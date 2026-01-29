
Contexto do erro (confirmado pelos logs)
- Todos os scrapers estão caindo no start por causa de:
  - `IndentationError: unexpected indent (mcgames_scraper.py, line 29)`
- O crash acontece antes do scraper rodar de fato, durante:
  - `run_scraper.py -> get_scraper_class() -> from scrapers import (...) -> scrapers/__init__.py -> import mcgames_scraper`
- Isso confirma a “fragilidade de importação”: um único arquivo quebrado derruba TODOS os scrapers.

Observação importante (causa do “ainda está com erro” mesmo após o diff)
- O seu PM2/VPS está executando caminhos como:
  - `/root/Desktop/scraper/standalone/run_scraper.py`
  - `/root/Desktop/scraper/scrapers/mcgames_scraper.py`
- No projeto aqui, os arquivos estão em `docs/scraper/...`.
- Então existem dois cenários:
  1) Você ainda não aplicou/atualizou no VPS a versão corrigida (git pull no repo certo / pasta certa), ou
  2) O VPS usa uma cópia “flatten” (sem `docs/`) e a correção precisa ser aplicada naquele arquivo também.
- Mesmo corrigindo a indentação aqui, o VPS continuará falhando enquanto o arquivo “rodando de verdade” lá ainda tiver o erro.

Objetivos
1) Corrigir definitivamente o `mcgames_scraper.py` para não gerar IndentationError/TabError.
2) Eliminar a fragilidade: impedir que “um scraper com erro” derrube todos os outros na fase de import.
3) Criar um procedimento de verificação rápida para você confirmar no VPS antes de religar tudo.

Plano de implementação (no repositório do projeto)
A) Corrigir o arquivo `mcgames_scraper.py` (robusto contra tabs/espaços)
Arquivos:
- `docs/scraper/scrapers/mcgames_scraper.py`

Ações:
1) Garantir que `LEAGUES = {` esteja com indentação correta (4 espaços dentro da classe).
2) Remover tabs invisíveis dentro do bloco do dicionário (há uma linha com tab visível no arquivo exibido: a chave `"champions_league"` está com um caractere de tab; isso pode causar erro de indentação/tab em ambientes diferentes).
3) Padronizar todas as linhas do dicionário para:
   - mesma indentação (apenas espaços)
   - sem tabs
4) (Opcional mas recomendado) Rodar um “lint mínimo” de whitespace:
   - garantir newline no fim do arquivo
   - garantir que não há caracteres estranhos antes do `LEAGUES`

Resultado esperado:
- Import do `mcgames_scraper.py` não falha mais em nenhum Python/terminal/PM2.

B) Remover a causa sistêmica: parar de importar todos os scrapers no start
Arquivos:
- `docs/scraper/standalone/run_scraper.py`
- (opcional) `docs/scraper/scrapers/__init__.py`

Problema atual:
- `get_scraper_class()` faz `from scrapers import (…McgamesScraper…)`, que força o import de `scrapers/__init__.py` e, por consequência, importa todos os scrapers.
- Se 1 arquivo tiver erro de sintaxe/indentação, tudo cai.

Solução proposta (mais segura):
1) Trocar `get_scraper_class()` para usar import “lazy” com `importlib`:
   - mapear `scraper_name -> (module_path, class_name)`
   - importar apenas o módulo daquele scraper solicitado
2) Evitar `from scrapers import (...)` completamente dentro do runner.

Exemplo do que o runner passaria a fazer (conceito):
- `"superbet" -> ("scrapers.superbet_scraper", "SuperbetScraper")`
- `"bet365" -> ("scrapers.bet365_scraper", "Bet365Scraper")`
- `"mcgames" -> ("scrapers.mcgames_scraper", "McgamesScraper")`
- etc.

Vantagem:
- Se “mcgames” quebrar, apenas `--scraper mcgames` falha.
- `superbet`, `bet365`, `stake` continuam subindo.

3) (Opcional) Simplificar `docs/scraper/scrapers/__init__.py` para não importar tudo automaticamente (deixar só docstring e `__all__` ou até vazio). Isso reduz a chance de alguém reintroduzir o problema no futuro.

C) Checklist de validação (para evitar “restart em loop” em massa)
Após implementar as mudanças no repo, validar localmente (ou no próprio VPS) com:
1) “compilação” rápida do(s) arquivo(s):
   - `python -m py_compile scrapers/mcgames_scraper.py` (no VPS, no caminho real que ele usa)
2) teste de import direto do scraper:
   - `python -c "from scrapers.mcgames_scraper import McgamesScraper; print('ok')"`
3) teste do runner importando apenas o scraper desejado (depois do lazy import):
   - `python standalone/run_scraper.py --scraper superbet --interval 30 --debug` (deve iniciar sem puxar todos)

Plano de aplicação no VPS (passo a passo, sem “chute”)
Como o log mostra caminhos sem `docs/`, o procedimento no VPS deve confirmar o arquivo correto:

1) Confirmar qual arquivo o VPS realmente está usando:
   - conferir o path exato do erro (você já tem: `/root/Desktop/scraper/scrapers/mcgames_scraper.py`)
2) Ver o conteúdo real da linha 29 no VPS e detectar tabs invisíveis:
   - imprimir trecho do arquivo com visualização de whitespace (para ver tabs)
3) Aplicar a correção no arquivo “real” do VPS (via git pull no repo certo ou edit direto)
4) Reiniciar com limpeza:
   - `pm2 restart all` (ou `pm2 delete all && pm2 start ecosystem.config.js` se o PM2 estiver preso em config antiga)
5) Confirmar que ao menos 1 processo sobe estável:
   - `pm2 logs scraper-superbet --lines 50` (não pode ter traceback)
   - `pm2 status` (uptime subindo, não reiniciando a cada segundo)

Entregáveis quando você aprovar este plano
1) Ajuste no `docs/scraper/scrapers/mcgames_scraper.py` removendo tabs e normalizando indentação do bloco `LEAGUES`.
2) Refactor do `docs/scraper/standalone/run_scraper.py` para lazy import via `importlib`, importando somente o scraper solicitado.
3) (Opcional) Ajuste no `docs/scraper/scrapers/__init__.py` para não importar todos os scrapers automaticamente.
4) Checklist de comandos para você validar no VPS e parar o “restart em loop” mesmo se outro scraper quebrar no futuro.
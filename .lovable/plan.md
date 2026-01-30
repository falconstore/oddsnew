
Objetivo: parar os crashes do PM2 imediatamente corrigindo o `IndentationError` no `run_scraper.py` (isso está impedindo TODOS os scrapers de subirem, inclusive o superbet).

## Diagnóstico (confirmado no código)
No arquivo `docs/scraper/standalone/run_scraper.py`, dentro de `parse_args()`, a linha do `--debug` está fora do bloco por falta de indentação:

- Linha 219 está assim (errado):
  - `parser.add_argument(` (sem os 4 espaços)
- Isso causa:
  - `IndentationError: unexpected indent`
  - `IndentationError: unindent does not match any outer indentation level`
  - Os dois erros podem aparecer alternados quando há mistura de tabs/spaces ou quando a estrutura de blocos fica inválida.

## Correção (rápida e definitiva)
### 1) Reescrever/normalizar o bloco `parse_args()` com indentação consistente (4 espaços)
Substituir o trecho inteiro da função `parse_args()` por uma versão “limpa”, garantindo que:
- Todas as chamadas `parser.add_argument(...)` estejam com exatamente 4 espaços dentro de `parse_args()`
- Não exista TAB no arquivo (somente espaços)

O bloco correto deve ficar estruturalmente assim (exemplo fiel ao seu arquivo, só corrigindo indentação):

```python
def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Standalone Scraper Runner - Roda um único scraper em loop infinito"
    )

    parser.add_argument(
        "--scraper",
        required=True,
        help="Nome do scraper (ex: betano, superbet, bet365)"
    )

    parser.add_argument(
        "--interval",
        type=int,
        default=30,
        help="Intervalo entre ciclos em segundos (default: 30)"
    )

    parser.add_argument(
        "--debug",
        action="store_true",
        help="Ativar logging de debug"
    )

    parser.add_argument(
        "--initial-delay",
        type=int,
        default=0,
        help="Segundos para aguardar antes do primeiro ciclo (escalonamento)"
    )

    return parser.parse_args()
```

Por que reescrever o bloco inteiro: quando a VPS fica com um mix de TABs e espaços (ou edições parciais via terminal), corrigir “só uma linha” às vezes não remove a causa do `unindent does not match...`. Reescrever garante que o Python pare de reclamar.

### 2) Aplicar a correção no arquivo que a VPS realmente executa
Pelos logs, a VPS está rodando:
- `/root/Desktop/scraper/standalone/run_scraper.py`

Então a correção precisa estar exatamente nesse arquivo também (mesmo que no Lovable esteja em `docs/scraper/standalone/run_scraper.py`).

### 3) Validar sintaxe antes de reiniciar tudo
Rodar na VPS (na pasta onde está o arquivo):
- `python3 -m py_compile standalone/run_scraper.py`

Critério de sucesso:
- comando não imprime nada e retorna exit code 0

### 4) Reiniciar PM2 de forma limpa
Depois do `py_compile` ok:
- `pm2 restart all`
ou, se estiver muito “sujo” de restarts:
- `pm2 stop all`
- `pm2 delete all`
- `pm2 start ecosystem.config.js`
- `pm2 save`

### 5) Verificação pós-fix (rápida)
- `pm2 status` (todos online)
- `pm2 logs scraper-superbet --lines 50` (sem IndentationError)
- `htop` por 2-3 minutos para confirmar que agora o escalonamento vai surtir efeito (sem crashes repetidos).

## Risco/impacto
- Zero mudança de lógica de scraping; só corrige parsing de argumentos.
- Alta urgência e baixo risco: sem isso, o escalonamento nem chega a rodar porque o runner não inicia.

## Observação importante
Você está vendo o erro no `scraper-superbet`, mas não é “erro do superbet”: é o runner `run_scraper.py` falhando ao iniciar, então QUALQUER processo que usa ele vai cair igual.


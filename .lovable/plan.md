

# Reescrever Jogo de Ouro com Captura Dinamica de Token (Padrao Mcgames)

## Diagnostico

O scraper atual da Jogo de Ouro le um token de um arquivo (`jogodeouro_token.txt`) que foi capturado no seu Mac. A API Altenar valida o token contra o IP de origem, entao quando o VPS tenta usar esse token, recebe 403.

A Mcgames usa o mesmo backend Altenar e funciona perfeitamente porque captura o token **dinamicamente via Playwright** direto no VPS. O token e gerado para o IP do VPS e funciona imediatamente.

## Solucao

Reescrever `docs/scraper/scrapers/jogodeouro_scraper.py` usando o padrao identico ao `mcgames_unified_scraper.py`:

1. **Playwright captura o token**: Abre o site jogodeouro.bet.br no Chromium headless, intercepta as requests para `biahosted.com/api` e extrai o header `authorization`
2. **curl_cffi faz as requests da API**: Usa o token capturado para chamar `GetEvents` com o `integration=jogodeouro`
3. **Football + NBA unificado**: Scrape de futebol (1x2, typeId=1) e NBA (moneyline, typeId=219) na mesma sessao

## Mudancas Principais

### Arquivo: `docs/scraper/scrapers/jogodeouro_scraper.py` (reescrita completa)

O que muda em relacao ao codigo atual:

| Antes (Token Estatico) | Depois (Playwright Dinamico) |
|---|---|
| Le token de `jogodeouro_token.txt` | Captura token via Playwright no VPS |
| Token do Mac, IP incompativel | Token gerado no IP do VPS |
| Sem suporte NBA | Football + NBA unificado |
| `AsyncSession` com headers fixos | Headers dinamicos com UA do Playwright |
| Sem retry de token | Invalida token em 403, recaptura proximo ciclo |

Estrutura do novo scraper (baseado no McgamesUnifiedScraper):

- Classe `JogodeOuroUnifiedScraper` herda `BaseScraper`
- `INTEGRATION = "jogodeouro"` (em vez de `mcgames2`)
- `WARMUP_URLS` apontando para `jogodeouro.bet.br/sports/futebol/italia/serie-a/c-2942`
- `origin` e `referer` para `jogodeouro.bet.br`
- `bookmaker_name = "jogodeouro"` nos ScrapedOdds
- Mesmas ligas de futebol + NBA (champ_id="2980")
- Metodo `scrape_all()` que faz setup, scrape football, scrape NBA, teardown
- Metodo `_fetch_league_data()` com tratamento de 403 (invalida token)
- Metodo `_scrape_football_league()` (typeId=1, 1x2)
- Metodo `_scrape_basketball_league()` (typeId=219, moneyline)

### Nenhum outro arquivo precisa ser alterado

Os runners (`run_sequential.py` e `run_scraper.py`) ja apontam para:
```python
"jogodeouro": ("scrapers.jogodeouro_scraper", "JogodeOuroUnifiedScraper")
```

A classe continua sendo `JogodeOuroUnifiedScraper`, entao nao ha quebra de importacao.

## Deploy

```
1. git pull no VPS
2. pm2 restart scraper-hybrid (ou scraper-jogodeouro se estiver standalone)
3. Verificar logs: pm2 logs scraper-jogodeouro --lines 20
4. Deve aparecer: "[JogodeOuro] Token captured via request interception"
5. Seguido de: "[JogodeOuro] Serie A: XX odds"
```

O arquivo `jogodeouro_token.txt` nao sera mais necessario.


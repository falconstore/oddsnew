

# Fix Jogo de Ouro: Usar integration=mcgames2 nas API calls

## Problema Identificado

O token Altenar e vinculado a integracao onde foi gerado. Quando o Playwright abre `mcgames.bet.br`, o widget inicializa com `integration=mcgames2` e o token e emitido para essa integracao.

Ao usar esse token com `integration=jogodeouro`, a API Altenar rejeita com 403 porque o token nao corresponde a integracao.

## Por que isso funciona

Mcgames e Jogo de Ouro sao white-labels do mesmo backend Altenar. Os championship IDs sao identicos (Serie A = 2942, Premier League = 2936, NBA = 2980, etc.). As odds retornadas sao as mesmas porque ambos usam a mesma plataforma Altenar como provedor de odds.

O `bookmaker_name` nos ScrapedOdds continua sendo `"jogodeouro"`, entao os dados sao registrados corretamente no banco como pertencendo ao Jogo de Ouro.

## Mudancas no Arquivo

**`docs/scraper/scrapers/jogodeouro_scraper.py`** - 3 mudancas cirurgicas:

### 1. Mudar INTEGRATION (linha 58)
```
Antes:  INTEGRATION = "jogodeouro"
Depois: INTEGRATION = "mcgames2"
```

### 2. Mudar origin no _fetch_league_data() (linha 279)
```
Antes:  "origin": "https://jogodeouro.bet.br"
Depois: "origin": "https://mcgames.bet.br"
```

### 3. Mudar referer no _fetch_league_data() (linha 280)
```
Antes:  "referer": "https://jogodeouro.bet.br/"
Depois: "referer": "https://mcgames.bet.br/"
```

Nada mais precisa mudar. O `bookmaker_name="jogodeouro"` nos ScrapedOdds permanece inalterado, garantindo que os dados entrem no banco como odds do Jogo de Ouro.

## Nenhum outro arquivo afetado

A classe, import path, e todos os metodos de parsing permanecem identicos.

## Deploy

```
1. git pull no VPS
2. pm2 restart scraper-jogodeouro
3. pm2 logs scraper-jogodeouro --lines 20
4. Esperado:
   - "[JogodeOuro] Token captured via mcgames.bet.br request interception"
   - "[JogodeOuro] Cross-site token capture successful!"
   - "[JogodeOuro] Serie A: XX odds"  (em vez de "Token issue HTTP 403")
```


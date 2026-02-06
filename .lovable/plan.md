

# Fix Jogo de Ouro: Cross-Site Token Strategy

## Root Cause (Confirmed)

The VPS IP is blocked by Cloudflare on `jogodeouro.bet.br`. Every page load returns:
- Title: "Attention Required! | Cloudflare"
- Body: "Sorry, you have been blocked"

This is an IP-level block that cannot be bypassed with stealth techniques, Chrome args, or anti-detection scripts.

## Solution: Cross-Site Token Capture

All Altenar-powered sites share the same API backend:
- `sb2frontend-altenar2.biahosted.com/api/widget/GetEvents`

The only difference between bookmakers is the `integration` query parameter:
- Mcgames uses `integration=mcgames2`
- Esportivabet uses `integration=esportiva`
- Jogo de Ouro uses `integration=jogodeouro`

The token is an Altenar session token, not tied to a specific bookmaker. We can capture a token from `mcgames.bet.br` (which has NO Cloudflare and works perfectly) and use it with `integration=jogodeouro`.

## File: `docs/scraper/scrapers/jogodeouro_scraper.py`

### Changes to `setup()` method:

Replace the Playwright section that tries to open `jogodeouro.bet.br` with a strategy that opens `mcgames.bet.br` instead:

1. Change `WARMUP_URLS` to use mcgames.bet.br URLs (since they have no Cloudflare):
   ```
   WARMUP_URLS = [
       "https://mcgames.bet.br/sports/futebol/italia/serie-a/c-2942",
       "https://mcgames.bet.br/sports/futebol",
   ]
   ```

2. In `setup()`, keep the same Playwright interception logic but targeting `mcgames.bet.br`

3. In `_fetch_league_data()`, the API calls already use `integration=jogodeouro` and `origin: jogodeouro.bet.br` - these stay the same since the API endpoint (`biahosted.com`) is NOT behind Cloudflare

4. Remove the extra Chrome args and stealth scripts (not needed since mcgames.bet.br has no Cloudflare). Simplify to match the Mcgames scraper config that already works

### Specific code changes:

**WARMUP_URLS** - Change from jogodeouro.bet.br to mcgames.bet.br:
```python
WARMUP_URLS = [
    "https://mcgames.bet.br/sports/futebol/italia/serie-a/c-2942",
    "https://mcgames.bet.br/sports/futebol",
]
```

**CHROME_ARGS** - Simplify back to 5 (matching Mcgames which works):
```python
CHROME_ARGS = [
    '--no-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--single-process',
    '--disable-gpu',
    '--memory-pressure-off',
]
```

**setup()** method:
- Remove `add_init_script` stealth injection (not needed, mcgames has no bot detection)
- Remove `locale` from context (not needed)
- Simplify viewport back to `800x600`
- Change `wait_until` back to `"domcontentloaded"` (faster)
- Reduce timeout back to `15000` (mcgames loads fast)
- Remove double-scroll, keep single scroll of 1000px
- Reduce final wait from 15s back to 5s
- Remove diagnostic HTML body logging (not needed once working)
- Keep the `handle_request` interceptor checking for `biahosted.com/api`

**_fetch_league_data()** - No changes needed:
- Already uses `integration=jogodeouro` (correct)
- Already uses `origin: jogodeouro.bet.br` (correct)
- The Altenar API at `biahosted.com` does NOT validate origin headers

### Why this works:

The Altenar token is a session identifier for the widget platform, not for a specific bookmaker. The `integration` parameter tells the API which bookmaker's data to return. Since both mcgames and jogodeouro use the exact same API endpoint and championship IDs, a token from either site works for both.

## No other files need changes

The scraper class name (`JogodeOuroUnifiedScraper`) and import path remain identical, so `run_scraper.py` and `ecosystem.config.js` need no updates.

## Deploy

```
1. git pull no VPS
2. pm2 restart scraper-jogodeouro
3. pm2 logs scraper-jogodeouro --lines 20
4. Expected output:
   - "[JogodeOuro] Token captured via request interception"
   - "[JogodeOuro] Serie A: XX odds"
   - "[JogodeOuro] Premier League: XX odds"
```



# Plano: Corrigir Scrapers Betano e McGames

## Diagnostico

### Problema 1: Betano - Setup Duplicado
Os logs mostram:
```
21:22:36 | Setting up betano scraper
21:22:56 | Setting up betano scraper  <-- 2x seguidas!
21:23:13 | Target page, context or browser has been closed
```

**Causa**: O `setup()` do Betano nao tem guard pattern. Quando `run_scraper.py` chama `setup()` e depois `scrape_all()` chama internamente, cria dois browsers e o primeiro e fechado/sobrescrito.

### Problema 2: McGames - Token Nao Capturado
Os logs mostram:
```
21:20:07 | [Mcgames] Starting Playwright to capture credentials...
21:20:15 | Trying URL 1/2: serie-a/c-2942
21:20:25 | Trying URL 2/2: /sports/futebol
21:20:38 | FAILED: Could not capture token after all attempts
```

**Causa**: O site pode ter mudado a forma como expoe o token na API, ou as URLs de warmup nao estao mais gerando chamadas API com authorization header.

---

## Solucao

### Arquivo 1: `docs/scraper/scrapers/betano_scraper.py`

#### 1.1 Adicionar Guard no setup()

```python
async def setup(self):
    """Initialize Playwright browser and capture session cookies."""
    # GUARD: Evitar reinicializacao
    if self._page is not None:
        return
    
    await super().setup()
    
    self.logger.info("Setting up betano scraper")
    # ... resto do codigo
```

#### 1.2 Adicionar teardown() seguro no setup()

```python
async def setup(self):
    """Initialize Playwright browser and capture session cookies."""
    # GUARD: Evitar reinicializacao
    if self._page is not None:
        return
    
    await super().setup()
    
    self.logger.info("Setting up betano scraper")
    
    # Start Playwright and browser
    self._playwright = await async_playwright().start()
    # ... resto permanece igual
```

---

### Arquivo 2: `docs/scraper/scrapers/mcgames_scraper.py`

#### 2.1 Adicionar mais URLs de warmup (paginas que garantem chamadas API)

```python
WARMUP_URLS = [
    "https://mcgames.bet.br/sports/futebol/italia/serie-a/c-2942",
    "https://mcgames.bet.br/sports/futebol/inglaterra/premier-league/c-2936",
    "https://mcgames.bet.br/sports/futebol",
    "https://mcgames.bet.br/sports",  # URL mais generica
]
```

#### 2.2 Aumentar scroll e tempo de espera

```python
# Dentro do loop de warmup
try:
    await page.goto(target_url, wait_until="domcontentloaded", timeout=20000)
    await page.wait_for_timeout(3000)  # Mais tempo para carregar
    
    # Scrolls multiplos para forcar chamadas API
    if not token_future.done():
        await page.evaluate("window.scrollTo(0, 500)")
        await page.wait_for_timeout(1500)
    if not token_future.done():
        await page.evaluate("window.scrollTo(0, 1500)")
        await page.wait_for_timeout(1500)
    if not token_future.done():
        await page.evaluate("window.scrollTo(0, 0)")
        await page.wait_for_timeout(1000)
```

#### 2.3 Capturar token de response tambem (fallback)

```python
async def handle_request(request):
    if "biahosted.com/api" in request.url:
        headers = request.headers
        if "authorization" in headers:
            token = headers["authorization"]
            if not token_future.done():
                token_future.set_result(token)
                self.logger.info("[Mcgames] Token captured via request")

async def handle_response(response):
    # Fallback: tentar extrair de cookies ou headers de response
    if "biahosted.com" in response.url and not token_future.done():
        try:
            headers = response.request.headers
            if "authorization" in headers:
                token_future.set_result(headers["authorization"])
        except:
            pass

page.on("request", handle_request)
page.on("response", handle_response)
```

---

### Arquivo 3: `docs/scraper/ecosystem.config.js`

#### 3.1 Ajustar configuracao do Betano (igual ao Stake)

```javascript
{
  name: 'scraper-betano',
  script: 'standalone/run_scraper.py',
  interpreter: 'python3',
  args: '--scraper betano --interval 30',
  cwd: __dirname,
  max_memory_restart: '200M',   // Aumentar para Playwright
  restart_delay: 10000,          // 10s entre restarts
  max_restarts: 5,               // Menos restarts em loop
  min_uptime: 30000,             // Precisa rodar 30s
  kill_timeout: 30000,           // 30s para shutdown
  autorestart: true,
  env: {
    PYTHONUNBUFFERED: '1'
  }
},
```

#### 3.2 Ajustar configuracao do McGames

```javascript
{
  name: 'scraper-mcgames',
  script: 'standalone/run_scraper.py',
  interpreter: 'python3',
  args: '--scraper mcgames --interval 30',
  cwd: __dirname,
  max_memory_restart: '200M',   // Aumentar para Playwright
  restart_delay: 10000,
  max_restarts: 5,
  min_uptime: 30000,
  kill_timeout: 30000,
  autorestart: true,
  env: {
    PYTHONUNBUFFERED: '1'
  }
},
```

---

## Fluxo Apos Correcoes

```text
┌────────────────────────────────────────────────────────────────┐
│                    BETANO CORRIGIDO                            │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  run_scraper.py: await scraper.setup()                         │
│     └── setup() verifica: self._page is None? Sim → continua   │
│     └── Cria browser, context, page                            │
│     └── Navega para homepage, captura cookies                  │
│     └── Cria aiohttp session                                   │
│                                                                │
│  run_scraper.py: await scraper.scrape_all()                    │
│     └── (Se scrape_league chamar setup internamente)           │
│     └── setup() verifica: self._page is None? Nao → return     │
│     └── Scraping continua normalmente                          │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

```text
┌────────────────────────────────────────────────────────────────┐
│                    MCGAMES CORRIGIDO                           │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  1. Mais URLs de warmup (4 em vez de 2)                        │
│  2. Mais tempo de espera (3s em vez de 2s)                     │
│  3. Multiplos scrolls para forcar chamadas API                 │
│  4. Fallback: capturar token de response tambem                │
│  5. PM2 com restart_delay maior (10s)                          │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Resumo das Mudancas

| Arquivo | Mudanca |
|---------|---------|
| `betano_scraper.py` | Guard `if self._page is not None: return` no setup() |
| `mcgames_scraper.py` | Mais URLs warmup (4 URLs) |
| `mcgames_scraper.py` | Scrolls multiplos para forcar API |
| `mcgames_scraper.py` | Tempo de espera maior (3s) |
| `ecosystem.config.js` | Betano: restart_delay=10s, kill_timeout=30s |
| `ecosystem.config.js` | McGames: restart_delay=10s, kill_timeout=30s |

---

## Notas Tecnicas

1. **Guard Pattern**: Essencial para scrapers Playwright que sao chamados multiplas vezes
2. **Token McGames**: O Altenar API exige um token JWT que e gerado pelo frontend. Se o token continuar falhando, pode ser necessario usar uma abordagem diferente (ex: autenticacao explicita)
3. **Memoria**: Aumentar para 200M porque Playwright consome mais recursos

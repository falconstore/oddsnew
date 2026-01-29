

# Plano: Migrar Stake Scraper para Playwright

## Problema Atual

O scraper Stake usa `httpx` com requisicoes diretas, mas a API da Stake esta bloqueando com **403 Forbidden**:

```
Client error '403 Forbidden' for url 'https://sbweb.stake.bet.br/api/v1/br/pt-br/tournament/.../live-upcoming'
```

Isso acontece porque:
1. Stake detecta que as requisicoes vem de servidor (nao browser)
2. Headers simples nao passam a protecao anti-bot
3. Falta de cookies de sessao validos

---

## Solucao: Abordagem Hibrida (Playwright + httpx)

Usar o mesmo padrao do Betano scraper:

```text
┌────────────────────────────────────────────────────────────┐
│                    FLUXO DE EXECUCAO                       │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  1. SETUP (uma vez por ciclo)                              │
│     ┌──────────────────┐                                   │
│     │   Playwright     │  Abre browser headless            │
│     │   (Chromium)     │  Navega ate stake.bet.br          │
│     │                  │  Captura cookies de sessao        │
│     └────────┬─────────┘                                   │
│              │                                             │
│              ▼                                             │
│     ┌──────────────────┐                                   │
│     │  Cookies válidos │  __cf_bm, cf_clearance, etc       │
│     └────────┬─────────┘                                   │
│              │                                             │
│  2. SCRAPING (multiplas requisicoes)                       │
│              ▼                                             │
│     ┌──────────────────┐                                   │
│     │     httpx        │  Usa cookies capturados           │
│     │   (rapido)       │  Faz requisicoes API              │
│     │                  │  Retorna JSON                     │
│     └──────────────────┘                                   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Mudancas no Arquivo

### Arquivo: `docs/scraper/scrapers/stake_scraper.py`

#### 1. Novos Imports

```python
# Antes
import httpx

# Depois
import httpx
from playwright.async_api import async_playwright, Browser, BrowserContext, Page
```

#### 2. Novos Atributos na Classe

```python
def __init__(self):
    super().__init__(name="stake", base_url="https://stake.bet.br")
    # Playwright
    self._playwright = None
    self._browser: Optional[Browser] = None
    self._context: Optional[BrowserContext] = None
    self._page: Optional[Page] = None
    # HTTP client
    self.client: Optional[httpx.AsyncClient] = None
    self._cookies: Dict[str, str] = {}
    self.logger = logger.bind(component="stake")
```

#### 3. Novo Metodo setup() com Playwright

```python
async def setup(self):
    """Initialize Playwright browser and capture session cookies."""
    self.logger.info("[Stake] Iniciando browser Playwright...")
    
    # Start Playwright
    self._playwright = await async_playwright().start()
    self._browser = await self._playwright.chromium.launch(
        headless=True,
        args=[
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
        ]
    )
    
    # Create browser context
    self._context = await self._browser.new_context(
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        locale="pt-BR",
        timezone_id="America/Sao_Paulo",
        viewport={"width": 1920, "height": 1080},
    )
    
    self._page = await self._context.new_page()
    
    # Navigate to site to get valid cookies
    self.logger.info("[Stake] Navegando para capturar cookies...")
    try:
        await self._page.goto("https://stake.bet.br/pt-br/sports/", wait_until="domcontentloaded", timeout=30000)
        await self._page.wait_for_timeout(3000)  # Wait for anti-bot JS
    except Exception as e:
        self.logger.warning(f"[Stake] Aviso no carregamento inicial: {e}")
    
    # Capture cookies
    cookies = await self._context.cookies()
    self._cookies = {c["name"]: c["value"] for c in cookies}
    self.logger.info(f"[Stake] Capturados {len(self._cookies)} cookies")
    
    # Create httpx client with captured cookies
    cookie_header = "; ".join([f"{k}={v}" for k, v in self._cookies.items()])
    
    self.client = httpx.AsyncClient(
        timeout=30.0,
        headers={
            "Accept": "application/json",
            "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
            "Referer": "https://stake.bet.br/",
            "Origin": "https://stake.bet.br",
            "Cookie": cookie_header,
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        }
    )
```

#### 4. Novo Metodo teardown() Seguro

```python
async def teardown(self):
    """Close HTTP client and Playwright browser safely."""
    # Close httpx
    if self.client:
        await self.client.aclose()
    self.client = None
    
    # Close Playwright components safely
    try:
        if self._page:
            await self._page.close()
    except Exception:
        pass
    self._page = None
    
    try:
        if self._context:
            await self._context.close()
    except Exception:
        pass
    self._context = None
    
    try:
        if self._browser:
            await self._browser.close()
    except Exception:
        pass
    self._browser = None
    
    try:
        if self._playwright:
            await self._playwright.stop()
    except Exception:
        pass
    self._playwright = None
    
    self._cookies = {}
    self.logger.info("[Stake] Recursos liberados")
```

---

## Resumo da Mudanca

| Componente | Antes | Depois |
|------------|-------|--------|
| Setup | httpx simples | Playwright + httpx com cookies |
| Cookies | Nenhum | Capturados do browser |
| Anti-bot | Bloqueado (403) | Bypassado |
| Teardown | Simples | Seguro com try/except |
| Resto do codigo | Sem mudanca | Sem mudanca |

---

## Resultado Esperado

Apos a mudanca:

```
[Stake] Iniciando browser Playwright...
[Stake] Navegando para capturar cookies...
[Stake] Capturados 15 cookies
[Stake] Premier League: 5 SO + 5 PA = 10 total
[Stake] La Liga: 3 SO + 3 PA = 6 total
...
[Stake] Total: 80 odds coletadas
```

---

## Notas Tecnicas

1. **Playwright ja instalado**: O Betano e Betbra ja usam, entao a dependencia existe
2. **Memoria**: Playwright usa mais RAM (~100-150MB vs ~50MB httpx), mas e aceitavel
3. **Tempo de setup**: Adiciona ~5-10s no inicio de cada ciclo para carregar browser
4. **Cookies renovados**: A cada ciclo os cookies sao renovados, evitando expiracao


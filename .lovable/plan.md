
# Plano: Otimizar Stake Scraper com 10 Abas Paralelas

## Problemas Identificados

1. **Setup duplicado**: `run_scraper.py` chama `scraper.setup()` na linha 150, e `scrape_all()` chama novamente na linha 184. Isso causa multiplos browsers e `TargetClosedError`.

2. **Requisicoes sequenciais**: Cada chamada `page.goto()` leva ~500ms. Com 14 ligas de futebol + 1 NBA, e cada liga com ~10 eventos precisando de requisicoes PA individuais, o ciclo demora muito.

3. **Conflito entre processos**: Os logs mostram dois ciclos rodando em paralelo (timestamps intercalados), indicando que o PM2 reinicia o processo enquanto o anterior ainda esta rodando.

---

## Solucao: Pool de Paginas + Guard no Setup

```text
┌────────────────────────────────────────────────────────────────┐
│                    ARQUITETURA OTIMIZADA                       │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  setup() (uma vez)                                             │
│     └── Cria 1 browser + 1 context + 10 paginas (pool)         │
│                                                                │
│  scrape_all()                                                  │
│     └── Usa pool de paginas para requisicoes paralelas         │
│         ├── Liga 1: pega pagina do pool → fetch → devolve      │
│         ├── Liga 2: pega pagina do pool → fetch → devolve      │
│         └── ... (ate 10 em paralelo)                           │
│                                                                │
│  _fetch_json_parallel(urls)                                    │
│     └── Distribui URLs entre as 10 paginas                     │
│     └── asyncio.gather() para executar em paralelo             │
│                                                                │
│  teardown()                                                    │
│     └── Fecha todas as paginas + context + browser             │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Mudancas no Arquivo

### Arquivo: `docs/scraper/scrapers/stake_scraper.py`

### 1. Adicionar Guard no setup() para Evitar Reinicializacao

```python
async def setup(self):
    """Initialize Playwright browser for API requests."""
    # GUARD: Evitar reinicializacao se ja esta pronto
    if self._page is not None:
        return
    
    self.logger.info("[Stake] Iniciando browser Playwright...")
    # ... resto do codigo
```

### 2. Adicionar Pool de Paginas

```python
def __init__(self):
    super().__init__(name="stake", base_url="https://stake.bet.br")
    # Playwright components
    self._playwright = None
    self._browser: Optional[Browser] = None
    self._context: Optional[BrowserContext] = None
    self._page: Optional[Page] = None
    # NOVO: Pool de paginas para requisicoes paralelas
    self._page_pool: List[Page] = []
    self._pool_semaphore: Optional[asyncio.Semaphore] = None
    self._pool_size = 10
    self.logger = logger.bind(component="stake")
```

### 3. Modificar setup() para Criar Pool

```python
async def setup(self):
    """Initialize Playwright browser with page pool."""
    if self._page is not None:
        return
    
    self.logger.info("[Stake] Iniciando browser Playwright...")
    
    # Start Playwright
    self._playwright = await async_playwright().start()
    self._browser = await self._playwright.chromium.launch(
        headless=True,
        args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    )
    
    self._context = await self._browser.new_context(
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:147.0) Gecko/20100101 Firefox/147.0",
        locale="pt-BR",
        timezone_id="America/Sao_Paulo",
        viewport={"width": 1920, "height": 1080},
    )
    
    # Pagina principal para compatibilidade
    self._page = await self._context.new_page()
    
    # NOVO: Criar pool de paginas
    self.logger.info(f"[Stake] Criando pool de {self._pool_size} paginas...")
    self._page_pool = []
    for _ in range(self._pool_size):
        page = await self._context.new_page()
        self._page_pool.append(page)
    
    self._pool_semaphore = asyncio.Semaphore(self._pool_size)
    
    # Estabelecer sessao na pagina principal
    self.logger.info("[Stake] Estabelecendo sessao...")
    try:
        await self._page.goto("https://stake.bet.br/pt-br/sports/", wait_until="domcontentloaded", timeout=30000)
        await self._page.wait_for_timeout(2000)
    except Exception as e:
        self.logger.warning(f"[Stake] Aviso no carregamento inicial: {e}")
    
    self.logger.info("[Stake] Browser pronto")
```

### 4. Novo Metodo para Requisicoes Paralelas

```python
async def _fetch_json_with_page(self, page: Page, url: str) -> Dict[str, Any]:
    """Fetch JSON using a specific page from pool."""
    try:
        response = await page.goto(url, wait_until="domcontentloaded", timeout=15000)
        
        if not response or response.status != 200:
            return {}
        
        await page.wait_for_timeout(200)
        content = await page.evaluate("() => document.body.innerText")
        
        if content:
            return json.loads(content)
        return {}
        
    except Exception:
        return {}

async def _fetch_parallel(self, urls: List[str]) -> List[Dict[str, Any]]:
    """Fetch multiple URLs in parallel using page pool."""
    if not urls:
        return []
    
    results = [None] * len(urls)
    
    async def fetch_one(idx: int, url: str):
        async with self._pool_semaphore:
            page = self._page_pool[idx % self._pool_size]
            results[idx] = await self._fetch_json_with_page(page, url)
    
    await asyncio.gather(*[fetch_one(i, url) for i, url in enumerate(urls)])
    return results
```

### 5. Otimizar _fetch_all_pa_odds para Usar Paralelismo

```python
async def _fetch_all_pa_odds(self, event_ids: List[str]) -> Dict[str, Dict[int, float]]:
    """Fetch PA odds for all events in parallel."""
    if not event_ids:
        return {}
    
    # Construir URLs
    urls = [f"{self.API_BASE}/events/{eid}/odds" for eid in event_ids]
    
    # Buscar em paralelo
    responses = await self._fetch_parallel(urls)
    
    # Processar resultados
    results = {}
    for event_id, data in zip(event_ids, responses):
        if not data:
            continue
        
        odds_map = {}
        for odd in data.get("odds", []):
            if odd.get("marketId") != self.MARKET_PA:
                continue
            
            column_id = odd.get("columnId")
            odd_values = odd.get("oddValues") or {}
            odd_value = odd_values.get("decimal") if isinstance(odd_values, dict) else None
            
            if column_id is not None and odd_value:
                odds_map[column_id] = float(odd_value)
        
        if odds_map:
            results[event_id] = odds_map
    
    return results
```

### 6. Remover setup() de scrape_all()

```python
async def scrape_all(self) -> List[ScrapedOdds]:
    """Scrape all leagues for both sports using Playwright."""
    all_odds = []
    # REMOVIDO: await self.setup() - run_scraper.py ja faz isso
    
    try:
        # Football (SO + PA)
        for league_id, config in self.FOOTBALL_LEAGUES.items():
            try:
                odds = await self._scrape_football(config)
                all_odds.extend(odds)
            except Exception as e:
                self.logger.error(f"[Stake] Erro na liga {config['name']}: {e}")
        
        # Basketball (Moneyline)
        for league_id, config in self.BASKETBALL_LEAGUES.items():
            try:
                odds = await self._scrape_basketball(config)
                all_odds.extend(odds)
            except Exception as e:
                self.logger.error(f"[Stake] Erro na liga {config['name']}: {e}")
                
    except Exception as e:
        self.logger.error(f"[Stake] Erro geral: {e}")
        raise
    
    # REMOVIDO: finally teardown() - run_scraper.py gerencia o ciclo de vida
    
    self.logger.info(f"[Stake] Total: {len(all_odds)} odds coletadas")
    return all_odds
```

### 7. Atualizar teardown() para Limpar Pool

```python
async def teardown(self):
    """Close Playwright browser and page pool safely."""
    # Fechar pool de paginas
    for page in self._page_pool:
        try:
            await page.close()
        except Exception:
            pass
    self._page_pool = []
    self._pool_semaphore = None
    
    # Fechar pagina principal
    try:
        if self._page:
            await self._page.close()
    except Exception:
        pass
    self._page = None
    
    # Fechar context, browser, playwright
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
    
    self.logger.info("[Stake] Recursos liberados")
```

---

## Impacto na Performance

| Metrica | Antes (Sequencial) | Depois (10 Paralelas) |
|---------|--------------------|-----------------------|
| Requisicoes PA por liga | ~500ms x N eventos | ~500ms total (paralelo) |
| Tempo por liga (10 eventos) | ~5s | ~0.5s |
| Tempo total (14 ligas) | ~70s | ~7-10s |
| Uso de memoria | ~150MB | ~250MB (+100MB) |

---

## Resumo das Mudancas

1. **Guard no setup()**: Evita reinicializacao duplicada
2. **Pool de 10 paginas**: Permite ate 10 requisicoes simultaneas
3. **_fetch_parallel()**: Novo metodo para distribuir URLs entre paginas
4. **Remover setup/teardown de scrape_all()**: `run_scraper.py` gerencia o ciclo de vida
5. **Manter browser aberto**: Entre ciclos, so reinicia se houver erro

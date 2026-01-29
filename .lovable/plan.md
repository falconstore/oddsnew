
# Plano: Stake Scraper com Requisicoes via Playwright

## Diagnostico Atualizado

Os headers que funcionaram mostram:

| Header | Valor | Significado |
|--------|-------|-------------|
| Sec-Fetch-Mode | navigate | Requisicao de navegacao (nao XHR) |
| Sec-Fetch-Dest | document | Carregando como documento |
| Sec-Fetch-Site | none | Requisicao direta (nao cross-origin) |

A API aceita requisicoes de navegacao mas bloqueia XHR/fetch cross-origin (que e o que httpx faz).

---

## Solucao: Usar page.goto() do Playwright

Em vez de usar httpx para chamar a API, vamos usar o Playwright para navegar diretamente para as URLs da API e extrair o JSON.

```text
┌─────────────────────────────────────────────────────────────┐
│                    FLUXO SIMPLIFICADO                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  TUDO VIA PLAYWRIGHT (sem httpx)                            │
│                                                             │
│  1. page.goto("/tournament/{id}/live-upcoming")             │
│     └── Retorna JSON com lista de eventos                   │
│                                                             │
│  2. page.goto("/events/{id}/odds") para cada evento         │
│     └── Retorna JSON com odds                               │
│                                                             │
│  3. Parsear JSON diretamente do DOM                         │
│     └── page.content() ou page.evaluate()                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Mudancas no Arquivo

### Arquivo: `docs/scraper/scrapers/stake_scraper.py`

#### 1. Remover httpx (nao precisa mais)

```python
# ANTES
self.client = httpx.AsyncClient(...)
response = await self.client.get(url)
data = response.json()

# DEPOIS
await self._page.goto(url, wait_until="domcontentloaded")
content = await self._page.content()
# Extrair JSON do body
```

#### 2. Novo Metodo para Requisicoes via Playwright

```python
async def _fetch_json(self, url: str) -> Dict[str, Any]:
    """Fetch JSON data by navigating to URL with Playwright."""
    try:
        response = await self._page.goto(url, wait_until="domcontentloaded", timeout=15000)
        
        if response and response.status == 200:
            # Extract JSON from page body
            content = await self._page.evaluate("() => document.body.innerText")
            return json.loads(content)
        else:
            self.logger.debug(f"[Stake] Status {response.status if response else 'None'} para {url}")
            return {}
            
    except Exception as e:
        self.logger.debug(f"[Stake] Erro ao buscar {url}: {e}")
        return {}
```

#### 3. Simplificar setup() - Remover httpx

```python
async def setup(self):
    """Initialize Playwright browser only."""
    self.logger.info("[Stake] Iniciando browser Playwright...")
    
    self._playwright = await async_playwright().start()
    self._browser = await self._playwright.chromium.launch(
        headless=True,
        args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    )
    
    # Usar Firefox user-agent (funciona melhor)
    self._context = await self._browser.new_context(
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:147.0) Gecko/20100101 Firefox/147.0",
        locale="pt-BR",
        timezone_id="America/Sao_Paulo",
        viewport={"width": 1920, "height": 1080},
    )
    
    self._page = await self._context.new_page()
    
    # Navegar para o site primeiro (estabelecer sessao)
    await self._page.goto("https://stake.bet.br/pt-br/sports/", wait_until="domcontentloaded", timeout=30000)
    await self._page.wait_for_timeout(2000)
    
    self.logger.info("[Stake] Browser pronto")
```

#### 4. Atualizar _fetch_events()

```python
async def _fetch_events(self, tournament_id: str) -> List[Dict[str, Any]]:
    """Fetch upcoming events for a tournament via Playwright navigation."""
    url = f"{self.API_BASE}/tournament/{tournament_id}/live-upcoming"
    data = await self._fetch_json(url)
    
    events = data.get("events", [])
    return [e for e in events if not e.get("isLive", False)]
```

#### 5. Atualizar _fetch_event_odds()

```python
async def _fetch_event_odds(self, event_id: str) -> Dict[str, Any]:
    """Fetch odds for a single event via Playwright navigation."""
    url = f"{self.API_BASE}/events/{event_id}/odds"
    return await self._fetch_json(url)
```

#### 6. Remover _fetch_so_odds e _fetch_pa_odds com httpx

Substituir por versoes que usam `_fetch_json()`.

---

## Codigo Completo do Novo _fetch_json

```python
async def _fetch_json(self, url: str) -> Dict[str, Any]:
    """Fetch JSON data by navigating to URL with Playwright."""
    try:
        # Navigate to API URL directly
        response = await self._page.goto(url, wait_until="domcontentloaded", timeout=15000)
        
        if not response:
            return {}
            
        if response.status != 200:
            self.logger.debug(f"[Stake] Status {response.status} para {url}")
            return {}
        
        # Wait a bit for content
        await self._page.wait_for_timeout(500)
        
        # Extract JSON from page body (API returns raw JSON)
        content = await self._page.evaluate("() => document.body.innerText")
        
        if content:
            return json.loads(content)
        
        return {}
        
    except json.JSONDecodeError as e:
        self.logger.debug(f"[Stake] JSON invalido em {url}")
        return {}
    except Exception as e:
        self.logger.debug(f"[Stake] Erro ao buscar {url}: {e}")
        return {}
```

---

## Resumo das Mudancas

| Componente | Antes | Depois |
|------------|-------|--------|
| Biblioteca HTTP | httpx | Playwright page.goto() |
| Tipo de requisicao | XHR/fetch (bloqueado) | Navigate (funciona) |
| User-Agent | Chrome | Firefox |
| Cookies | Tentava capturar | Nao precisa |
| Complexidade | Alta | Baixa |

---

## Performance

| Metrica | httpx | Playwright goto |
|---------|-------|-----------------|
| Tempo por requisicao | ~100ms | ~500ms |
| Requisicoes paralelas | Sim | Nao (sequencial) |
| Funciona | Nao (403) | Sim |

A desvantagem e que sera mais lento (sequencial), mas pelo menos funciona!

---

## Otimizacao Futura

Se a velocidade for problema, podemos criar multiplas paginas (tabs) para fazer requisicoes em paralelo:

```python
# Criar 5 paginas para requisicoes paralelas
pages = [await self._context.new_page() for _ in range(5)]
```

Mas isso pode ser feito depois de confirmar que a abordagem basica funciona.

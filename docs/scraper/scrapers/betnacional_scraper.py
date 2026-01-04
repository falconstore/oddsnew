"""
Betnacional Scraper - Direct API access with Playwright fallback.

Betnacional uses a REST API protected by Cloudflare.
Strategy: Try httpx first, fallback to Playwright if 403.

API: https://prod-global-bff-events.bet6.com.br/api/odds/1/events-by-seasons
"""

import httpx
from datetime import datetime
from typing import List, Optional, Dict, Any
from loguru import logger
from collections import defaultdict

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig

# Playwright imports (optional, for fallback)
try:
    from playwright.async_api import async_playwright, Browser, BrowserContext, Page
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False


class BetnacionalScraper(BaseScraper):
    """
    Scraper para Betnacional (API Direta com fallback Playwright).
    
    A API retorna uma lista de odds individuais que precisam ser
    agrupadas por event_id para montar o 1x2 completo.
    """
    
    API_BASE_URL = "https://prod-global-bff-events.bet6.com.br/api/odds/1/events-by-seasons"
    
    # Ligas configuradas (tournament_id da API)
    LEAGUES = {
        "premier_league": {
            "tournament_id": "17",
            "name": "Premier League",
            "country": "Inglaterra"
        },
        # Adicionar mais ligas conforme necessário:
        # "serie_a": {"tournament_id": "?", "name": "Serie A", "country": "Italia"},
        # "la_liga": {"tournament_id": "?", "name": "La Liga", "country": "Espanha"},
    }
    
    # Headers que imitam o navegador Chrome
    BROWSER_HEADERS = {
        "accept": "application/json, text/plain, */*",
        "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "accept-encoding": "gzip, deflate, br",
        "referer": "",  # Explicitamente vazio (importante!)
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
        # Chrome Client Hints
        "sec-ch-ua": '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        # Fetch Metadata
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "cross-site",
        # Sentry headers (capturados do navegador)
        "sentry-trace": "f572248759ee49288b1b8cf51bf4af09-b6fe74ffebecd129-0",
        "baggage": "sentry-environment=production,sentry-release=5.0.3,sentry-public_key=4de4f26e4dce052125e7ea124a3c310c,sentry-trace_id=a3e4f9fe6b8c4ee592f1e498dd8017f1,sentry-sample_rate=0.05,sentry-transaction=POST%20%2Fapi%2Frevalidate,sentry-sampled=false",
        "connection": "keep-alive",
    }
    
    def __init__(self):
        super().__init__(name="betnacional", base_url="https://betnacional.bet.br")
        self.client: Optional[httpx.AsyncClient] = None
        self.logger = logger.bind(component="betnacional")
        # Playwright resources
        self._playwright = None
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self._page: Optional[Page] = None
        self._use_playwright = False
    
    async def setup(self):
        self.logger.info("Iniciando sessão HTTP Betnacional (HTTP/2)...")
        self.client = httpx.AsyncClient(
            timeout=30.0,
            http2=True,
            follow_redirects=True,
            headers=self.BROWSER_HEADERS
        )
    
    async def _setup_playwright(self):
        """Inicializa Playwright como fallback."""
        if not PLAYWRIGHT_AVAILABLE:
            self.logger.error("Playwright não está instalado!")
            return False
        
        self.logger.info("Iniciando Playwright (fallback anti-bot)...")
        self._playwright = await async_playwright().start()
        
        self._browser = await self._playwright.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
                "--no-sandbox",
            ]
        )
        
        self._context = await self._browser.new_context(
            user_agent=self.BROWSER_HEADERS["user-agent"],
            locale="pt-BR",
            timezone_id="America/Sao_Paulo",
            viewport={"width": 1920, "height": 1080},
        )
        
        # Stealth: esconder webdriver
        await self._context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US', 'en'] });
        """)
        
        self._page = await self._context.new_page()
        self._use_playwright = True
        return True
    
    async def teardown(self):
        if self.client:
            await self.client.aclose()
            self.client = None
        
        if self._page:
            await self._page.close()
        if self._context:
            await self._context.close()
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()

    async def get_available_leagues(self) -> List[LeagueConfig]:
        return [
            LeagueConfig(league_id=k, name=v["name"], url="", country=v["country"]) 
            for k, v in self.LEAGUES.items()
        ]
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        if not self.client:
            await self.setup()
        
        # Encontra o tournament_id da liga
        league_config = self.LEAGUES.get(league.league_id)
        if not league_config:
            for k, v in self.LEAGUES.items():
                if v["name"] == league.name:
                    league_config = v
                    break
        
        if not league_config:
            self.logger.warning(f"Liga não configurada: {league.name}")
            return []
        
        tournament_id = league_config["tournament_id"]
        self.logger.info(f"Buscando API Betnacional: {league.name} (tournament_id: {tournament_id})")
        
        params = {
            "sport_id": "1",
            "category_id": "0",
            "tournament_id": tournament_id,
            "markets": "1",
            "filter_time_event": ""
        }
        
        # Tentar httpx primeiro
        data = await self._request_httpx(params)
        
        # Fallback para Playwright se 403
        if data is None and not self._use_playwright:
            self.logger.warning("httpx falhou, tentando Playwright...")
            if await self._setup_playwright():
                data = await self._request_playwright(params)
        elif data is None and self._use_playwright:
            data = await self._request_playwright(params)
        
        if data is None:
            return []
        
        return self._parse_odds(data, league.name)
    
    async def _request_httpx(self, params: Dict[str, str]) -> Optional[Dict]:
        """Tenta fazer request via httpx."""
        try:
            response = await self.client.get(self.API_BASE_URL, params=params)
            
            if response.status_code == 403:
                self._log_403_details(response)
                return None
            
            response.raise_for_status()
            return response.json()
            
        except httpx.HTTPStatusError as e:
            self.logger.error(f"Erro HTTP {e.response.status_code}")
            if e.response.status_code == 403:
                self._log_403_details(e.response)
            return None
        except Exception as e:
            self.logger.error(f"Erro httpx: {e}")
            return None
    
    def _log_403_details(self, response):
        """Log detalhado para diagnosticar 403."""
        content_type = response.headers.get("content-type", "")
        cf_ray = response.headers.get("cf-ray", "N/A")
        server = response.headers.get("server", "N/A")
        
        body_preview = response.text[:500] if response.text else "(vazio)"
        
        self.logger.error(f"""
╔══════════════════════════════════════════════════════════════
║ 🚫 403 FORBIDDEN - Cloudflare bloqueou a request
╠══════════════════════════════════════════════════════════════
║ Content-Type: {content_type}
║ Server: {server}
║ CF-Ray: {cf_ray}
╠══════════════════════════════════════════════════════════════
║ Body (preview):
║ {body_preview}
╚══════════════════════════════════════════════════════════════
        """)
    
    async def _request_playwright(self, params: Dict[str, str]) -> Optional[Dict]:
        """Faz request usando contexto do Playwright."""
        if not self._context or not self._page:
            self.logger.error("Playwright não inicializado")
            return None
        
        try:
            # Montar URL completa
            param_str = "&".join(f"{k}={v}" for k, v in params.items())
            full_url = f"{self.API_BASE_URL}?{param_str}"
            
            self.logger.info(f"Playwright: acessando {full_url}")
            
            # Usar page.goto para resolver challenges
            response = await self._page.goto(full_url, wait_until="networkidle", timeout=30000)
            
            if response and response.status == 200:
                content = await self._page.content()
                # Extrair JSON do body (geralmente em <pre> ou direto)
                import json
                
                # Tentar parsear o texto da página como JSON
                body_text = await self._page.evaluate("() => document.body.innerText")
                data = json.loads(body_text)
                self.logger.info("✅ Playwright: dados obtidos com sucesso")
                return data
            else:
                status = response.status if response else "N/A"
                self.logger.error(f"Playwright: status {status}")
                return None
                
        except Exception as e:
            self.logger.error(f"Erro Playwright: {e}")
            return None

    def _parse_odds(self, data: Dict[str, Any], league_name: str) -> List[ScrapedOdds]:
        """
        Parseia a resposta da API.
        
        Estrutura da resposta:
        {
            "odds": [
                {
                    "event_id": 61300903,
                    "home": "Everton",
                    "away": "Brentford",
                    "date_start": "2026-01-04 12:00:00",
                    "odd": 2.45,
                    "outcome_id": "1",  # 1=Casa, 2=Empate, 3=Fora
                    ...
                },
                ...
            ]
        }
        """
        results = []
        odds_list = data.get("odds", [])
        
        if not odds_list:
            self.logger.warning("Nenhuma odd retornada pela API")
            return results
        
        # Agrupar odds por event_id
        events: Dict[int, Dict[str, Any]] = defaultdict(lambda: {
            "home": None,
            "away": None,
            "date_start": None,
            "odds": {}
        })
        
        for odd in odds_list:
            try:
                event_id = odd.get("event_id")
                if not event_id:
                    continue
                
                outcome_id = odd.get("outcome_id")
                price = odd.get("odd")
                
                if outcome_id and price:
                    events[event_id]["odds"][outcome_id] = float(price)
                
                # Preencher dados do evento (apenas uma vez)
                if events[event_id]["home"] is None:
                    events[event_id]["home"] = odd.get("home", "").strip()
                    events[event_id]["away"] = odd.get("away", "").strip()
                    events[event_id]["date_start"] = odd.get("date_start")
                    
            except Exception as e:
                self.logger.debug(f"Erro ao processar odd: {e}")
                continue
        
        # Converter eventos agrupados em ScrapedOdds
        for event_id, event_data in events.items():
            try:
                odds = event_data["odds"]
                
                # Precisamos das 3 odds para 1X2
                if "1" not in odds or "2" not in odds or "3" not in odds:
                    continue
                
                home_team = event_data["home"]
                away_team = event_data["away"]
                
                if not home_team or not away_team:
                    continue
                
                # Parse da data
                date_str = event_data["date_start"]
                try:
                    match_date = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
                except:
                    match_date = datetime.now()
                
                scraped = ScrapedOdds(
                    bookmaker_name="betnacional",
                    home_team_raw=home_team,
                    away_team_raw=away_team,
                    league_raw=league_name,
                    match_date=match_date,
                    home_odd=odds["1"],
                    draw_odd=odds["2"],
                    away_odd=odds["3"],
                    market_type="1x2",
                    extra_data={
                        "event_id": str(event_id)
                    }
                )
                results.append(scraped)
                
            except Exception as e:
                self.logger.debug(f"Erro ao criar ScrapedOdds: {e}")
                continue
        
        self.logger.info(f"✅ Betnacional: {len(results)} jogos parseados ({league_name})")
        return results


# Teste direto
if __name__ == "__main__":
    import asyncio
    
    async def run():
        s = BetnacionalScraper()
        await s.setup()
        
        try:
            # Teste Premier League
            lg = LeagueConfig(
                league_id="premier_league", 
                name="Premier League", 
                url="", 
                country="Inglaterra"
            )
            odds = await s.scrape_league(lg)
            
            print(f"\n--- Resultado ({len(odds)} jogos) ---")
            for o in odds:
                print(f"{o.home_team_raw} x {o.away_team_raw}")
                print(f"  Odds: {o.home_odd:.2f} - {o.draw_odd:.2f} - {o.away_odd:.2f}")
                print(f"  Event ID: {o.extra_data['event_id']}")
                print(f"  Link: https://betnacional.bet.br/event/1/0/{o.extra_data['event_id']}")
                print("-" * 40)
        finally:
            await s.teardown()
    
    asyncio.run(run())

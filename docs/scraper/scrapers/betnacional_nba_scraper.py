"""
Betnacional NBA Scraper - Playwright only (Cloudflare bypass).

Betnacional's API is protected by Cloudflare, requiring browser automation.
NBA uses sport_id=2, tournament_id=132, markets=219 (Moneyline).

API: https://prod-global-bff-events.bet6.com.br/api/odds/1/events-by-seasons
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from loguru import logger
from collections import defaultdict

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig
from playwright.async_api import async_playwright, Browser, BrowserContext, Page


class BetnacionalNBAScraper(BaseScraper):
    """
    Scraper para Betnacional NBA usando Playwright.
    
    A API retorna uma lista de odds individuais que precisam ser
    agrupadas por event_id para montar o Moneyline completo.
    
    outcome_id: "4" = Home, "5" = Away (diferente do futebol: 1, 2, 3)
    """
    
    API_BASE_URL = "https://prod-global-bff-events.bet6.com.br/api/odds/1/events-by-seasons"
    
    # NBA configuration
    SPORT_ID = "2"      # Basketball (vs "1" for football)
    MARKET_ID = "219"   # Moneyline (vs "1" for 1x2)
    
    LEAGUES = {
        "nba": {
            "tournament_id": "132",
            "name": "NBA",
            "country": "USA"
        }
    }
    
    def __init__(self):
        super().__init__(name="betnacional_nba", base_url="https://betnacional.bet.br")
        self.logger = logger.bind(component="betnacional_nba")
        # Playwright resources
        self._playwright = None
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self._page: Optional[Page] = None
    
    async def setup(self):
        """Inicializa Playwright para acessar a API."""
        self.logger.info("[Betnacional NBA] Iniciando Playwright...")
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
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
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
    
    async def teardown(self):
        """Fecha recursos do Playwright."""
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
        if not self._page:
            await self.setup()
        
        # Encontra o tournament_id da liga
        league_config = self.LEAGUES.get(league.league_id)
        if not league_config:
            for k, v in self.LEAGUES.items():
                if v["name"] == league.name:
                    league_config = v
                    break
        
        if not league_config:
            self.logger.warning(f"[Betnacional NBA] Liga nao configurada: {league.name}")
            return []
        
        tournament_id = league_config["tournament_id"]
        self.logger.info(f"[Betnacional NBA] Buscando API: {league.name} (tournament_id: {tournament_id})")
        
        params = {
            "sport_id": self.SPORT_ID,
            "category_id": "0",
            "tournament_id": tournament_id,
            "markets": self.MARKET_ID,
            "filter_time_event": ""
        }
        
        data = await self._request_playwright(params)
        
        if data is None:
            return []
        
        return self._parse_odds(data, league.name)
    
    async def _request_playwright(self, params: Dict[str, str]) -> Optional[Dict]:
        """Faz request usando contexto do Playwright."""
        if not self._page:
            self.logger.error("[Betnacional NBA] Playwright nao inicializado")
            return None
        
        try:
            # Montar URL completa
            param_str = "&".join(f"{k}={v}" for k, v in params.items())
            full_url = f"{self.API_BASE_URL}?{param_str}"
            
            self.logger.info(f"[Betnacional NBA] Acessando: {full_url}")
            
            # Usar page.goto para resolver challenges
            response = await self._page.goto(full_url, wait_until="networkidle", timeout=30000)
            
            if response and response.status == 200:
                import json
                
                # Extrair JSON do body
                body_text = await self._page.evaluate("() => document.body.innerText")
                data = json.loads(body_text)
                self.logger.info("[Betnacional NBA] Dados obtidos com sucesso")
                return data
            else:
                status = response.status if response else "N/A"
                self.logger.error(f"[Betnacional NBA] Status {status}")
                return None
                
        except Exception as e:
            self.logger.error(f"[Betnacional NBA] Erro: {e}")
            return None

    def _parse_odds(self, data: Dict[str, Any], league_name: str) -> List[ScrapedOdds]:
        """
        Parseia a resposta da API para NBA.
        
        NBA outcomes:
        - outcome_id "4" = Home
        - outcome_id "5" = Away
        
        Sem empate (draw_odd = None).
        """
        results = []
        odds_list = data.get("odds", [])
        
        if not odds_list:
            self.logger.warning("[Betnacional NBA] Nenhuma odd retornada pela API")
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
                self.logger.warning(f"[Betnacional NBA] Erro ao processar odd: {e}")
                continue
        
        # Converter eventos agrupados em ScrapedOdds
        for event_id, event_data in events.items():
            try:
                odds = event_data["odds"]
                
                # NBA precisa de outcome_id "4" (Home) e "5" (Away)
                if "4" not in odds or "5" not in odds:
                    self.logger.debug(f"[Betnacional NBA] Evento {event_id} incompleto: {odds.keys()}")
                    continue
                
                home_team = event_data["home"]
                away_team = event_data["away"]
                
                if not home_team or not away_team:
                    continue
                
                # Parse date
                date_str = event_data["date_start"]
                try:
                    match_date = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
                except (ValueError, TypeError):
                    match_date = datetime.utcnow()
                
                scraped = ScrapedOdds(
                    bookmaker_name="betnacional",
                    home_team_raw=home_team,
                    away_team_raw=away_team,
                    league_raw=league_name,
                    match_date=match_date,
                    home_odd=odds["4"],     # outcome_id 4 = Home
                    draw_odd=None,          # Sem empate no basquete
                    away_odd=odds["5"],     # outcome_id 5 = Away
                    sport="basketball",
                    market_type="moneyline",
                    odds_type="SO",         # Betnacional = Super Odds only
                    extra_data={
                        "event_id": str(event_id),
                        "sport_type": "basketball"  # Para deep links
                    }
                )
                
                results.append(scraped)
                self.logger.debug(f"[Betnacional NBA] {home_team} vs {away_team}: {odds['4']}/{odds['5']}")
                
            except Exception as e:
                self.logger.warning(f"[Betnacional NBA] Erro ao criar ScrapedOdds: {e}")
                continue
        
        self.logger.info(f"[Betnacional NBA] {len(results)} jogos extraidos")
        return results


# Direct test
if __name__ == "__main__":
    import asyncio
    
    async def test():
        scraper = BetnacionalNBAScraper()
        try:
            await scraper.setup()
            leagues = await scraper.get_available_leagues()
            for league in leagues:
                print(f"\n=== {league.name} ===")
                odds = await scraper.scrape_league(league)
                for odd in odds:
                    print(f"  {odd.home_team_raw} vs {odd.away_team_raw}: {odd.home_odd}/{odd.away_odd}")
        finally:
            await scraper.teardown()
    
    asyncio.run(test())

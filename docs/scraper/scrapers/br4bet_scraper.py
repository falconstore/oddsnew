"""
Br4bet Scraper - Scrapes odds from Br4bet via Altenar API.

Uses Playwright to navigate to league pages and passively capture API responses.
When the page loads, the frontend makes calls to the Altenar API - we intercept
those responses via page.on("response") to avoid CORS issues.

API endpoint: https://sb2frontend-altenar2.biahosted.com/api/widget/GetEvents
"""

import asyncio
from datetime import datetime
from typing import List, Dict, Any, Optional

from playwright.async_api import async_playwright, Playwright, Browser, BrowserContext, Page, Response

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


class Br4betScraper(BaseScraper):
    """
    Scraper for Br4bet (uses Altenar backend).
    
    Strategy: Navigate to league pages and passively capture the API responses
    that the frontend automatically makes. This avoids CORS issues since
    we're intercepting the site's own valid cross-origin requests.
    """
    
    LEAGUES = {
        "serie_a": {
            "champ_id": "2942",
            "name": "Serie A",
            "country": "italia",
            "slug": "italia/serie-a",
        },
        "premier_league": {
            "champ_id": "2936",
            "name": "Premier League", 
            "country": "inglaterra",
            "slug": "inglaterra/premier-league",
        },
        "la_liga": {
            "champ_id": "2941",
            "name": "La Liga",
            "country": "espanha",
            "slug": "espanha/laliga",
        },
    }
    
    USER_AGENT = (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/142.0.0.0 Safari/537.36"
    )
    
    def __init__(self):
        super().__init__(
            name="br4bet",
            base_url="https://br4.bet.br"
        )
        self._playwright: Optional[Playwright] = None
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self._page: Optional[Page] = None
    
    async def setup(self):
        """Initialize Playwright browser with stealth settings."""
        await super().setup()
        
        self.logger.info("Starting Playwright browser with stealth...")
        self._playwright = await async_playwright().start()
        
        # Browser launch args for stealth
        launch_args = [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
        ]
        
        self._browser = await self._playwright.chromium.launch(
            headless=True,
            args=launch_args,
        )
        
        # Create context with realistic settings
        self._context = await self._browser.new_context(
            user_agent=self.USER_AGENT,
            viewport={'width': 1920, 'height': 1080},
            locale='pt-BR',
            timezone_id='America/Sao_Paulo',
            extra_http_headers={
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            }
        )
        
        # Add stealth script to hide webdriver
        await self._context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
            
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
            
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });
            
            Object.defineProperty(navigator, 'languages', {
                get: () => ['pt-BR', 'pt', 'en-US', 'en'],
            });
        """)
        
        self._page = await self._context.new_page()
        
        # Navigate to main site to establish session
        self.logger.info("Establishing session at br4.bet.br...")
        try:
            await self._page.goto(self.base_url, wait_until="networkidle", timeout=60000)
            await self._page.wait_for_timeout(3000)
            
            cookies = await self._context.cookies()
            if cookies:
                self.logger.info(f"Session established. Cookies: {[c['name'] for c in cookies]}")
            else:
                self.logger.warning("No cookies captured from session")
                
        except Exception as e:
            self.logger.warning(f"Session setup warning: {e}")
    
    async def teardown(self):
        """Clean up Playwright resources."""
        if self._page:
            await self._page.close()
            self._page = None
        if self._context:
            await self._context.close()
            self._context = None
        if self._browser:
            await self._browser.close()
            self._browser = None
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None
        await super().teardown()
    
    async def get_available_leagues(self) -> List[LeagueConfig]:
        """Return list of supported leagues."""
        return [
            LeagueConfig(
                league_id=cfg["champ_id"],
                name=cfg["name"],
                url=f"{self.base_url}/sports/futebol/{cfg['slug']}",
                country=cfg["country"]
            )
            for cfg in self.LEAGUES.values()
        ]
    
    def _get_league_slug(self, champ_id: str) -> str:
        """Get URL slug for a league by its champ_id."""
        for cfg in self.LEAGUES.values():
            if cfg["champ_id"] == champ_id:
                return cfg["slug"]
        return ""
    
    async def _capture_api_response(self, league: LeagueConfig) -> Optional[Dict[str, Any]]:
        """
        Navigate to league page and passively capture the API response
        that the frontend automatically makes.
        """
        captured_data: Dict[str, Any] = {}
        target_champ_id = league.league_id
        
        async def on_response(response: Response):
            nonlocal captured_data
            url = response.url
            
            # Check if this is the GetEvents API call for our league
            if "GetEvents" in url and f"champIds={target_champ_id}" in url:
                if response.status == 200:
                    try:
                        data = await response.json()
                        captured_data = data
                        self.logger.info(f"Captured API response for {league.name}")
                    except Exception as e:
                        self.logger.warning(f"Failed to parse captured response: {e}")
        
        # Register listener
        self._page.on("response", on_response)
        
        try:
            # Navigate to league page - this triggers the API call
            league_slug = self._get_league_slug(league.league_id)
            league_url = f"{self.base_url}/sports/futebol/{league_slug}"
            self.logger.debug(f"Navigating to: {league_url}")
            
            await self._page.goto(league_url, wait_until="networkidle", timeout=60000)
            
            # Wait for any lazy-loaded requests
            await self._page.wait_for_timeout(3000)
            
            # If not captured yet, try scrolling to trigger more requests
            if not captured_data:
                self.logger.debug(f"No data captured yet for {league.name}, scrolling...")
                await self._page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await self._page.wait_for_timeout(2000)
                
        except Exception as e:
            self.logger.warning(f"Navigation error for {league.name}: {e}")
        finally:
            # Remove listener
            self._page.remove_listener("response", on_response)
        
        return captured_data if captured_data else None
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """Scrape odds by navigating to league page and capturing API response."""
        if not self._page:
            raise RuntimeError("Page not initialized. Call setup() first.")
        
        # Capture API response passively
        data = await self._capture_api_response(league)
        
        if data:
            result = self._parse_response(data, league)
            # Small delay between leagues to avoid rate limiting
            await asyncio.sleep(2)
            return result
        
        self.logger.error(f"Failed to capture API data for {league.name}")
        return []
    
    def _parse_response(self, data: Dict[str, Any], league: LeagueConfig) -> List[ScrapedOdds]:
        """
        Parse Br4bet/Altenar API response (estrutura relacional).
        
        Usa 3 estratégias para identificar odds:
        1. typeId (padrão Altenar: 1=Home, 2=Draw, 3=Away)
        2. competitorId (cruzamento relacional)
        3. nome da odd (fallback)
        """
        odds_list = []
        
        # === MAPAS RELACIONAIS ===
        all_odds = {o["id"]: o for o in data.get("odds", [])}
        all_markets = {m["id"]: m for m in data.get("markets", [])}
        all_competitors = {c["id"]: c for c in data.get("competitors", [])}
        
        events = data.get("events", [])
        
        self.logger.debug(
            f"API: {len(events)} eventos, {len(all_markets)} markets, "
            f"{len(all_odds)} odds, {len(all_competitors)} competitors"
        )
        
        for event in events:
            event_id = event.get("id")
            
            # === 1. IDENTIFICAR OS TIMES ===
            # Opção A: competitors inline
            competitors = event.get("competitors", [])
            
            if len(competitors) >= 2:
                home_comp = competitors[0]
                away_comp = competitors[1]
            else:
                # Opção B: buscar pelos competitorIds na lista separada
                comp_ids = event.get("competitorIds", [])
                if len(comp_ids) < 2:
                    continue
                home_comp = all_competitors.get(comp_ids[0], {})
                away_comp = all_competitors.get(comp_ids[1], {})
            
            home_name = home_comp.get("name", "").strip()
            away_name = away_comp.get("name", "").strip()
            home_comp_id = home_comp.get("id")
            away_comp_id = away_comp.get("id")
            
            if not home_name or not away_name:
                continue
            
            # === 2. ENCONTRAR O MERCADO 1X2 ===
            market_ids = event.get("marketIds", [])
            
            for m_id in market_ids:
                market = all_markets.get(m_id)
                if not market:
                    continue
                
                # Verifica se é mercado 1X2
                market_type_id = market.get("typeId")
                market_name = market.get("name", "").lower()
                
                is_1x2_market = (
                    market_type_id == 1 or
                    ("vencedor" in market_name and "encontro" in market_name) or
                    ("match" in market_name and ("winner" in market_name or "result" in market_name)) or
                    "1x2" in market_name
                )
                
                if not is_1x2_market:
                    continue
                
                # === 3. EXTRAIR AS ODDS ===
                odd_ids = market.get("oddIds", [])
                
                home_odd = None
                draw_odd = None
                away_odd = None
                
                for odd_id in odd_ids:
                    odd = all_odds.get(odd_id)
                    if not odd:
                        continue
                    
                    # Extrair preço
                    price = odd.get("price")
                    if isinstance(price, dict):
                        price = price.get("parsedValue") or price.get("decimal")
                    if not price:
                        continue
                    
                    try:
                        price = float(price)
                    except (ValueError, TypeError):
                        continue
                    
                    type_id = odd.get("typeId")
                    comp_id = odd.get("competitorId")
                    odd_name = odd.get("name", "").lower().strip()
                    
                    # Estratégia 1: typeId padrão Altenar
                    if type_id == 1:
                        home_odd = price
                    elif type_id == 2:
                        draw_odd = price
                    elif type_id == 3:
                        away_odd = price
                    # Estratégia 2: competitorId (cruzamento relacional)
                    elif comp_id:
                        if comp_id == home_comp_id:
                            home_odd = price
                        elif comp_id == away_comp_id:
                            away_odd = price
                    # Estratégia 3: nome da odd (fallback)
                    elif "empate" in odd_name or "draw" in odd_name or odd_name == "x":
                        draw_odd = price
                    elif odd_name == "1":
                        home_odd = price
                    elif odd_name == "2":
                        away_odd = price
                
                # Verifica se encontrou as 3 odds
                if home_odd and draw_odd and away_odd:
                    # Parse da data
                    start_date = event.get("startDate")
                    try:
                        match_date = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                    except (ValueError, TypeError, AttributeError):
                        self.logger.warning(f"Failed to parse date: {start_date}")
                        continue
                    
                    scraped = ScrapedOdds(
                        home_team=home_name,
                        away_team=away_name,
                        league=league.name,
                        match_date=match_date,
                        home_odd=home_odd,
                        draw_odd=draw_odd,
                        away_odd=away_odd,
                        sport_type="football",
                        market_type="1x2",
                        odds_type="PA",  # Br4bet usa Pagamento Antecipado
                        extra_data={
                            "event_id": str(event_id),
                            "market_id": str(m_id),
                            "br4bet_league_id": league.league_id,
                        }
                    )
                    odds_list.append(scraped)
                    self.logger.debug(f"Scraped: {home_name} vs {away_name}")
                    break  # Encontrou 1X2, próximo evento
        
        self.logger.info(f"{league.name}: {len(odds_list)} matches parsed")
        return odds_list

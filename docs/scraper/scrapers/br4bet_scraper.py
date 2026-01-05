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
        Parse Br4bet/Altenar API response.
        
        Response structure:
        - events: [{id, competitors: [{id, name}], startDate, ...}]
        - odds: [{id, typeId, price, competitorId, ...}]
        - markets: [{oddIds: [...], typeId, ...}]
        
        typeId in odds: 1=home, 2=draw, 3=away
        typeId in markets: 1="Vencedor do encontro" (1X2)
        """
        odds_list = []
        
        events = data.get("events", [])
        all_odds = {o["id"]: o for o in data.get("odds", [])}
        all_markets = data.get("markets", [])
        
        # Build map: competitor_id -> event_id
        competitor_to_event = {}
        for event in events:
            event_id = event.get("id")
            for comp in event.get("competitors", []):
                competitor_to_event[comp.get("id")] = event_id
        
        # Process markets to get 1X2 odds per event
        event_odds_map = {}
        
        for market in all_markets:
            # Only process "Vencedor do encontro" (1X2)
            if market.get("typeId") != 1:
                continue
            
            odd_ids = market.get("oddIds", [])
            
            home_odd = draw_odd = away_odd = None
            event_id = None
            
            for odd_id in odd_ids:
                odd = all_odds.get(odd_id)
                if not odd:
                    continue
                
                # Get event_id from competitorId
                comp_id = odd.get("competitorId")
                if comp_id and event_id is None:
                    event_id = competitor_to_event.get(comp_id)
                
                type_id = odd.get("typeId")
                price = odd.get("price")
                
                # Extract numeric value from price
                if isinstance(price, dict):
                    price = price.get("parsedValue")
                
                if price is None:
                    continue
                
                if type_id == 1:
                    home_odd = float(price)
                elif type_id == 2:
                    draw_odd = float(price)
                elif type_id == 3:
                    away_odd = float(price)
            
            if event_id and home_odd and draw_odd and away_odd:
                event_odds_map[event_id] = {
                    "home": home_odd,
                    "draw": draw_odd,
                    "away": away_odd,
                    "market_id": market.get("id")
                }
        
        # Process events and create ScrapedOdds
        for event in events:
            event_id = event.get("id")
            
            if event_id not in event_odds_map:
                continue
            
            odds_data = event_odds_map[event_id]
            
            # Extract teams
            competitors = event.get("competitors", [])
            if len(competitors) < 2:
                continue
            
            home_team = competitors[0].get("name", "")
            away_team = competitors[1].get("name", "")
            
            if not home_team or not away_team:
                continue
            
            # Parse date
            start_date = event.get("startDate")
            try:
                match_date = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            except (ValueError, TypeError, AttributeError):
                self.logger.warning(f"Failed to parse date: {start_date}")
                continue
            
            scraped = ScrapedOdds(
                bookmaker_name="br4bet",
                home_team_raw=home_team,
                away_team_raw=away_team,
                league_raw=league.name,
                match_date=match_date,
                home_odd=odds_data["home"],
                draw_odd=odds_data["draw"],
                away_odd=odds_data["away"],
                market_type="1x2",
                extra_data={
                    "br4bet_event_id": event_id,
                    "br4bet_market_id": odds_data["market_id"],
                    "br4bet_league_id": league.league_id,
                    "br4bet_country": league.country,
                }
            )
            
            odds_list.append(scraped)
            self.logger.debug(f"Scraped: {home_team} vs {away_team}")
        
        self.logger.info(f"{league.name}: {len(odds_list)} matches parsed")
        return odds_list

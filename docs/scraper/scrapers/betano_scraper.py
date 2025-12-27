"""
Betano Scraper - Scrapes odds from Betano Brazil.

Uses Playwright to capture valid session cookies, then aiohttp for API requests.
This hybrid approach bypasses anti-bot protection while maintaining performance.
"""

import aiohttp
from datetime import datetime
from typing import List, Optional, Dict, Any
from playwright.async_api import async_playwright, Browser, BrowserContext, Page

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


class BetanoScraper(BaseScraper):
    """
    Scraper for Betano Brazil.
    
    Uses Playwright to bypass anti-bot protection by:
    1. Loading the site in a headless browser
    2. Capturing session cookies
    3. Using those cookies with aiohttp for fast API requests
    
    Supported leagues:
    - Premier League (England)
    - La Liga (Spain)
    - Serie A (Italy)
    """
    
    # League configurations with Betano IDs
    LEAGUES = {
        "premier_league": {
            "id": "1",
            "name": "Premier League",
            "country": "Inglaterra",
            "url_path": "/sport/futebol/inglaterra/premier-league/1/"
        },
        "la_liga": {
            "id": "5",
            "name": "La Liga",
            "country": "Espanha",
            "url_path": "/sport/futebol/espanha/laliga/5/"
        },
        "serie_a": {
            "id": "1635",
            "name": "Serie A",
            "country": "Itália",
            "url_path": "/sport/futebol/italia/serie-a/1635/"
        },
    }
    
    def __init__(self):
        super().__init__(
            name="betano",
            base_url="https://www.betano.bet.br"
        )
        self._playwright = None
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self._page: Optional[Page] = None
        self._session: Optional[aiohttp.ClientSession] = None
        self._cookies: Dict[str, str] = {}
    
    async def setup(self):
        """Initialize Playwright browser and capture session cookies."""
        await super().setup()
        
        self.logger.debug("Initializing Playwright browser...")
        
        # Start Playwright and browser
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=True,
            args=[
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
            ]
        )
        
        # Create browser context with realistic settings
        self._context = await self._browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0",
            locale="pt-BR",
            timezone_id="America/Sao_Paulo",
            viewport={"width": 1920, "height": 1080},
        )
        
        self._page = await self._context.new_page()
        
        # Navigate to site to get valid cookies
        self.logger.debug("Loading Betano homepage to capture cookies...")
        try:
            await self._page.goto(self.base_url, wait_until="domcontentloaded", timeout=30000)
            # Wait a bit for any JavaScript to set cookies
            await self._page.wait_for_timeout(2000)
        except Exception as e:
            self.logger.warning(f"Initial page load issue (continuing anyway): {e}")
        
        # Capture cookies
        cookies = await self._context.cookies()
        self._cookies = {c["name"]: c["value"] for c in cookies}
        self.logger.debug(f"Captured {len(self._cookies)} cookies")
        
        # Create aiohttp session with captured cookies
        cookie_header = "; ".join([f"{k}={v}" for k, v in self._cookies.items()])
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "pt-BR,pt;q=0.8,en-US;q=0.5,en;q=0.3",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "Cookie": cookie_header,
        }
        
        self._session = aiohttp.ClientSession(
            base_url=self.base_url,
            headers=headers
        )
        self.logger.debug("aiohttp session initialized with captured cookies")
    
    async def teardown(self):
        """Close browser and aiohttp session."""
        if self._session:
            await self._session.close()
            self._session = None
        
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
        """Return list of configured leagues."""
        return [
            LeagueConfig(
                league_id=config["id"],
                name=config["name"],
                url=f"{self.base_url}{config['url_path']}",
                country=config["country"]
            )
            for config in self.LEAGUES.values()
        ]
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """
        Scrape odds from a specific league.
        
        First tries aiohttp with cookies. If that fails with 403,
        falls back to using Playwright to fetch the API directly.
        """
        if not self._session:
            raise RuntimeError("Session not initialized. Call setup() first.")
        
        api_url = f"/api/league/hot/upcoming/?leagueId={league.league_id}&req=s,stnf,c,mb"
        
        self.logger.debug(f"Fetching {league.name} from {api_url}")
        
        # Try with aiohttp first (faster)
        try:
            headers = {"Referer": league.url}
            
            async with self._session.get(api_url, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    return self._parse_response(data, league.name)
                elif response.status == 403:
                    self.logger.debug(f"aiohttp got 403, falling back to Playwright for {league.name}")
                else:
                    self.logger.error(f"HTTP {response.status} for {league.name}")
                    return []
                    
        except aiohttp.ClientError as e:
            self.logger.warning(f"aiohttp failed for {league.name}: {e}")
        
        # Fallback: Use Playwright to fetch API directly
        return await self._scrape_with_playwright(league, api_url)
    
    async def _scrape_with_playwright(self, league: LeagueConfig, api_url: str) -> List[ScrapedOdds]:
        """
        Fallback method: Use Playwright to make API request.
        
        This executes fetch() within the browser context, which has valid cookies and passes bot detection.
        """
        if not self._page:
            self.logger.error("Playwright page not available")
            return []
        
        try:
            # First navigate to a page on the domain if not already there
            current_url = self._page.url
            if "betano.bet.br" not in current_url:
                await self._page.goto(league.url, wait_until="domcontentloaded", timeout=30000)
                await self._page.wait_for_timeout(1000)
            
            # Execute fetch in browser context
            full_url = f"{self.base_url}{api_url}"
            self.logger.debug(f"Playwright fetching: {full_url}")
            
            data = await self._page.evaluate(f"""
                async () => {{
                    try {{
                        const response = await fetch("{full_url}", {{
                            headers: {{
                                "Accept": "application/json, text/plain, */*",
                                "Accept-Language": "pt-BR,pt;q=0.8,en-US;q=0.5,en;q=0.3",
                            }},
                            credentials: "include"
                        }});
                        if (!response.ok) {{
                            return {{ error: response.status }};
                        }}
                        return await response.json();
                    }} catch (e) {{
                        return {{ error: e.message }};
                    }}
                }}
            """)
            
            if isinstance(data, dict) and "error" in data:
                self.logger.error(f"Playwright fetch error for {league.name}: {data['error']}")
                return []
            
            return self._parse_response(data, league.name)
            
        except Exception as e:
            self.logger.error(f"Playwright scrape failed for {league.name}: {e}")
            return []
    
    def _parse_response(self, data: Dict[str, Any], league_name: str) -> List[ScrapedOdds]:
        """
        Parse the Betano API response and extract odds.
        
        Response structure:
        {
            "data": {
                "events": [
                    {
                        "id": "77526540",
                        "name": "Manchester United - Newcastle United",
                        "startTime": 1766779200000,  # milliseconds
                        "liveNow": false,
                        "participants": [{"name": "Manchester United"}, {"name": "Newcastle United"}],
                        "markets": [
                            {
                                "type": "MRES",  # Resultado Final 1X2
                                "selections": [
                                    {"name": "1", "price": 1.5},
                                    {"name": "X", "price": 3.95},
                                    {"name": "2", "price": 7.1}
                                ]
                            }
                        ]
                    }
                ]
            }
        }
        """
        odds_list = []
        
        events = data.get("data", {}).get("events", [])
        
        if not events:
            self.logger.warning(f"No events found for {league_name}")
            return odds_list
        
        for event in events:
            # Skip live games
            if event.get("liveNow", False):
                self.logger.debug(f"Skipping live game: {event.get('name')}")
                continue
            
            # Extract match info
            match_name = event.get("name", "")
            start_time_ms = event.get("startTime")
            participants = event.get("participants", [])
            markets = event.get("markets", [])
            
            if not all([match_name, start_time_ms, participants, markets]):
                continue
            
            # Get team names from participants
            if len(participants) >= 2:
                home_team = participants[0].get("name", "")
                away_team = participants[1].get("name", "")
            else:
                # Fallback: parse from match name (e.g., "Team A - Team B")
                parts = match_name.split(" - ")
                if len(parts) == 2:
                    home_team, away_team = parts
                else:
                    self.logger.warning(f"Could not parse teams from: {match_name}")
                    continue
            
            # Convert timestamp from milliseconds to datetime
            match_date = datetime.utcfromtimestamp(start_time_ms / 1000)
            
            # Find MRES market (Resultado Final 1X2)
            mres_market = None
            for market in markets:
                if market.get("type") == "MRES":
                    mres_market = market
                    break
            
            if not mres_market:
                self.logger.debug(f"No MRES market for: {match_name}")
                continue
            
            # Extract odds from selections
            selections = mres_market.get("selections", [])
            home_odd = None
            draw_odd = None
            away_odd = None
            
            for selection in selections:
                name = selection.get("name", "")
                price = selection.get("price")
                
                if name == "1":
                    home_odd = price
                elif name == "X":
                    draw_odd = price
                elif name == "2":
                    away_odd = price
            
            # Validate all odds are present
            if home_odd is None or draw_odd is None or away_odd is None:
                self.logger.warning(f"Incomplete odds for: {match_name}")
                continue
            
            # Create ScrapedOdds object
            scraped = ScrapedOdds(
                bookmaker_name="betano",
                home_team_raw=home_team,
                away_team_raw=away_team,
                league_raw=league_name,
                match_date=match_date,
                home_odd=float(home_odd),
                draw_odd=float(draw_odd),
                away_odd=float(away_odd),
                market_type="1x2",
                extra_data={
                    "betano_event_id": event.get("id"),
                    "betano_market_id": mres_market.get("id"),
                }
            )
            
            odds_list.append(scraped)
            self.logger.debug(
                f"Parsed: {home_team} vs {away_team} | "
                f"{home_odd:.2f} / {draw_odd:.2f} / {away_odd:.2f}"
            )
        
        self.logger.info(f"{league_name}: {len(odds_list)} matches parsed")
        return odds_list

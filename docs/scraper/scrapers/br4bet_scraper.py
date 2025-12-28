"""
Br4bet Scraper - Scrapes odds from Br4bet via Altenar API.

Uses Playwright to navigate to league pages and capture the real API calls
made by the website's frontend. This bypasses anti-bot protection by using
the exact requests the site makes.

API endpoint: https://sb2frontend-altenar2.biahosted.com/api/widget/GetEvents
"""

import asyncio
import json
import os
import re
from datetime import datetime
from typing import List, Dict, Any, Optional

from playwright.async_api import async_playwright, Playwright, Browser, BrowserContext, Page, Response

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


class Br4betScraper(BaseScraper):
    """
    Scraper for Br4bet (uses Altenar backend).
    
    Strategy: Navigate to actual league pages and intercept the API calls
    made by the website's JavaScript. This ensures all cookies, headers,
    and request parameters match exactly what the site uses.
    """
    
    LEAGUES = {
        "serie_a": {
            "id": "2942",
            "name": "Serie A",
            "country": "italia",
            "slug": "italia/serie-a",
        },
        "premier_league": {
            "id": "2936",
            "name": "Premier League", 
            "country": "inglaterra",
            "slug": "inglaterra/premier-league",
        },
        "la_liga": {
            "id": "2941",
            "name": "La Liga",
            "country": "espanha",
            "slug": "espanha/laliga",
        },
        "brasileirao_a": {
            "id": "2912",
            "name": "Brasileirão Série A",
            "country": "brasil",
            "slug": "brasil/campeonato-brasileiro-serie-a",
        },
    }
    
    API_PATTERN = "sb2frontend-altenar2.biahosted.com/api/widget/GetEvents"
    
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
        
        # Check for proxy configuration
        proxy_server = os.environ.get('BR4BET_PROXY_SERVER')
        proxy_config = None
        if proxy_server:
            proxy_config = {
                'server': proxy_server,
            }
            proxy_user = os.environ.get('BR4BET_PROXY_USER')
            proxy_pass = os.environ.get('BR4BET_PROXY_PASS')
            if proxy_user and proxy_pass:
                proxy_config['username'] = proxy_user
                proxy_config['password'] = proxy_pass
            self.logger.info(f"Using proxy: {proxy_server}")
        
        self._browser = await self._playwright.chromium.launch(
            headless=True,
            args=launch_args,
        )
        
        # Create context with realistic settings
        context_options = {
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'viewport': {'width': 1920, 'height': 1080},
            'locale': 'pt-BR',
            'timezone_id': 'America/Sao_Paulo',
            'extra_http_headers': {
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            }
        }
        
        if proxy_config:
            context_options['proxy'] = proxy_config
        
        self._context = await self._browser.new_context(**context_options)
        
        # Add stealth script to hide webdriver
        await self._context.add_init_script("""
            // Hide webdriver
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
            
            // Hide automation indicators
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
            
            // Fake plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });
            
            // Fake languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['pt-BR', 'pt', 'en-US', 'en'],
            });
        """)
        
        self._page = await self._context.new_page()
        
        # Navigate to main site to warm up session
        self.logger.info("Establishing session at br4.bet.br...")
        try:
            await self._page.goto(self.base_url, wait_until="networkidle", timeout=45000)
            await self._page.wait_for_timeout(3000)  # Wait for JS initialization
            
            # Check if we're blocked
            title = await self._page.title()
            if 'challenge' in title.lower() or 'blocked' in title.lower():
                self.logger.warning(f"Possible challenge page detected: {title}")
            
            # Log cookies captured
            cookies = await self._context.cookies()
            if cookies:
                cookie_names = [c["name"] for c in cookies]
                self.logger.info(f"Session established. Cookies: {cookie_names}")
            else:
                self.logger.warning("No cookies captured from session")
                
        except Exception as e:
            self.logger.warning(f"Session setup warning (continuing anyway): {e}")
    
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
                league_id=cfg["id"],
                name=cfg["name"],
                url=f"{self.base_url}/sports/futebol/{cfg['slug']}",
                country=cfg["country"]
            )
            for cfg in self.LEAGUES.values()
        ]
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """
        Scrape odds by navigating to the league page and capturing the API call.
        
        Strategy:
        1. Set up response listener for GetEvents API
        2. Navigate to the league page
        3. Wait for the API response
        4. Parse and return odds
        """
        if not self._page:
            raise RuntimeError("Page not initialized. Call setup() first.")
        
        # Find the slug for this league
        league_slug = None
        for cfg in self.LEAGUES.values():
            if cfg["id"] == league.league_id:
                league_slug = cfg["slug"]
                break
        
        if not league_slug:
            self.logger.error(f"Unknown league ID: {league.league_id}")
            return []
        
        league_url = f"{self.base_url}/sports/futebol/{league_slug}"
        self.logger.debug(f"Navigating to: {league_url}")
        
        # Variable to store captured response
        captured_data: Optional[Dict] = None
        captured_url: Optional[str] = None
        
        async def handle_response(response: Response):
            nonlocal captured_data, captured_url
            if self.API_PATTERN in response.url and f"champIds={league.league_id}" in response.url:
                try:
                    captured_url = response.url
                    if response.status == 200:
                        captured_data = await response.json()
                        self.logger.debug(f"Captured API response for {league.name}")
                    else:
                        self.logger.error(f"API returned {response.status} for {league.name}")
                        self.logger.debug(f"Failed URL: {response.url}")
                except Exception as e:
                    self.logger.error(f"Error capturing response: {e}")
        
        # Register response listener
        self._page.on("response", handle_response)
        
        try:
            # Navigate to league page
            await self._page.goto(league_url, wait_until="domcontentloaded", timeout=30000)
            
            # Wait for API call to complete (max 10 seconds)
            for _ in range(20):
                if captured_data is not None:
                    break
                await self._page.wait_for_timeout(500)
            
            # Remove listener
            self._page.remove_listener("response", handle_response)
            
            if captured_data:
                self.logger.debug(f"Successfully captured data for {league.name}")
                return self._parse_response(captured_data, league)
            
            # Fallback: try direct API call with context.request (shares cookies)
            self.logger.debug(f"No captured response, trying context.request fallback for {league.name}")
            return await self._fallback_request(league)
                
        except Exception as e:
            self.logger.error(f"Error scraping {league.name}: {e}")
            self._page.remove_listener("response", handle_response)
            return []
    
    async def _fallback_request(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """
        Fallback: Use context.request.get() which shares cookies with the browser.
        """
        url = (
            f"https://sb2frontend-altenar2.biahosted.com/api/widget/GetEvents?"
            f"culture=pt-BR"
            f"&timezoneOffset=-180"
            f"&integration=br4bet"
            f"&deviceType=1"
            f"&numFormat=en-GB"
            f"&countryCode=BR"
            f"&eventCount=0"
            f"&sportId=66"
            f"&champIds={league.league_id}"
        )
        
        try:
            self.logger.debug(f"Fallback request: {url}")
            
            response = await self._context.request.get(
                url,
                headers={
                    'Accept': 'application/json, text/plain, */*',
                    'Origin': 'https://br4.bet.br',
                    'Referer': 'https://br4.bet.br/',
                }
            )
            
            if response.status != 200:
                self.logger.error(f"Fallback HTTP {response.status} for {league.name}")
                return []
            
            data = await response.json()
            return self._parse_response(data, league)
            
        except Exception as e:
            self.logger.error(f"Fallback error for {league.name}: {e}")
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
        
        # Build map: event_id -> {home, draw, away odds}
        # First, map competitor_id -> event_id
        competitor_to_event = {}
        for event in events:
            event_id = event.get("id")
            for comp in event.get("competitors", []):
                competitor_to_event[comp.get("id")] = event_id
        
        # Now process markets to get 1X2 odds per event
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
        
        self.logger.info(f"Scraped {len(odds_list)} matches from {league.name}")
        return odds_list

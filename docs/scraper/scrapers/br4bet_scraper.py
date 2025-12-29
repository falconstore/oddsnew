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
    
    API_PATTERN = "GetEvents"  # Loosened pattern to catch any GetEvents call
    API_TIMEOUT_MS = 45000  # Increased from 15s to 45s
    SCREENSHOT_DIR = "debug_screenshots"  # Directory for diagnostic screenshots
    USER_AGENT = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
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

        # Captured from real frontend requests
        self._auth_header: Optional[str] = None
        self._last_api_url_by_league: Dict[str, str] = {}
    
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
            'user_agent': self.USER_AGENT,
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
                league_id=cfg["champ_id"],
                name=cfg["name"],
                url=f"{self.base_url}/sports/futebol/{cfg['slug']}",
                country=cfg["country"]
            )
            for cfg in self.LEAGUES.values()
        ]
    
    def _build_api_headers(self, referer: str) -> Dict[str, str]:
        headers: Dict[str, str] = {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Origin': 'https://br4.bet.br',
            'Referer': referer,
            'User-Agent': self.USER_AGENT,
        }
        if self._auth_header:
            # Don't log/print this value anywhere (token)
            headers['Authorization'] = self._auth_header
        return headers

    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """Scrape odds by capturing the real GetEvents call from the league page."""
        if not self._page or not self._context:
            raise RuntimeError("Page/context not initialized. Call setup() first.")

        # Find the slug for this league
        league_slug = None
        for cfg in self.LEAGUES.values():
            if cfg["champ_id"] == league.league_id:
                league_slug = cfg["slug"]
                break

        if not league_slug:
            self.logger.error(f"Unknown league ID: {league.league_id}")
            return []

        league_url = f"{self.base_url}/sports/futebol/{league_slug}"
        self.logger.debug(f"Navigating to: {league_url}")

        # Loosened filter: capture any GetEvents response
        captured_responses: List[Response] = []
        
        def _on_response(resp: Response):
            if self.API_PATTERN in resp.url:
                self.logger.debug(f"Captured API call: {resp.status} {resp.request.method} {resp.url[:150]}...")
                captured_responses.append(resp)

        self._page.on("response", _on_response)
        
        try:
            # Use networkidle and longer timeout
            await self._page.goto(league_url, wait_until="networkidle", timeout=60000)
            await self._page.wait_for_timeout(5000)  # Extra wait for JS to fire XHR
        except Exception as e:
            self.logger.warning(f"Navigation issue for {league.name}: {e}")
        
        self._page.remove_listener("response", _on_response)
        
        # Diagnostic: log page state
        await self._diagnose_page(league.name)
        
        # Find the best matching response for this league
        captured_response: Optional[Response] = None
        for resp in captured_responses:
            if f"champIds={league.league_id}" in resp.url:
                captured_response = resp
                break
        
        # If no exact match, use any GetEvents response as fallback
        if not captured_response and captured_responses:
            captured_response = captured_responses[0]
            self.logger.warning(f"Using non-exact GetEvents response for {league.name}")
        
        if not captured_response:
            self.logger.error(f"No GetEvents API calls captured for {league.name}")
            # Try localStorage fallback
            return await self._fallback_from_storage(league, league_url)

        # If we saw a response (even 400), capture URL + Authorization for reuse
        if captured_response:
            self._last_api_url_by_league[league.league_id] = captured_response.url

            try:
                req_headers = captured_response.request.headers or {}
                auth = req_headers.get("authorization") or req_headers.get("Authorization")
                if auth:
                    self._auth_header = auth
            except Exception:
                pass

            if captured_response.status == 200:
                try:
                    data = await captured_response.json()
                    return self._parse_response(data, league)
                except Exception as e:
                    self.logger.error(f"Error parsing JSON for {league.name}: {e}")
            else:
                # Diagnostics (don't print token)
                auth_present = bool(self._auth_header)
                self.logger.error(f"GetEvents HTTP {captured_response.status} for {league.name}")
                self.logger.debug(f"GetEvents URL: {captured_response.url}")
                self.logger.debug(f"Authorization header present: {auth_present}")
                try:
                    cookies = await self._context.cookies()
                    self.logger.debug(f"Cookie names: {[c['name'] for c in cookies]}")
                except Exception:
                    pass
                try:
                    body = await captured_response.text()
                    self.logger.debug(f"Body preview: {body[:200]}")
                except Exception:
                    pass

        # Fallback: retry the exact captured URL using context.request (same cookies)
        fallback_url = self._last_api_url_by_league.get(league.league_id)
        if not fallback_url:
            self.logger.error(f"No captured GetEvents URL available for {league.name}; skipping.")
            return []

        data = await self._request_json_with_context(fallback_url, referer=league_url, league_name=league.name)
        if not data:
            return []
        return self._parse_response(data, league)

    async def _request_json_with_context(self, url: str, referer: str, league_name: str) -> Optional[Dict[str, Any]]:
        """Request JSON using the browser context cookies + captured headers (Authorization)."""
        try:
            self.logger.debug(f"Context.request URL: {url}")
            resp = await self._context.request.get(url, headers=self._build_api_headers(referer))

            if resp.status != 200:
                self.logger.error(f"Context.request HTTP {resp.status} for {league_name}")
                try:
                    txt = await resp.text()
                    self.logger.debug(f"Context.request body preview: {txt[:200]}")
                except Exception:
                    pass
                return None

            return await resp.json()
        except Exception as e:
            self.logger.error(f"Context.request error for {league_name}: {e}")
            return None

    async def _diagnose_page(self, league_name: str):
        """Log diagnostic info about the current page state."""
        try:
            final_url = self._page.url
            title = await self._page.title()
            self.logger.debug(f"Page state for {league_name}: URL={final_url}, Title={title}")
            
            # Check for anti-bot indicators in HTML
            html = await self._page.content()
            antibot_indicators = ['datadome', 'captcha', 'challenge', 'blocked', 'access denied', 'enable javascript', 'cloudflare']
            for indicator in antibot_indicators:
                if indicator.lower() in html.lower():
                    self.logger.warning(f"Anti-bot indicator found: '{indicator}' in {league_name}")
            
            # Save screenshot for debugging
            os.makedirs(self.SCREENSHOT_DIR, exist_ok=True)
            safe_name = league_name.replace(" ", "_").lower()
            screenshot_path = f"{self.SCREENSHOT_DIR}/br4bet_{safe_name}.png"
            await self._page.screenshot(path=screenshot_path)
            self.logger.debug(f"Screenshot saved: {screenshot_path}")
            
        except Exception as e:
            self.logger.warning(f"Diagnostic error for {league_name}: {e}")

    async def _fallback_from_storage(self, league: LeagueConfig, referer: str) -> List[ScrapedOdds]:
        """Try to extract auth token from storage and make direct API call."""
        try:
            # Try to get auth token from localStorage/sessionStorage
            local_storage = await self._page.evaluate("() => JSON.stringify(localStorage)")
            session_storage = await self._page.evaluate("() => JSON.stringify(sessionStorage)")
            
            self.logger.debug(f"localStorage keys: {list(json.loads(local_storage).keys())[:10]}")
            self.logger.debug(f"sessionStorage keys: {list(json.loads(session_storage).keys())[:10]}")
            
            # Look for token-like values
            for storage_str in [local_storage, session_storage]:
                storage = json.loads(storage_str)
                for key, value in storage.items():
                    if any(tok in key.lower() for tok in ['token', 'auth', 'jwt', 'bearer']):
                        self.logger.debug(f"Found potential auth key: {key}")
                        if isinstance(value, str) and len(value) > 20:
                            self._auth_header = f"Bearer {value}" if not value.startswith("Bearer") else value
                            break
            
            # If we have a previous URL for this league, try it
            fallback_url = self._last_api_url_by_league.get(league.league_id)
            if fallback_url:
                self.logger.info(f"Trying fallback API call for {league.name}")
                data = await self._request_json_with_context(fallback_url, referer, league.name)
                if data:
                    return self._parse_response(data, league)
            
            # Build URL from scratch if we have no cached URL
            api_base = "https://sb2frontend-altenar2.biahosted.com/api/widget/GetEvents"
            api_url = f"{api_base}?culture=pt-BR&timezoneOffset=180&integration=br4bet&deviceType=1&numFormat=en-GB&countryCode=BR&eventCount=0&sportId=0&champIds={league.league_id}"
            self.logger.info(f"Trying constructed API URL for {league.name}")
            data = await self._request_json_with_context(api_url, referer, league.name)
            if data:
                return self._parse_response(data, league)
                
        except Exception as e:
            self.logger.error(f"Storage fallback error for {league.name}: {e}")
        
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

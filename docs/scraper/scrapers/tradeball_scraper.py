"""
Tradeball Scraper - Scrapes odds from Tradeball (Betbra Dball Exchange).

API: https://tradeball.betbra.bet.br/api/feedDball/list
Fetches today + next 3 days of matches.

## Authentication Modes (in priority order):

### 1. Manual Token (TRADEBALL_AUTH_TOKEN) - Fastest, no browser
   export TRADEBALL_AUTH_TOKEN="27459028|lAf4ZXPMWTye..."
   export TRADEBALL_COOKIES="BIAB_TZ=180; BIAB_CUSTOMER=eyJ..."

### 2. Auto-Login (TRADEBALL_USERNAME + PASSWORD) - Recommended
   export TRADEBALL_USERNAME="seu_email@example.com"
   export TRADEBALL_PASSWORD="sua_senha"
   Uses Playwright to login automatically and capture the session token.

### 3. Anonymous Browser - Fallback (will fail without login)

Note: VPS must have Brazilian IP or use a Brazilian proxy (site is geo-blocked).
"""

import json
import os
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

import httpx
from loguru import logger

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


class TradeballScraper(BaseScraper):
    """
    Scraper for Tradeball (Betbra Dball Exchange).
    Fetches today + next 3 days of matches.
    
    Supports two modes:
    1. Token mode (preferred): Uses TRADEBALL_AUTH_TOKEN env var for direct API calls
    2. Browser mode (fallback): Uses Playwright for session-based auth (requires login)
    """
    
    # League mapping by clId from API
    LEAGUE_MAPPING = {
        # Brasil
        35: {"name": "Paulistão", "country": "Brazil"},
        4: {"name": "Brasileirão Série A", "country": "Brazil"},
        # Europa
        1: {"name": "Premier League", "country": "England"},
        2: {"name": "La Liga", "country": "Spain"},
        3: {"name": "Serie A", "country": "Italy"},
        5: {"name": "Bundesliga", "country": "Germany"},
        6: {"name": "Ligue 1", "country": "France"},
        7: {"name": "Liga Portugal", "country": "Portugal"},
        # Champions/Europa
        10: {"name": "Champions League", "country": "Europe"},
        11: {"name": "Europa League", "country": "Europe"},
    }
    
    API_BASE = "https://tradeball.betbra.bet.br/api/feedDball/list"
    
    def __init__(self):
        super().__init__(
            name="tradeball",
            base_url="https://tradeball.betbra.bet.br"
        )
        self._auth_token: Optional[str] = None
        self._cookies: Optional[str] = None
        self._use_token_mode = False
        self._last_fetch_status = 0  # Track last HTTP status for retry logic
        
        # Browser vars (only used if no token)
        self._playwright = None
        self._browser = None
        self._context = None
        self._page = None
        
        self.logger = logger.bind(component="tradeball")
    
    async def setup(self):
        """Initialize scraper with authentication (token > auto-login > anonymous)."""
        self.logger.debug("Initializing Tradeball scraper...")
        
        # Priority 1: Manual token from env var (fastest, no browser needed)
        manual_token = os.environ.get("TRADEBALL_AUTH_TOKEN")
        manual_cookies = os.environ.get("TRADEBALL_COOKIES")
        
        if manual_token:
            self.logger.info("Using token from TRADEBALL_AUTH_TOKEN env var")
            self._auth_token = manual_token
            self._cookies = manual_cookies or ""
            self._use_token_mode = True
            return  # Skip browser setup - use direct API calls
        
        # Priority 2: Auto-login with credentials
        username = os.environ.get("TRADEBALL_USERNAME")
        password = os.environ.get("TRADEBALL_PASSWORD")
        
        if username and password:
            self.logger.info("Credentials found, attempting auto-login...")
            await self._setup_browser()
            
            login_success = await self._perform_login(username, password)
            if login_success:
                self.logger.info("Auto-login successful, session active")
                self._use_token_mode = False  # Use browser fetch with session
                return
            else:
                self.logger.error("Auto-login failed, scraper may not work")
                return
        
        # Priority 3: Anonymous browser session (will likely fail)
        self.logger.warning("No auth configured (set TRADEBALL_USERNAME/PASSWORD or TRADEBALL_AUTH_TOKEN)")
        await self._setup_browser()
    
    async def _setup_browser(self):
        """Initialize Playwright browser for session-based auth."""
        from playwright.async_api import async_playwright
        
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-setuid-sandbox']
        )
        
        self._context = await self._browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
            locale="pt-BR",
            timezone_id="America/Sao_Paulo",
        )
        
        self._page = await self._context.new_page()
        
        # Navigate to main page
        await self._page.goto(self.base_url, wait_until="domcontentloaded", timeout=30000)
        await self._page.wait_for_timeout(1000)
        
        # Navigate to the trading feed page to initialize session
        await self._page.goto(
            "https://tradeball.betbra.bet.br/dballTradingFeed",
            wait_until="networkidle",
            timeout=30000
        )
        await self._page.wait_for_timeout(2000)
        
        self.logger.info("Tradeball browser session initialized")
    
    async def teardown(self):
        """Close resources."""
        if self._page:
            await self._page.close()
        if self._context:
            await self._context.close()
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()
        self.logger.info("Session closed")
    
    async def _perform_login(self, username: str, password: str) -> bool:
        """
        Perform login via Playwright browser.
        Returns True if successful, False otherwise.
        """
        try:
            self.logger.info("Navigating to login page...")
            
            # Navigate to main site first to initialize cookies
            await self._page.goto(
                "https://tradeball.betbra.bet.br",
                wait_until="networkidle",
                timeout=30000
            )
            await self._page.wait_for_timeout(2000)
            
            # Click login button to open modal (if exists)
            try:
                login_btn = await self._page.wait_for_selector(
                    'button:has-text("Entrar"), a:has-text("Entrar"), [data-test="login"]',
                    timeout=5000
                )
                if login_btn:
                    await login_btn.click()
                    await self._page.wait_for_timeout(1500)
            except Exception:
                # Try navigating directly to login page
                await self._page.goto(
                    "https://tradeball.betbra.bet.br/login",
                    wait_until="networkidle",
                    timeout=30000
                )
                await self._page.wait_for_timeout(2000)
            
            self.logger.info("Filling login form...")
            
            # Try multiple possible selectors for email/username field
            email_selectors = [
                'input[name="email"]',
                'input[name="username"]',
                'input[type="email"]',
                'input[placeholder*="email" i]',
                'input[placeholder*="usuário" i]',
                '#email',
                '#username'
            ]
            
            email_filled = False
            for selector in email_selectors:
                try:
                    email_input = await self._page.wait_for_selector(selector, timeout=2000)
                    if email_input:
                        await email_input.fill(username)
                        email_filled = True
                        self.logger.debug(f"Email filled using selector: {selector}")
                        break
                except Exception:
                    continue
            
            if not email_filled:
                self.logger.error("Could not find email/username input field")
                return False
            
            # Try multiple possible selectors for password field
            password_selectors = [
                'input[name="password"]',
                'input[type="password"]',
                'input[placeholder*="senha" i]',
                '#password'
            ]
            
            password_filled = False
            for selector in password_selectors:
                try:
                    password_input = await self._page.wait_for_selector(selector, timeout=2000)
                    if password_input:
                        await password_input.fill(password)
                        password_filled = True
                        self.logger.debug(f"Password filled using selector: {selector}")
                        break
                except Exception:
                    continue
            
            if not password_filled:
                self.logger.error("Could not find password input field")
                return False
            
            # Click submit button
            submit_selectors = [
                'button[type="submit"]',
                'button:has-text("Entrar")',
                'button:has-text("Login")',
                'input[type="submit"]'
            ]
            
            submit_clicked = False
            for selector in submit_selectors:
                try:
                    submit_btn = await self._page.wait_for_selector(selector, timeout=2000)
                    if submit_btn:
                        await submit_btn.click()
                        submit_clicked = True
                        self.logger.debug(f"Submit clicked using selector: {selector}")
                        break
                except Exception:
                    continue
            
            if not submit_clicked:
                self.logger.error("Could not find submit button")
                return False
            
            # Wait for navigation/response
            self.logger.info("Waiting for login response...")
            await self._page.wait_for_load_state("networkidle", timeout=15000)
            await self._page.wait_for_timeout(3000)
            
            # Verify login success by checking URL or page content
            current_url = self._page.url
            self.logger.debug(f"Post-login URL: {current_url}")
            
            # Check for login error messages
            try:
                error_element = await self._page.query_selector(
                    '.error, .alert-danger, [class*="error"], [class*="invalid"]'
                )
                if error_element:
                    error_text = await error_element.text_content()
                    if error_text and len(error_text.strip()) > 0:
                        self.logger.error(f"Login error: {error_text.strip()}")
                        return False
            except Exception:
                pass
            
            # If we're no longer on login page, assume success
            if "login" not in current_url.lower():
                self.logger.info("Login appears successful, navigating to trading feed...")
                
                # Navigate to trading feed to fully initialize session
                await self._page.goto(
                    "https://tradeball.betbra.bet.br/dballTradingFeed",
                    wait_until="networkidle",
                    timeout=30000
                )
                await self._page.wait_for_timeout(2000)
                return True
            else:
                self.logger.warning("Still on login page after submit, checking page state...")
                # Take screenshot for debugging (if headless=False would show it)
                page_content = await self._page.content()
                if "dashboard" in page_content.lower() or "tradingfeed" in page_content.lower():
                    return True
                return False
            
        except Exception as e:
            self.logger.error(f"Login error: {e}")
            return False
    
    async def _retry_with_relogin(self, url: str, date_str: Optional[str]) -> List[ScrapedOdds]:
        """Attempt to re-login and retry fetch after 401 error."""
        username = os.environ.get("TRADEBALL_USERNAME")
        password = os.environ.get("TRADEBALL_PASSWORD")
        
        if not username or not password:
            self.logger.error("Cannot re-login: no credentials configured")
            return []
        
        self.logger.info("Attempting re-login after 401...")
        if await self._perform_login(username, password):
            self.logger.info("Re-login successful, retrying fetch...")
            # Retry the fetch (without recursion to avoid infinite loop)
            return await self._fetch_with_browser_no_retry(url, date_str)
        else:
            self.logger.error("Re-login failed")
            return []
    
    async def get_available_leagues(self) -> List[LeagueConfig]:
        """Return all configured leagues."""
        return [
            LeagueConfig(
                league_id=str(league_id),
                name=config["name"],
                url="",
                country=config["country"]
            )
            for league_id, config in self.LEAGUE_MAPPING.items()
        ]
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """Not used - scrape_all handles all leagues at once."""
        return []
    
    async def scrape_all(self) -> List[ScrapedOdds]:
        """Fetch today + next 3 days of matches."""
        all_odds = []
        today = datetime.now()
        
        try:
            await self.setup()
            
            # Day 1: Today (without date parameter, marketId=2)
            self.logger.info("Fetching today's matches...")
            today_odds = await self._fetch_day(None)
            all_odds.extend(today_odds)
            
            # Days 2-4: Next 3 days (with date parameter, marketId=3)
            for days_ahead in range(1, 4):
                target_date = today + timedelta(days=days_ahead)
                date_str = target_date.strftime("%Y-%m-%d")
                self.logger.info(f"Fetching matches for {date_str}...")
                day_odds = await self._fetch_day(date_str)
                all_odds.extend(day_odds)
            
            self.logger.info(f"Tradeball Total: {len(all_odds)} matches")
            
        except Exception as e:
            self.logger.error(f"Tradeball scraper error: {e}")
        finally:
            await self.teardown()
        
        return all_odds
    
    def _build_api_url(self, date_str: Optional[str] = None) -> str:
        """Build the API URL with proper filters."""
        import urllib.parse
        
        if date_str:
            # Future day: marketId=3, with date in filter
            filter_obj = {
                "line": 1,
                "periodTypeId": 1,
                "tradingTypeId": 2,
                "marketId": 3,
                "date": date_str
            }
        else:
            # Today: marketId=2, without date
            filter_obj = {
                "line": 1,
                "periodTypeId": 1,
                "tradingTypeId": 2,
                "marketId": 2
            }
        
        filter_json = json.dumps(filter_obj, separators=(',', ':'))
        filter_encoded = urllib.parse.quote(filter_json, safe='')
        app_id = str(uuid.uuid4())
        
        return (
            f"{self.API_BASE}?page=1"
            f"&filter={filter_encoded}"
            f"&start=0&limit=50"
            f"&sort=%5B%7B%22property%22:%22created_at%22,%22direction%22:%22desc%22%7D%5D"
            f"&requiredDictionaries%5B%5D=LeagueGroup"
            f"&requiredDictionaries%5B%5D=TimeZone"
            f"&init=true"
            f"&version=0"
            f"&uniqAppId={app_id}"
            f"&locale=pt"
        )
    
    async def _fetch_day(self, date_str: Optional[str] = None) -> List[ScrapedOdds]:
        """Fetch all matches for a specific day."""
        url = self._build_api_url(date_str)
        
        if self._use_token_mode:
            return await self._fetch_with_token(url, date_str)
        else:
            return await self._fetch_with_browser(url, date_str)
    
    async def _fetch_with_token(self, url: str, date_str: Optional[str]) -> List[ScrapedOdds]:
        """Fetch using direct HTTP request with auth token (faster, no browser)."""
        headers = {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "pt-BR,pt;q=0.9",
            "Authorization": f"Bearer {self._auth_token}",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": "https://tradeball.betbra.bet.br/dballTradingFeed",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
        }
        
        # Parse cookies string into dict
        cookies = {}
        if self._cookies:
            for cookie in self._cookies.split("; "):
                if "=" in cookie:
                    key, value = cookie.split("=", 1)
                    cookies[key] = value
        
        async with httpx.AsyncClient(cookies=cookies, timeout=30.0) as client:
            try:
                response = await client.get(url, headers=headers)
                
                if response.status_code == 401:
                    self.logger.error(
                        "Token expired! Update TRADEBALL_AUTH_TOKEN env var. "
                        "See scraper docstring for instructions."
                    )
                    return []
                
                if response.status_code == 403:
                    self.logger.error(
                        "Access forbidden (403). Possible geo-block or token issue. "
                        "Ensure VPS is in Brazil or use a Brazilian proxy."
                    )
                    return []
                
                if response.status_code != 200:
                    self.logger.error(f"HTTP {response.status_code}: {response.text[:200]}")
                    return []
                
                # Check if response is JSON
                content_type = response.headers.get("content-type", "")
                if "application/json" not in content_type:
                    self.logger.warning(f"Non-JSON response: {response.text[:100]}")
                    return []
                
                data = response.json()
                self.logger.debug(f"Token fetch for {date_str or 'today'}: {len(data.get('data', []))} events")
                return self._parse_response(data)
                
            except httpx.TimeoutException:
                self.logger.error(f"Request timeout for {date_str or 'today'}")
                return []
            except Exception as e:
                self.logger.error(f"Request failed for {date_str or 'today'}: {e}")
                return []
    
    async def _fetch_with_browser(self, url: str, date_str: Optional[str]) -> List[ScrapedOdds]:
        """Fetch using browser context (slower, requires session). Retries on 401."""
        result = await self._fetch_with_browser_no_retry(url, date_str)
        
        # If empty and we got a 401, try re-login
        if not result and self._last_fetch_status == 401:
            return await self._retry_with_relogin(url, date_str)
        
        return result
    
    async def _fetch_with_browser_no_retry(self, url: str, date_str: Optional[str]) -> List[ScrapedOdds]:
        """Fetch using browser context without retry logic."""
        self._last_fetch_status = 0
        
        try:
            fetch_result = await self._page.evaluate("""
                async (url) => {
                    try {
                        const resp = await fetch(url, {
                            credentials: 'include',
                            headers: {
                                'Accept': 'application/json, text/plain, */*',
                                'X-Requested-With': 'XMLHttpRequest'
                            }
                        });
                        const text = await resp.text();
                        return { status: resp.status, text: text };
                    } catch (e) {
                        return { error: e.message };
                    }
                }
            """, url)
            
            if fetch_result and fetch_result.get("error"):
                self.logger.error(f"Browser fetch error: {fetch_result.get('error')}")
                return []
            
            status = fetch_result.get("status", 0)
            self._last_fetch_status = status
            fetch_text = fetch_result.get("text", "").strip()
            
            self.logger.debug(f"Browser fetch: status={status}, size={len(fetch_text)} bytes")
            
            if status == 401:
                self.logger.warning("Got 401 Unauthenticated - session expired or invalid")
                return []
            
            if status == 403:
                self.logger.error("Got 403 Forbidden - possible geo-block (VPS needs Brazilian IP)")
                return []
            
            if fetch_text.startswith('[') or fetch_text.startswith('{'):
                data = json.loads(fetch_text)
                return self._parse_response(data)
            else:
                self.logger.warning(f"Non-JSON response: {fetch_text[:100]}")
                return []
            
        except Exception as e:
            self.logger.error(f"Browser fetch failed: {e}")
            return []
    
    def _parse_response(self, data: Any) -> List[ScrapedOdds]:
        """Parse API response and extract odds."""
        odds_list = []
        
        # Data can be direct list or dict with "data" field
        events = data if isinstance(data, list) else data.get("data", [])
        
        for event in events:
            try:
                # Get league ID
                league_id = event.get("clId")
                
                # Check if league is mapped, if not use raw name
                if league_id in self.LEAGUE_MAPPING:
                    league_info = self.LEAGUE_MAPPING[league_id]
                    league_name = league_info["name"]
                else:
                    # Use raw league name from API
                    league_name = event.get("clName", "Unknown League")
                
                # Extract team data
                home_team = event.get("cthName", "")
                away_team = event.get("ctaName", "")
                
                if not home_team or not away_team:
                    continue
                
                # Extract odds (strings to float)
                home_odds_str = event.get("wldHm", "0")
                draw_odds_str = event.get("wldDm", "0")
                away_odds_str = event.get("wldAm", "0")
                
                home_odds = float(home_odds_str) if home_odds_str else 0.0
                draw_odds = float(draw_odds_str) if draw_odds_str else 0.0
                away_odds = float(away_odds_str) if away_odds_str else 0.0
                
                if home_odds <= 0 or away_odds <= 0:
                    continue
                
                # Parse date
                match_date_str = event.get("dg", "")
                match_date = self._parse_match_date(match_date_str)
                
                if not match_date:
                    continue
                
                # Event ID for deep link
                event_id = event.get("ceId", "")
                
                odds_list.append(ScrapedOdds(
                    bookmaker_name="Tradeball",
                    home_team_raw=home_team,
                    away_team_raw=away_team,
                    league_raw=league_name,
                    match_date=match_date,
                    home_odd=home_odds,
                    draw_odd=draw_odds,
                    away_odd=away_odds,
                    sport="football",
                    market_type="1x2",
                    odds_type="PA",  # Tradeball uses PA-style odds
                    extra_data={
                        "tradeball_event_id": str(event_id),
                        "tradeball_home_id": event.get("cthId"),
                        "tradeball_away_id": event.get("ctaId"),
                        "league_id": league_id,
                    }
                ))
                
            except Exception as e:
                self.logger.warning(f"Parse error: {e}")
                continue
        
        return odds_list
    
    def _parse_match_date(self, date_str: str) -> Optional[datetime]:
        """Parse date string to datetime."""
        if not date_str:
            return None
        try:
            return datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
        except Exception:
            try:
                return datetime.strptime(date_str, "%Y-%m-%d")
            except Exception:
                return None


if __name__ == "__main__":
    import asyncio
    
    async def test():
        scraper = TradeballScraper()
        try:
            odds = await scraper.scrape_all()
            print(f"\nTotal: {len(odds)} partidas da Tradeball\n")
            for odd in odds[:10]:
                print(f"  {odd.home_team_raw} x {odd.away_team_raw}")
                print(f"    League: {odd.league_raw}")
                print(f"    Odds: {odd.home_odd} / {odd.draw_odd} / {odd.away_odd}")
                print()
        except Exception as e:
            print(f"Error: {e}")
    
    asyncio.run(test())

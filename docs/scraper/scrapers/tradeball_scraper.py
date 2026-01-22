"""
Tradeball Scraper - Scrapes odds from Tradeball (Betbra Dball Exchange).
Uses Playwright to bypass authentication and fetch API data.
API: https://tradeball.betbra.bet.br/api/feedDball/list

Fetches today + next 3 days of matches.
"""

import json
import re
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from playwright.async_api import async_playwright, Browser, BrowserContext, Page

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig
from loguru import logger


class TradeballScraper(BaseScraper):
    """
    Scraper for Tradeball (Betbra Dball Exchange).
    Fetches today + next 3 days of matches.
    """
    
    # Mapeamento de ligas por clId da API
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
        self._playwright = None
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self._page: Optional[Page] = None
        self.logger = logger.bind(component="tradeball")
    
    async def setup(self):
        """Initialize Playwright and establish session."""
        self.logger.debug("Initializing Tradeball scraper...")
        
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
        
        # Navigate to establish session cookies
        await self._page.goto(self.base_url, wait_until="domcontentloaded", timeout=30000)
        await self._page.wait_for_timeout(2000)
        
        self.logger.info("Tradeball session initialized")
    
    async def teardown(self):
        """Close browser resources."""
        if self._page:
            await self._page.close()
        if self._context:
            await self._context.close()
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()
        self.logger.info("Session closed")
    
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
    
    async def _fetch_day(self, date_str: Optional[str] = None) -> List[ScrapedOdds]:
        """Fetch all matches for a specific day using page.goto (browser context)."""
        try:
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
            
            import urllib.parse
            # JSON compacto sem espaços (como a URL original)
            filter_json = json.dumps(filter_obj, separators=(',', ':'))
            filter_encoded = urllib.parse.quote(filter_json, safe='')
            
            # UUID único como o site usa
            app_id = str(uuid.uuid4())
            
            url = (
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
            
            # Use page.goto() like betbra_scraper - browser handles authentication
            response = await self._page.goto(url, wait_until="domcontentloaded", timeout=30000)
            
            if not response or response.status != 200:
                self.logger.error(f"API error for {date_str or 'today'}: status={response.status if response else 'no response'}")
                return []
            
            # Extract JSON from page content (browser may wrap it in HTML)
            body_text = await self._page.content()
            
            # Try to find JSON array or object in the response
            # First try: look for content in <pre> tag (common for JSON display)
            pre_match = re.search(r'<pre[^>]*>(.*?)</pre>', body_text, re.DOTALL | re.IGNORECASE)
            if pre_match:
                json_text = pre_match.group(1).strip()
                json_text = json_text.replace('&quot;', '"').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
                try:
                    data = json.loads(json_text)
                    self.logger.debug(f"Parsed {len(data) if isinstance(data, list) else 'dict'} items from <pre> for {date_str or 'today'}")
                    return self._parse_response(data)
                except json.JSONDecodeError:
                    pass
            
            # Second try: extract from body directly (strip all HTML tags)
            body_match = re.search(r'<body[^>]*>(.*?)</body>', body_text, re.DOTALL | re.IGNORECASE)
            if body_match:
                body_content = body_match.group(1).strip()
                # Remove all HTML tags
                body_clean = re.sub(r'<[^>]+>', '', body_content).strip()
                # Decode HTML entities
                body_clean = body_clean.replace('&quot;', '"').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
                if body_clean and (body_clean.startswith('[') or body_clean.startswith('{')):
                    try:
                        data = json.loads(body_clean)
                        self.logger.debug(f"Parsed {len(data) if isinstance(data, list) else 'dict'} items from body for {date_str or 'today'}")
                        return self._parse_response(data)
                    except json.JSONDecodeError as e:
                        self.logger.debug(f"JSON decode error: {e}, content preview: {body_clean[:200]}")
            
            # Third try: raw regex for JSON structures
            json_match = re.search(r'(\[[\s\S]*\]|\{[\s\S]*\})', body_text)
            if json_match:
                try:
                    data = json.loads(json_match.group(1))
                    self.logger.debug(f"Parsed {len(data) if isinstance(data, list) else 'dict'} items from regex for {date_str or 'today'}")
                    return self._parse_response(data)
                except json.JSONDecodeError:
                    pass
            
            self.logger.warning(f"No valid JSON found for {date_str or 'today'}")
            return []
            
        except Exception as e:
            self.logger.error(f"Fetch failed for {date_str or 'today'}: {e}")
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

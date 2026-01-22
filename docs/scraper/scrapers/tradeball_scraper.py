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
        """Initialize Playwright and establish session with proper warm-up."""
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
        
        # Step 1: Navigate to main page
        await self._page.goto(self.base_url, wait_until="domcontentloaded", timeout=30000)
        await self._page.wait_for_timeout(1000)
        
        # Step 2: Navigate to the trading feed page to fully initialize session
        # This page triggers all necessary authentication cookies/tokens
        await self._page.goto(
            "https://tradeball.betbra.bet.br/dballTradingFeed",
            wait_until="networkidle",
            timeout=30000
        )
        await self._page.wait_for_timeout(2000)
        
        self.logger.info("Tradeball session initialized with trading feed warm-up")
    
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
        """Fetch all matches for a specific day using page.evaluate fetch (browser context)."""
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
            filter_json = json.dumps(filter_obj, separators=(',', ':'))
            filter_encoded = urllib.parse.quote(filter_json, safe='')
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
            
            # Use page.evaluate fetch directly (works with browser session context)
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
                        return { status: resp.status, text: text, url: resp.url };
                    } catch (e) {
                        return { error: e.message };
                    }
                }
            """, url)
            
            if fetch_result and fetch_result.get("error"):
                self.logger.error(f"Fetch error for {date_str or 'today'}: {fetch_result.get('error')}")
                return []
            
            status = fetch_result.get("status", 0)
            fetch_text = fetch_result.get("text", "").strip()
            final_url = fetch_result.get("url", "")
            
            self.logger.debug(f"Fetch result: status={status}, url={final_url[:60]}..., size={len(fetch_text)} bytes")
            
            # Log preview of response for debugging
            if fetch_text and len(fetch_text) < 500:
                self.logger.debug(f"Response preview: {fetch_text[:200]}")
            
            if fetch_text.startswith('[') or fetch_text.startswith('{'):
                data = json.loads(fetch_text)
                
                # Log the structure to understand empty responses
                if isinstance(data, dict):
                    self.logger.debug(f"Response keys: {list(data.keys())}")
                    if "data" in data:
                        self.logger.debug(f"data array length: {len(data.get('data', []))}")
                elif isinstance(data, list):
                    self.logger.debug(f"Response array length: {len(data)}")
                
                return self._parse_response(data)
            else:
                self.logger.warning(f"Response not JSON for {date_str or 'today'}: {fetch_text[:100]}")
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

"""
Betano NBA Scraper - Scraper for Betano Brazil basketball (NBA) odds.
Captures both SO (Super Odds) and PA (Pagamento Antecipado) markets.

API Structure:
- PA (Pagamento Antecipado): markets[] where type == "H2HT"
- SO (Super Odds): sixPackBlocks[0].columns[] where type == "H2H1"
"""

import aiohttp
from datetime import datetime
from typing import List, Dict, Any, Optional
from playwright.async_api import async_playwright

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


class BetanoNBAScraper(BaseScraper):
    """
    Scraper for Betano Brazil NBA odds.
    Uses Playwright for session cookies and aiohttp for API requests.
    """
    
    LEAGUES = {
        "nba": {
            "id": "441g",
            "name": "NBA",
            "country": "EUA",
            "url_path": "/sport/basquete/eua/nba/441g/"
        }
    }
    
    def __init__(self):
        super().__init__(
            name="betano_nba",
            base_url="https://www.betano.bet.br"
        )
        self._playwright = None
        self._browser = None
        self._context = None
        self._page = None
        self._session = None
        self._cookies = {}
    
    async def setup(self):
        """Initialize Playwright browser and capture session cookies."""
        self.logger.info("Starting Betano NBA scraper setup")
        
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(headless=True)
        self._context = await self._browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
            locale="pt-BR",
            timezone_id="America/Sao_Paulo"
        )
        self._page = await self._context.new_page()
        
        # Navigate to Betano basketball page to capture cookies
        await self._page.goto(f"{self.base_url}/sport/basquete/", wait_until="networkidle", timeout=30000)
        
        # Capture cookies from browser context
        cookies = await self._context.cookies()
        self._cookies = {c["name"]: c["value"] for c in cookies}
        
        # Setup aiohttp session with captured cookies
        cookie_header = "; ".join([f"{k}={v}" for k, v in self._cookies.items()])
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
            "Referer": f"{self.base_url}/sport/basquete/",
            "Cookie": cookie_header,
        }
        self._session = aiohttp.ClientSession(headers=headers)
        
        self.logger.info("Betano NBA scraper setup complete")
    
    async def teardown(self):
        """Cleanup resources."""
        if self._session:
            await self._session.close()
        if self._page:
            await self._page.close()
        if self._context:
            await self._context.close()
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()
        self.logger.info("Betano NBA scraper teardown complete")
    
    async def get_available_leagues(self) -> List[LeagueConfig]:
        """Return list of available NBA leagues."""
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
        """Scrape odds from a specific NBA league."""
        api_url = f"{self.base_url}/api/sports/BASK/hot/trending/leagues/{league.league_id}/events/?req=s,stnf,c,mb"
        
        self.logger.info(f"Fetching NBA odds from: {api_url}")
        
        try:
            async with self._session.get(api_url) as response:
                if response.status == 403:
                    self.logger.warning("Got 403, falling back to Playwright")
                    return await self._scrape_with_playwright(api_url, league.name)
                
                response.raise_for_status()
                data = await response.json()
                return self._parse_response(data, league.name)
                
        except Exception as e:
            self.logger.error(f"Error fetching {league.name}: {e}")
            return []
    
    async def _scrape_with_playwright(self, api_url: str, league_name: str) -> List[ScrapedOdds]:
        """Fallback: use Playwright to fetch API data when session fails."""
        try:
            response = await self._page.evaluate(f"""
                async () => {{
                    const res = await fetch('{api_url}');
                    return await res.json();
                }}
            """)
            return self._parse_response(response, league_name)
        except Exception as e:
            self.logger.error(f"Playwright fallback failed: {e}")
            return []
    
    def _parse_response(self, data: Dict[str, Any], league_name: str) -> List[ScrapedOdds]:
        """Parse API response and extract both SO and PA odds."""
        odds_list = []
        
        events = data.get("data", {}).get("events", [])
        self.logger.info(f"Found {len(events)} NBA events")
        
        for event in events:
            try:
                # Extract team names from participants
                participants = event.get("participants", [])
                if len(participants) < 2:
                    continue
                
                home_team = participants[0].get("name", "")
                away_team = participants[1].get("name", "")
                
                if not home_team or not away_team:
                    continue
                
                # Get match date
                start_time_ms = event.get("startTime")
                if not start_time_ms:
                    continue
                match_date = datetime.utcfromtimestamp(start_time_ms / 1000)
                
                event_id = event.get("id")
                
                # Extract PA odds from markets (H2HT)
                pa_odds = self._extract_pa_odds(event)
                if pa_odds:
                    scraped = ScrapedOdds(
                        bookmaker_name="betano",
                        home_team_raw=home_team,
                        away_team_raw=away_team,
                        league_raw=league_name,
                        match_date=match_date,
                        home_odd=pa_odds["home"],
                        draw_odd=None,
                        away_odd=pa_odds["away"],
                        sport="basketball",
                        market_type="moneyline",
                        odds_type="PA",
                        extra_data={
                            "betano_event_id": event_id,
                            "betano_market_id": pa_odds.get("market_id"),
                        }
                    )
                    odds_list.append(scraped)
                    self.logger.debug(
                        f"Parsed [PA]: {home_team} vs {away_team} | "
                        f"{pa_odds['home']:.2f} / {pa_odds['away']:.2f}"
                    )
                
                # Extract SO odds from sixPackBlocks (H2H1)
                so_odds = self._extract_so_odds(event)
                if so_odds:
                    scraped = ScrapedOdds(
                        bookmaker_name="betano",
                        home_team_raw=home_team,
                        away_team_raw=away_team,
                        league_raw=league_name,
                        match_date=match_date,
                        home_odd=so_odds["home"],
                        draw_odd=None,
                        away_odd=so_odds["away"],
                        sport="basketball",
                        market_type="moneyline",
                        odds_type="SO",
                        extra_data={
                            "betano_event_id": event_id,
                            "betano_market_id": so_odds.get("market_id"),
                        }
                    )
                    odds_list.append(scraped)
                    self.logger.debug(
                        f"Parsed [SO]: {home_team} vs {away_team} | "
                        f"{so_odds['home']:.2f} / {so_odds['away']:.2f}"
                    )
                    
            except Exception as e:
                self.logger.error(f"Error parsing event: {e}")
                continue
        
        self.logger.info(f"NBA {league_name}: {len(odds_list)} odds entries parsed")
        return odds_list
    
    def _extract_pa_odds(self, event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Extract PA (Pagamento Antecipado) odds from markets array."""
        markets = event.get("markets", [])
        
        for market in markets:
            if market.get("type") == "H2HT":
                selections = market.get("selections", [])
                if len(selections) >= 2:
                    return {
                        "home": float(selections[0].get("price", 0)),
                        "away": float(selections[1].get("price", 0)),
                        "market_id": market.get("id"),
                    }
        return None
    
    def _extract_so_odds(self, event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Extract SO (Super Odds) from sixPackBlocks array."""
        six_pack_blocks = event.get("sixPackBlocks", [])
        
        if not six_pack_blocks:
            return None
        
        columns = six_pack_blocks[0].get("columns", [])
        
        for column in columns:
            if column.get("type") == "H2H1":
                selections = column.get("selections", [])
                if len(selections) >= 2:
                    return {
                        "home": float(selections[0].get("price", 0)),
                        "away": float(selections[1].get("price", 0)),
                        "market_id": column.get("id"),
                    }
        return None

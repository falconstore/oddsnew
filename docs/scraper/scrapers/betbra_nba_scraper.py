"""
Betbra NBA Scraper - Scrapes NBA basketball odds from Betbra Brazil (Exchange).

Uses Playwright page.goto directly - only BACK odds are collected (lay odds are ignored).
API: https://mexchange-api.betbra.bet.br/api/events
"""

import json
import re
from datetime import datetime
from typing import List, Dict, Any, Optional
from playwright.async_api import async_playwright, Browser, BrowserContext, Page

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig
from loguru import logger


class BetbraNBAScraper(BaseScraper):
    """
    Scraper for Betbra Brazil Exchange - NBA Basketball.
    
    Uses Playwright page.goto to bypass anti-bot protection.
    Only collects BACK odds (never lay).
    """
    
    # League configurations for NBA
    LEAGUES = {
        "nba": {
            "name": "NBA",
            "country": "EUA",
            "tag_url_name": "nba",
        },
    }
    
    API_BASE = "https://mexchange-api.betbra.bet.br/api/events"
    
    def __init__(self):
        super().__init__(
            name="betbra",  # Same bookmaker name for database linking
            base_url="https://betbra.bet.br"
        )
        self._playwright = None
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self._page: Optional[Page] = None
        self._log = logger.bind(component="betbra_nba")
    
    async def setup(self):
        """Initialize Playwright browser."""
        self._log.debug("Initializing Playwright browser for NBA...")
        
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
        
        # Navigate to site to establish session
        self._log.debug("Loading Betbra homepage to establish session...")
        try:
            await self._page.goto(self.base_url, wait_until="domcontentloaded", timeout=30000)
            await self._page.wait_for_timeout(2000)
        except Exception as e:
            self._log.warning(f"Initial page load issue (continuing anyway): {e}")
        
        self._log.info("Playwright session initialized for NBA")
    
    async def teardown(self):
        """Close browser."""
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
            
        self._log.info("NBA session closed")
    
    async def get_available_leagues(self) -> List[LeagueConfig]:
        """Return list of configured leagues."""
        return [
            LeagueConfig(
                league_id=league_id,
                name=config["name"],
                url=config["tag_url_name"],
                country=config["country"]
            )
            for league_id, config in self.LEAGUES.items()
        ]
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """
        Scrape NBA odds from Betbra API.
        
        Uses page.goto directly to bypass anti-bot protection.
        """
        if not self._page:
            self._log.error("Playwright page not initialized")
            return []
        
        try:
            # Build API URL with NBA/basketball parameters
            params = f"offset=0&per-page=100&tag-url-names={league.url},basketball&sort-by=volume&sort-direction=desc&en-market-names=Moneyline"
            full_url = f"{self.API_BASE}?{params}"
            
            self._log.debug(f"Fetching NBA via browser...")
            
            response = await self._page.goto(full_url, wait_until="domcontentloaded", timeout=30000)
            
            if not response:
                self._log.error(f"No response for NBA")
                return []
            
            status = response.status
            self._log.debug(f"Browser fetch status: {status}")
            
            if status != 200:
                body_text = await self._page.content()
                self._log.error(f"API error {status} for NBA: {body_text[:300]}")
                return []
            
            # Get JSON from page content
            body_text = await self._page.content()
            
            # The response might be wrapped in HTML tags, extract JSON
            json_match = re.search(r'\{.*\}', body_text, re.DOTALL)
            if not json_match:
                self._log.error(f"No JSON found in response for NBA")
                return []
            
            data = json.loads(json_match.group())
            
            if "events" not in data:
                self._log.warning(f"No events in response for NBA")
                return []
            
            odds_list = self._parse_response(data, league.name)
            self._log.info(f"NBA: {len(odds_list)} matches parsed")
            return odds_list
            
        except Exception as e:
            self._log.error(f"Scrape failed for NBA: {e}")
            return []
    
    def _parse_response(self, data: Dict[str, Any], league_name: str) -> List[ScrapedOdds]:
        """
        Parse API response and extract BACK odds only for NBA Moneyline.
        
        IMPORTANT: Betbra uses "Away em Home" naming convention in event names,
        meaning the first team listed is the AWAY team and second is the HOME team.
        We parse the event["name"] to correctly identify home/away.
        
        Filters:
        - Only matches (not outrights like "NBA Championship")
        - Only Moneyline markets (money_line type)
        - Only BACK prices (ignores LAY prices)
        - No draw (basketball is 2-way)
        """
        odds_list = []
        
        for event in data.get("events", []):
            try:
                # Skip outright events (e.g., "NBA Championship 2025-26")
                markets = event.get("markets", [])
                
                # Find the Moneyline market
                moneyline_market = None
                for market in markets:
                    market_type = market.get("market-type", "")
                    # Only get "money_line" type, skip "outright"
                    if market_type == "money_line":
                        moneyline_market = market
                        break
                
                if not moneyline_market:
                    # No Moneyline market found, skip this event
                    continue
                
                # CRITICAL: Parse event name to get correct home/away orientation
                # Betbra format: "Away em Home" (e.g., "Minnesota Timberwolves em Miami Heat")
                # "em" means "at" in Portuguese, so first team is AWAY, second is HOME
                event_name = event.get("name", "")
                home_team = None
                away_team = None
                
                if " em " in event_name:
                    # Use "em" pattern to correctly identify teams
                    parts = event_name.split(" em ", 1)
                    if len(parts) == 2:
                        away_team = parts[0].strip()
                        home_team = parts[1].strip()
                        self._log.debug(f"Parsed 'em' pattern: away={away_team}, home={home_team}")
                
                # Fallback: use event-participants if "em" pattern not found
                if not home_team or not away_team:
                    participants = {}
                    for p in event.get("event-participants", []):
                        number = p.get("number", "")
                        name = p.get("participant-name", "")
                        if number and name:
                            participants[number] = name
                    
                    # In fallback, assume number 2 is home (based on observed data)
                    home_team = participants.get("2", "")
                    away_team = participants.get("1", "")
                    
                    if home_team and away_team:
                        self._log.debug(f"Fallback participants: away={away_team}, home={home_team}")
                
                if not home_team or not away_team:
                    self._log.debug(f"Missing team names in event: {event_name}")
                    continue
                
                # Extract BACK odds from runners - match by name
                home_odd = None
                away_odd = None
                
                for runner in moneyline_market.get("runners", []):
                    runner_name = runner.get("name", "")
                    
                    # Find BACK price only (ignore LAY)
                    back_price = None
                    for price in runner.get("prices", []):
                        if price.get("side") == "back":
                            back_price = price.get("odds")
                            break
                    
                    if back_price is None:
                        continue
                    
                    # Match runner to outcome by name
                    if runner_name == home_team:
                        home_odd = float(back_price)
                    elif runner_name == away_team:
                        away_odd = float(back_price)
                
                # Only create odds if we have both (no draw in basketball)
                if home_odd is None or away_odd is None:
                    self._log.debug(
                        f"Incomplete odds for {home_team} vs {away_team}: "
                        f"H={home_odd}, A={away_odd}"
                    )
                    continue
                
                # Parse match date
                match_date = None
                start_str = event.get("start", "")
                if start_str:
                    try:
                        # Remove 'Z' and parse ISO format
                        match_date = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
                    except ValueError:
                        match_date = datetime.now()
                
                # Create ScrapedOdds object for basketball
                odds_list.append(ScrapedOdds(
                    bookmaker_name="betbra",
                    home_team_raw=home_team,
                    away_team_raw=away_team,
                    league_raw=league_name,
                    match_date=match_date,
                    home_odd=home_odd,
                    draw_odd=None,  # No draw in basketball
                    away_odd=away_odd,
                    sport="basketball",
                    market_type="moneyline",
                    odds_type="SO",  # Betbra = Super Odds (exchange)
                    extra_data={
                        "betbra_event_id": event.get("id"),
                        "betbra_market_id": moneyline_market.get("id"),
                        "odds_type": "back",
                        "volume": moneyline_market.get("volume", 0),
                    }
                ))
                
            except Exception as e:
                self._log.warning(f"Error parsing NBA event: {e}")
                continue
        
        return odds_list

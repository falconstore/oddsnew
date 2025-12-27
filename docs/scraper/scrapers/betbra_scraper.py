"""
Betbra Scraper - Scrapes odds from Betbra Brazil (Exchange).

Uses REST API - only BACK odds are collected (lay odds are ignored).
API: https://mexchange-api.betbra.bet.br/api/events
"""

import aiohttp
from datetime import datetime
from typing import List, Dict, Any, Optional

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig
from loguru import logger


class BetbraScraper(BaseScraper):
    """
    Scraper for Betbra Brazil Exchange.
    
    Uses public REST API - collects only BACK odds (never lay).
    Exchange odds typically offer better value than traditional bookmakers.
    """
    
    # League configurations with Betbra tag URL names
    LEAGUES = {
        "premier_league": {
            "name": "Premier League",
            "country": "England",
            "tag_url_name": "english-premier-league",
        },
    }
    
    API_BASE = "https://mexchange-api.betbra.bet.br/api/events"
    
    def __init__(self):
        super().__init__(
            name="betbra",
            base_url="https://betbra.bet.br"
        )
        self._session: Optional[aiohttp.ClientSession] = None
        self._log = logger.bind(component="betbra")
    
    async def setup(self):
        """Initialize HTTP session with appropriate headers."""
        self._session = aiohttp.ClientSession(
            headers={
                "Accept": "application/json",
                "Accept-Language": "pt-BR,pt;q=0.8,en-US;q=0.5,en;q=0.3",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:146.0) Gecko/20100101 Firefox/146.0",
                "Origin": "https://betbra.bet.br",
                "Referer": "https://betbra.bet.br/",
            }
        )
        self._log.info("Session initialized")
    
    async def teardown(self):
        """Close HTTP session."""
        if self._session:
            await self._session.close()
            self._session = None
            self._log.info("Session closed")
    
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
        Scrape odds for a specific league from Betbra API.
        
        Only extracts BACK odds (exchange back prices).
        """
        if not self._session:
            self._log.error("Session not initialized")
            return []
        
        try:
            # Build API URL with parameters
            params = {
                "offset": 0,
                "per-page": 100,
                "tag-url-names": f"{league.url},soccer",
                "sort-by": "volume",
                "sort-direction": "desc",
                "en-market-names": "Moneyline,Match Odds,Winner"
            }
            
            self._log.debug(f"Fetching {league.name} from API")
            
            async with self._session.get(self.API_BASE, params=params) as response:
                if response.status != 200:
                    self._log.error(f"API error: {response.status}")
                    return []
                
                data = await response.json()
                
                if "events" not in data:
                    self._log.warning(f"No events in response for {league.name}")
                    return []
                
                odds_list = self._parse_response(data, league.name)
                self._log.info(f"{league.name}: {len(odds_list)} matches parsed")
                return odds_list
                
        except aiohttp.ClientError as e:
            self._log.error(f"Network error: {e}")
            return []
        except Exception as e:
            self._log.exception(f"Unexpected error: {e}")
            return []
    
    def _parse_response(self, data: Dict[str, Any], league_name: str) -> List[ScrapedOdds]:
        """
        Parse API response and extract BACK odds only.
        
        Filters:
        - Only matches (not outrights like "winner of the season")
        - Only 1X2 markets (Match Odds)
        - Only BACK prices (ignores LAY prices)
        """
        odds_list = []
        
        for event in data.get("events", []):
            try:
                # Skip outright events (e.g., "English Premier League 2025/26")
                # These are season-long bets, not match odds
                markets = event.get("markets", [])
                
                # Find the 1X2 market
                one_x_two_market = None
                for market in markets:
                    market_type = market.get("market-type", "")
                    # Only get "one_x_two" type, skip "outright"
                    if market_type == "one_x_two":
                        one_x_two_market = market
                        break
                
                if not one_x_two_market:
                    # No 1X2 market found, skip this event
                    continue
                
                # Extract team names from event participants
                participants = {}
                for p in event.get("event-participants", []):
                    number = p.get("number", "")
                    name = p.get("participant-name", "")
                    if number and name:
                        participants[number] = name
                
                home_team = participants.get("1", "")
                away_team = participants.get("2", "")
                
                if not home_team or not away_team:
                    self._log.debug(f"Missing team names in event: {event.get('name')}")
                    continue
                
                # Extract BACK odds from runners
                home_odd = None
                draw_odd = None
                away_odd = None
                
                for runner in one_x_two_market.get("runners", []):
                    runner_name = runner.get("name", "")
                    
                    # Find BACK price only (ignore LAY)
                    back_price = None
                    for price in runner.get("prices", []):
                        if price.get("side") == "back":
                            back_price = price.get("odds")
                            break
                    
                    if back_price is None:
                        continue
                    
                    # Match runner to outcome
                    if runner_name == home_team:
                        home_odd = float(back_price)
                    elif runner_name == away_team:
                        away_odd = float(back_price)
                    elif runner_name.lower() in ["empate", "draw", "x"]:
                        draw_odd = float(back_price)
                
                # Only create odds if we have all three
                if home_odd is None or draw_odd is None or away_odd is None:
                    self._log.debug(
                        f"Incomplete odds for {home_team} vs {away_team}: "
                        f"H={home_odd}, D={draw_odd}, A={away_odd}"
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
                
                # Create ScrapedOdds object
                odds_list.append(ScrapedOdds(
                    bookmaker_name="betbra",
                    home_team_raw=home_team,
                    away_team_raw=away_team,
                    league_raw=league_name,
                    match_date=match_date,
                    home_odd=home_odd,
                    draw_odd=draw_odd,
                    away_odd=away_odd,
                    market_type="1x2",
                    extra_data={
                        "betbra_event_id": event.get("id"),
                        "betbra_market_id": one_x_two_market.get("id"),
                        "odds_type": "back",
                        "volume": one_x_two_market.get("volume", 0),
                    }
                ))
                
            except Exception as e:
                self._log.warning(f"Error parsing event: {e}")
                continue
        
        return odds_list

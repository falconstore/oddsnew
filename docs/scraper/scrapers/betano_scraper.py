"""
Betano Scraper - Scrapes odds from Betano Brazil.

Uses direct HTTP requests to the Betano API (no browser needed).
API Endpoint: /api/league/hot/upcoming/?leagueId={id}&req=s,stnf,c,mb
"""

import aiohttp
from datetime import datetime
from typing import List, Optional, Dict, Any

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


class BetanoScraper(BaseScraper):
    """
    Scraper for Betano Brazil.
    
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
        self._session: Optional[aiohttp.ClientSession] = None
    
    async def setup(self):
        """Initialize aiohttp session with appropriate headers."""
        await super().setup()
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:146.0) Gecko/20100101 Firefox/146.0",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "pt-BR,pt;q=0.8,en-US;q=0.5,en;q=0.3",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
        }
        
        self._session = aiohttp.ClientSession(
            base_url=self.base_url,
            headers=headers
        )
        self.logger.debug("aiohttp session initialized")
    
    async def teardown(self):
        """Close aiohttp session."""
        if self._session:
            await self._session.close()
            self._session = None
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
        
        Makes a request to the Betano API and parses the JSON response.
        """
        if not self._session:
            raise RuntimeError("Session not initialized. Call setup() first.")
        
        api_url = f"/api/league/hot/upcoming/?leagueId={league.league_id}&req=s,stnf,c,mb"
        
        self.logger.debug(f"Fetching {league.name} from {api_url}")
        
        try:
            # Set referer for this specific request
            headers = {"Referer": league.url}
            
            async with self._session.get(api_url, headers=headers) as response:
                if response.status != 200:
                    self.logger.error(f"HTTP {response.status} for {league.name}")
                    return []
                
                data = await response.json()
                return self._parse_response(data, league.name)
                
        except aiohttp.ClientError as e:
            self.logger.error(f"Network error fetching {league.name}: {e}")
            return []
        except Exception as e:
            self.logger.error(f"Error scraping {league.name}: {e}")
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
                            },
                            {
                                "type": "MR12",  # SuperOdds (ignore)
                                ...
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

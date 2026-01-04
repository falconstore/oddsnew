"""
Stake Scraper - Scraper for Stake.bet.br using their REST API.
Uses httpx for direct API calls.
Odds type: PA (Pagamento Antecipado)
"""

import httpx
from datetime import datetime
from typing import List, Optional, Dict, Any
from loguru import logger

from ..base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


class StakeScraper(BaseScraper):
    """
    Scraper for Stake.bet.br odds.
    Uses REST API endpoints for event listing and odds fetching.
    """
    
    API_BASE = "https://sbweb.stake.bet.br/api/v1/br/pt-br"
    MARKET_1X2 = "1001159858"  # Resultado Final (1x2)
    
    # Tournament IDs for each league
    LEAGUES = {
        "premier_league": {
            "tournament_id": "1000094985",
            "name": "Premier League",
            "country": "Inglaterra"
        },
        "serie_a": {
            "tournament_id": "1000095001",
            "name": "Serie A",
            "country": "Italia"
        },
        "la_liga": {
            "tournament_id": "1000095049",
            "name": "La Liga",
            "country": "Espanha"
        },
    }
    
    def __init__(self):
        super().__init__(name="stake", base_url="https://stake.bet.br")
        self.client: Optional[httpx.AsyncClient] = None
        
    async def setup(self):
        """Initialize HTTP client with appropriate headers."""
        self.logger.info("Setting up Stake scraper")
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "Accept": "application/json",
                "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
                "Referer": "https://stake.bet.br/",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"macOS"',
            }
        )
        
    async def teardown(self):
        """Close HTTP client."""
        self.logger.info("Tearing down Stake scraper")
        if self.client:
            await self.client.aclose()
            self.client = None
            
    async def get_available_leagues(self) -> List[LeagueConfig]:
        """Return list of available leagues."""
        return [
            LeagueConfig(
                league_id=key,
                name=config["name"],
                url=f"{self.API_BASE}/tournament/{config['tournament_id']}/live-upcoming",
                country=config["country"]
            )
            for key, config in self.LEAGUES.items()
        ]
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """Scrape odds from a specific league."""
        if not self.client:
            self.logger.error("HTTP client not initialized")
            return []
        
        try:
            # Step 1: Fetch events for this league
            events = await self._fetch_events(league)
            if not events:
                self.logger.warning(f"No events found for {league.name}")
                return []
            
            self.logger.info(f"Found {len(events)} events for {league.name}")
            
            # Step 2: Extract event IDs
            event_ids = [str(event["id"]) for event in events]
            
            # Step 3: Fetch odds for all events
            odds_data = await self._fetch_odds(event_ids)
            if not odds_data:
                self.logger.warning(f"No odds found for {league.name}")
                return []
            
            # Step 4: Parse odds and create ScrapedOdds objects
            scraped_odds = self._parse_odds_response(events, odds_data, league)
            
            return scraped_odds
            
        except Exception as e:
            self.logger.error(f"Error scraping {league.name}: {e}")
            return []
    
    async def _fetch_events(self, league: LeagueConfig) -> List[Dict[str, Any]]:
        """Fetch upcoming events for a league."""
        try:
            response = await self.client.get(league.url)
            response.raise_for_status()
            data = response.json()
            
            events = data.get("events", [])
            # Filter out live events (we only want pre-match)
            return [e for e in events if not e.get("isLive", False)]
            
        except Exception as e:
            self.logger.error(f"Error fetching events: {e}")
            return []
    
    async def _fetch_odds(self, event_ids: List[str]) -> Dict[str, Any]:
        """Fetch odds for a list of event IDs."""
        if not event_ids:
            return {}
        
        try:
            # Join IDs with comma
            ids_param = ",".join(event_ids)
            url = f"{self.API_BASE}/events/odds?events={ids_param}"
            
            response = await self.client.get(url)
            response.raise_for_status()
            return response.json()
            
        except Exception as e:
            self.logger.error(f"Error fetching odds: {e}")
            return {}
    
    def _parse_odds_response(
        self, 
        events: List[Dict[str, Any]], 
        odds_data: Dict[str, Any],
        league: LeagueConfig
    ) -> List[ScrapedOdds]:
        """Parse odds response and create ScrapedOdds objects."""
        scraped = []
        
        # Create event lookup by ID
        event_lookup = {str(e["id"]): e for e in events}
        
        # Process odds data
        # The odds response structure: { "events": [...], "odds": [...] }
        odds_list = odds_data.get("odds", [])
        
        # Group odds by event ID
        odds_by_event: Dict[str, Dict[int, float]] = {}
        
        for odd in odds_list:
            event_id = str(odd.get("eventId", ""))
            market_id = odd.get("marketId", "")
            
            # Only process 1x2 market
            if market_id != self.MARKET_1X2:
                continue
            
            column_id = odd.get("columnId")  # 0=Home, 1=Draw, 2=Away
            odd_value = odd.get("oddValues", {}).get("decimal")
            
            if event_id and column_id is not None and odd_value:
                if event_id not in odds_by_event:
                    odds_by_event[event_id] = {}
                odds_by_event[event_id][column_id] = float(odd_value)
        
        # Create ScrapedOdds for each event with complete odds
        for event_id, odds_map in odds_by_event.items():
            # Need all three outcomes
            if 0 not in odds_map or 1 not in odds_map or 2 not in odds_map:
                self.logger.debug(f"Incomplete odds for event {event_id}: {odds_map}")
                continue
            
            event = event_lookup.get(event_id)
            if not event:
                continue
            
            teams = event.get("teams", {})
            home_team = teams.get("home", "Unknown")
            away_team = teams.get("away", "Unknown")
            
            # Parse match date
            date_str = event.get("dateStart", "")
            try:
                match_date = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            except Exception:
                match_date = datetime.utcnow()
            
            scraped.append(ScrapedOdds(
                bookmaker_name="stake",
                home_team_raw=home_team,
                away_team_raw=away_team,
                league_raw=league.name,
                match_date=match_date,
                home_odd=odds_map[0],
                draw_odd=odds_map[1],
                away_odd=odds_map[2],
                market_type="1x2",
                odds_type="PA",  # Stake uses regular odds (Pagamento Antecipado)
                extra_data={
                    "event_id": event_id,
                    "tournament_id": self.LEAGUES.get(league.league_id, {}).get("tournament_id"),
                }
            ))
        
        return scraped

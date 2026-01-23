"""
Stake Scraper - Scraper for Stake.bet.br using their REST API.
Uses httpx for direct API calls.
Collects both SO (Super Odds) and PA (Pagamento Antecipado).
"""

import asyncio
import httpx
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from loguru import logger

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


class StakeScraper(BaseScraper):
    """
    Scraper for Stake.bet.br odds.
    Uses REST API endpoints for event listing and odds fetching.
    Collects both Super Odds (SO) and Pagamento Antecipado (PA).
    """
    
    API_BASE = "https://sbweb.stake.bet.br/api/v1/br/pt-br"
    
    # Market IDs for different odds types
    MARKET_SO = "1001159858"    # Super Odds (Resultado Final)
    MARKET_PA = "2100089307_0"  # Pagamento Antecipado
    
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
        "bundesliga": {
            "tournament_id": "1000094994",
            "name": "Bundesliga",
            "country": "Alemanha"
        },
        "ligue_1": {
            "tournament_id": "1000094991",
            "name": "Ligue 1",
            "country": "França"
        },
 	"paulistao": {
            "tournament_id": "1000094970",
            "name": "Paulistao",
            "country": "Brasil"
        },
	"fa_cup": {
            "tournament_id": "1000094984",
            "name": "FA Cup",
            "country": "Inglaterra"
        },
	"efl_cup": {
            "tournament_id": "1000094986",
            "name": "EFL Cup",
            "country": "Inglaterra"
        },
	"copa_do_rei": {
            "tournament_id": "1000095050",
            "name": "Copa do Rei",
            "country": "Espanha"
        },
    "champions_league": {
            "tournament_id": "1000093381",
            "name": "Champions League",
            "country": "Europa"
        },
    "liga_europa": {
            "tournament_id": "2000051195",
            "name": "Liga Europa",
            "country": "Europa"
        },
    "liga_da_conferencia": {
            "tournament_id": "2000130522",
            "name": "Liga da Conferencia",
            "country": "Europa"
        },
    "eredivisie": {
            "tournament_id": "1000094980",
            "name": "Eredivisie",
            "country": "Holanda"
        },
    }
    
    def __init__(self):
        super().__init__(name="stake", base_url="https://stake.bet.br")
        self.client: Optional[httpx.AsyncClient] = None
        
    async def setup(self):
        """Initialize HTTP client with appropriate headers."""
        self.logger.info("[Stake] Setup: Initializing HTTP client")
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
        self.logger.info("[Stake] Teardown: Closing HTTP client")
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
        """Scrape odds from a specific league (both SO and PA)."""
        if not self.client:
            self.logger.error("[Stake] HTTP client not initialized")
            return []
        
        try:
            # Step 1: Fetch events for this league
            events = await self._fetch_events(league)
            if not events:
                self.logger.warning(f"[Stake] {league.name}: No events found")
                return []
            
            self.logger.info(f"[Stake] {league.name}: Found {len(events)} events")
            
            # Step 2: Extract event IDs
            event_ids = [str(event["id"]) for event in events]
            
            # Step 3: Fetch SO odds (batch request)
            so_odds_data = await self._fetch_so_odds(event_ids)
            
            # Step 4: Fetch PA odds for each event (individual requests)
            pa_odds_by_event = await self._fetch_all_pa_odds(event_ids)
            
            # Step 5: Parse odds and create ScrapedOdds objects
            scraped_odds = self._parse_all_odds(events, so_odds_data, pa_odds_by_event, league)
            
            # Count SO and PA
            so_count = sum(1 for o in scraped_odds if o.odds_type == "SO")
            pa_count = sum(1 for o in scraped_odds if o.odds_type == "PA")
            self.logger.info(f"[Stake] {league.name}: {so_count} SO + {pa_count} PA = {len(scraped_odds)} total")
            
            return scraped_odds
            
        except Exception as e:
            self.logger.error(f"[Stake] {league.name}: Error scraping - {e}")
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
            self.logger.error(f"[Stake] Error fetching events: {e}")
            return []
    
    async def _fetch_so_odds(self, event_ids: List[str]) -> Dict[str, Any]:
        """Fetch Super Odds for a list of event IDs (batch request)."""
        if not event_ids:
            return {}
        
        try:
            ids_param = ",".join(event_ids)
            url = f"{self.API_BASE}/events/odds?events={ids_param}"
            
            response = await self.client.get(url)
            response.raise_for_status()
            return response.json()
            
        except Exception as e:
            self.logger.error(f"[Stake] Error fetching SO odds: {e}")
            return {}
    
    async def _fetch_pa_odds(self, event_id: str) -> Dict[int, float]:
        """Fetch PA odds for a specific event."""
        try:
            url = f"{self.API_BASE}/events/{event_id}/odds"
            response = await self.client.get(url)
            response.raise_for_status()
            data = response.json()
            
            odds_map = {}
            odds_list = data.get("odds", [])
            
            for odd in odds_list:
                market_id = odd.get("marketId", "")
                
                # Only process PA market
                if market_id != self.MARKET_PA:
                    continue
                
                column_id = odd.get("columnId")  # 0=Home, 1=Draw, 2=Away
                odd_values = odd.get("oddValues") or {}
                odd_value = odd_values.get("decimal") if isinstance(odd_values, dict) else None
                
                if column_id is not None and odd_value:
                    odds_map[column_id] = float(odd_value)
            
            return odds_map
            
        except Exception as e:
            self.logger.debug(f"[Stake] Error fetching PA odds for event {event_id}: {e}")
            return {}
    
    async def _fetch_all_pa_odds(self, event_ids: List[str]) -> Dict[str, Dict[int, float]]:
        """Fetch PA odds for all events concurrently."""
        if not event_ids:
            return {}
        
        # Fetch PA odds for all events concurrently (with rate limiting)
        results = {}
        
        # Process in batches of 10 to avoid overwhelming the API
        batch_size = 10
        for i in range(0, len(event_ids), batch_size):
            batch = event_ids[i:i + batch_size]
            tasks = [self._fetch_pa_odds(eid) for eid in batch]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for eid, result in zip(batch, batch_results):
                if isinstance(result, dict) and result:
                    results[eid] = result
            
            # Small delay between batches
            if i + batch_size < len(event_ids):
                await asyncio.sleep(0.2)
        
        return results
    
    def _parse_all_odds(
        self,
        events: List[Dict[str, Any]],
        so_odds_data: Dict[str, Any],
        pa_odds_by_event: Dict[str, Dict[int, float]],
        league: LeagueConfig
    ) -> List[ScrapedOdds]:
        """Parse all odds (SO and PA) and create ScrapedOdds objects."""
        scraped = []
        
        # Create event lookup by ID
        event_lookup = {str(e["id"]): e for e in events}
        
        # Parse SO odds from batch response
        so_odds_by_event = self._parse_so_odds(so_odds_data)
        
        # Process each event
        for event_id, event in event_lookup.items():
            teams = event.get("teams") or {}
            home_team = teams.get("home", "Unknown") if isinstance(teams, dict) else "Unknown"
            away_team = teams.get("away", "Unknown") if isinstance(teams, dict) else "Unknown"
            
            # Parse match date
            date_str = event.get("dateStart", "")
            try:
                match_date = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            except Exception:
                match_date = datetime.now(timezone.utc)
            
            tournament_id = self.LEAGUES.get(league.league_id, {}).get("tournament_id")
            
            # Add SO odds if available
            so_odds = so_odds_by_event.get(event_id, {})
            if 0 in so_odds and 1 in so_odds and 2 in so_odds:
                scraped.append(ScrapedOdds(
                    bookmaker_name="stake",
                    home_team_raw=home_team,
                    away_team_raw=away_team,
                    league_raw=league.name,
                    match_date=match_date,
                    home_odd=so_odds[0],
                    draw_odd=so_odds[1],
                    away_odd=so_odds[2],
                    market_type="1x2",
                    odds_type="SO",
                    extra_data={
                        "event_id": event_id,
                        "tournament_id": tournament_id,
                    }
                ))
            
            # Add PA odds if available
            pa_odds = pa_odds_by_event.get(event_id, {})
            if 0 in pa_odds and 1 in pa_odds and 2 in pa_odds:
                scraped.append(ScrapedOdds(
                    bookmaker_name="stake",
                    home_team_raw=home_team,
                    away_team_raw=away_team,
                    league_raw=league.name,
                    match_date=match_date,
                    home_odd=pa_odds[0],
                    draw_odd=pa_odds[1],
                    away_odd=pa_odds[2],
                    market_type="1x2",
                    odds_type="PA",
                    extra_data={
                        "event_id": event_id,
                        "tournament_id": tournament_id,
                    }
                ))
        
        return scraped
    
    def _parse_so_odds(self, odds_data: Dict[str, Any]) -> Dict[str, Dict[int, float]]:
        """Parse SO odds from batch response."""
        odds_by_event: Dict[str, Dict[int, float]] = {}
        
        odds_list = odds_data.get("odds", [])
        
        for odd in odds_list:
            event_id = str(odd.get("eventId", ""))
            market_id = odd.get("marketId", "")
            
            # Only process SO market
            if market_id != self.MARKET_SO:
                continue
            
            column_id = odd.get("columnId")  # 0=Home, 1=Draw, 2=Away
            odd_values = odd.get("oddValues") or {}
            odd_value = odd_values.get("decimal") if isinstance(odd_values, dict) else None
            
            if event_id and column_id is not None and odd_value:
                if event_id not in odds_by_event:
                    odds_by_event[event_id] = {}
                odds_by_event[event_id][column_id] = float(odd_value)
        
        return odds_by_event

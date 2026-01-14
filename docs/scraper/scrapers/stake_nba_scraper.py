"""
Stake NBA Scraper - Scraper for Stake.bet.br NBA basketball using REST API.
Uses httpx for direct API calls. Only Moneyline (2-way, no draw).
"""

import httpx
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from loguru import logger

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


class StakeNBAScraper(BaseScraper):
    """
    Scraper for Stake.bet.br NBA basketball odds.
    Uses REST API endpoints for event listing and odds fetching.
    NBA only has Moneyline (2-way, no draw).
    """
    
    API_BASE = "https://sbweb.stake.bet.br/api/v1/br/pt-br"
    
    # Market ID for Moneyline (basketball - Vencedor da partida)
    MARKET_MONEYLINE = "1001159732"
    
    # NBA Tournament configuration
    LEAGUES = {
        "nba": {
            "tournament_id": "1000093652",
            "name": "NBA",
            "country": "EUA"
        }
    }
    
    def __init__(self):
        super().__init__(name="stake", base_url="https://stake.bet.br")
        self.logger = logger.bind(component="stake_nba")
        self.client: Optional[httpx.AsyncClient] = None
        
    async def setup(self):
        """Initialize HTTP client with appropriate headers."""
        self.logger.info("[Stake NBA] Setup: Initializing HTTP client")
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "Accept": "application/json",
                "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
                "Origin": "https://stake.bet.br",
                "Referer": "https://stake.bet.br/",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
                "sec-ch-ua": '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"macOS"',
            }
        )
        
    async def teardown(self):
        """Close HTTP client."""
        self.logger.info("[Stake NBA] Teardown: Closing HTTP client")
        if self.client:
            await self.client.aclose()
            self.client = None
            
    async def get_available_leagues(self) -> List[LeagueConfig]:
        """Return list of available leagues (NBA only)."""
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
        """Scrape Moneyline odds from NBA."""
        if not self.client:
            self.logger.error("[Stake NBA] HTTP client not initialized")
            return []
        
        try:
            # Step 1: Fetch events for NBA
            events = await self._fetch_events(league)
            if not events:
                self.logger.warning(f"[Stake NBA] {league.name}: No events found")
                return []
            
            self.logger.info(f"[Stake NBA] {league.name}: Found {len(events)} events")
            
            # Step 2: Extract event IDs
            event_ids = [str(event["id"]) for event in events]
            
            # Step 3: Fetch Moneyline odds (batch request)
            odds_data = await self._fetch_moneyline_odds(event_ids)
            
            # Step 4: Parse odds and create ScrapedOdds objects
            scraped_odds = self._parse_all_odds(events, odds_data, league)
            
            self.logger.info(f"[Stake NBA] {league.name}: Scraped {len(scraped_odds)} games")
            
            return scraped_odds
            
        except Exception as e:
            self.logger.error(f"[Stake NBA] {league.name}: Error scraping - {e}")
            return []
    
    async def _fetch_events(self, league: LeagueConfig) -> List[Dict[str, Any]]:
        """Fetch upcoming events for NBA."""
        try:
            response = await self.client.get(league.url)
            response.raise_for_status()
            data = response.json()
            
            events = data.get("events", [])
            # Filter out live events (we only want pre-match)
            return [e for e in events if not e.get("isLive", False)]
            
        except Exception as e:
            self.logger.error(f"[Stake NBA] Error fetching events: {e}")
            return []
    
    async def _fetch_moneyline_odds(self, event_ids: List[str]) -> Dict[str, Any]:
        """Fetch Moneyline odds for a list of event IDs (batch request)."""
        if not event_ids:
            return {}
        
        try:
            ids_param = ",".join(event_ids)
            url = f"{self.API_BASE}/events/odds?events={ids_param}"
            
            response = await self.client.get(url)
            response.raise_for_status()
            return response.json()
            
        except Exception as e:
            self.logger.error(f"[Stake NBA] Error fetching Moneyline odds: {e}")
            return {}
    
    def _parse_all_odds(
        self,
        events: List[Dict[str, Any]],
        odds_data: Dict[str, Any],
        league: LeagueConfig
    ) -> List[ScrapedOdds]:
        """Parse Moneyline odds and create ScrapedOdds objects."""
        scraped = []
        
        # Create event lookup by ID
        event_lookup = {str(e["id"]): e for e in events}
        
        # Parse Moneyline odds from batch response
        moneyline_odds = self._parse_moneyline_odds(odds_data)
        
        tournament_id = self.LEAGUES.get(league.league_id, {}).get("tournament_id")
        
        # Process each event
        for event_id, event in event_lookup.items():
            teams = event.get("teams") or {}
            home_team = teams.get("home", "Unknown") if isinstance(teams, dict) else "Unknown"
            away_team = teams.get("away", "Unknown") if isinstance(teams, dict) else "Unknown"
            
            # Skip if teams are unknown
            if home_team == "Unknown" or away_team == "Unknown":
                continue
            
            # Parse match date
            date_str = event.get("dateStart", "")
            try:
                match_date = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            except Exception:
                match_date = datetime.now(timezone.utc)
            
            # Get Moneyline odds for this event
            odds = moneyline_odds.get(event_id, {})
            
            # NBA uses columnId 0 (Home) and 2 (Away), no Draw
            if 0 in odds and 2 in odds:
                scraped.append(ScrapedOdds(
                    bookmaker_name="stake",
                    home_team_raw=home_team,
                    away_team_raw=away_team,
                    league_raw=league.name,
                    match_date=match_date,
                    home_odd=odds[0],
                    draw_odd=None,  # No draw in basketball
                    away_odd=odds[2],
                    sport="basketball",
                    market_type="moneyline",
                    odds_type="PA",  # Default for NBA
                    extra_data={
                        "event_id": event_id,
                        "tournament_id": tournament_id,
                        "sport_type": "basketball"
                    }
                ))
        
        return scraped
    
    def _parse_moneyline_odds(self, odds_data: Dict[str, Any]) -> Dict[str, Dict[int, float]]:
        """Parse Moneyline odds from batch response."""
        odds_by_event: Dict[str, Dict[int, float]] = {}
        
        odds_list = odds_data.get("odds", [])
        
        for odd in odds_list:
            event_id = str(odd.get("eventId", ""))
            market_id = odd.get("marketId", "")
            
            # Only process Moneyline market
            if market_id != self.MARKET_MONEYLINE:
                continue
            
            column_id = odd.get("columnId")  # 0=Home, 2=Away (no Draw in basketball)
            odd_values = odd.get("oddValues") or {}
            odd_value = odd_values.get("decimal") if isinstance(odd_values, dict) else None
            
            if event_id and column_id is not None and odd_value:
                if event_id not in odds_by_event:
                    odds_by_event[event_id] = {}
                odds_by_event[event_id][column_id] = float(odd_value)
        
        return odds_by_event


# For testing
if __name__ == "__main__":
    import asyncio
    
    async def main():
        scraper = StakeNBAScraper()
        await scraper.setup()
        
        try:
            leagues = await scraper.get_available_leagues()
            for league in leagues:
                print(f"\nScraping {league.name}...")
                odds = await scraper.scrape_league(league)
                for o in odds:
                    print(f"  {o.home_team_raw} vs {o.away_team_raw}: {o.home_odd} / {o.away_odd}")
        finally:
            await scraper.teardown()
    
    asyncio.run(main())

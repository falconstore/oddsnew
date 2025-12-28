"""
Br4bet Scraper - Scrapes odds from Br4bet via Altenar API.

Uses simple REST API - requires Authorization header.
API endpoint: https://sb2frontend-altenar2.biahosted.com/api/widget/GetEvents

Environment Variables:
    BR4BET_AUTHORIZATION: Authorization token captured from browser DevTools
"""

import aiohttp
from datetime import datetime
from typing import List, Dict, Any, Optional

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig
from config import settings


class Br4betScraper(BaseScraper):
    """
    Scraper for Br4bet (uses Altenar backend).
    
    API Structure:
    - events: List of matches with competitors
    - odds: List of all odds with typeId (1=home, 2=draw, 3=away)
    - markets: Links odds to events via oddIds
    """
    
    LEAGUES = {
        "serie_a": {
            "id": "2942",
            "name": "Serie A",
            "country": "italia",
        },
        "premier_league": {
            "id": "2936",
            "name": "Premier League", 
            "country": "inglaterra",
        },
        "la_liga": {
            "id": "2941",
            "name": "La Liga",
            "country": "espanha",
        },
        "brasileirao_a": {
            "id": "2912",
            "name": "Brasileirão Série A",
            "country": "brasil",
        },
    }
    
    API_BASE = "https://sb2frontend-altenar2.biahosted.com/api/widget/GetEvents"
    
    def __init__(self):
        super().__init__(
            name="br4bet",
            base_url="https://br4.bet.br"
        )
        self._session: Optional[aiohttp.ClientSession] = None
    
    async def setup(self):
        """Initialize aiohttp session with required headers."""
        await super().setup()
        
        # Get Authorization token from settings
        auth_token = settings.br4bet_authorization or ""
        if not auth_token:
            self.logger.warning(
                "BR4BET_AUTHORIZATION not set. API may return 400 errors. "
                "Capture the Authorization header from br4.bet.br DevTools."
            )
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:146.0) Gecko/20100101 Firefox/146.0",
            "Accept": "application/json",
            "Accept-Language": "pt-BR,pt;q=0.8,en-US;q=0.5,en;q=0.3",
            "Origin": "https://br4.bet.br",
            "Referer": "https://br4.bet.br/",
        }
        
        if auth_token:
            headers["Authorization"] = auth_token
        
        self._session = aiohttp.ClientSession(headers=headers)
    
    async def teardown(self):
        """Clean up aiohttp session."""
        if self._session:
            await self._session.close()
            self._session = None
        await super().teardown()
    
    async def get_available_leagues(self) -> List[LeagueConfig]:
        """Return list of supported leagues."""
        return [
            LeagueConfig(
                league_id=cfg["id"],
                name=cfg["name"],
                url=f"{self.base_url}/sports/futebol",
                country=cfg["country"]
            )
            for cfg in self.LEAGUES.values()
        ]
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """Scrape odds for a specific league."""
        if not self._session:
            raise RuntimeError("Session not initialized. Call setup() first.")
        
        url = (
            f"{self.API_BASE}?"
            f"culture=pt-BR"
            f"&timezoneOffset=180"
            f"&integration=br4bet"
            f"&deviceType=1"
            f"&numFormat=en-GB"
            f"&countryCode=BR"
            f"&eventCount=0"
            f"&sportId=0"
            f"&champIds={league.league_id}"
        )
        
        try:
            async with self._session.get(url) as response:
                if response.status != 200:
                    self.logger.error(f"HTTP {response.status} for {league.name}")
                    return []
                
                data = await response.json()
                return self._parse_response(data, league)
                
        except aiohttp.ClientError as e:
            self.logger.error(f"Request failed for {league.name}: {e}")
            return []
        except Exception as e:
            self.logger.error(f"Unexpected error for {league.name}: {e}")
            return []
    
    def _parse_response(self, data: Dict[str, Any], league: LeagueConfig) -> List[ScrapedOdds]:
        """
        Parse Br4bet/Altenar API response.
        
        Response structure:
        - events: [{id, competitors: [{id, name}], startDate, ...}]
        - odds: [{id, typeId, price, competitorId, ...}]
        - markets: [{oddIds: [...], typeId, ...}]
        
        typeId in odds: 1=home, 2=draw, 3=away
        typeId in markets: 1="Vencedor do encontro" (1X2)
        """
        odds_list = []
        
        events = data.get("events", [])
        all_odds = {o["id"]: o for o in data.get("odds", [])}
        all_markets = data.get("markets", [])
        
        # Build map: event_id -> {home, draw, away odds}
        # First, map competitor_id -> event_id
        competitor_to_event = {}
        for event in events:
            event_id = event.get("id")
            for comp in event.get("competitors", []):
                competitor_to_event[comp.get("id")] = event_id
        
        # Now process markets to get 1X2 odds per event
        event_odds_map = {}
        
        for market in all_markets:
            # Only process "Vencedor do encontro" (1X2)
            if market.get("typeId") != 1:
                continue
            
            odd_ids = market.get("oddIds", [])
            
            home_odd = draw_odd = away_odd = None
            event_id = None
            
            for odd_id in odd_ids:
                odd = all_odds.get(odd_id)
                if not odd:
                    continue
                
                # Get event_id from competitorId
                comp_id = odd.get("competitorId")
                if comp_id and event_id is None:
                    event_id = competitor_to_event.get(comp_id)
                
                type_id = odd.get("typeId")
                price = odd.get("price")
                
                # Extract numeric value from price
                if isinstance(price, dict):
                    price = price.get("parsedValue")
                
                if price is None:
                    continue
                
                if type_id == 1:
                    home_odd = float(price)
                elif type_id == 2:
                    draw_odd = float(price)
                elif type_id == 3:
                    away_odd = float(price)
            
            if event_id and home_odd and draw_odd and away_odd:
                event_odds_map[event_id] = {
                    "home": home_odd,
                    "draw": draw_odd,
                    "away": away_odd,
                    "market_id": market.get("id")
                }
        
        # Process events and create ScrapedOdds
        for event in events:
            event_id = event.get("id")
            
            if event_id not in event_odds_map:
                continue
            
            odds_data = event_odds_map[event_id]
            
            # Extract teams
            competitors = event.get("competitors", [])
            if len(competitors) < 2:
                continue
            
            home_team = competitors[0].get("name", "")
            away_team = competitors[1].get("name", "")
            
            if not home_team or not away_team:
                continue
            
            # Parse date
            start_date = event.get("startDate")
            try:
                match_date = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            except (ValueError, TypeError, AttributeError):
                self.logger.warning(f"Failed to parse date: {start_date}")
                continue
            
            scraped = ScrapedOdds(
                bookmaker_name="br4bet",
                home_team_raw=home_team,
                away_team_raw=away_team,
                league_raw=league.name,
                match_date=match_date,
                home_odd=odds_data["home"],
                draw_odd=odds_data["draw"],
                away_odd=odds_data["away"],
                market_type="1x2",
                extra_data={
                    "br4bet_event_id": event_id,
                    "br4bet_market_id": odds_data["market_id"],
                    "br4bet_league_id": league.league_id,
                    "br4bet_country": league.country,
                }
            )
            
            odds_list.append(scraped)
            self.logger.debug(f"Scraped: {home_team} vs {away_team}")
        
        self.logger.info(f"Scraped {len(odds_list)} matches from {league.name}")
        return odds_list

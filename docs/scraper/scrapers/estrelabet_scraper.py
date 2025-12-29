"""
Estrelabet Scraper - Direct API access via Altenar backend.

Estrelabet uses the same Altenar provider as Br4bet but does NOT block API access.
This allows for simple HTTP requests without Playwright or anti-bot measures.
"""

import httpx
from datetime import datetime
from typing import List, Optional
from loguru import logger

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


class EstrelabetScraper(BaseScraper):
    """
    Simple HTTP-based scraper for Estrelabet.
    Uses the Altenar API directly without authentication workarounds.
    """
    
    API_BASE_URL = "https://sb2frontend-altenar2.biahosted.com/api/widget/GetEvents"
    
    # League configurations with Altenar championship IDs
    LEAGUES = {
        "serie_a": {
            "champ_id": "2942",
            "name": "Serie A",
            "country": "Italia",
        },
        # More leagues will be added after testing
    }
    
    def __init__(self):
        super().__init__(name="estrelabet", base_url="https://www.estrelabet.bet.br")
        self.client: Optional[httpx.AsyncClient] = None
        self.logger = logger.bind(component="estrelabet")
    
    async def setup(self):
        """Initialize HTTP client."""
        self.logger.info("Initializing Estrelabet HTTP session...")
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "accept": "*/*",
                "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
                "origin": "https://www.estrelabet.bet.br",
                "referer": "https://www.estrelabet.bet.br/",
                "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
            }
        )
    
    async def teardown(self):
        """Close HTTP client."""
        if self.client:
            await self.client.aclose()
            self.client = None
        self.logger.info("Estrelabet HTTP session closed")
    
    async def get_available_leagues(self) -> List[LeagueConfig]:
        """Return list of available leagues."""
        return [
            LeagueConfig(
                league_id=key,
                name=config["name"],
                url=f"{self.API_BASE_URL}?champIds={config['champ_id']}",
                country=config["country"],
            )
            for key, config in self.LEAGUES.items()
        ]
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """Scrape odds from a specific league."""
        if not self.client:
            await self.setup()
        
        # Find the champ_id for this league
        league_config = None
        for key, config in self.LEAGUES.items():
            if config["name"] == league.name:
                league_config = config
                break
        
        if not league_config:
            self.logger.warning(f"League config not found for: {league.name}")
            return []
        
        champ_id = league_config["champ_id"]
        self.logger.info(f"Scraping {league.name} (champ_id: {champ_id})")
        
        try:
            # Build API request
            params = {
                "culture": "pt-BR",
                "timezoneOffset": "180",
                "integration": "estrelabet",
                "deviceType": "1",
                "numFormat": "en-GB",
                "countryCode": "BR",
                "eventCount": "0",
                "sportId": "0",
                "champIds": champ_id,
            }
            
            response = await self.client.get(self.API_BASE_URL, params=params)
            response.raise_for_status()
            
            data = response.json()
            
            # Parse the Altenar response
            odds_list = self._parse_altenar_response(data, league.name)
            
            self.logger.info(f"{league.name}: {len(odds_list)} matches parsed")
            return odds_list
            
        except httpx.HTTPStatusError as e:
            self.logger.error(f"HTTP error scraping {league.name}: {e.response.status_code}")
            return []
        except Exception as e:
            self.logger.error(f"Error scraping {league.name}: {e}")
            return []
    
    def _parse_altenar_response(self, data: dict, league_name: str) -> List[ScrapedOdds]:
        """
        Parse Altenar API response format.
        
        Structure:
        - events: list of matches with id, startDate, competitorIds, marketIds
        - competitors: list with id and name (separate from events)
        - markets: list of markets with id, typeId and oddIds
        - odds: list of odds with id, price, typeId (1=Home, 2=Draw, 3=Away)
        """
        results = []
        
        events = data.get("events", [])
        markets = data.get("markets", [])
        odds_data = data.get("odds", [])
        competitors = data.get("competitors", [])
        
        if not events:
            self.logger.debug("No events in response")
            return results
        
        # Create lookup maps
        odds_by_id = {odd["id"]: odd for odd in odds_data}
        markets_by_id = {m["id"]: m for m in markets}
        competitors_by_id = {c["id"]: c["name"] for c in competitors}
        
        self.logger.debug(f"Events: {len(events)}, Markets: {len(markets)}, Odds: {len(odds_data)}, Competitors: {len(competitors)}")
        
        for event in events:
            try:
                event_id = event.get("id")
                competitor_ids = event.get("competitorIds", [])
                market_ids = event.get("marketIds", [])
                start_date_str = event.get("startDate")
                
                if len(competitor_ids) < 2:
                    continue
                
                # Get team names from competitors mapping
                home_team = competitors_by_id.get(competitor_ids[0], "")
                away_team = competitors_by_id.get(competitor_ids[1], "")
                
                if not home_team or not away_team:
                    continue
                
                # Parse match date
                match_date = datetime.now()
                if start_date_str:
                    try:
                        match_date = datetime.fromisoformat(start_date_str.replace("Z", "+00:00"))
                    except:
                        pass
                
                # Find the 1x2 market (typeId == 1) from this event's marketIds
                market_1x2 = None
                for market_id in market_ids:
                    market = markets_by_id.get(market_id)
                    if market and market.get("typeId") == 1:
                        market_1x2 = market
                        break
                
                if not market_1x2:
                    continue
                
                odd_ids = market_1x2.get("oddIds", [])
                if len(odd_ids) < 3:
                    continue
                
                # Extract Home, Draw, Away odds
                home_odd = None
                draw_odd = None
                away_odd = None
                
                for odd_id in odd_ids:
                    odd = odds_by_id.get(odd_id)
                    if not odd:
                        continue
                    
                    type_id = odd.get("typeId")
                    price = odd.get("price")
                    
                    if type_id == 1:  # Home
                        home_odd = price
                    elif type_id == 2:  # Draw
                        draw_odd = price
                    elif type_id == 3:  # Away
                        away_odd = price
                
                if home_odd and draw_odd and away_odd:
                    scraped = ScrapedOdds(
                        bookmaker_name="estrelabet",
                        home_team_raw=home_team,
                        away_team_raw=away_team,
                        league_raw=league_name,
                        match_date=match_date,
                        home_odd=float(home_odd),
                        draw_odd=float(draw_odd),
                        away_odd=float(away_odd),
                        market_type="1x2",
                        extra_data={
                            "estrelabet_event_id": str(event_id),
                        }
                    )
                    results.append(scraped)
                    
            except Exception as e:
                self.logger.debug(f"Error parsing event: {e}")
                continue
        
        return results


# Test the scraper directly
if __name__ == "__main__":
    import asyncio
    
    async def run_test():
        scraper = EstrelabetScraper()
        await scraper.setup()
        
        try:
            leagues = await scraper.get_available_leagues()
            print(f"Available leagues: {[l.name for l in leagues]}")
            
            for league in leagues:
                print(f"\nScraping {league.name}...")
                odds = await scraper.scrape_league(league)
                
                for odd in odds[:3]:  # Show first 3
                    print(f"  {odd.home_team_raw} vs {odd.away_team_raw}")
                    print(f"    Odds: {odd.home_odd} - {odd.draw_odd} - {odd.away_odd}")
                    print(f"    Event ID: {odd.extra_data.get('estrelabet_event_id')}")
                
                print(f"  Total: {len(odds)} matches")
        finally:
            await scraper.teardown()
    
    asyncio.run(run_test())

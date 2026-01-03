"""
NBA Scraper Template - Example for basketball scrapers.
This template shows how to implement a scraper for NBA games using the moneyline market.

Key differences from football scrapers:
1. sport = "basketball" (instead of "football")
2. market_type = "moneyline" (instead of "1x2")
3. draw_odd = None (basketball has no draw)
"""

from datetime import datetime
from typing import List, Dict, Any
from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


class NBAScraperTemplate(BaseScraper):
    """
    Template scraper for NBA odds.
    
    IMPORTANT for all NBA scrapers:
    - Set sport="basketball" in ScrapedOdds
    - Set market_type="moneyline" in ScrapedOdds
    - Set draw_odd=None (no draw in basketball)
    - Handle potential team name inversions in exchanges
    """
    
    # League configuration for NBA
    LEAGUES = {
        "nba": LeagueConfig(
            league_id="nba",
            name="NBA",
            url="/api/basketball/nba",  # Example API endpoint
            country="EUA"
        ),
    }
    
    def __init__(self):
        super().__init__(
            name="nba_template",
            base_url="https://example-bookmaker.com"
        )
    
    async def get_available_leagues(self) -> List[LeagueConfig]:
        """Return available basketball leagues."""
        return list(self.LEAGUES.values())
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """
        Scrape odds for an NBA league.
        
        Example implementation showing the key differences for basketball.
        """
        odds_list = []
        
        # Example data - replace with actual API call
        example_games = [
            {
                "home_team": "Los Angeles Lakers",
                "away_team": "Boston Celtics",
                "match_date": datetime(2026, 1, 10, 20, 0),
                "home_odd": 1.85,
                "away_odd": 2.05,
                "event_id": "12345"
            },
            {
                "home_team": "Golden State Warriors",
                "away_team": "Miami Heat",
                "match_date": datetime(2026, 1, 10, 22, 30),
                "home_odd": 1.65,
                "away_odd": 2.30,
                "event_id": "12346"
            }
        ]
        
        for game in example_games:
            scraped = ScrapedOdds(
                bookmaker_name=self.name,
                home_team_raw=game["home_team"],
                away_team_raw=game["away_team"],
                league_raw=league.name,  # "NBA"
                match_date=game["match_date"],
                home_odd=game["home_odd"],
                draw_odd=None,  # IMPORTANT: No draw in basketball
                away_odd=game["away_odd"],
                sport="basketball",  # IMPORTANT: Set sport type
                market_type="moneyline",  # IMPORTANT: Moneyline market
                odds_type="PA",  # Most bookmakers use PA
                extra_data={
                    "event_id": game["event_id"],
                    # Add any bookmaker-specific data needed for link generation
                }
            )
            odds_list.append(scraped)
        
        return odds_list


# =============================================================================
# Example: KTO NBA Scraper (based on existing KTO football scraper)
# =============================================================================

class KTONBAScraper(BaseScraper):
    """
    KTO scraper for NBA using the Kambi API.
    
    The Kambi API structure for basketball is similar to football,
    but uses different sport/region/league identifiers.
    """
    
    # Kambi API identifiers for NBA
    SPORT_ID = "basketball"  # or numeric ID depending on API
    REGION_ID = "us"  # or "usa"
    LEAGUE_ID = "nba"
    
    LEAGUES = {
        "nba": LeagueConfig(
            league_id="nba",
            name="NBA",
            url=f"/offering/v2018/{SPORT_ID}/{REGION_ID}/{LEAGUE_ID}/matches.json",
            country="EUA"
        ),
    }
    
    def __init__(self):
        super().__init__(
            name="kto",  # Same bookmaker name
            base_url="https://eu-offering-api.kambicdn.com"
        )
    
    async def get_available_leagues(self) -> List[LeagueConfig]:
        return list(self.LEAGUES.values())
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """
        Scrape NBA odds from KTO/Kambi API.
        
        The main difference from football:
        - Look for "Match Result" or "Moneyline" market (2 outcomes)
        - No draw outcome
        """
        odds_list = []
        
        # Fetch data from Kambi API
        # url = f"{self.base_url}{league.url}"
        # response = await self.http_client.get(url, headers=self.headers)
        # data = response.json()
        
        # Parse events
        # for event in data.get("events", []):
        #     # Find Moneyline market (usually has 2 outcomes)
        #     for market in event.get("markets", []):
        #         if market.get("marketName") == "Match Result":
        #             outcomes = market.get("outcomes", [])
        #             if len(outcomes) == 2:  # Moneyline has exactly 2 outcomes
        #                 home_odd = outcomes[0]["price"] / 1000
        #                 away_odd = outcomes[1]["price"] / 1000
        #                 
        #                 scraped = ScrapedOdds(
        #                     bookmaker_name=self.name,
        #                     home_team_raw=event["homeName"],
        #                     away_team_raw=event["awayName"],
        #                     league_raw="NBA",
        #                     match_date=parse_date(event["start"]),
        #                     home_odd=home_odd,
        #                     draw_odd=None,  # No draw in basketball
        #                     away_odd=away_odd,
        #                     sport="basketball",
        #                     market_type="moneyline",
        #                     odds_type="PA",
        #                     extra_data={
        #                         "event_id": event["id"],
        #                         "league_path": f"basketball/usa/nba",
        #                     }
        #                 )
        #                 odds_list.append(scraped)
        
        return odds_list


# =============================================================================
# IMPORTANT NOTES FOR NBA IMPLEMENTATION
# =============================================================================
"""
1. DATABASE SETUP:
   - Run the migration: docs/migration-add-sport-type.sql
   - This creates the sport_type enum and adds NBA league

2. TEAM SETUP:
   - Add NBA teams to the 'teams' table with league_id pointing to NBA
   - Add team aliases for each bookmaker's naming convention

3. FRONTEND:
   - The frontend automatically detects sport_type and renders 2-way odds
   - No draw column shown for basketball
   - Surebet calculator uses 2-way formula

4. ODDS TYPE CONSIDERATIONS:
   - Most bookmakers use "PA" (Pagamento Antecipado) for NBA
   - Some exchanges may offer "SO" (Super Odds)

5. LINK GENERATION:
   - Update generateBookmakerLink() in OddsComparisonTable.tsx 
   - Add basketball-specific URL patterns for each bookmaker

6. EXCHANGE HANDLING:
   - Exchanges like Betbra may invert home/away teams
   - Store original order in extra_data if needed
   - Use extra_data.teams_inverted flag to handle inversions
"""

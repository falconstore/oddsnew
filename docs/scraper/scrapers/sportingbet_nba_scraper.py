"""
Sportingbet NBA Scraper - API bwin/CDS for basketball.
Based on the football scraper but configured for NBA basketball.
"""

import httpx
from datetime import datetime
from typing import List, Optional, Dict, Any
from loguru import logger
from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


class SportingbetNBAScraper(BaseScraper):
    """
    Scraper para Sportingbet Brasil - NBA Basketball.
    Usa API CDS (bwin) com sportId=7 para basquete.
    """
    
    API_BASE = "https://www.sportingbet.bet.br/cds-api/bettingoffer/fixtures"
    
    # x-bwin-accessid extracted from the site
    ACCESS_ID = "YTRhMjczYjctNTBlNy00MWZlLTliMGMtMWNkOWQxMThmZTI2"
    
    LEAGUES = {
        "nba": {
            "region_id": "9",       # USA
            "competition_id": "6004",  # NBA
            "name": "NBA",
            "country": "EUA"
        },
    }
    
    def __init__(self):
        super().__init__(name="sportingbet_nba", base_url="https://www.sportingbet.bet.br")
        self.client: Optional[httpx.AsyncClient] = None
        self.logger = logger.bind(component="sportingbet_nba")
    
    async def setup(self):
        """Initialize HTTP client."""
        self.logger.info("[Sportingbet NBA] Iniciando sessao HTTP...")
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "accept": "application/json, text/plain, */*",
                "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
                "referer": "https://www.sportingbet.bet.br/pt-br/sports/basquete-7/aposta/am%C3%A9rica-do-norte-9/nba-6004",
                "x-bwin-browser-url": "https://www.sportingbet.bet.br/pt-br/sports/basquete-7/aposta/am%C3%A9rica-do-norte-9/nba-6004",
                "X-From-Product": "host-app",
                "X-Device-Type": "desktop",
            }
        )
    
    async def teardown(self):
        """Close HTTP client."""
        if self.client:
            await self.client.aclose()
            self.client = None

    async def get_available_leagues(self) -> List[LeagueConfig]:
        """Return list of configured leagues."""
        return [
            LeagueConfig(
                league_id=league_id,
                name=config["name"],
                url="",
                country=config["country"]
            ) 
            for league_id, config in self.LEAGUES.items()
        ]
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """Scrape odds for a specific league (NBA)."""
        if not self.client:
            await self.setup()
        
        # Simplified params - no regionIds or competitionIds to avoid HTTP 400
        params = {
            "x-bwin-accessid": self.ACCESS_ID,
            "lang": "pt-br",
            "country": "BR",
            "userCountry": "BR",
            "fixtureTypes": "Standard",
            "state": "Latest",
            "offerMapping": "Filtered",
            "offerCategories": "Gridable",
            "fixtureCategories": "Gridable,NonGridable,Other",
            "sportIds": "7",  # Basketball only
            "isPriceBoost": "false",
            "statisticsModes": "None",
            "skip": "0",
            "take": "50",
            "sortBy": "Tags"
        }
        
        self.logger.info(f"[Sportingbet NBA] Buscando {league.name}...")
        
        try:
            response = await self.client.get(self.API_BASE, params=params)
            response.raise_for_status()
            data = response.json()
            return self._parse_response(data, league.name)
        except httpx.HTTPStatusError as e:
            self.logger.error(f"[Sportingbet NBA] Erro HTTP: {e.response.status_code}")
            return []
        except Exception as e:
            self.logger.error(f"[Sportingbet NBA] Erro: {e}")
            return []

    def _parse_response(self, data: Dict[str, Any], league_name: str) -> List[ScrapedOdds]:
        """Parse API response and extract NBA moneyline odds."""
        results = []
        fixtures = data.get("fixtures", [])
        
        self.logger.debug(f"[Sportingbet NBA] Processando {len(fixtures)} fixtures...")
        
        for fixture in fixtures:
            try:
                # Filter by competition if present (accept if missing since API already filters basketball)
                competition = fixture.get("competition", {})
                if competition:
                    comp_name = competition.get("name", {}).get("value", "").upper()
                    if comp_name and "NBA" not in comp_name:
                        continue
                
                # Extract teams from participants
                # Teams are participants WITHOUT properties.type (players have type="Player")
                participants = fixture.get("participants", [])
                teams = []
                
                for p in participants:
                    props = p.get("properties", {})
                    # Teams don't have properties.type, players have type="Player"
                    if not props.get("type"):
                        team_name = p.get("name", {}).get("value", "")
                        if team_name:
                            teams.append(team_name)
                    if len(teams) >= 2:
                        break
                
                if len(teams) < 2:
                    self.logger.debug(f"[Sportingbet NBA] Fixture sem 2 times encontrados")
                    continue
                
                # In Sportingbet NBA API: first team in participants list corresponds to sourceName="1"
                # and second team to sourceName="2". We'll map them after finding odds.
                team_by_source = {"1": teams[0], "2": teams[1]}
                
                # Parse match date
                start_date = fixture.get("startDate", "")
                try:
                    dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                except Exception:
                    dt = datetime.now()
                
                # Find Moneyline market in optionMarkets
                # For basketball, look for "Vencedor" market (TemplateId 3450)
                markets = fixture.get("optionMarkets", [])
                home_odd = None
                away_odd = None
                home_team = ""
                away_team = ""
                
                for market in markets:
                    market_name = market.get("name", {}).get("value", "")
                    
                    # Only process main Moneyline market "Vencedor" (not "Vencedor - 1º Tempo" etc)
                    if market_name == "Vencedor":
                        options = market.get("options", [])
                        for opt in options:
                            source_name = opt.get("sourceName", {}).get("value", "")
                            price = opt.get("price", {}).get("odds")
                            
                            if price and source_name:
                                # sourceName "1" = Away team, "2" = Home team (NBA convention)
                                if source_name == "1":
                                    away_odd = price
                                    away_team = team_by_source.get("1", "")
                                elif source_name == "2":
                                    home_odd = price
                                    home_team = team_by_source.get("2", "")
                        break
                
                # Only add if both odds are found
                if home_odd and away_odd and home_team and away_team:
                    # Extract fixture ID (remove prefix if present)
                    fixture_id = str(fixture.get("id", ""))
                    if ":" in fixture_id:
                        fixture_id = fixture_id.split(":")[-1]
                    
                    scraped = ScrapedOdds(
                        bookmaker_name="sportingbet",
                        home_team_raw=home_team.strip(),
                        away_team_raw=away_team.strip(),
                        league_raw=league_name,
                        match_date=dt,
                        home_odd=home_odd,
                        draw_odd=None,  # No draw in basketball
                        away_odd=away_odd,
                        sport="basketball",
                        market_type="moneyline",
                        extra_data={
                            "fixture_id": fixture_id,
                            "home_team_raw": home_team.strip(),
                            "away_team_raw": away_team.strip(),
                            "sport_type": "basketball"
                        }
                    )
                    results.append(scraped)
                    self.logger.debug(f"[Sportingbet NBA] {home_team} vs {away_team}: {home_odd} / {away_odd}")
                    
            except Exception as e:
                self.logger.debug(f"[Sportingbet NBA] Erro ao processar fixture: {e}")
                continue
        
        self.logger.info(f"[Sportingbet NBA] {league_name}: {len(results)} jogos coletados")
        return results


# Test directly
if __name__ == "__main__":
    import asyncio

    async def run():
        s = SportingbetNBAScraper()
        await s.setup()
        try:
            lg = LeagueConfig(league_id="nba", name="NBA", url="", country="EUA")
            odds = await s.scrape_league(lg)
            
            print(f"\n--- Resultado ({len(odds)} odds) ---")
            for o in odds[:5]:
                print(f"  {o.home_team_raw} x {o.away_team_raw}")
                print(f"    Odds: {o.home_odd:.2f} - {o.away_odd:.2f}")
        finally:
            await s.teardown()
            
    asyncio.run(run())

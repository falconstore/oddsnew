"""
Sportingbet Unified Scraper - Football and NBA Basketball.
Uses bwin/CDS API with shared httpx session.

Sport IDs:
- Football: sportIds=4
- Basketball: sportIds=7
"""

import httpx
from datetime import datetime
from typing import List, Optional, Dict, Any
from loguru import logger
from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


class SportingbetScraper(BaseScraper):
    """
    Unified scraper for Sportingbet Brasil (CDS/bwin API).
    Handles both Football (1X2) and Basketball (Moneyline).
    """
    
    API_BASE = "https://www.sportingbet.bet.br/cds-api/bettingoffer/fixtures"
    
    # x-bwin-accessid (may need periodic updates)
    ACCESS_ID = "YTRhMjczYjctNTBlNy00MWZlLTliMGMtMWNkOWQxMThmZTI2"
    
    # Sport IDs
    SPORT_FOOTBALL = "4"
    SPORT_BASKETBALL = "7"
    
    # Football leagues
    FOOTBALL_LEAGUES = {
        "premier_league": {
            "region_id": "14",
            "competition_id": "102841",
            "name": "Premier League",
            "country": "Inglaterra"
        },
        "la_liga": {
            "region_id": "28",
            "competition_id": "102829",
            "name": "La Liga",
            "country": "Espanha"
        },
        "serie_a": {
            "region_id": "20",
            "competition_id": "102846",
            "name": "Serie A",
            "country": "Itália"
        },
        "bundesliga": {
            "region_id": "17",
            "competition_id": "102842",
            "name": "Bundesliga",
            "country": "Alemanha"
        },
        "ligue_1": {
            "region_id": "16",
            "competition_id": "102843",
            "name": "Ligue 1",
            "country": "Franca"
        },
        "paulistao": {
            "region_id": "33",
            "competition_id": "102148",
            "name": "Paulistao",
            "country": "Brasil"
        },
        "fa_cup": {
            "region_id": "14",
            "competition_id": "102802",
            "name": "FA Cup",
            "country": "Inglaterra"
        },
        "efl_cup": {
            "region_id": "14",
            "competition_id": "102782",
            "name": "EFL Cup",
            "country": "Inglaterra"
        },
        "copa_do_rei": {
            "region_id": "28",
            "competition_id": "102728",
            "name": "Copa do Rei",
            "country": "Espanha"
        },
        "champions_league": {
            "region_id": "7",
            "competition_id": "102855",
            "name": "Champions League",
            "country": "Europa"
        },
        "liga_europa": {
            "region_id": "7",
            "competition_id": "102856",
            "name": "Liga Europa",
            "country": "Europa"
        },
        "eredivisie": {
            "region_id": "36",
            "competition_id": "102847",
            "name": "Eredivisie",
            "country": "Holanda"
        },
        "liga_da_conferencia": {
            "region_id": "7",
            "competition_id": "102919",
            "name": "Liga da Conferência",
            "country": "Europa"
        },
    }
    
    # Basketball leagues
    BASKETBALL_LEAGUES = {
        "nba": {
            "region_id": "9",
            "competition_id": "6004",
            "name": "NBA",
            "country": "EUA"
        },
    }
    
    # Compatibility alias
    LEAGUES = FOOTBALL_LEAGUES
    
    def __init__(self):
        super().__init__(name="sportingbet", base_url="https://www.sportingbet.bet.br")
        self.client: Optional[httpx.AsyncClient] = None
        self.logger = logger.bind(component="sportingbet")
    
    async def setup(self):
        """Initialize HTTP client."""
        self.logger.info("[Sportingbet] Iniciando sessao HTTP...")
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "accept": "application/json, text/plain, */*",
                "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
                "referer": "https://www.sportingbet.bet.br/",
                "x-bwin-browser-url": "https://www.sportingbet.bet.br/",
                "X-From-Product": "host-app",
                "X-Device-Type": "desktop",
            }
        )
    
    async def teardown(self):
        """Close HTTP client."""
        if self.client:
            await self.client.aclose()
            self.client = None
        self.logger.info("[Sportingbet] Sessao HTTP encerrada")

    async def get_available_leagues(self) -> List[LeagueConfig]:
        """Return list of configured football leagues (for compatibility)."""
        return [
            LeagueConfig(
                league_id=league_id,
                name=config["name"],
                url="",
                country=config["country"]
            ) 
            for league_id, config in self.FOOTBALL_LEAGUES.items()
        ]
    
    async def scrape_all(self) -> List[ScrapedOdds]:
        """Scrape all sports using shared HTTP session."""
        all_odds = []
        await self.setup()
        
        try:
            # Football leagues (1X2)
            for league_id, config in self.FOOTBALL_LEAGUES.items():
                odds = await self._scrape_football(league_id, config)
                all_odds.extend(odds)
            
            # Basketball leagues (Moneyline)
            for league_id, config in self.BASKETBALL_LEAGUES.items():
                odds = await self._scrape_basketball(league_id, config)
                all_odds.extend(odds)
            
            self.logger.info(f"[Sportingbet] Total: {len(all_odds)} odds coletadas")
            
        finally:
            await self.teardown()
        
        return all_odds
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """Scrape odds for a specific football league (compatibility method)."""
        if not self.client:
            await self.setup()
        
        league_config = self.FOOTBALL_LEAGUES.get(league.league_id, {})
        if not league_config:
            self.logger.warning(f"[Sportingbet] Liga nao configurada: {league.league_id}")
            return []
        
        return await self._scrape_football(league.league_id, league_config)
    
    async def _scrape_football(self, league_id: str, config: Dict[str, Any]) -> List[ScrapedOdds]:
        """Scrape football odds (1X2 market)."""
        region_id = config.get("region_id")
        competition_id = config.get("competition_id")
        league_name = config.get("name")
        
        if not region_id or not competition_id:
            return []
        
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
            "sportIds": self.SPORT_FOOTBALL,
            "regionIds": region_id,
            "competitionIds": competition_id,
            "isPriceBoost": "false",
            "statisticsModes": "None",
            "skip": "0",
            "take": "50",
            "sortBy": "Tags"
        }
        
        try:
            response = await self.client.get(self.API_BASE, params=params)
            response.raise_for_status()
            data = response.json()
            return self._parse_football_response(data, league_name, region_id)
        except httpx.HTTPStatusError as e:
            self.logger.error(f"[Sportingbet] HTTP {e.response.status_code} - {league_name}")
            return []
        except Exception as e:
            self.logger.error(f"[Sportingbet] Erro {league_name}: {e}")
            return []
    
    async def _scrape_basketball(self, league_id: str, config: Dict[str, Any]) -> List[ScrapedOdds]:
        """Scrape basketball odds (Moneyline market)."""
        league_name = config.get("name")
        
        # NBA API requires no regionIds/competitionIds to avoid HTTP 400
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
            "sportIds": self.SPORT_BASKETBALL,
            "isPriceBoost": "false",
            "statisticsModes": "None",
            "skip": "0",
            "take": "50",
            "sortBy": "Tags"
        }
        
        self.logger.info(f"[Sportingbet] Buscando NBA...")
        
        try:
            response = await self.client.get(self.API_BASE, params=params)
            response.raise_for_status()
            data = response.json()
            return self._parse_basketball_response(data, league_name)
        except httpx.HTTPStatusError as e:
            self.logger.error(f"[Sportingbet NBA] HTTP {e.response.status_code}")
            return []
        except Exception as e:
            self.logger.error(f"[Sportingbet NBA] Erro: {e}")
            return []

    def _parse_football_response(self, data: Dict[str, Any], league_name: str, region_id: str) -> List[ScrapedOdds]:
        """Parse API response for football (1X2)."""
        results = []
        fixtures = data.get("fixtures", [])
        
        for fixture in fixtures:
            try:
                # Extract teams from participants
                participants = fixture.get("participants", [])
                home_team = ""
                away_team = ""
                
                for p in participants:
                    ptype = p.get("properties", {}).get("type")
                    if ptype == "HomeTeam":
                        home_team = p.get("name", {}).get("value", "")
                    elif ptype == "AwayTeam":
                        away_team = p.get("name", {}).get("value", "")
                
                if not home_team or not away_team:
                    continue
                
                # Parse match date
                start_date = fixture.get("startDate", "")
                try:
                    dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                except Exception:
                    dt = datetime.now()
                
                # Find 1X2 market in optionMarkets
                markets = fixture.get("optionMarkets", [])
                home_odd = None
                draw_odd = None
                away_odd = None
                
                for market in markets:
                    market_name = market.get("name", {}).get("value", "")
                    is_main = market.get("isMain", False)
                    
                    if is_main and "Resultado" in market_name:
                        options = market.get("options", [])
                        
                        for opt in options:
                            opt_name = opt.get("name", {}).get("value", "")
                            price = opt.get("price", {}).get("odds")
                            source_name_obj = opt.get("sourceName", {})
                            source_name = source_name_obj.get("value", "") if isinstance(source_name_obj, dict) else str(source_name_obj)
                            
                            if price:
                                if source_name == "1":
                                    home_odd = price
                                elif source_name in ("X", "x"):
                                    draw_odd = price
                                elif source_name == "2":
                                    away_odd = price
                                elif opt_name == "X":
                                    draw_odd = price
                                elif opt_name == home_team:
                                    home_odd = price
                                elif opt_name == away_team:
                                    away_odd = price
                        
                        # Fallback: positional
                        if not (home_odd and draw_odd and away_odd) and len(options) == 3:
                            for i, opt in enumerate(options):
                                opt_name = opt.get("name", {}).get("value", "")
                                price = opt.get("price", {}).get("odds")
                                if price:
                                    if opt_name == "X" or i == 1:
                                        if not draw_odd:
                                            draw_odd = price
                                    elif i == 0 and not home_odd:
                                        home_odd = price
                                    elif i == 2 and not away_odd:
                                        away_odd = price
                        break
                
                if not (home_odd and draw_odd and away_odd):
                    continue
                
                fixture_id = str(fixture.get("id", ""))
                if fixture_id.startswith("2:"):
                    fixture_id = fixture_id[2:]
                
                scraped = ScrapedOdds(
                    bookmaker_name="sportingbet",
                    home_team_raw=home_team.strip(),
                    away_team_raw=away_team.strip(),
                    league_raw=league_name,
                    match_date=dt,
                    home_odd=home_odd,
                    draw_odd=draw_odd,
                    away_odd=away_odd,
                    market_type="1x2",
                    extra_data={
                        "fixture_id": fixture_id,
                        "region_id": region_id,
                        "home_team_raw": home_team.strip(),
                        "away_team_raw": away_team.strip()
                    }
                )
                results.append(scraped)
                
            except Exception as e:
                self.logger.debug(f"[Sportingbet] Erro processando fixture: {e}")
                continue
        
        self.logger.info(f"[Sportingbet] {league_name}: {len(results)} jogos")
        return results

    def _parse_basketball_response(self, data: Dict[str, Any], league_name: str) -> List[ScrapedOdds]:
        """Parse API response for basketball (Moneyline)."""
        results = []
        fixtures = data.get("fixtures", [])
        
        for fixture in fixtures:
            try:
                # Filter by NBA competition
                competition = fixture.get("competition", {})
                if competition:
                    comp_name = competition.get("name", {}).get("value", "").upper()
                    if comp_name and "NBA" not in comp_name:
                        continue
                
                # Extract teams (no type property for basketball)
                participants = fixture.get("participants", [])
                teams = []
                
                for p in participants:
                    props = p.get("properties", {})
                    if not props.get("type"):
                        team_name = p.get("name", {}).get("value", "")
                        if team_name:
                            teams.append(team_name)
                    if len(teams) >= 2:
                        break
                
                if len(teams) < 2:
                    continue
                
                team_by_source = {"1": teams[0], "2": teams[1]}
                
                # Parse match date
                start_date = fixture.get("startDate", "")
                try:
                    dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                except Exception:
                    dt = datetime.now()
                
                # Find Moneyline market "Vencedor"
                markets = fixture.get("optionMarkets", [])
                home_odd = None
                away_odd = None
                home_team = ""
                away_team = ""
                
                for market in markets:
                    market_name = market.get("name", {}).get("value", "")
                    
                    if market_name == "Vencedor":
                        options = market.get("options", [])
                        for opt in options:
                            source_name = opt.get("sourceName", {}).get("value", "")
                            price = opt.get("price", {}).get("odds")
                            
                            if price and source_name:
                                # sourceName "1" = Away, "2" = Home (NBA convention)
                                if source_name == "1":
                                    away_odd = price
                                    away_team = team_by_source.get("1", "")
                                elif source_name == "2":
                                    home_odd = price
                                    home_team = team_by_source.get("2", "")
                        break
                
                if home_odd and away_odd and home_team and away_team:
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
                        draw_odd=None,
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
                    
            except Exception as e:
                self.logger.debug(f"[Sportingbet NBA] Erro processando fixture: {e}")
                continue
        
        self.logger.info(f"[Sportingbet NBA] {len(results)} jogos coletados")
        return results


# Direct test
if __name__ == "__main__":
    import asyncio

    async def run():
        s = SportingbetScraper()
        import time
        start = time.time()
        
        odds = await s.scrape_all()
        
        elapsed = time.time() - start
        print(f"\n--- Resultado: {len(odds)} odds em {elapsed:.2f}s ---")
        
        football = [o for o in odds if o.sport != "basketball"]
        basketball = [o for o in odds if o.sport == "basketball"]
        
        print(f"Futebol: {len(football)} jogos")
        print(f"Basquete: {len(basketball)} jogos")
        
        for o in basketball[:3]:
            print(f"  {o.home_team_raw} x {o.away_team_raw}: {o.home_odd:.2f} / {o.away_odd:.2f}")
            
    asyncio.run(run())

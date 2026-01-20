"""
Scraper para Sportingbet (API bwin/CDS).
A Sportingbet usa a mesma infraestrutura da bwin.
"""

import httpx
from datetime import datetime
from typing import List, Optional, Dict, Any
from loguru import logger
from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


class SportingbetScraper(BaseScraper):
    """
    Scraper para Sportingbet Brasil (API CDS/bwin).
    """
    
    API_BASE = "https://www.sportingbet.bet.br/cds-api/bettingoffer/fixtures"
    
    # x-bwin-accessid extraído do site (pode precisar atualizar periodicamente)
    ACCESS_ID = "YTRhMjczYjctNTBlNy00MWZlLTliMGMtMWNkOWQxMThmZTI2"
    
    LEAGUES = {
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
    }
    
    def __init__(self):
        super().__init__(name="sportingbet", base_url="https://www.sportingbet.bet.br")
        self.client: Optional[httpx.AsyncClient] = None
        self.logger = logger.bind(component="sportingbet")
    
    async def setup(self):
        """Initialize HTTP client."""
        self.logger.info("Iniciando sessão HTTP Sportingbet...")
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "accept": "application/json, text/plain, */*",
                "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
                "referer": "https://www.sportingbet.bet.br/",
                "x-bwin-browser-url": "https://www.sportingbet.bet.br/",
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
        """Scrape odds for a specific league."""
        if not self.client:
            await self.setup()
        
        league_config = self.LEAGUES.get(league.league_id, {})
        region_id = league_config.get("region_id")
        competition_id = league_config.get("competition_id")
        if not region_id or not competition_id:
            self.logger.warning(f"Liga não configurada: {league.league_id}")
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
            "sportIds": "4",  # Futebol
            "regionIds": region_id,
            "competitionIds": competition_id,  # Filtra pela liga específica
            "isPriceBoost": "false",
            "statisticsModes": "None",
            "skip": "0",
            "take": "50",
            "sortBy": "Tags"
        }
        
        self.logger.info(f"Buscando Sportingbet: {league.name}...")
        
        try:
            response = await self.client.get(self.API_BASE, params=params)
            response.raise_for_status()
            data = response.json()
            return self._parse_response(data, league.name, region_id)
        except httpx.HTTPStatusError as e:
            self.logger.error(f"Erro HTTP Sportingbet: {e.response.status_code}")
            return []
        except Exception as e:
            self.logger.error(f"Erro Sportingbet: {e}")
            return []

    def _parse_response(self, data: Dict[str, Any], league_name: str, region_id: str) -> List[ScrapedOdds]:
        """Parse API response and extract odds."""
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
                    self.logger.debug(f"Skipping fixture - missing teams: {fixture.get('id')}")
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
                    
                    # Main market: "Resultado da Partida" (exclude handicap markets like "VP (+2)")
                    if is_main and "Resultado" in market_name and "VP" not in market_name and "(+" not in market_name and "(-" not in market_name:
                        options = market.get("options", [])
                        
                        # Log para debug
                        self.logger.debug(
                            f"Market '{market_name}' for {home_team} vs {away_team}: "
                            f"{[(o.get('name', {}).get('value'), o.get('sourceName', {}).get('value')) for o in options]}"
                        )
                        
                        for opt in options:
                            opt_name = opt.get("name", {}).get("value", "")
                            price = opt.get("price", {}).get("odds")
                            # sourceName é um objeto: {"value": "1"}
                            source_name_obj = opt.get("sourceName", {})
                            source_name = source_name_obj.get("value", "") if isinstance(source_name_obj, dict) else str(source_name_obj)
                            
                            if price:
                                # Método 1: Usar sourceName se disponível (ex: "1", "X", "2")
                                if source_name == "1":
                                    home_odd = price
                                elif source_name == "X" or source_name == "x":
                                    draw_odd = price
                                elif source_name == "2":
                                    away_odd = price
                                # Método 2: Checar o nome da opção
                                elif opt_name == "X":
                                    draw_odd = price
                                elif opt_name == home_team:
                                    home_odd = price
                                elif opt_name == away_team:
                                    away_odd = price
                        
                        # Fallback: Se ainda não encontrou todas, tentar por índice
                        if not (home_odd and draw_odd and away_odd) and len(options) == 3:
                            self.logger.debug(f"Using positional fallback for {home_team} vs {away_team}")
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
                
                # Log detalhado se falhar
                if not (home_odd and draw_odd and away_odd):
                    self.logger.debug(
                        f"Incomplete odds for {home_team} vs {away_team}: "
                        f"H={home_odd}, D={draw_odd}, A={away_odd}"
                    )
                    continue
                
                # Extract fixture ID
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
                self.logger.debug(f"Parsed: {home_team} vs {away_team} | {home_odd} / {draw_odd} / {away_odd}")
                
            except Exception as e:
                self.logger.debug(f"Erro ao processar fixture: {e}")
                continue
        
        self.logger.info(f"Sportingbet {league_name}: {len(results)} jogos encontrados")
        return results

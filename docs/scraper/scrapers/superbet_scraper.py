"""
Superbet Unified Scraper - Football (1X2) and Basketball (Moneyline).
Uses Superbet Brazil REST API.
"""

import aiohttp
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
from loguru import logger
from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


class SuperbetScraper(BaseScraper):
    """
    Unified scraper for Superbet Brazil - Football and Basketball.
    Football: 1X2 market (ID 547)
    Basketball: Moneyline market (ID 759)
    """
    
    API_BASE = "https://production-superbet-offer-br.freetls.fastly.net/v2/pt-BR/events/by-date"
    
    # Sport IDs
    SPORT_FOOTBALL = 5
    SPORT_BASKETBALL = 4
    
    # Market IDs
    MARKET_1X2 = 547           # Resultado Final (Football)
    MARKET_MONEYLINE = 759     # Vencedor Inc. prorrogação (Basketball)
    
    # Football Leagues
    FOOTBALL_LEAGUES = {
        "premier_league": {"id": "106", "name": "Premier League", "country": "Inglaterra"},
        "serie_a": {"id": "104", "name": "Serie A", "country": "Itália"},
        "la_liga": {"id": "98", "name": "La Liga", "country": "Espanha"},
        "bundesliga": {"id": "245", "name": "Bundesliga", "country": "Alemanha"},
        "ligue_1": {"id": "100", "name": "Ligue 1", "country": "Franca"},
        "paulistao": {"id": "20934", "name": "Paulistao A1", "country": "Brasil"},
        "fa_cup": {"id": "107", "name": "FA Cup", "country": "Inglaterra"},
        "efl_cup": {"id": "90", "name": "EFL Cup", "country": "Inglaterra"},
        "copa_do_rei": {"id": "26", "name": "Copa do Rei", "country": "Espanha"},
        "champions_league": {"id": "80794", "name": "Champions League", "country": "Europa"},
        "liga_europa": {"id": "688", "name": "Liga Europa", "country": "Europa"},
        "liga_da_conferencia": {"id": "56652", "name": "Liga da Conferencia", "country": "Europa"},
        "eredivisie": {"id": "256", "name": "Eredivisie", "country": "Holanda"},
        "brasileira_serie_a": {"id": "1698", "name": "Brasileirao Serie A", "country": "Brasil"},
        "libertadores_da_america": {"id": "389", "name": "Copa Libertadores da América", "country": "América do Sul"},
        "carioca": {"id": "21132", "name": "Carioca", "country": "Brasil"},
        "liga_portuguesa": {"id": "142", "name": "Liga Portuguesa", "country": "Portugal"},
    }
    
    # Basketball Leagues
    BASKETBALL_LEAGUES = {
        "nba": {"id": "164", "name": "NBA", "country": "EUA"},
    }
    
    def __init__(self):
        super().__init__(name="superbet", base_url="https://superbet.bet.br")
        self._session: Optional[aiohttp.ClientSession] = None
        self.logger = logger.bind(component="superbet")
    
    async def setup(self):
        """Initialize HTTP session."""
        await super().setup()
        self.logger.info("[Superbet] Iniciando sessao HTTP...")
        self._session = aiohttp.ClientSession(
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0",
                "Accept": "application/json",
                "Accept-Language": "pt-BR,pt;q=0.8,en-US;q=0.5,en;q=0.3",
            }
        )
    
    async def teardown(self):
        """Close HTTP session."""
        if self._session:
            await self._session.close()
            self._session = None
        await super().teardown()

    async def get_available_leagues(self) -> List[LeagueConfig]:
        """Return list of configured leagues (football + basketball)."""
        leagues = []
        for cfg in self.FOOTBALL_LEAGUES.values():
            leagues.append(LeagueConfig(
                league_id=cfg["id"],
                name=cfg["name"],
                url=f"{self.base_url}/apostas/futebol",
                country=cfg["country"]
            ))
        for cfg in self.BASKETBALL_LEAGUES.values():
            leagues.append(LeagueConfig(
                league_id=cfg["id"],
                name=cfg["name"],
                url=f"{self.base_url}/apostas/basquete",
                country=cfg["country"]
            ))
        return leagues
    
    async def scrape_all(self) -> List[ScrapedOdds]:
        """Scrape all leagues for both sports using a single HTTP session."""
        all_odds = []
        await self.setup()
        
        try:
            # Football (1X2)
            for league_id, config in self.FOOTBALL_LEAGUES.items():
                try:
                    odds = await self._scrape_sport(
                        config, 
                        self.SPORT_FOOTBALL, 
                        self.MARKET_1X2,
                        "football"
                    )
                    all_odds.extend(odds)
                except Exception as e:
                    self.logger.error(f"[Superbet] Erro na liga {config['name']}: {e}")
            
            # Basketball (Moneyline)
            for league_id, config in self.BASKETBALL_LEAGUES.items():
                try:
                    odds = await self._scrape_sport(
                        config, 
                        self.SPORT_BASKETBALL, 
                        self.MARKET_MONEYLINE,
                        "basketball"
                    )
                    all_odds.extend(odds)
                except Exception as e:
                    self.logger.error(f"[Superbet] Erro na liga {config['name']}: {e}")
                    
        finally:
            await self.teardown()
        
        self.logger.info(f"[Superbet] Total: {len(all_odds)} odds coletadas")
        return all_odds
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """Legacy method for compatibility with base scraper."""
        if not self._session:
            await self.setup()
        
        # Check if it's a basketball league
        for key, config in self.BASKETBALL_LEAGUES.items():
            if config["id"] == league.league_id or config["name"] == league.name:
                return await self._scrape_sport(config, self.SPORT_BASKETBALL, self.MARKET_MONEYLINE, "basketball")
        
        # Otherwise it's football
        for key, config in self.FOOTBALL_LEAGUES.items():
            if config["id"] == league.league_id or config["name"] == league.name:
                return await self._scrape_sport(config, self.SPORT_FOOTBALL, self.MARKET_1X2, "football")
        
        return []

    async def _scrape_sport(self, config: dict, sport_id: int, 
                            market_id: int, sport: str) -> List[ScrapedOdds]:
        """Generic method to scrape odds for any sport."""
        league_name = config["name"]
        tournament_id = config["id"]
        
        now = datetime.now(timezone.utc)
        start_date = now.strftime("%Y-%m-%d 00:00:00")
        end_date = (now + timedelta(days=30)).strftime("%Y-%m-%d 00:00:00")
        
        url = (
            f"{self.API_BASE}?"
            f"offerState=prematch"
            f"&sportId={sport_id}"
            f"&tournamentIds={tournament_id}"
            f"&startDate={start_date}"
            f"&endDate={end_date}"
        )
        
        self.logger.debug(f"[Superbet] Buscando {league_name}...")
        
        try:
            async with self._session.get(url) as response:
                if response.status != 200:
                    self.logger.warning(f"[Superbet] HTTP {response.status} para {league_name}")
                    return []
                
                data = await response.json()
                
                if data.get("error"):
                    self.logger.error(f"[Superbet] API error para {league_name}: {data}")
                    return []
                
                return self._parse_response(data, league_name, market_id, sport)
                
        except aiohttp.ClientError as e:
            self.logger.error(f"[Superbet] Erro de conexão ({league_name}): {e}")
            return []
        except Exception as e:
            self.logger.error(f"[Superbet] Erro ({league_name}): {e}")
            return []

    def _parse_response(self, data: Dict[str, Any], league_name: str, 
                        market_id: int, sport: str) -> List[ScrapedOdds]:
        """Parse Superbet API response."""
        results = []
        events = data.get("data", [])
        
        if not events:
            self.logger.warning(f"[Superbet] Nenhum evento encontrado para {league_name}")
            return results
        
        for event in events:
            try:
                # Parse team names (separated by · or -)
                match_name = event.get("matchName", "")
                
                if "·" in match_name:
                    parts = match_name.split("·")
                elif " - " in match_name:
                    parts = match_name.split(" - ")
                else:
                    continue
                
                if len(parts) != 2:
                    continue
                
                home_team = parts[0].strip()
                away_team = parts[1].strip()
                
                # Parse match date
                utc_date = event.get("utcDate", "")
                try:
                    match_date = datetime.fromisoformat(utc_date.replace("Z", "+00:00"))
                except:
                    match_date = datetime.now(timezone.utc)
                
                # Extract odds from the correct market
                event_odds = event.get("odds") or []
                if not event_odds:
                    continue
                
                if sport == "football":
                    # 1X2 market
                    home_odd = None
                    draw_odd = None
                    away_odd = None
                    
                    for odd in event_odds:
                        if odd.get("marketId") == market_id:
                            code = odd.get("code")
                            price = odd.get("price")
                            
                            if code == "1":
                                home_odd = price
                            elif code == "0":
                                draw_odd = price
                            elif code == "2":
                                away_odd = price
                    
                    if home_odd and draw_odd and away_odd:
                        results.append(ScrapedOdds(
                            bookmaker_name="superbet",
                            home_team_raw=home_team,
                            away_team_raw=away_team,
                            league_raw=league_name,
                            match_date=match_date,
                            home_odd=home_odd,
                            draw_odd=draw_odd,
                            away_odd=away_odd,
                            market_type="1x2",
                            extra_data={
                                "event_id": str(event.get("eventId", "")),
                                "match_id": str(event.get("matchId", ""))
                            }
                        ))
                
                else:  # basketball
                    # Moneyline market
                    home_odd = None
                    away_odd = None
                    
                    for odd in event_odds:
                        if odd.get("marketId") == market_id:
                            code = odd.get("code")
                            price = odd.get("price")
                            
                            if code == "1":
                                home_odd = price
                            elif code == "2":
                                away_odd = price
                    
                    if home_odd and away_odd:
                        results.append(ScrapedOdds(
                            bookmaker_name="superbet",
                            home_team_raw=home_team,
                            away_team_raw=away_team,
                            league_raw=league_name,
                            match_date=match_date,
                            home_odd=home_odd,
                            draw_odd=None,
                            away_odd=away_odd,
                            sport="basketball",
                            market_type="moneyline",
                            extra_data={
                                "event_id": str(event.get("eventId", "")),
                                "match_id": str(event.get("matchId", ""))
                            }
                        ))
                        
            except Exception as e:
                self.logger.debug(f"[Superbet] Erro ao processar evento: {e}")
                continue
        
        self.logger.info(f"[Superbet] {league_name}: {len(results)} jogos coletados")
        return results


# Test
if __name__ == "__main__":
    import asyncio

    async def run():
        s = SuperbetScraper()
        odds = await s.scrape_all()
        
        print(f"\n--- Resultado ({len(odds)} odds) ---")
        
        # Football
        football = [o for o in odds if o.sport == "football"]
        print(f"\nFutebol: {len(football)} odds")
        for o in football[:3]:
            print(f"  {o.home_team_raw} x {o.away_team_raw}")
            print(f"    Odds: {o.home_odd:.2f} - {o.draw_odd:.2f} - {o.away_odd:.2f}")
        
        # Basketball
        basketball = [o for o in odds if o.sport == "basketball"]
        print(f"\nBasquete: {len(basketball)} odds")
        for o in basketball[:3]:
            print(f"  {o.home_team_raw} x {o.away_team_raw}")
            print(f"    Odds: {o.home_odd:.2f} - {o.away_odd:.2f}")
            
    asyncio.run(run())

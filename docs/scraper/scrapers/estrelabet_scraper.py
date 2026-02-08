"""
Estrelabet Unified Scraper - Direct API access via Altenar backend.

Supports both Football (1X2) and Basketball/NBA (Moneyline).
Uses httpx for simple HTTP requests (no Playwright needed).
"""

import httpx
from datetime import datetime
from typing import List, Optional, Dict, Any
from loguru import logger
from dateutil import parser as date_parser

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


class EstrelabetScraper(BaseScraper):
    """
    Scraper unificado para EstrelaBet (API Altenar V2).
    Suporta Futebol (1X2) e Basquete/NBA (Moneyline).
    """
    
    API_BASE_URL = "https://sb2frontend-altenar2.biahosted.com/api/widget/GetEvents"
    
    # Football leagues (sportId=66, market typeId=1 for 1X2)
    FOOTBALL_LEAGUES = {
        "serie_a": {"champ_id": "2942", "name": "Serie A", "country": "Italia"},
        "premier_league": {"champ_id": "2936", "name": "Premier League", "country": "Inglaterra"},
        "la_liga": {"champ_id": "2941", "name": "La Liga", "country": "Espanha"},
        "bundesliga": {"champ_id": "2950", "name": "Bundesliga", "country": "Alemanha"},
        "ligue_1": {"champ_id": "2943", "name": "Ligue 1", "country": "Franca"},
        "paulista": {"champ_id": "3436", "name": "Paulistao A1", "country": "Brasil"},
        "fa_cup": {"champ_id": "2935", "name": "FA Cup", "country": "Inglaterra"},
        "efl_cup": {"champ_id": "2972", "name": "EFL Cup", "country": "Inglaterra"},
        "champions_league": {"champ_id": "16808", "name": "Champions League", "country": "Europa"},
        "copa_do_rei": {"champ_id": "2973", "name": "Copa do Rei", "country": "Espanha"},
        "liga_europa": {"champ_id": "16809", "name": "Liga Europa", "country": "Europa"},
        "liga_da_conferencia": {"champ_id": "31608", "name": "Liga da Conferencia", "country": "Europa"},
        "eredivisie": {"champ_id": "3065", "name": "Eredivisie", "country": "Holanda"},
        "brasileirao_serie_a": {"champ_id": "11318", "name": "Brasileirão Série A", "country": "Brasil"},
        "libertadores": {"champ_id": "3709", "name": "Libertadores", "country": "America"},
        "liga_portuguesa": {"champ_id": "3152", "name": "Liga Portuguesa", "country": "Portugal"},
        "carioca": {"champ_id": "3357", "name": "Carioca", "country": "Brasil"},
    }
    
    # Basketball leagues (sportId=67, market typeId=219 for Moneyline)
    BASKETBALL_LEAGUES = {
        "nba": {"champ_id": "2980", "name": "NBA", "country": "eua"},
    }
    
    def __init__(self):
        super().__init__(name="estrelabet", base_url="https://www.estrelabet.bet.br")
        self.client: Optional[httpx.AsyncClient] = None
        self.logger = logger.bind(component="estrelabet")
    
    async def setup(self):
        """Initialize HTTP client once for all sports."""
        self.logger.info("Iniciando sessão HTTP EstrelaBet (unificado)...")
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "accept": "*/*",
                "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
                "origin": "https://www.estrelabet.bet.br",
                "referer": "https://www.estrelabet.bet.br/",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            }
        )
    
    async def teardown(self):
        if self.client:
            await self.client.aclose()
            self.client = None

    async def get_available_leagues(self) -> List[LeagueConfig]:
        """Return all configured leagues (football + basketball)."""
        leagues = []
        for k, v in self.FOOTBALL_LEAGUES.items():
            leagues.append(LeagueConfig(league_id=k, name=v["name"], url="", country=v["country"]))
        for k, v in self.BASKETBALL_LEAGUES.items():
            leagues.append(LeagueConfig(league_id=k, name=v["name"], url="", country=v["country"]))
        return leagues

    async def scrape_all(self) -> List[ScrapedOdds]:
        """
        Scrape all sports using a single HTTP session.
        This is more efficient than separate scrapers.
        """
        all_odds = []
        
        await self.setup()
        
        try:
            # Football (1X2 - 3 way)
            for league_id, config in self.FOOTBALL_LEAGUES.items():
                try:
                    odds = await self._scrape_football(config)
                    all_odds.extend(odds)
                except Exception as e:
                    self.logger.error(f"Erro futebol {config['name']}: {e}")
            
            # Basketball (Moneyline - 2 way)
            for league_id, config in self.BASKETBALL_LEAGUES.items():
                try:
                    odds = await self._scrape_basketball(config)
                    all_odds.extend(odds)
                except Exception as e:
                    self.logger.error(f"Erro basquete {config['name']}: {e}")
                    
        finally:
            await self.teardown()
        
        self.logger.info(f"EstrelaBet unificado: {len(all_odds)} odds totais")
        return all_odds
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """Legacy method for compatibility with base scraper."""
        if not self.client:
            await self.setup()
        
        # Check if it's basketball
        if league.league_id in self.BASKETBALL_LEAGUES or league.name.upper() == "NBA":
            config = self.BASKETBALL_LEAGUES.get(league.league_id)
            if not config:
                config = {"champ_id": "2980", "name": "NBA", "country": "eua"}
            return await self._scrape_basketball(config)
        
        # Otherwise football
        config = self.FOOTBALL_LEAGUES.get(league.league_id)
        if not config:
            for k, v in self.FOOTBALL_LEAGUES.items():
                if v["name"] == league.name:
                    config = v
                    break
        
        if not config:
            return []
            
        return await self._scrape_football(config)

    async def _scrape_football(self, config: dict) -> List[ScrapedOdds]:
        """Fetch 1X2 odds for football."""
        self.logger.info(f"Buscando futebol: {config['name']}")
        
        params = {
            "culture": "pt-BR",
            "timezoneOffset": "-180",
            "integration": "estrelabet",
            "deviceType": "1",
            "numFormat": "en-GB",
            "countryCode": "BR",
            "eventCount": "0",
            "sportId": "66",  # Football
            "champIds": config["champ_id"]
        }
        
        response = await self.client.get(self.API_BASE_URL, params=params)
        response.raise_for_status()
        data = response.json()
        
        return self._parse_football_response(data, config["name"])
    
    async def _scrape_basketball(self, config: dict) -> List[ScrapedOdds]:
        """Fetch Moneyline odds for basketball."""
        self.logger.info(f"Buscando basquete: {config['name']}")
        
        params = {
            "culture": "pt-BR",
            "timezoneOffset": "-180",
            "integration": "estrelabet",
            "deviceType": "1",
            "numFormat": "en-GB",
            "countryCode": "BR",
            "eventCount": "0",
            "sportId": "67",  # Basketball
            "champIds": config["champ_id"]
        }
        
        response = await self.client.get(self.API_BASE_URL, params=params)
        response.raise_for_status()
        data = response.json()
        
        return self._parse_basketball_response(data, config["name"])

    def _parse_football_response(self, data: Dict[str, Any], league_name: str) -> List[ScrapedOdds]:
        """Parse Altenar API response for Football 1X2 odds (PA + SO)."""
        results = []
        
        all_odds = {o["id"]: o for o in data.get("odds", [])}
        all_markets = {m["id"]: m for m in data.get("markets", [])}
        events = data.get("events", [])
        
        for event in events:
            try:
                event_id = event.get("id")
                event_name = event.get("name", "")
                event_name = ' '.join(event_name.split())
                market_ids = event.get("marketIds", [])
                
                if " vs. " in event_name:
                    home_raw, away_raw = event_name.split(" vs. ")
                else:
                    continue
                
                try:
                    dt = datetime.fromisoformat(event.get("startDate", "").replace("Z", "+00:00"))
                except:
                    dt = datetime.now()
                
                odds_by_type = {}
                
                for mid in market_ids:
                    market = all_markets.get(mid)
                    if not market:
                        continue
                    
                    if market.get("typeId") == 1:
                        market_name = market.get("name", "")
                        if "Super Odds" in market_name:
                            odds_type = "SO"
                        else:
                            odds_type = "PA"
                        
                        found_odds = {}
                        for odd_id in market.get("oddIds", []):
                            odd = all_odds.get(odd_id)
                            if not odd:
                                continue
                            
                            price = float(odd.get("price", 0))
                            type_id = odd.get("typeId")
                            
                            if type_id == 1:
                                found_odds['home'] = price
                            elif type_id == 2:
                                found_odds['draw'] = price
                            elif type_id == 3:
                                found_odds['away'] = price
                        
                        if len(found_odds) == 3:
                            odds_by_type[odds_type] = found_odds
                
                for odds_type, found_odds in odds_by_type.items():
                    scraped = ScrapedOdds(
                        bookmaker_name="estrelabet",
                        home_team_raw=home_raw.strip(),
                        away_team_raw=away_raw.strip(),
                        league_raw=league_name,
                        match_date=dt,
                        home_odd=found_odds['home'],
                        draw_odd=found_odds['draw'],
                        away_odd=found_odds['away'],
                        sport="football",
                        market_type="1x2",
                        odds_type=odds_type,
                        extra_data={"event_id": str(event_id)}
                    )
                    results.append(scraped)
                    
            except Exception as e:
                continue

        so_count = len([r for r in results if r.odds_type == "SO"])
        pa_count = len([r for r in results if r.odds_type == "PA"])
        self.logger.info(f"Futebol {league_name}: {pa_count} PA + {so_count} SO = {len(results)} total")
        return results

    def _parse_basketball_response(self, data: Dict[str, Any], league_name: str) -> List[ScrapedOdds]:
        """Parse Altenar API response for Basketball Moneyline odds."""
        results = []
        
        all_odds = {o["id"]: o for o in data.get("odds", [])}
        all_markets = {m["id"]: m for m in data.get("markets", [])}
        events = data.get("events", [])
        
        for event in events:
            try:
                event_id = event.get("id")
                event_name = event.get("name", "")
                event_name = ' '.join(event_name.split())
                market_ids = event.get("marketIds", [])
                
                if " vs. " in event_name:
                    home_raw, away_raw = event_name.split(" vs. ")
                elif " vs " in event_name:
                    home_raw, away_raw = event_name.split(" vs ")
                else:
                    continue
                
                try:
                    dt = date_parser.parse(event.get("startDate", ""))
                except:
                    dt = datetime.now()
                
                # Find Moneyline market (typeId=219)
                found_odds = {}
                
                for mid in market_ids:
                    market = all_markets.get(mid)
                    if not market:
                        continue
                    
                    if market.get("typeId") == 219:
                        for odd_id in market.get("oddIds", []):
                            odd = all_odds.get(odd_id)
                            if not odd:
                                continue
                            
                            price_raw = odd.get("price")
                            if price_raw is None:
                                continue
                            
                            if isinstance(price_raw, dict):
                                price = float(price_raw.get("parsedValue", 0))
                            else:
                                price = float(price_raw)
                            
                            type_id = odd.get("typeId")
                            
                            if type_id == 1:
                                found_odds['home'] = price
                            elif type_id == 3:
                                found_odds['away'] = price
                        
                        break
                
                if 'home' in found_odds and 'away' in found_odds:
                    scraped = ScrapedOdds(
                        bookmaker_name="estrelabet",
                        home_team_raw=home_raw.strip(),
                        away_team_raw=away_raw.strip(),
                        league_raw="NBA",
                        match_date=dt,
                        home_odd=found_odds['home'],
                        draw_odd=None,
                        away_odd=found_odds['away'],
                        sport="basketball",
                        market_type="moneyline",
                        odds_type="PA",
                        extra_data={
                            "event_id": str(event_id),
                            "country": "eua",
                            "sport_type": "basketball"
                        }
                    )
                    results.append(scraped)
                    
            except Exception as e:
                continue

        self.logger.info(f"Basquete {league_name}: {len(results)} jogos")
        return results


# Test
if __name__ == "__main__":
    import asyncio
    
    async def run():
        s = EstrelabetScraper()
        odds = await s.scrape_all()
        
        print(f"\n--- Resultado Total: {len(odds)} jogos ---")
        
        football = [o for o in odds if o.sport == "football"]
        basketball = [o for o in odds if o.sport == "basketball"]
        so_count = len([o for o in football if o.odds_type == "SO"])
        pa_count = len([o for o in football if o.odds_type == "PA"])
        
        print(f"Futebol: {len(football)} ({pa_count} PA + {so_count} SO)")
        print(f"Basquete: {len(basketball)}")
        
        for o in odds[:10]:
            print(f"[{o.odds_type}] {o.home_team_raw} vs {o.away_team_raw} ({o.sport}) - {o.home_odd}/{o.draw_odd}/{o.away_odd}")
            
    asyncio.run(run())

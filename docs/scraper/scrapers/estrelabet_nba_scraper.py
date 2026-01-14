"""
Estrelabet NBA Scraper - Direct API access via Altenar backend.
Uses httpx for simple HTTP requests (no Playwright needed).
"""

import httpx
from datetime import datetime
from typing import List, Optional, Dict, Any
from loguru import logger
from dateutil import parser as date_parser

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


class EstrelabetNBAScraper(BaseScraper):
    """
    Scraper para NBA da EstrelaBet (API Altenar V2).
    Mercado Moneyline (2-way, sem empate).
    """
    
    API_BASE_URL = "https://sb2frontend-altenar2.biahosted.com/api/widget/GetEvents"
    
    LEAGUES = {
        "nba": {"champ_id": "2980", "name": "NBA", "country": "eua"},
    }
    
    def __init__(self):
        super().__init__(name="estrelabet_nba", base_url="https://www.estrelabet.bet.br")
        self.client: Optional[httpx.AsyncClient] = None
        self.logger = logger.bind(component="estrelabet_nba")
    
    async def setup(self):
        self.logger.info("[Estrelabet NBA] Iniciando sessão HTTP...")
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
        return [
            LeagueConfig(league_id=k, name=v["name"], url="", country=v["country"]) 
            for k, v in self.LEAGUES.items()
        ]
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        if not self.client:
            await self.setup()
        
        champ_id = self.LEAGUES.get(league.league_id, {}).get("champ_id")
        if not champ_id:
            for k, v in self.LEAGUES.items():
                if v["name"] == league.name:
                    champ_id = v["champ_id"]
                    break
        
        if not champ_id:
            return []
            
        self.logger.info(f"[Estrelabet NBA] Buscando API: {league.name} (ID: {champ_id})")
        
        try:
            params = {
                "culture": "pt-BR",
                "timezoneOffset": "-180",
                "integration": "estrelabet",
                "deviceType": "1",
                "numFormat": "en-GB",
                "countryCode": "BR",
                "eventCount": "0",
                "sportId": "67",  # Basketball
                "champIds": champ_id
            }
            
            response = await self.client.get(self.API_BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()
            
            return self._parse_response(data, league.name)
            
        except Exception as e:
            self.logger.error(f"[Estrelabet NBA] Erro na API: {e}")
            return []

    def _parse_response(self, data: Dict[str, Any], league_name: str) -> List[ScrapedOdds]:
        """Parse Altenar API response for NBA Moneyline odds."""
        results = []
        
        # Build lookup maps
        all_odds = {o["id"]: o for o in data.get("odds", [])}
        all_markets = {m["id"]: m for m in data.get("markets", [])}
        events = data.get("events", [])
        
        for event in events:
            try:
                event_id = event.get("id")
                event_name = event.get("name", "")
                event_name = ' '.join(event_name.split())  # Clean whitespace
                market_ids = event.get("marketIds", [])
                
                # Parse team names
                if " vs. " in event_name:
                    home_raw, away_raw = event_name.split(" vs. ")
                elif " vs " in event_name:
                    home_raw, away_raw = event_name.split(" vs ")
                else:
                    continue
                
                # Parse date
                try:
                    dt = date_parser.parse(event.get("startDate", ""))
                except:
                    dt = datetime.now()
                
                # Find Moneyline market (typeId 219 for basketball)
                found_odds = {}
                
                for mid in market_ids:
                    market = all_markets.get(mid)
                    if not market:
                        continue
                    
                    # typeId 219 = Moneyline/Vencedor for basketball
                    if market.get("typeId") == 219:
                        for odd_id in market.get("oddIds", []):
                            odd = all_odds.get(odd_id)
                            if not odd:
                                continue
                            
                            price_raw = odd.get("price")
                            if price_raw is None:
                                continue
                            
                            # Handle price as number or object
                            if isinstance(price_raw, dict):
                                price = float(price_raw.get("parsedValue", 0))
                            else:
                                price = float(price_raw)
                            
                            type_id = odd.get("typeId")  # 1=Home, 3=Away
                            
                            if type_id == 1:
                                found_odds['home'] = price
                            elif type_id == 3:
                                found_odds['away'] = price
                        
                        break  # Found moneyline market
                
                # NBA needs both home and away (no draw)
                if 'home' in found_odds and 'away' in found_odds:
                    scraped = ScrapedOdds(
                        bookmaker_name="estrelabet",
                        home_team_raw=home_raw.strip(),
                        away_team_raw=away_raw.strip(),
                        league_raw="NBA",
                        match_date=dt,
                        home_odd=found_odds['home'],
                        draw_odd=None,  # No draw in basketball
                        away_odd=found_odds['away'],
                        sport="basketball",
                        market_type="moneyline",
                        odds_type="PA",  # NBA uses PA by default
                        extra_data={
                            "estrelabet_event_id": str(event_id),
                            "country": "eua",
                            "sport_type": "basketball"
                        }
                    )
                    results.append(scraped)
                    
            except Exception as e:
                self.logger.debug(f"[Estrelabet NBA] Error parsing event: {e}")
                continue

        self.logger.info(f"[Estrelabet NBA] {len(results)} jogos parseados")
        return results


# Test
if __name__ == "__main__":
    import asyncio
    
    async def run():
        s = EstrelabetNBAScraper()
        await s.setup()
        try:
            leagues = await s.get_available_leagues()
            for lg in leagues:
                odds = await s.scrape_league(lg)
                print(f"\n--- {lg.name}: {len(odds)} jogos ---")
                for o in odds[:5]:
                    print(f"{o.home_team_raw} vs {o.away_team_raw}")
                    print(f"  Odds: {o.home_odd:.2f} / {o.away_odd:.2f}")
        finally:
            await s.teardown()
            
    asyncio.run(run())

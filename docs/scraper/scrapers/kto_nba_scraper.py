"""
KTO NBA Scraper - Scrapes NBA basketball odds from KTO Brazil (Kambi API).
Uses the same API as the football scraper, but for basketball/nba path.
"""

import httpx
from datetime import datetime
from typing import List, Optional, Dict, Any
from loguru import logger
from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


class KtoNBAScraper(BaseScraper):
    """
    Scraper para KTO Brasil - NBA Basketball.
    Usa API Kambi com odds divididas por 1000.
    """
    
    API_BASE = "https://us1.offering-api.kambicdn.com/offering/v2018/ktobr/listView"
    
    # Criterion ID para Moneyline (Vencedor da partida - Incluindo prorrogação)
    MONEYLINE_CRITERION_ID = 1001159732
    
    LEAGUES = {
        "nba": {
            "path": "basketball/nba", 
            "name": "NBA",
            "country": "EUA"
        },
    }
    
    def __init__(self):
        super().__init__(name="kto_nba", base_url="https://www.kto.com")
        self.client: Optional[httpx.AsyncClient] = None
        self.logger = logger.bind(component="kto_nba")
    
    async def setup(self):
        """Initialize HTTP client."""
        self.logger.info("[KTO NBA] Iniciando sessao HTTP...")
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "accept": "*/*",
                "origin": "https://www.kto.bet.br",
                "referer": "https://www.kto.bet.br/",
                "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
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
            LeagueConfig(league_id=k, name=v["name"], url=v["path"], country=v["country"]) 
            for k, v in self.LEAGUES.items()
        ]
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """Scrape odds for a specific league (NBA)."""
        if not self.client: 
            await self.setup()
        
        path = self.LEAGUES.get(league.league_id, {}).get("path")
        if not path:
            for k, v in self.LEAGUES.items():
                if v["name"] == league.name:
                    path = v["path"]
                    break
        
        if not path: 
            return []
        
        url = f"{self.API_BASE}/{path}/all/all/matches.json"
        params = {
            "channel_id": "1",
            "client_id": "200",
            "lang": "pt_BR",
            "market": "BR",
            "useCombined": "true",
            "useCombinedLive": "true"
        }
        
        self.logger.info(f"[KTO NBA] Buscando {league.name}...")
        
        try:
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            return self._parse_response(data, league.name)
        except httpx.HTTPStatusError as e:
            self.logger.error(f"[KTO NBA] Erro HTTP: {e.response.status_code}")
            return []
        except Exception as e:
            self.logger.error(f"[KTO NBA] Erro: {e}")
            return []

    def _parse_response(self, data: Dict[str, Any], league_name: str) -> List[ScrapedOdds]:
        """Parse Kambi API response and extract NBA moneyline odds."""
        results = []
        events_list = data.get("events", [])
        
        for item in events_list:
            try:
                event = item.get("event", {})
                bet_offers = item.get("betOffers", [])
                
                if not event or not bet_offers: 
                    continue
                
                event_id = event.get("id")
                home_team = event.get("homeName")
                away_team = event.get("awayName")
                
                # Se não tiver nomes separados, tenta separar pelo delimitador
                if not home_team or not away_team:
                    event_name = event.get("name", "")
                    if " - " in event_name:
                        parts = event_name.split(" - ")
                        home_team = parts[0].strip()
                        away_team = parts[1].strip()
                    else:
                        continue

                # Parse date
                try:
                    dt = datetime.fromisoformat(event.get("start", "").replace("Z", "+00:00"))
                except:
                    dt = datetime.now()

                # Find Moneyline market (criterion 1001159732)
                match_offer = None
                for offer in bet_offers:
                    criterion = offer.get("criterion", {})
                    if criterion.get("id") == self.MONEYLINE_CRITERION_ID:
                        match_offer = offer
                        break
                
                if not match_offer: 
                    continue
                
                # Extract odds (divide by 1000)
                outcomes = match_offer.get("outcomes", [])
                home_odd = None
                away_odd = None
                
                for out in outcomes:
                    out_type = out.get("type")
                    odds_int = out.get("odds")
                    
                    if not odds_int: 
                        continue
                    
                    decimal_odd = odds_int / 1000.0
                    
                    if out_type == "OT_ONE":
                        home_odd = decimal_odd
                    elif out_type == "OT_TWO":
                        away_odd = decimal_odd
                
                if home_odd and away_odd:
                    scraped = ScrapedOdds(
                        bookmaker_name="kto",
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
                            "event_id": str(event_id),
                            "kambi_offer_id": str(match_offer.get("id")),
                            "sport_type": "basketball",
                            "home_team_slug": home_team.strip(),
                            "away_team_slug": away_team.strip()
                        }
                    )
                    results.append(scraped)
                    
            except Exception as e:
                self.logger.debug(f"[KTO NBA] Erro ao processar evento: {e}")
                continue
        
        self.logger.info(f"[KTO NBA] {league_name}: {len(results)} jogos coletados")
        return results


# Teste direto
if __name__ == "__main__":
    import asyncio

    async def run():
        s = KtoNBAScraper()
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

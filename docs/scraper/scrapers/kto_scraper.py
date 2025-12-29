"""
Scraper para KTO (API Kambi).
A Kambi retorna odds inteiras (ex: 1580) que precisam ser divididas por 1000.
"""

import httpx
from datetime import datetime
from typing import List, Optional, Dict, Any
from loguru import logger
from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


class KtoScraper(BaseScraper):
    """
    Scraper para KTO (Usando API da Kambi).
    A Kambi retorna odds inteiras (ex: 1580) que precisam ser divididas por 1000.
    """
    
    # URL base da API Kambi (KTO Brasil)
    API_BASE = "https://us1.offering-api.kambicdn.com/offering/v2018/ktobr/listView"
    
    # Configuração das Ligas (Caminhos da URL)
    LEAGUES = {
        "serie_a": {
            "path": "football/italy/serie_a", 
            "name": "Serie A",
            "country": "Itália"
        },
        "premier_league": {
            "path": "football/england/premier_league", 
            "name": "Premier League",
            "country": "Inglaterra"
        },
        "la_liga": {
            "path": "football/spain/laliga", 
            "name": "La Liga",
            "country": "Espanha"
        },
        "brasileirao": {
            "path": "football/brazil/brasileirao_serie_a", 
            "name": "Brasileirão Série A",
            "country": "Brasil"
        }
    }
    
    def __init__(self):
        super().__init__(name="kto", base_url="https://www.kto.com")
        self.client: Optional[httpx.AsyncClient] = None
        self.logger = logger.bind(component="kto")
    
    async def setup(self):
        self.logger.info("Iniciando sessão HTTP KTO...")
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "accept": "*/*",
                "origin": "https://www.kto.bet.br",
                "referer": "https://www.kto.bet.br/",
                "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            }
        )
    
    async def teardown(self):
        if self.client:
            await self.client.aclose()
            self.client = None

    async def get_available_leagues(self) -> List[LeagueConfig]:
        return [
            LeagueConfig(league_id=k, name=v["name"], url=v["path"], country=v["country"]) 
            for k, v in self.LEAGUES.items()
        ]
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        if not self.client: await self.setup()
        
        # Pega o caminho da liga (ex: football/italy/serie_a)
        path = self.LEAGUES.get(league.league_id, {}).get("path")
        if not path:
             # Fallback: tenta achar pelo nome se o ID não bater
            for k, v in self.LEAGUES.items():
                if v["name"] == league.name:
                    path = v["path"]
                    break
        
        if not path: return []

        # Monta a URL completa
        url = f"{self.API_BASE}/{path}/all/matches.json"
        
        # Parâmetros padrão da KTO
        params = {
            "channel_id": "1",
            "client_id": "200",  # Cliente KTO Brasil
            "lang": "pt_BR",
            "market": "BR",
            "useCombined": "true"
        }

        self.logger.info(f"Buscando KTO: {league.name}...")
        
        try:
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            return self._parse_kambi_response(data, league.name, path)
            
        except Exception as e:
            self.logger.error(f"Erro na KTO: {e}")
            return []

    def _parse_kambi_response(self, data: Dict[str, Any], league_name: str, league_path: str) -> List[ScrapedOdds]:
        results = []
        events_list = data.get("events", [])
        
        for item in events_list:
            try:
                event = item.get("event", {})
                bet_offers = item.get("betOffers", [])
                
                if not event or not bet_offers: continue
                
                event_id = event.get("id")
                event_name = event.get("name")  # Ex: Roma - Genoa
                home_team = event.get("homeName")
                away_team = event.get("awayName")
                
                # Se não tiver nomes separados, tenta separar pelo delimitador
                if not home_team or not away_team:
                    if " - " in event_name:
                        home_team, away_team = event_name.split(" - ")
                    else:
                        continue

                # Data
                try:
                    dt = datetime.fromisoformat(event.get("start", "").replace("Z", "+00:00"))
                except:
                    dt = datetime.now()

                # Procurar o mercado 1x2 (Match)
                match_offer = None
                
                for offer in bet_offers:
                    criteria = offer.get("criterion", {})
                    if criteria.get("id") == 1001159858 or offer.get("betOfferType", {}).get("id") == 2:
                        match_offer = offer
                        break
                
                if not match_offer: continue
                
                # Extrair Odds
                outcomes = match_offer.get("outcomes", [])
                raw_odds = {}
                
                for out in outcomes:
                    label = out.get("label")  # "1", "X", "2"
                    odds_int = out.get("odds")  # Ex: 1580
                    
                    if not odds_int: continue
                    
                    decimal_odd = odds_int / 1000.0
                    
                    if label == "1": raw_odds['home'] = decimal_odd
                    elif label == "X": raw_odds['draw'] = decimal_odd
                    elif label == "2": raw_odds['away'] = decimal_odd
                
                if len(raw_odds) == 3:
                    scraped = ScrapedOdds(
                        bookmaker_name="kto",
                        home_team_raw=home_team.strip(),
                        away_team_raw=away_team.strip(),
                        league_raw=league_name,
                        match_date=dt,
                        home_odd=raw_odds['home'],
                        draw_odd=raw_odds['draw'],
                        away_odd=raw_odds['away'],
                        market_type="1x2",
                        extra_data={
                            "event_id": str(event_id),
                            "kambi_offer_id": str(match_offer.get("id")),
                            "league_path": league_path
                        }
                    )
                    results.append(scraped)
            except Exception as e:
                continue

        self.logger.info(f"✅ Sucesso: {len(results)} jogos parseados da KTO.")
        return results


# Teste direto
if __name__ == "__main__":
    import asyncio

    async def run():
        s = KtoScraper()
        # Teste Serie A
        lg = LeagueConfig(league_id="serie_a", name="Serie A", url="", country="IT")
        odds = await s.scrape_league(lg)
        
        print(f"\n--- Resultado ({len(odds)} jogos) ---")
        for o in odds[:5]:  # Mostra os 5 primeiros
            print(f"{o.home_team_raw} x {o.away_team_raw} | ID: {o.extra_data['event_id']}")
            print(f"Odds: {o.home_odd:.2f} - {o.draw_odd:.2f} - {o.away_odd:.2f}")
            print("-" * 30)
            
    asyncio.run(run())

"""
Estrelabet Scraper - Direct API access via Altenar backend.

Estrelabet uses the Altenar provider and does NOT block API access.
This allows for simple HTTP requests without Playwright or anti-bot measures.
"""

import httpx
from datetime import datetime
from typing import List, Optional, Dict, Any
from loguru import logger

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


class EstrelabetScraper(BaseScraper):
    """
    Scraper para EstrelaBet (API Altenar V2).
    Lógica ajustada para estrutura normalizada (Listas separadas de Events, Markets, Odds).
    """
    
    # URL para pegar a lista de jogos (Widget API)
    API_BASE_URL = "https://sb2frontend-altenar2.biahosted.com/api/widget/GetEvents"
    
    LEAGUES = {
        "serie_a": {"champ_id": "2942", "name": "Serie A", "country": "Italia"},
        "premier_league": {"champ_id": "2936", "name": "Premier League", "country": "Inglaterra"},
        "la_liga": {"champ_id": "2941", "name": "La Liga", "country": "Espanha"},
    }
    
    def __init__(self):
        super().__init__(name="estrelabet", base_url="https://www.estrelabet.bet.br")
        self.client: Optional[httpx.AsyncClient] = None
        self.logger = logger.bind(component="estrelabet")
    
    async def setup(self):
        self.logger.info("Iniciando sessão HTTP EstrelaBet...")
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
        
        # Encontra o ID da liga
        champ_id = self.LEAGUES.get(league.league_id, {}).get("champ_id")
        if not champ_id:
            # Tenta achar pelo nome se o ID não bater
            for k, v in self.LEAGUES.items():
                if v["name"] == league.name:
                    champ_id = v["champ_id"]
                    break
        
        if not champ_id:
            return []
            
        self.logger.info(f"Buscando API EstrelaBet: {league.name} (ID: {champ_id})")
        
        try:
            params = {
                "culture": "pt-BR",
                "timezoneOffset": "-180",
                "integration": "estrelabet",
                "deviceType": "1",
                "numFormat": "en-GB",
                "countryCode": "BR",
                "eventCount": "0",
                "sportId": "66",  # Futebol
                "champIds": champ_id
            }
            
            response = await self.client.get(self.API_BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()
            
            return self._parse_altenar_normalized(data, league.name)
            
        except Exception as e:
            self.logger.error(f"Erro na API: {e}")
            return []

    def _parse_altenar_normalized(self, data: Dict[str, Any], league_name: str) -> List[ScrapedOdds]:
        results = []
        
        # 1. Mapeamento de Odds (ID -> Objeto Odd)
        all_odds = {o["id"]: o for o in data.get("odds", [])}
        
        # 2. Mapeamento de Mercados (ID -> Objeto Mercado)
        all_markets = {m["id"]: m for m in data.get("markets", [])}
        
        # 3. Iterar sobre os Eventos
        events = data.get("events", [])
        
        for event in events:
            try:
                event_id = event.get("id")
                event_name = event.get("name", "")
                # Limpar tabs, quebras de linha e espaços múltiplos
                event_name = ' '.join(event_name.split())
                market_ids = event.get("marketIds", [])
                
                # Extrair nomes dos times pelo nome do evento
                if " vs. " in event_name:
                    home_raw, away_raw = event_name.split(" vs. ")
                else:
                    # Fallback se não tiver 'vs.'
                    home_raw = event_name
                    away_raw = "N/A"
                
                # Data do jogo
                try:
                    dt = datetime.fromisoformat(event.get("startDate", "").replace("Z", "+00:00"))
                except:
                    dt = datetime.now()
                
                # Procurar mercado de Vencedor (1x2)
                # Na EstrelaBet/Altenar, typeId 1 é "Vencedor do encontro"
                found_odds = {}
                
                for mid in market_ids:
                    market = all_markets.get(mid)
                    if not market:
                        continue
                    
                    # typeId 1 = Match Result (1x2)
                    if market.get("typeId") == 1:
                        # Extrair odds desse mercado
                        for odd_id in market.get("oddIds", []):
                            odd = all_odds.get(odd_id)
                            if not odd:
                                continue
                            
                            price = float(odd.get("price", 0))
                            type_id = odd.get("typeId")  # 1=Home, 2=Draw, 3=Away
                            
                            if type_id == 1:
                                found_odds['home'] = price
                            elif type_id == 2:
                                found_odds['draw'] = price
                            elif type_id == 3:
                                found_odds['away'] = price
                        
                        # Se achou mercado principal, para de procurar outros mercados
                        break
                
                # Se temos as 3 odds, salva
                if len(found_odds) == 3:
                    scraped = ScrapedOdds(
                        bookmaker_name="estrelabet",
                        home_team_raw=home_raw.strip(),
                        away_team_raw=away_raw.strip(),
                        league_raw=league_name,
                        match_date=dt,
                        home_odd=found_odds['home'],
                        draw_odd=found_odds['draw'],
                        away_odd=found_odds['away'],
                        market_type="1x2",
                        extra_data={"event_id": str(event_id)}
                    )
                    results.append(scraped)
            except Exception as e:
                continue

        self.logger.info(f"✅ Sucesso: {len(results)} jogos parseados da EstrelaBet.")
        return results


# Teste direto
if __name__ == "__main__":
    import asyncio
    
    async def run():
        s = EstrelabetScraper()
        # Teste Serie A
        lg = LeagueConfig(league_id="serie_a", name="Serie A", url="", country="IT")
        odds = await s.scrape_league(lg)
        
        print(f"\n--- Resultado ({len(odds)} jogos) ---")
        for o in odds:
            print(f"{o.home_team_raw} x {o.away_team_raw} | ID: {o.extra_data['estrelabet_event_id']}")
            print(f"Odds: {o.home_odd:.2f} - {o.draw_odd:.2f} - {o.away_odd:.2f}")
            print("-" * 30)
            
    asyncio.run(run())

"""
Betnacional Scraper - Direct API access.

Betnacional uses a simple REST API that returns odds data directly.
API: https://prod-global-bff-events.bet6.com.br/api/odds/1/events-by-seasons
"""

import httpx
from datetime import datetime
from typing import List, Optional, Dict, Any
from loguru import logger
from collections import defaultdict

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


class BetnacionalScraper(BaseScraper):
    """
    Scraper para Betnacional (API Direta).
    
    A API retorna uma lista de odds individuais que precisam ser
    agrupadas por event_id para montar o 1x2 completo.
    """
    
    API_BASE_URL = "https://prod-global-bff-events.bet6.com.br/api/odds/1/events-by-seasons"
    
    # Ligas configuradas (tournament_id da API)
    LEAGUES = {
        "premier_league": {
            "tournament_id": "17",
            "name": "Premier League",
            "country": "Inglaterra"
        },
        # Adicionar mais ligas conforme necessário:
        # "serie_a": {"tournament_id": "?", "name": "Serie A", "country": "Italia"},
        # "la_liga": {"tournament_id": "?", "name": "La Liga", "country": "Espanha"},
    }
    
    def __init__(self):
        super().__init__(name="betnacional", base_url="https://betnacional.bet.br")
        self.client: Optional[httpx.AsyncClient] = None
        self.logger = logger.bind(component="betnacional")
    
    async def setup(self):
        self.logger.info("Iniciando sessão HTTP Betnacional...")
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "accept": "*/*",
                "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
                "origin": "https://betnacional.bet.br",
                "referer": "https://betnacional.bet.br/",
                "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
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
        
        # Encontra o tournament_id da liga
        league_config = self.LEAGUES.get(league.league_id)
        if not league_config:
            # Tenta achar pelo nome
            for k, v in self.LEAGUES.items():
                if v["name"] == league.name:
                    league_config = v
                    break
        
        if not league_config:
            self.logger.warning(f"Liga não configurada: {league.name}")
            return []
        
        tournament_id = league_config["tournament_id"]
        self.logger.info(f"Buscando API Betnacional: {league.name} (tournament_id: {tournament_id})")
        
        try:
            params = {
                "sport_id": "1",           # Futebol
                "category_id": "0",        # Todas categorias
                "tournament_id": tournament_id,
                "markets": "1",            # Mercado 1X2
                "filter_time_event": ""    # Sem filtro de tempo
            }
            
            response = await self.client.get(self.API_BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()
            
            return self._parse_odds(data, league.name)
            
        except httpx.HTTPStatusError as e:
            self.logger.error(f"Erro HTTP {e.response.status_code}: {e}")
            return []
        except Exception as e:
            self.logger.error(f"Erro na API Betnacional: {e}")
            return []

    def _parse_odds(self, data: Dict[str, Any], league_name: str) -> List[ScrapedOdds]:
        """
        Parseia a resposta da API.
        
        Estrutura da resposta:
        {
            "odds": [
                {
                    "event_id": 61300903,
                    "home": "Everton",
                    "away": "Brentford",
                    "date_start": "2026-01-04 12:00:00",
                    "odd": 2.45,
                    "outcome_id": "1",  # 1=Casa, 2=Empate, 3=Fora
                    ...
                },
                ...
            ]
        }
        """
        results = []
        odds_list = data.get("odds", [])
        
        if not odds_list:
            self.logger.warning("Nenhuma odd retornada pela API")
            return results
        
        # Agrupar odds por event_id
        events: Dict[int, Dict[str, Any]] = defaultdict(lambda: {
            "home": None,
            "away": None,
            "date_start": None,
            "odds": {}
        })
        
        for odd in odds_list:
            try:
                event_id = odd.get("event_id")
                if not event_id:
                    continue
                
                outcome_id = odd.get("outcome_id")
                price = odd.get("odd")
                
                if outcome_id and price:
                    events[event_id]["odds"][outcome_id] = float(price)
                
                # Preencher dados do evento (apenas uma vez)
                if events[event_id]["home"] is None:
                    events[event_id]["home"] = odd.get("home", "").strip()
                    events[event_id]["away"] = odd.get("away", "").strip()
                    events[event_id]["date_start"] = odd.get("date_start")
                    
            except Exception as e:
                self.logger.debug(f"Erro ao processar odd: {e}")
                continue
        
        # Converter eventos agrupados em ScrapedOdds
        for event_id, event_data in events.items():
            try:
                odds = event_data["odds"]
                
                # Precisamos das 3 odds para 1X2
                if "1" not in odds or "2" not in odds or "3" not in odds:
                    continue
                
                home_team = event_data["home"]
                away_team = event_data["away"]
                
                if not home_team or not away_team:
                    continue
                
                # Parse da data
                date_str = event_data["date_start"]
                try:
                    match_date = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
                except:
                    match_date = datetime.now()
                
                scraped = ScrapedOdds(
                    bookmaker_name="betnacional",
                    home_team_raw=home_team,
                    away_team_raw=away_team,
                    league_raw=league_name,
                    match_date=match_date,
                    home_odd=odds["1"],
                    draw_odd=odds["2"],
                    away_odd=odds["3"],
                    market_type="1x2",
                    extra_data={
                        "event_id": str(event_id)
                    }
                )
                results.append(scraped)
                
            except Exception as e:
                self.logger.debug(f"Erro ao criar ScrapedOdds: {e}")
                continue
        
        self.logger.info(f"✅ Betnacional: {len(results)} jogos parseados ({league_name})")
        return results


# Teste direto
if __name__ == "__main__":
    import asyncio
    
    async def run():
        s = BetnacionalScraper()
        await s.setup()
        
        try:
            # Teste Premier League
            lg = LeagueConfig(
                league_id="premier_league", 
                name="Premier League", 
                url="", 
                country="Inglaterra"
            )
            odds = await s.scrape_league(lg)
            
            print(f"\n--- Resultado ({len(odds)} jogos) ---")
            for o in odds:
                print(f"{o.home_team_raw} x {o.away_team_raw}")
                print(f"  Odds: {o.home_odd:.2f} - {o.draw_odd:.2f} - {o.away_odd:.2f}")
                print(f"  Event ID: {o.extra_data['event_id']}")
                print(f"  Link: https://betnacional.bet.br/event/1/0/{o.extra_data['event_id']}")
                print("-" * 40)
        finally:
            await s.teardown()
    
    asyncio.run(run())

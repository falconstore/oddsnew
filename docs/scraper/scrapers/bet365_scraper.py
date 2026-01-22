"""
Scraper para Bet365 via odds-api.io.
API simples, sem necessidade de login complexo.
"""

import asyncio
import time
import httpx
from datetime import datetime
from typing import List, Optional, Dict, Any
from loguru import logger

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


class Bet365Scraper(BaseScraper):
    """
    Scraper para Bet365 usando odds-api.io.
    
    Vantagens:
    - API simples (apenas API key)
    - Já traz URL direta da Bet365
    - Estrutura clara e fácil de parsear
    
    Rate Limit: 100 requisições por ~10 minutos
    """
    
    BASE_URL_EVENTS = "https://api.odds-api.io/v3/events"
    BASE_URL_ODDS_MULTI = "https://api.odds-api.io/v3/odds/multi"
    
    # Mapeamento slug da API -> nome do sistema
    LEAGUE_MAPPING = {
        # Brasil
        "brazil-serie-a": "Brasileirão Série A",
        "brazil-paulista": "Paulistao",
        "brazil-mineiro": "Campeonato Mineiro",
        
        # Europa - Top Leagues
        "premier-league": "Premier League",
        "la-liga": "La Liga",
        "bundesliga": "Bundesliga",
        "ligue-1": "Ligue 1",
        "serie-a": "Serie A",
        "eredivisie": "Eredivisie",
        
        # Copas Nacionais
        "fa-cup": "FA Cup",
        "efl-cup": "EFL Cup",
        "copa-del-rey": "Copa do Rei",
        
        # Competições Continentais
        "champions-league": "Champions League",
        "europa-league": "Liga Europa",
        "conference-league": "Liga da Conferencia",
    }
    
    # Mapeamento para NBA
    NBA_LEAGUE_MAPPING = {
        "nba": "NBA",
    }
    
    def __init__(self):
        super().__init__(name="bet365", base_url="https://www.bet365.com")
        self.client: Optional[httpx.AsyncClient] = None
        self.api_key: Optional[str] = None
        self.logger = logger.bind(component="bet365")
    
    async def setup(self):
        """Inicializa cliente HTTP com API key."""
        from config import settings
        
        self.api_key = getattr(settings, 'odds_api_key', None)
        
        if not self.api_key:
            self.logger.error("ODDS_API_KEY não configurada no .env!")
            return
        
        self.client = httpx.AsyncClient(timeout=30.0)
        self.logger.info("Bet365 Scraper inicializado via odds-api.io")
    
    async def teardown(self):
        """Fecha cliente HTTP."""
        if self.client:
            await self.client.aclose()
            self.client = None
    
    def get_available_leagues(self) -> List[LeagueConfig]:
        """Retorna ligas disponíveis."""
        leagues = []
        for slug, name in self.LEAGUE_MAPPING.items():
            leagues.append(LeagueConfig(
                id=slug,
                name=name,
                url=slug,
                country="Unknown"
            ))
        return leagues
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """Não usado - scrape_all busca todas as ligas de uma vez."""
        return []
    
    async def scrape_all(self) -> List[ScrapedOdds]:
        """Busca odds de Football e Basketball."""
        if not self.client or not self.api_key:
            await self.setup()
        
        if not self.api_key:
            self.logger.error("API key não disponível, abortando scrape")
            return []
        
        results = []
        
        try:
            # Buscar Football
            football_results = await self._scrape_sport("Football", self.LEAGUE_MAPPING, "football")
            results.extend(football_results)
            self.logger.info(f"Football: {len(football_results)} partidas coletadas")
            
            # Buscar Basketball (NBA)
            basketball_results = await self._scrape_sport("Basketball", self.NBA_LEAGUE_MAPPING, "basketball")
            results.extend(basketball_results)
            self.logger.info(f"Basketball: {len(basketball_results)} partidas coletadas")
            
        except Exception as e:
            self.logger.error(f"Erro no scrape_all: {e}")
        
        self.logger.info(f"Bet365 Total: {len(results)} partidas via odds-api.io")
        return results
    
    async def _scrape_sport(self, sport: str, league_mapping: Dict[str, str], sport_type: str) -> List[ScrapedOdds]:
        """Busca eventos e odds para um esporte específico."""
        results = []
        
        # Passo 1: Buscar lista de eventos
        events = await self._fetch_events(sport)
        self.logger.debug(f"{sport}: {len(events)} eventos totais encontrados")
        
        if not events:
            return results
        
        # Passo 2: Filtrar apenas eventos de ligas mapeadas
        filtered_events = []
        for event in events:
            if not isinstance(event, dict):
                continue
            league = event.get("league", {})
            league_slug = league.get("slug", "")
            if league_slug in league_mapping:
                filtered_events.append(event)
        
        self.logger.debug(f"{sport}: {len(filtered_events)} eventos após filtro de ligas")
        
        if not filtered_events:
            return results
        
        # Passo 3: Extrair IDs dos eventos
        event_ids = [e.get("id") for e in filtered_events if e.get("id")]
        
        # Passo 4: Buscar odds em lotes de 10
        for i in range(0, len(event_ids), 10):
            batch = event_ids[i:i+10]
            odds_data = await self._fetch_odds_batch(batch)
            
            # Delay para rate limit
            await asyncio.sleep(0.5)
            
            # Parsear resposta
            parsed = self._parse_odds_response(odds_data, league_mapping, sport_type)
            results.extend(parsed)
        
        return results
    
    async def _fetch_events(self, sport: str) -> List[Dict]:
        """Busca lista de eventos de um esporte."""
        try:
            params = {
                "apiKey": self.api_key,
                "sport": sport,
            }
            
            self.logger.debug(f"Buscando eventos de {sport}")
            response = await self.client.get(self.BASE_URL_EVENTS, params=params)
            
            # Log rate limit
            remaining = response.headers.get("x-ratelimit-remaining", "?")
            self.logger.debug(f"Rate limit: {remaining} restantes")
            
            response.raise_for_status()
            data = response.json()
            
            if isinstance(data, list):
                return data
            elif isinstance(data, dict) and "data" in data:
                return data.get("data", [])
            elif isinstance(data, dict) and "items" in data:
                return data.get("items", [])
            
            return []
            
        except httpx.HTTPStatusError as e:
            self.logger.error(f"HTTP Error buscando eventos {sport}: {e.response.status_code}")
            return []
        except Exception as e:
            self.logger.error(f"Erro buscando eventos {sport}: {e}")
            return []
    
    async def _fetch_odds_batch(self, event_ids: List[int]) -> List[Dict]:
        """Busca odds para múltiplos eventos (max 10)."""
        try:
            params = {
                "apiKey": self.api_key,
                "eventIds": ",".join(str(id) for id in event_ids[:10]),
                "bookmakers": "Bet365",
            }
            
            self.logger.debug(f"Buscando odds para {len(event_ids)} eventos")
            response = await self.client.get(self.BASE_URL_ODDS_MULTI, params=params)
            
            # Log rate limit
            remaining = response.headers.get("x-ratelimit-remaining", "?")
            if remaining != "?" and int(remaining) < 20:
                self.logger.warning(f"Rate limit baixo: {remaining} requisições restantes!")
            
            response.raise_for_status()
            data = response.json()
            
            if isinstance(data, list):
                return data
            elif isinstance(data, dict) and "data" in data:
                return data.get("data", [])
            elif isinstance(data, dict) and "items" in data:
                return data.get("items", [])
            
            return []
            
        except httpx.HTTPStatusError as e:
            self.logger.error(f"HTTP Error buscando odds: {e.response.status_code}")
            return []
        except Exception as e:
            self.logger.error(f"Erro buscando odds: {e}")
            return []
    
    def _parse_odds_response(self, events: List[Dict], league_mapping: Dict[str, str], sport_type: str) -> List[ScrapedOdds]:
        """Parseia resposta de odds."""
        results = []
        
        for event in events:
            try:
                if not isinstance(event, dict):
                    continue
                
                league = event.get("league", {})
                league_slug = league.get("slug", "")
                league_name = league_mapping.get(league_slug)
                
                if not league_name:
                    continue
                
                home = event.get("home", "")
                away = event.get("away", "")
                
                if not home or not away:
                    continue
                
                # Extrair odds do Bet365
                bookmakers = event.get("bookmakers", {})
                bet365_markets = bookmakers.get("Bet365", [])
                
                if not bet365_markets:
                    continue
                
                # Encontrar mercado 1X2 ou ML
                market_names = ["1X2", "ML"] if sport_type == "football" else ["ML"]
                
                for market in bet365_markets:
                    if market.get("name") in market_names:
                        odds_list = market.get("odds", [])
                        if not odds_list:
                            continue
                        
                        odds = odds_list[0]
                        
                        home_odd = self._safe_float(odds.get("home"))
                        away_odd = self._safe_float(odds.get("away"))
                        
                        if not home_odd or not away_odd:
                            continue
                        
                        draw_odd = None
                        if sport_type == "football":
                            draw_odd = self._safe_float(odds.get("draw"))
                        
                        # URL direta da Bet365
                        urls = event.get("urls", {})
                        bet365_url = urls.get("Bet365", "")
                        
                        # Parse date
                        match_date = self._parse_datetime(event.get("date", ""))
                        if not match_date:
                            continue
                        
                        scraped = ScrapedOdds(
                            bookmaker_name="bet365",
                            home_team_raw=home,
                            away_team_raw=away,
                            league_raw=league_name,
                            match_date=match_date,
                            home_odd=home_odd,
                            draw_odd=draw_odd,
                            away_odd=away_odd,
                            sport=sport_type,
                            market_type="1x2" if sport_type == "football" else "moneyline",
                            odds_type="PA",
                            extra_data={
                                "source": "odds-api.io",
                                "event_id": event.get("id"),
                                "bet365_url": bet365_url,
                            }
                        )
                        results.append(scraped)
                        break
                        
            except Exception as e:
                self.logger.debug(f"Erro parseando evento: {e}")
        
        return results
    
    def _safe_float(self, value: Any) -> Optional[float]:
        """Converte valor para float de forma segura."""
        if value is None:
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None
    
    def _parse_datetime(self, date_str: str) -> Optional[datetime]:
        """Parseia string de data ISO 8601."""
        if not date_str:
            return None
        try:
            # Handle ISO format with Z suffix
            if date_str.endswith("Z"):
                date_str = date_str[:-1] + "+00:00"
            return datetime.fromisoformat(date_str)
        except Exception:
            return None


# Teste local
if __name__ == "__main__":
    from dotenv import load_dotenv
    
    load_dotenv()
    
    async def test():
        scraper = Bet365Scraper()
        await scraper.setup()
        
        if scraper.api_key:
            odds = await scraper.scrape_all()
            print(f"\nTotal: {len(odds)} partidas da Bet365")
            
            for o in odds[:5]:
                print(f"  {o.home_team_raw} x {o.away_team_raw} ({o.league_raw})")
                print(f"    Odds: {o.home_odd} / {o.draw_odd} / {o.away_odd}")
                if o.extra_data.get("bet365_url"):
                    print(f"    URL: {o.extra_data['bet365_url']}")
        else:
            print("API key não configurada - adicione ODDS_API_KEY no .env")
        
        await scraper.teardown()
    
    asyncio.run(test())

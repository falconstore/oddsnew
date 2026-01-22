"""
Scraper para Bet365 via odds-api.io.
API simples, sem necessidade de login complexo.
"""

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
    
    BASE_URL = "https://api.odds-api.io/v3/odds/updated"
    
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
            football_data = await self._fetch_sport("Football")
            football_odds = self._parse_football(football_data)
            results.extend(football_odds)
            self.logger.info(f"Football: {len(football_odds)} partidas coletadas")
            
            # Buscar Basketball (NBA)
            basketball_data = await self._fetch_sport("Basketball")
            basketball_odds = self._parse_basketball(basketball_data)
            results.extend(basketball_odds)
            self.logger.info(f"Basketball: {len(basketball_odds)} partidas coletadas")
            
        except Exception as e:
            self.logger.error(f"Erro no scrape_all: {e}")
        
        self.logger.info(f"Bet365 Total: {len(results)} partidas via odds-api.io")
        return results
    
    async def _fetch_sport(self, sport: str) -> List[Dict]:
        """Busca odds para um esporte específico."""
        try:
            # Timestamp atual (requisito da API - max 1 min)
            since = int(time.time())
            
            params = {
                "apiKey": self.api_key,
                "sport": sport,
                "bookmaker": "Bet365",
                "since": since,
            }
            
            self.logger.debug(f"Buscando {sport} com since={since}")
            response = await self.client.get(self.BASE_URL, params=params)
            
            # Log rate limit
            remaining = response.headers.get("x-ratelimit-remaining", "?")
            reset = response.headers.get("x-ratelimit-reset", "?")
            self.logger.debug(f"Rate limit: {remaining} restantes, reset: {reset}")
            
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
            self.logger.error(f"HTTP Error buscando {sport}: {e.response.status_code}")
            return []
        except Exception as e:
            self.logger.error(f"Erro buscando {sport}: {e}")
            return []
    
    def _parse_football(self, events: List[Dict]) -> List[ScrapedOdds]:
        """Parseia eventos de futebol."""
        results = []
        skipped_leagues = set()
        
        for event in events:
            try:
                if not isinstance(event, dict):
                    continue
                
                league = event.get("league", {})
                league_slug = league.get("slug", "")
                league_name = self.LEAGUE_MAPPING.get(league_slug)
                
                if not league_name:
                    skipped_leagues.add(league_slug)
                    continue
                
                home = event.get("home", "")
                away = event.get("away", "")
                
                if not home or not away:
                    continue
                
                # Extrair odds do Bet365
                bookmakers = event.get("bookmakers", {})
                bet365_markets = bookmakers.get("Bet365", [])
                
                # Encontrar mercado 1X2 ou ML
                for market in bet365_markets:
                    if market.get("name") in ["1X2", "ML"]:
                        odds_list = market.get("odds", [])
                        if not odds_list:
                            continue
                        
                        odds = odds_list[0]
                        
                        home_odd = self._safe_float(odds.get("home"))
                        draw_odd = self._safe_float(odds.get("draw"))
                        away_odd = self._safe_float(odds.get("away"))
                        
                        if not home_odd or not away_odd:
                            continue
                        
                        # URL direta da Bet365 (já vem pronta!)
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
                            sport="football",
                            market_type="1x2",
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
                self.logger.debug(f"Erro parseando evento football: {e}")
        
        if skipped_leagues:
            self.logger.debug(f"Ligas não mapeadas: {skipped_leagues}")
        
        return results
    
    def _parse_basketball(self, events: List[Dict]) -> List[ScrapedOdds]:
        """Parseia eventos de basketball (NBA)."""
        results = []
        
        for event in events:
            try:
                if not isinstance(event, dict):
                    continue
                
                league = event.get("league", {})
                league_slug = league.get("slug", "")
                league_name = self.NBA_LEAGUE_MAPPING.get(league_slug)
                
                if not league_name:
                    continue
                
                home = event.get("home", "")
                away = event.get("away", "")
                
                if not home or not away:
                    continue
                
                bookmakers = event.get("bookmakers", {})
                bet365_markets = bookmakers.get("Bet365", [])
                
                for market in bet365_markets:
                    if market.get("name") == "ML":  # Moneyline
                        odds_list = market.get("odds", [])
                        if not odds_list:
                            continue
                        
                        odds = odds_list[0]
                        
                        home_odd = self._safe_float(odds.get("home"))
                        away_odd = self._safe_float(odds.get("away"))
                        
                        if not home_odd or not away_odd:
                            continue
                        
                        urls = event.get("urls", {})
                        bet365_url = urls.get("Bet365", "")
                        
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
                            draw_odd=None,  # Basketball não tem empate
                            away_odd=away_odd,
                            sport="basketball",
                            market_type="moneyline",
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
                self.logger.debug(f"Erro parseando NBA: {e}")
        
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
    import asyncio
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

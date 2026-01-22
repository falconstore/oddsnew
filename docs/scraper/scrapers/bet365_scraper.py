"""
Scraper para Bet365 via odds-api.io.
Utiliza endpoint /v3/odds/updated para buscar todas as odds em uma única requisição.
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
    
    Utiliza endpoint /v3/odds/updated que retorna todas as odds em uma única requisição,
    economizando ~95% do rate limit comparado ao método de batching.
    
    Rate Limit: 5000 requisições/hora
    Consumo estimado: ~30 req/hora (1 req a cada 2 min)
    """
    
    ODDS_UPDATED_URL = "https://api.odds-api.io/v3/odds/updated"
    
    # Mapeamento slug da API -> nome do sistema
    LEAGUE_MAPPING = {
        # Brasil
        "brazil-brasileiro-serie-a": "Brasileirão Série A",
        "brazil-paulista-serie-a1": "Paulistao",
        "brazil-mineiro": "Campeonato Mineiro",
        
        # Inglaterra
        "england-premier-league": "Premier League",
        "england-fa-cup": "FA Cup",
        "england-efl-cup": "EFL Cup",
        
        # Espanha
        "spain-laliga": "La Liga",
        "spain-copa-del-rey": "Copa do Rei",
        
        # Alemanha
        "germany-bundesliga": "Bundesliga",
        
        # França
        "france-ligue-1": "Ligue 1",
        
        # Itália
        "italy-serie-a": "Serie A",
        
        # Holanda
        "netherlands-eredivisie": "Eredivisie",
        
        # Competições Europeias
        "international-clubs-uefa-champions-league": "Champions League",
        "international-clubs-uefa-europa-league": "Liga Europa",
        "international-clubs-uefa-conference-league": "Liga da Conferencia",
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
        
        self.client = httpx.AsyncClient(timeout=60.0)  # Timeout maior para payload grande
        self.logger.info("Bet365 Scraper inicializado via odds-api.io (endpoint único)")
    
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
    
    def _get_since_timestamp(self) -> int:
        """Retorna timestamp de 30 segundos atrás (dentro do limite de 1 min da API)."""
        return int(time.time()) - 30
    
    async def _fetch_all_odds(self, sport: str, bookmaker: str = "Bet365") -> List[Dict]:
        """
        Busca todas as odds atualizadas em uma única requisição.
        
        Args:
            sport: "Football" ou "Basketball"
            bookmaker: Nome do bookmaker (default: Bet365)
            
        Returns:
            Lista de eventos com odds
        """
        try:
            since = self._get_since_timestamp()
            
            params = {
                "apiKey": self.api_key,
                "bookmaker": bookmaker,
                "sport": sport,
                "since": since
            }
            
            self.logger.debug(f"Buscando todas as odds de {sport} (since={since})")
            response = await self.client.get(self.ODDS_UPDATED_URL, params=params)
            
            # Log rate limit
            remaining = response.headers.get("x-ratelimit-remaining", "?")
            self.logger.info(f"Rate limit: {remaining} requisições restantes")
            
            response.raise_for_status()
            data = response.json()
            
            # A resposta pode vir em diferentes formatos
            if isinstance(data, list):
                return data
            elif isinstance(data, dict):
                # Pode ter uma chave "data" ou "items"
                return data.get("data", data.get("items", []))
            
            return []
            
        except httpx.HTTPStatusError as e:
            self.logger.error(f"HTTP Error buscando odds {sport}: {e.response.status_code}")
            if e.response.status_code == 429:
                self.logger.warning("Rate limit atingido! Aguardar antes de nova tentativa.")
            return []
        except Exception as e:
            self.logger.error(f"Erro buscando odds {sport}: {e}")
            return []
    
    async def scrape_all(self) -> List[ScrapedOdds]:
        """
        Busca odds de Football usando endpoint único.
        Uma única requisição retorna todas as odds da Bet365.
        """
        if not self.client or not self.api_key:
            await self.setup()
        
        if not self.api_key:
            self.logger.error("API key não disponível, abortando scrape")
            return []
        
        results = []
        
        try:
            # UMA única requisição para todas as odds de Football
            all_events = await self._fetch_all_odds("Football")
            self.logger.info(f"Recebidos {len(all_events)} eventos da Bet365")
            
            # Filtrar apenas as ligas que nos interessam (em memória)
            football_results = self._filter_and_parse(all_events, self.LEAGUE_MAPPING, "football")
            results.extend(football_results)
            
            self.logger.info(f"Football: {len(football_results)} partidas após filtro de ligas")
            
        except Exception as e:
            self.logger.error(f"Erro no scrape_all: {e}")
        
        self.logger.info(f"Bet365 Total: {len(results)} partidas via endpoint único")
        return results
    
    def _filter_and_parse(self, events: List[Dict], league_mapping: Dict[str, str], sport_type: str) -> List[ScrapedOdds]:
        """
        Filtra eventos por liga e converte para ScrapedOdds.
        
        Args:
            events: Lista de eventos da API
            league_mapping: Mapeamento slug -> nome da liga
            sport_type: "football" ou "basketball"
            
        Returns:
            Lista de ScrapedOdds filtrados
        """
        results = []
        
        for event in events:
            try:
                if not isinstance(event, dict):
                    continue
                
                # Extrair slug da liga
                league = event.get("league", {})
                league_slug = league.get("slug", "")
                
                # Pular se não está nas ligas mapeadas
                if league_slug not in league_mapping:
                    continue
                
                league_name = league_mapping[league_slug]
                
                # Extrair times
                home = event.get("home", "")
                away = event.get("away", "")
                
                if not home or not away:
                    continue
                
                # Parse data
                match_date = self._parse_datetime(event.get("date", ""))
                if not match_date:
                    continue
                
                # URL direta da Bet365
                urls = event.get("urls", {})
                bet365_url = urls.get("Bet365", "")
                
                # Extrair odds do Bet365
                bookmakers = event.get("bookmakers", {})
                bet365_data = bookmakers.get("Bet365", [])
                
                if not bet365_data:
                    continue
                
                # Encontrar mercado 1X2 ou ML
                market_names = ["1X2", "Match Result", "ML"] if sport_type == "football" else ["ML", "Moneyline"]
                
                for market in bet365_data:
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
                        break  # Só precisamos de um mercado 1X2
                        
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
            
            # Agrupar por liga para visualização
            leagues = {}
            for o in odds:
                if o.league_raw not in leagues:
                    leagues[o.league_raw] = []
                leagues[o.league_raw].append(o)
            
            for league, matches in leagues.items():
                print(f"\n{league}: {len(matches)} partidas")
                for o in matches[:3]:
                    print(f"  {o.home_team_raw} x {o.away_team_raw}")
                    print(f"    Odds: {o.home_odd} / {o.draw_odd} / {o.away_odd}")
                    if o.extra_data.get("bet365_url"):
                        print(f"    URL: {o.extra_data['bet365_url'][:60]}...")
        else:
            print("API key não configurada - adicione ODDS_API_KEY no .env")
        
        await scraper.teardown()
    
    asyncio.run(test())

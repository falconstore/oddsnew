"""
Scraper para Novibet Brasil.
API REST simples sem bloqueios.
"""

import os
import httpx
from datetime import datetime
from typing import List, Optional, Dict, Any
from loguru import logger
from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


class NovibetScraper(BaseScraper):
    """
    Scraper para Novibet usando API REST direta.

    Endpoint: /spt/feed/marketviews/location/v2/{sportId}/{competitionId}/
    Retorna JSON com eventos e odds.
    """

    API_BASE = "https://www.novibet.bet.br/spt/feed/marketviews/location/v2"
    SPORT_ID = "4324"  # Futebol

    # Mapeamento de ligas
    # IDs descobertos via navegação no site
    LEAGUES = {
        "premier_league": {
            "competition_id": "5909300",
            "name": "Premier League",
            "country": "Inglaterra"
        },
        "la_liga": {
            "competition_id": "5909306",  # TODO: Descobrir ID correto
            "name": "La Liga",
            "country": "Espanha"
        },
        "serie_a": {
            "competition_id": "5909302",  # TODO: Descobrir ID correto
            "name": "Serie A",
            "country": "Italia"
        },
    }

    def __init__(self):
        super().__init__(name="novibet", base_url="https://www.novibet.bet.br")
        self.client: Optional[httpx.AsyncClient] = None
        self.logger = logger.bind(component="novibet")

    async def setup(self):
        """Inicializa o cliente HTTP com headers completos."""

        cookies = os.getenv("NOVIBET_COOKIES") or os.getenv("NOVIBET_COOKIE")

        headers: Dict[str, str] = {
            "accept": "application/json, text/plain, */*",
            "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
            "accept-encoding": "gzip, deflate, br",
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
            "referer": "https://www.novibet.bet.br/apostas-esportivas/futebol/4372606/england/premier-league/5908949",
            "priority": "u=1, i",
            "sec-ch-ua": '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"macOS"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-gw-application-name": "NoviBR",
            "x-gw-channel": "WebPC",
            "x-gw-client-timezone": "America/Sao_Paulo",
            "x-gw-cms-key": "_BR",
            "x-gw-country-sysname": "BR",
            "x-gw-currency-sysname": "BRL",
            "x-gw-domain-key": "_BR",
            "x-gw-language-sysname": "pt-BR",
            "x-gw-odds-representation": "Decimal",
            "x-gw-state-sysname": "",
        }

        # Se o seu IP estiver sendo desafiado pelo Cloudflare, pode ser necessário
        # enviar cookies de sessão (ex.: cf_clearance). Observação: expiram.
        if cookies:
            headers["cookie"] = cookies
            self.logger.info("Novibet: usando cookies fornecidos via NOVIBET_COOKIES")

        self.client = httpx.AsyncClient(
            timeout=30.0,
            follow_redirects=True,
            http2=True,
            headers=headers,
        )
        self.logger.info("Novibet scraper initialized")
    
    async def teardown(self):
        """Fecha o cliente HTTP."""
        if self.client:
            await self.client.aclose()
            self.client = None
        self.logger.info("Novibet scraper shutdown")

    async def get_available_leagues(self) -> List[LeagueConfig]:
        """Retorna lista de ligas disponíveis."""
        return [
            LeagueConfig(
                league_id=key,
                name=config["name"],
                url=f"{self.API_BASE}/{self.SPORT_ID}/{config['competition_id']}/",
                country=config["country"]
            )
            for key, config in self.LEAGUES.items()
        ]
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """
        Faz scraping de uma liga específica.
        
        Args:
            league: Configuração da liga
            
        Returns:
            Lista de odds extraídas
        """
        if not self.client:
            await self.setup()
        
        league_config = self.LEAGUES.get(league.league_id)
        if not league_config:
            self.logger.warning(f"Liga não configurada: {league.league_id}")
            return []
        
        competition_id = league_config["competition_id"]
        
        # Timestamp dinâmico (microsegundos)
        timestamp = int(datetime.now().timestamp() * 1000000)
        
        url = f"{self.API_BASE}/{self.SPORT_ID}/{competition_id}/"
        params = {
            "lang": "pt-BR",
            "timeZ": "E. South America Standard Time",
            "oddsR": "1",
            "usrGrp": "BR",
            "timestamp": str(timestamp)
        }
        
        try:
            self.logger.debug(f"Fetching {url}")
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            return self._parse_response(data, league.name)
            
        except httpx.HTTPStatusError as e:
            self.logger.error(f"HTTP error {e.response.status_code} for {league.name}")
            return []
        except Exception as e:
            self.logger.error(f"Error scraping Novibet {league.name}: {e}")
            return []

    def _parse_response(self, data: List[Dict[str, Any]], league_name: str) -> List[ScrapedOdds]:
        """
        Processa a resposta da API e extrai odds.
        
        Estrutura da resposta:
        [
            {
                "betViews": [
                    {
                        "items": [
                            {
                                "additionalCaptions": {"competitor1": "...", "competitor2": "..."},
                                "startDate": "2026-01-03T12:30:00+00:00",
                                "path": "matches/aston-villa-nottingham-forest",
                                "eventBetContextId": 43885096,
                                "markets": [
                                    {
                                        "betTypeSysname": "SOCCER_MATCH_RESULT",
                                        "betItems": [
                                            {"code": "1", "price": 1.85},
                                            {"code": "X", "price": 3.85},
                                            {"code": "2", "price": 4.50}
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
        """
        results = []
        
        if not data or len(data) == 0:
            self.logger.warning("Empty response from Novibet API")
            return results
        
        # Primeiro elemento contém betViews
        first_view = data[0]
        bet_views = first_view.get("betViews", [])
        
        if not bet_views:
            self.logger.warning("No betViews in response")
            return results
        
        items = bet_views[0].get("items", [])
        
        for item in items:
            try:
                # Extrair times
                captions = item.get("additionalCaptions", {})
                home_team = captions.get("competitor1", "")
                away_team = captions.get("competitor2", "")
                
                if not home_team or not away_team:
                    continue
                
                # Data do jogo
                start_date = item.get("startDate", "")
                try:
                    match_date = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                except:
                    match_date = datetime.now()
                
                # Pular jogos ao vivo
                if item.get("isLive", False):
                    self.logger.debug(f"Skipping live match: {home_team} vs {away_team}")
                    continue
                
                # Buscar mercado 1X2 (SOCCER_MATCH_RESULT)
                markets = item.get("markets", [])
                home_odd = None
                draw_odd = None
                away_odd = None
                
                for market in markets:
                    if market.get("betTypeSysname") == "SOCCER_MATCH_RESULT":
                        bet_items = market.get("betItems", [])
                        for bet in bet_items:
                            code = bet.get("code")
                            price = bet.get("price")
                            is_available = bet.get("isAvailable", True)
                            
                            if price and is_available:
                                if code == "1":
                                    home_odd = float(price)
                                elif code == "X":
                                    draw_odd = float(price)
                                elif code == "2":
                                    away_odd = float(price)
                        break  # Pegar apenas o primeiro mercado 1X2 (geralmente o principal)
                
                # Validar que temos todas as odds
                if not (home_odd and draw_odd and away_odd):
                    self.logger.debug(f"Incomplete odds for {home_team} vs {away_team}")
                    continue
                
                # Extrair dados para link
                event_id = item.get("eventBetContextId")
                path = item.get("path", "")
                
                scraped = ScrapedOdds(
                    bookmaker_name="novibet",
                    home_team_raw=home_team.strip(),
                    away_team_raw=away_team.strip(),
                    league_raw=league_name,
                    match_date=match_date,
                    home_odd=home_odd,
                    draw_odd=draw_odd,
                    away_odd=away_odd,
                    market_type="1x2",
                    extra_data={
                        "event_id": str(event_id),
                        "path": path,
                        "home_team_raw": home_team.strip(),
                        "away_team_raw": away_team.strip()
                    }
                )
                results.append(scraped)
                
            except Exception as e:
                self.logger.debug(f"Error parsing event: {e}")
                continue
        
        self.logger.info(f"Novibet {league_name}: {len(results)} matches found")
        return results

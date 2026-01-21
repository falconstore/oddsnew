"""
Scraper para Bet365 via API RadarOdds.
Faz login automático e renova token quando necessário.

A API do RadarOdds já faz o trabalho pesado de parsear o WebSocket da Bet365,
então usamos como proxy para obter as odds.
"""

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
    Scraper para Bet365 usando API do RadarOdds como fonte.
    
    Fluxo:
    1. Faz login com email/senha → obtém filter_token
    2. Usa token para buscar snapshot de odds
    3. Filtra apenas dados da Bet365
    4. Se token expirar, refaz login automaticamente
    """
    
    LOGIN_URL = "https://app.radarodds.com.br/api/login"
    SNAPSHOT_URL = "https://app.radarodds.com.br/api/snapshot"
    
    # Mapeamento RadarOdds -> Sistema interno
    LEAGUE_MAPPING = {
        # Brasil
        "Brasil - Série A": "Brasileirão Série A",
        "Brasil - Paulista": "Paulistão A1",
        "Brasil - Carioca": "Carioca",
        "Brasil - Mineiro": "Campeonato Mineiro",
        
        # Europa - Top Leagues
        "Inglaterra - Premier League": "Premier League",
        "Espanha - La Liga": "La Liga",
        "Alemanha - Bundesliga": "Bundesliga",
        "França - Ligue 1": "Ligue 1",
        "Itália - Série A": "Serie A",
        "Holanda - Eredivisie": "Eredivisie",
        "Inglaterra - Championship": "Championship",
        
        # Copas Nacionais
        "Inglaterra - FA Cup": "FA Cup",
        "Inglaterra - EFL cup": "EFL Cup",
        "Espanha - Copa del Rey": "Copa do Rei",
        "Alemanha - DFB Pokal": "DFB Pokal",
        
        # Competições Continentais
        "Europa - UEFA Champions League": "Champions League",
        "Europa - UEFA Europa League": "Europa League",
        "Internacional - Conference League": "Conference League",
        "América do Sul - CONMEBOL Libertadores": "Libertadores",
        "América do Sul - CONMEBOL Sudamericana": "Sul-Americana",
        "CONMEBOL Libertadores": "Libertadores",
        "CONMEBOL Sudamericana": "Sul-Americana",
        
        # Outros
        "EUA - Major League Soccer": "MLS",
        "Internacional - Amistoso Internacional": "Amistosos",
        "Internacional - Eliminatórias da Copa do Mundo": "Eliminatórias",
    }
    
    def __init__(self):
        super().__init__(name="bet365", base_url="https://www.bet365.bet.br")
        self.client: Optional[httpx.AsyncClient] = None
        self.filter_token: Optional[str] = None
        self.session_cookie: Optional[str] = None
        self.logger = logger.bind(component="bet365")
    
    async def setup(self):
        """Inicializa cliente HTTP e faz login se necessário."""
        from config import settings
        
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "accept": "*/*",
                "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
                "origin": "https://app.radarodds.com.br",
                "referer": "https://app.radarodds.com.br/",
                "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        )
        
        # Tentar usar token cacheado primeiro (se configurado no .env)
        self.filter_token = getattr(settings, 'radarodds_filter_token', None)
        
        # Se não tiver token, fazer login
        if not self.filter_token:
            await self._login(settings)
        
        if self.filter_token:
            self.logger.info("Bet365 Scraper inicializado via RadarOdds")
        else:
            self.logger.warning("Bet365 Scraper sem token - verifique credenciais")
    
    async def _login(self, settings) -> bool:
        """
        Faz login no RadarOdds e obtém filter_token dos cookies.
        
        Returns:
            True se login bem sucedido, False caso contrário
        """
        # Usar email como username (campo esperado pela API)
        username = getattr(settings, 'radarodds_email', None)
        password = getattr(settings, 'radarodds_password', None)
        
        if not username or not password:
            self.logger.error(
                "Credenciais RadarOdds não configuradas! "
                "Adicione RADARODDS_EMAIL e RADARODDS_PASSWORD no .env"
            )
            return False
        
        try:
            self.logger.debug(f"Fazendo login no RadarOdds com {username}...")
            
            response = await self.client.post(
                self.LOGIN_URL,
                json={"username": username, "password": password}
            )
            
            if response.status_code == 401:
                self.logger.error("Credenciais RadarOdds inválidas!")
                return False
            
            response.raise_for_status()
            
            # Extrair tokens dos cookies Set-Cookie
            self.filter_token = response.cookies.get("ra_filter_token")
            self.session_cookie = response.cookies.get("ra_sess")
            
            # Fallback: tentar do JSON se não veio nos cookies
            if not self.filter_token:
                try:
                    data = response.json()
                    self.filter_token = data.get("filter_token")
                except:
                    pass
            
            if self.filter_token:
                self.logger.info("Login RadarOdds realizado com sucesso")
                self.logger.debug(f"Token: {self.filter_token[:20]}...")
                return True
            else:
                self.logger.error("Token não encontrado nos cookies nem no JSON")
                return False
                
        except httpx.HTTPStatusError as e:
            self.logger.error(f"Erro HTTP no login RadarOdds: {e.response.status_code}")
            return False
        except Exception as e:
            self.logger.error(f"Erro no login RadarOdds: {e}")
            return False
    
    async def teardown(self):
        """Fecha cliente HTTP."""
        if self.client:
            await self.client.aclose()
            self.client = None
    
    async def get_available_leagues(self) -> List[LeagueConfig]:
        """Retorna lista de ligas suportadas."""
        return [
            LeagueConfig(league_id=k, name=v, url="", country="")
            for k, v in self.LEAGUE_MAPPING.items()
        ]
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """
        Não utilizado - este scraper busca todas as ligas de uma vez.
        Mantido para compatibilidade com interface BaseScraper.
        """
        return []
    
    async def scrape_all(self) -> List[ScrapedOdds]:
        """
        Busca todas as partidas do RadarOdds e filtra apenas Bet365.
        
        Override do método base para buscar tudo de uma vez,
        já que a API retorna todas as ligas em uma única chamada.
        """
        if not self.client:
            await self.setup()
        
        if not self.filter_token:
            self.logger.error("Sem token válido, abortando scrape")
            return []
        
        try:
            # Adiciona token no header E cookies
            self.client.headers["x-filter-token"] = self.filter_token
            if self.session_cookie:
                self.client.cookies.set("ra_sess", self.session_cookie)
                self.client.cookies.set("ra_filter_token", self.filter_token)
            
            self.logger.debug("Buscando snapshot do RadarOdds...")
            
            response = await self.client.get(
                self.SNAPSHOT_URL,
                params={"window_days": 3}
            )
            
            # Se 401/403, token expirou - tentar relogar
            if response.status_code in [401, 403]:
                self.logger.warning("Token expirado, refazendo login...")
                self.filter_token = None
                
                from config import settings
                if await self._login(settings):
                    self.client.headers["x-filter-token"] = self.filter_token
                    response = await self.client.get(
                        self.SNAPSHOT_URL,
                        params={"window_days": 3}
                    )
                else:
                    return []
            
            response.raise_for_status()
            data = response.json()
            
            results = self._parse_response(data)
            self.logger.info(f"Bet365: {len(results)} partidas coletadas via RadarOdds")
            return results
            
        except httpx.HTTPStatusError as e:
            self.logger.error(f"Erro HTTP RadarOdds: {e.response.status_code}")
            return []
        except Exception as e:
            self.logger.error(f"Erro ao buscar RadarOdds: {e}")
            return []
    
    def _parse_response(self, data: List[Dict[str, Any]]) -> List[ScrapedOdds]:
        """
        Parseia resposta do RadarOdds e extrai apenas odds da Bet365.
        
        Estrutura esperada:
        [
            {
                "type": "odds.best",
                "match": {"team1": "...", "team2": "...", "competition": "..."},
                "books": [
                    {"bookmaker": "bet365", "odd1": 1.5, "oddX": 3.0, "odd2": 5.0, ...},
                    ...
                ]
            },
            ...
        ]
        """
        results = []
        skipped_leagues = set()
        
        for item in data:
            try:
                # Apenas itens do tipo odds.best
                if item.get("type") != "odds.best":
                    continue
                
                match_info = item.get("match", {})
                books = item.get("books", [])
                
                # Encontrar Bet365 no array de bookmakers
                bet365_data = next(
                    (b for b in books if b.get("bookmaker") == "bet365"),
                    None
                )
                
                if not bet365_data:
                    continue  # Bet365 não tem odds para esta partida
                
                # Verificar se temos odds válidas
                odd1 = bet365_data.get("odd1")
                oddX = bet365_data.get("oddX")
                odd2 = bet365_data.get("odd2")
                
                if not all([odd1, oddX, odd2]):
                    continue
                
                # Mapear liga para nome interno
                competition = match_info.get("competition", "")
                league_name = self.LEAGUE_MAPPING.get(competition)
                
                if not league_name:
                    skipped_leagues.add(competition)
                    continue
                
                # Parsear data/hora
                match_date = self._parse_datetime(
                    match_info.get("date", ""),
                    match_info.get("kickoff_display", "")
                )
                
                # Criar objeto de odds
                scraped = ScrapedOdds(
                    bookmaker_name="bet365",
                    home_team_raw=match_info.get("team1", "").strip(),
                    away_team_raw=match_info.get("team2", "").strip(),
                    league_raw=league_name,
                    match_date=match_date,
                    home_odd=float(odd1),
                    draw_odd=float(oddX),
                    away_odd=float(odd2),
                    sport="football",
                    market_type="1x2",
                    odds_type="PA",  # Bet365 usa odds padrão (não Super Odds)
                    extra_data={
                        "source": "radarodds",
                        "href": bet365_data.get("href", ""),
                        "updated_at": bet365_data.get("updated_at", ""),
                        "is_best_home": bet365_data.get("isBest1", False),
                        "is_best_draw": bet365_data.get("isBestX", False),
                        "is_best_away": bet365_data.get("isBest2", False),
                    }
                )
                results.append(scraped)
                
            except Exception as e:
                self.logger.debug(f"Erro parseando partida: {e}")
                continue
        
        # Log de ligas não mapeadas (para facilitar expansão)
        if skipped_leagues:
            self.logger.debug(f"Ligas não mapeadas: {skipped_leagues}")
        
        return results
    
    def _parse_datetime(self, date_str: str, time_str: str) -> datetime:
        """
        Parseia formato do RadarOdds para datetime.
        
        Args:
            date_str: "21/01" (dia/mês)
            time_str: "20:01" (hora:minuto)
            
        Returns:
            datetime object
        """
        try:
            now = datetime.now()
            day, month = date_str.split("/")
            hour, minute = time_str.split(":")
            
            year = now.year
            # Se o mês for menor que o atual, provavelmente é ano que vem
            if int(month) < now.month:
                year += 1
            
            return datetime(year, int(month), int(day), int(hour), int(minute))
        except Exception:
            return datetime.now()


# Teste local
if __name__ == "__main__":
    import asyncio
    from dotenv import load_dotenv
    
    load_dotenv()
    
    async def test():
        scraper = Bet365Scraper()
        await scraper.setup()
        
        if scraper.filter_token:
            odds = await scraper.scrape_all()
            print(f"\nTotal: {len(odds)} partidas da Bet365")
            
            for o in odds[:5]:
                print(f"  {o.home_team_raw} x {o.away_team_raw} ({o.league_raw})")
                print(f"    Odds: {o.home_odd} / {o.draw_odd} / {o.away_odd}")
        else:
            print("Falha no login - verifique credenciais no .env")
        
        await scraper.teardown()
    
    asyncio.run(test())

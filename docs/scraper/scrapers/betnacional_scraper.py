"""
Betnacional Scraper - Playwright only (Cloudflare bypass).
Otimizado para requisições paralelas via context.request.

API: https://prod-global-bff-events.bet6.com.br/api/odds/1/events-by-seasons
"""

import asyncio
import json
from datetime import datetime
from typing import List, Optional, Dict, Any
from loguru import logger
from collections import defaultdict

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig
from playwright.async_api import async_playwright, Browser, BrowserContext, Page


class BetnacionalScraper(BaseScraper):
    """
    Scraper para Betnacional usando Playwright.
    Otimizado para fazer requisições paralelas via context.request.
    """
    
    API_BASE_URL = "https://prod-global-bff-events.bet6.com.br/api/odds/1/events-by-seasons"
    WARMUP_URL = "https://betnacional.bet.br/sports/futebol"
    
    # Ligas configuradas (tournament_id da API)
    LEAGUES = {
        "premier_league": {
            "tournament_id": "17",
            "name": "Premier League",
            "country": "Inglaterra"
        },
        "serie_a": {
            "tournament_id": "23",
            "name": "Serie A",
            "country": "Italia"
        },
        "la_liga": {
            "tournament_id": "8",
            "name": "La Liga",
            "country": "Espanha"
        },
        "bundesliga": {
            "tournament_id": "35",
            "name": "Bundesliga",
            "country": "Alemanha"
        },
        "ligue_1": {
            "tournament_id": "34",
            "name": "Ligue 1",
            "country": "Franca"
        },
        "paulistao": {
            "tournament_id": "372",
            "name": "Paulistao",
            "country": "Brasil"
        },
        "fa_cup": {
            "tournament_id": "19",
            "name": "FA Cup",
            "country": "Inglaterra"
        },
        "efl_cup": {
            "tournament_id": "21",
            "name": "EFL Cup",
            "country": "Inglaterra"
        },
        "copa_do_rei": {
            "tournament_id": "329",
            "name": "Copa do Rei",
            "country": "Espanha"
        },
    }
    
    def __init__(self):
        super().__init__(name="betnacional", base_url="https://betnacional.bet.br")
        self.logger = logger.bind(component="betnacional")
        # Playwright resources
        self._playwright = None
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self._page: Optional[Page] = None
        self._setup_done = False
    
    async def setup(self):
        """Inicializa Playwright e resolve Cloudflare uma vez."""
        self.logger.info("Iniciando Playwright Betnacional...")
        self._playwright = await async_playwright().start()
        
        self._browser = await self._playwright.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
                "--no-sandbox",
            ]
        )
        
        self._context = await self._browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
            locale="pt-BR",
            timezone_id="America/Sao_Paulo",
            viewport={"width": 1920, "height": 1080},
        )
        
        # Stealth: esconder webdriver
        await self._context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US', 'en'] });
        """)
        
        self._page = await self._context.new_page()
        
        # Warm-up: resolver Cloudflare uma vez
        try:
            self.logger.info("Warm-up: resolvendo Cloudflare...")
            await self._page.goto(self.WARMUP_URL, wait_until="domcontentloaded", timeout=15000)
            await self._page.wait_for_timeout(2000)
            self._setup_done = True
            self.logger.info("Warm-up concluido, pronto para requisicoes paralelas")
        except Exception as e:
            self.logger.warning(f"Warm-up falhou: {e}")
            self._setup_done = True  # Continua mesmo assim
    
    async def teardown(self):
        """Fecha recursos do Playwright."""
        if self._page:
            await self._page.close()
        if self._context:
            await self._context.close()
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()

    async def get_available_leagues(self) -> List[LeagueConfig]:
        return [
            LeagueConfig(league_id=k, name=v["name"], url="", country=v["country"]) 
            for k, v in self.LEAGUES.items()
        ]
    
    async def scrape_all(self) -> List[ScrapedOdds]:
        """Busca todas as ligas em PARALELO usando context.request."""
        if not self._context:
            await self.setup()
        
        leagues = await self.get_available_leagues()
        self.logger.info(f"Buscando {len(leagues)} ligas em paralelo...")
        
        # Criar tasks para buscar todas as ligas simultaneamente
        tasks = [self._fetch_league_api(league) for league in leagues]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        all_odds = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                self.logger.error(f"Erro em {leagues[i].name}: {result}")
            elif isinstance(result, list):
                all_odds.extend(result)
                self.logger.info(f"Collected {len(result)} odds from {leagues[i].name}")
        
        return all_odds
    
    async def _fetch_league_api(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """Busca odds via API usando context.request (não navega)."""
        league_config = self.LEAGUES.get(league.league_id)
        if not league_config:
            for k, v in self.LEAGUES.items():
                if v["name"] == league.name:
                    league_config = v
                    break
        
        if not league_config:
            self.logger.warning(f"Liga nao configurada: {league.name}")
            return []
        
        tournament_id = league_config["tournament_id"]
        url = f"{self.API_BASE_URL}?sport_id=1&category_id=0&tournament_id={tournament_id}&markets=1&filter_time_event="
        
        try:
            # Usar context.request para requisição direta (muito mais rápido que page.goto)
            response = await self._context.request.get(url, timeout=10000)
            
            if response.ok:
                data = await response.json()
                return self._parse_odds(data, league.name)
            else:
                self.logger.warning(f"{league.name}: HTTP {response.status}")
                return []
                
        except Exception as e:
            self.logger.error(f"{league.name}: {e}")
            return []
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """Fallback para scrape individual (compatibilidade)."""
        if not self._context:
            await self.setup()
        
        return await self._fetch_league_api(league)

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
            self.logger.debug(f"Nenhuma odd retornada para {league_name}")
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
                    odds_type="SO",
                    extra_data={
                        "event_id": str(event_id)
                    }
                )
                results.append(scraped)
                
            except Exception as e:
                self.logger.debug(f"Erro ao criar ScrapedOdds: {e}")
                continue
        
        self.logger.info(f"Betnacional: {len(results)} jogos parseados ({league_name})")
        return results


# Teste direto
if __name__ == "__main__":
    async def run():
        s = BetnacionalScraper()
        await s.setup()
        
        try:
            import time
            start = time.time()
            
            # Teste com scrape_all (paralelo)
            odds = await s.scrape_all()
            
            elapsed = time.time() - start
            print(f"\n--- Resultado: {len(odds)} jogos em {elapsed:.2f}s ---")
            
            for o in odds[:5]:  # Mostra só 5
                print(f"{o.home_team_raw} x {o.away_team_raw} ({o.league_raw})")
                print(f"  Odds: {o.home_odd:.2f} - {o.draw_odd:.2f} - {o.away_odd:.2f}")
                print("-" * 40)
        finally:
            await s.teardown()
    
    asyncio.run(run())

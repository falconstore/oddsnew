"""
Betnacional Unified Scraper - Football and NBA Basketball.
Uses Playwright for Cloudflare bypass with optimized page.goto.

Sport IDs:
- Football: sport_id=1, markets=1 (1X2)
- Basketball: sport_id=2, markets=219 (Moneyline)

Outcome IDs:
- Football: 1=Home, 2=Draw, 3=Away
- Basketball: 4=Home, 5=Away
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
    Unified scraper for Betnacional using Playwright.
    Handles both Football (1X2) and Basketball (Moneyline).
    Single browser session for all sports.
    """
    
    API_BASE_URL = "https://prod-global-bff-events.bet6.com.br/api/odds/1/events-by-seasons"
    WARMUP_URL = "https://betnacional.bet.br/sports/futebol"
    
    # Sport IDs
    SPORT_FOOTBALL = "1"
    SPORT_BASKETBALL = "2"
    
    # Market IDs
    MARKET_1X2 = "1"
    MARKET_MONEYLINE = "219"
    
    # Football leagues
    FOOTBALL_LEAGUES = {
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
        "champions_league": {
            "tournament_id": "7",
            "name": "Champions League",
            "country": "Europa"
        },
        "liga_europa": {
            "tournament_id": "679",
            "name": "Liga Europa",
            "country": "Europa"
        },
        "eredivisie": {
            "tournament_id": "37",
            "name": "Eredivisie",
            "country": "Holanda"
        },
    }
    
    # Basketball leagues
    BASKETBALL_LEAGUES = {
        "nba": {
            "tournament_id": "132",
            "name": "NBA",
            "country": "USA"
        }
    }
    
    # Compatibility alias
    LEAGUES = FOOTBALL_LEAGUES
    
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
        """Initialize Playwright and resolve Cloudflare once."""
        self.logger.info("[Betnacional] Iniciando Playwright...")
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
        
        # Stealth: hide webdriver
        await self._context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US', 'en'] });
        """)
        
        self._page = await self._context.new_page()
        
        # Warm-up com retry
        max_retries = 2
        for attempt in range(max_retries):
            try:
                self.logger.info(f"[Betnacional] Warm-up tentativa {attempt + 1}/{max_retries}...")
                await self._page.goto(self.WARMUP_URL, wait_until="domcontentloaded", timeout=20000)
                await self._page.wait_for_timeout(2000)
                
                # Primeira requisição API para estabelecer sessão
                first_api_url = f"{self.API_BASE_URL}?sport_id=1&category_id=0&tournament_id=17&markets=1&filter_time_event="
                await self._page.goto(first_api_url, wait_until="load", timeout=15000)
                await self._page.wait_for_timeout(500)
                
                self._setup_done = True
                self.logger.info("[Betnacional] Warm-up concluido com sucesso")
                return  # Sucesso, sair do loop
                
            except Exception as e:
                self.logger.warning(f"[Betnacional] Warm-up tentativa {attempt + 1} falhou: {e}")
                if attempt < max_retries - 1:
                    # Recriar page para próxima tentativa
                    try:
                        await self._page.close()
                    except:
                        pass
                    self._page = await self._context.new_page()
                    await asyncio.sleep(2)
                else:
                    # Última tentativa falhou - raise para não continuar com browser inválido
                    self.logger.error("[Betnacional] Warm-up falhou após todas tentativas!")
                    raise RuntimeError(f"Betnacional warm-up failed: {e}")
    
    async def teardown(self):
        """Close Playwright resources and reset references for next cycle."""
        if self._page:
            try:
                await self._page.close()
            except:
                pass
            self._page = None
        
        if self._context:
            try:
                await self._context.close()
            except:
                pass
            self._context = None
        
        if self._browser:
            try:
                await self._browser.close()
            except:
                pass
            self._browser = None
        
        if self._playwright:
            try:
                await self._playwright.stop()
            except:
                pass
            self._playwright = None
        
        self._setup_done = False
        self.logger.info("[Betnacional] Playwright encerrado")

    async def get_available_leagues(self) -> List[LeagueConfig]:
        """Return list of configured football leagues (for compatibility)."""
        return [
            LeagueConfig(league_id=k, name=v["name"], url="", country=v["country"]) 
            for k, v in self.FOOTBALL_LEAGUES.items()
        ]
    
    async def scrape_all(self) -> List[ScrapedOdds]:
        """Scrape all sports using shared Playwright session."""
        all_odds = []
        
        try:
            # Setup com tratamento de erro
            if not self._context:
                await self.setup()
            
            # Football leagues (1X2)
            for league_id, config in self.FOOTBALL_LEAGUES.items():
                try:
                    odds = await self._scrape_sport(config, self.SPORT_FOOTBALL, self.MARKET_1X2, "football")
                    all_odds.extend(odds)
                    self.logger.info(f"[Betnacional] {config['name']}: {len(odds)} jogos")
                except Exception as e:
                    self.logger.error(f"[Betnacional] Erro em {config['name']}: {e}")
                    continue
            
            # Basketball leagues (Moneyline)
            for league_id, config in self.BASKETBALL_LEAGUES.items():
                try:
                    odds = await self._scrape_sport(config, self.SPORT_BASKETBALL, self.MARKET_MONEYLINE, "basketball")
                    all_odds.extend(odds)
                    self.logger.info(f"[Betnacional NBA] {config['name']}: {len(odds)} jogos")
                except Exception as e:
                    self.logger.error(f"[Betnacional NBA] Erro em {config['name']}: {e}")
                    continue
            
            self.logger.info(f"[Betnacional] Total: {len(all_odds)} odds coletadas")
            
        except RuntimeError as e:
            # Setup falhou completamente
            self.logger.error(f"[Betnacional] Scraper não pode iniciar: {e}")
            return []
        finally:
            await self.teardown()
        
        return all_odds
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """Scrape odds for a specific football league (compatibility method)."""
        if not self._context:
            await self.setup()
        
        league_config = None
        for k, v in self.FOOTBALL_LEAGUES.items():
            if v["name"] == league.name or k == league.league_id:
                league_config = v
                break
        
        if not league_config:
            self.logger.warning(f"[Betnacional] Liga nao configurada: {league.name}")
            return []
        
        return await self._scrape_sport(league_config, self.SPORT_FOOTBALL, self.MARKET_1X2, "football")

    async def _scrape_sport(self, config: Dict[str, Any], sport_id: str, market_id: str, sport_type: str) -> List[ScrapedOdds]:
        """Generic method to scrape any sport."""
        tournament_id = config["tournament_id"]
        league_name = config["name"]
        
        # Verificar se page ainda está válida
        if not self._page or self._page.is_closed():
            self.logger.warning(f"[Betnacional] {league_name}: Page inválida, tentando recriar...")
            try:
                self._page = await self._context.new_page()
            except Exception as e:
                self.logger.error(f"[Betnacional] Não foi possível recriar page: {e}")
                return []
        
        url = f"{self.API_BASE_URL}?sport_id={sport_id}&category_id=0&tournament_id={tournament_id}&markets={market_id}&filter_time_event="
        
        try:
            response = await self._page.goto(url, wait_until="load", timeout=10000)
            
            if response and response.ok:
                body_text = await self._page.evaluate("() => document.body.innerText")
                data = json.loads(body_text)
                
                if sport_type == "basketball":
                    return self._parse_basketball_odds(data, league_name)
                else:
                    return self._parse_football_odds(data, league_name)
            else:
                status = response.status if response else "N/A"
                self.logger.warning(f"[Betnacional] {league_name}: HTTP {status}")
                return []
                
        except Exception as e:
            self.logger.error(f"[Betnacional] {league_name}: {e}")
            return []

    def _parse_football_odds(self, data: Dict[str, Any], league_name: str) -> List[ScrapedOdds]:
        """Parse football API response (1X2 market)."""
        results = []
        odds_list = data.get("odds", [])
        
        if not odds_list:
            return results
        
        # Group odds by event_id
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
                
                if events[event_id]["home"] is None:
                    events[event_id]["home"] = odd.get("home", "").strip()
                    events[event_id]["away"] = odd.get("away", "").strip()
                    events[event_id]["date_start"] = odd.get("date_start")
                    
            except Exception as e:
                self.logger.debug(f"[Betnacional] Erro ao processar odd: {e}")
                continue
        
        # Convert grouped events to ScrapedOdds
        for event_id, event_data in events.items():
            try:
                odds = event_data["odds"]
                
                # Football: 1=Home, 2=Draw, 3=Away
                if "1" not in odds or "2" not in odds or "3" not in odds:
                    continue
                
                home_team = event_data["home"]
                away_team = event_data["away"]
                
                if not home_team or not away_team:
                    continue
                
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
                self.logger.debug(f"[Betnacional] Erro ao criar ScrapedOdds: {e}")
                continue
        
        return results

    def _parse_basketball_odds(self, data: Dict[str, Any], league_name: str) -> List[ScrapedOdds]:
        """Parse basketball API response (Moneyline market)."""
        results = []
        odds_list = data.get("odds", [])
        
        if not odds_list:
            return results
        
        # Group odds by event_id
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
                
                if events[event_id]["home"] is None:
                    events[event_id]["home"] = odd.get("home", "").strip()
                    events[event_id]["away"] = odd.get("away", "").strip()
                    events[event_id]["date_start"] = odd.get("date_start")
                    
            except Exception as e:
                self.logger.debug(f"[Betnacional NBA] Erro ao processar odd: {e}")
                continue
        
        # Convert grouped events to ScrapedOdds
        for event_id, event_data in events.items():
            try:
                odds = event_data["odds"]
                
                # Basketball: 4=Home, 5=Away
                if "4" not in odds or "5" not in odds:
                    self.logger.debug(f"[Betnacional NBA] Evento {event_id} incompleto: {odds.keys()}")
                    continue
                
                home_team = event_data["home"]
                away_team = event_data["away"]
                
                if not home_team or not away_team:
                    continue
                
                date_str = event_data["date_start"]
                try:
                    match_date = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
                except:
                    match_date = datetime.utcnow()
                
                scraped = ScrapedOdds(
                    bookmaker_name="betnacional",
                    home_team_raw=home_team,
                    away_team_raw=away_team,
                    league_raw=league_name,
                    match_date=match_date,
                    home_odd=odds["4"],
                    draw_odd=None,  # No draw in basketball
                    away_odd=odds["5"],
                    sport="basketball",
                    market_type="moneyline",
                    odds_type="SO",
                    extra_data={
                        "event_id": str(event_id),
                        "sport_type": "basketball"
                    }
                )
                results.append(scraped)
                
            except Exception as e:
                self.logger.debug(f"[Betnacional NBA] Erro ao criar ScrapedOdds: {e}")
                continue
        
        return results


# Direct test
if __name__ == "__main__":
    async def run():
        s = BetnacionalScraper()
        
        import time
        start = time.time()
        
        odds = await s.scrape_all()
        
        elapsed = time.time() - start
        print(f"\n--- Resultado: {len(odds)} jogos em {elapsed:.2f}s ---")
        
        football = [o for o in odds if o.sport != "basketball"]
        basketball = [o for o in odds if o.sport == "basketball"]
        
        print(f"Futebol: {len(football)} jogos")
        print(f"Basquete: {len(basketball)} jogos")
        
        for o in basketball[:3]:
            print(f"  {o.home_team_raw} x {o.away_team_raw}: {o.home_odd:.2f} / {o.away_odd:.2f}")
    
    asyncio.run(run())

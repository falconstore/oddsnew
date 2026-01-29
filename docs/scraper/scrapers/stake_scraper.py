"""
Stake Unified Scraper - Football (SO + PA) and Basketball (Moneyline).
Uses Playwright with page pool for parallel requests (bypasses API blocks).
"""

import asyncio
import json
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from loguru import logger
from playwright.async_api import async_playwright, Browser, BrowserContext, Page
from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


class StakeScraper(BaseScraper):
    """
    Unified scraper for Stake.bet.br - Football and Basketball.
    Football: Super Odds (batch) + Pagamento Antecipado (parallel requests)
    Basketball: Moneyline (parallel requests)
    
    Uses a pool of 10 pages for parallel API requests via Playwright navigation.
    """
    
    API_BASE = "https://sbweb.stake.bet.br/api/v1/br/pt-br"
    
    # Market IDs
    MARKET_SO = "1001159858"          # Super Odds (Football)
    MARKET_PA = "2100089307_0"        # Pagamento Antecipado (Football)
    MARKET_MONEYLINE = "1001159732"   # Moneyline (Basketball)
    
    # Football Leagues
    FOOTBALL_LEAGUES = {
        "premier_league": {"tournament_id": "1000094985", "name": "Premier League", "country": "Inglaterra"},
        "serie_a": {"tournament_id": "1000095001", "name": "Serie A", "country": "Italia"},
        "la_liga": {"tournament_id": "1000095049", "name": "La Liga", "country": "Espanha"},
        "bundesliga": {"tournament_id": "1000094994", "name": "Bundesliga", "country": "Alemanha"},
        "ligue_1": {"tournament_id": "1000094991", "name": "Ligue 1", "country": "França"},
        "paulistao": {"tournament_id": "1000094970", "name": "Paulistao", "country": "Brasil"},
        "fa_cup": {"tournament_id": "1000094984", "name": "FA Cup", "country": "Inglaterra"},
        "efl_cup": {"tournament_id": "1000094986", "name": "EFL Cup", "country": "Inglaterra"},
        "copa_do_rei": {"tournament_id": "1000095050", "name": "Copa do Rei", "country": "Espanha"},
        "champions_league": {"tournament_id": "1000093381", "name": "Champions League", "country": "Europa"},
        "liga_europa": {"tournament_id": "2000051195", "name": "Liga Europa", "country": "Europa"},
        "liga_da_conferencia": {"tournament_id": "2000130522", "name": "Liga da Conferencia", "country": "Europa"},
        "eredivisie": {"tournament_id": "1000094980", "name": "Eredivisie", "country": "Holanda"},
        "brasileirao_serie_a": {"tournament_id": "1000094569", "name": "Brasileirão Série A", "country": "Brasil"},
    }
    
    # Basketball Leagues
    BASKETBALL_LEAGUES = {
        "nba": {"tournament_id": "1000093652", "name": "NBA", "country": "EUA"},
    }
    
    def __init__(self):
        super().__init__(name="stake", base_url="https://stake.bet.br")
        # Playwright components
        self._playwright = None
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self._page: Optional[Page] = None
        # Page pool for parallel requests
        self._page_pool: List[Page] = []
        self._pool_semaphore: Optional[asyncio.Semaphore] = None
        self._pool_size = 10
        self.logger = logger.bind(component="stake")
    
    async def setup(self):
        """Initialize Playwright browser with page pool for parallel requests."""
        # Guard: avoid re-initialization if already set up
        if self._page is not None:
            return
        
        self.logger.info("[Stake] Iniciando browser Playwright...")
        
        # Start Playwright
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=True,
            args=[
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
            ]
        )
        
        # Create browser context with Firefox user-agent (works better)
        self._context = await self._browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:147.0) Gecko/20100101 Firefox/147.0",
            locale="pt-BR",
            timezone_id="America/Sao_Paulo",
            viewport={"width": 1920, "height": 1080},
        )
        
        # Main page for compatibility and session establishment
        self._page = await self._context.new_page()
        
        # Create page pool for parallel requests
        self.logger.info(f"[Stake] Criando pool de {self._pool_size} paginas...")
        self._page_pool = []
        for _ in range(self._pool_size):
            page = await self._context.new_page()
            self._page_pool.append(page)
        
        self._pool_semaphore = asyncio.Semaphore(self._pool_size)
        
        # Navigate to site first to establish session
        self.logger.info("[Stake] Estabelecendo sessao...")
        try:
            await self._page.goto("https://stake.bet.br/pt-br/sports/", wait_until="domcontentloaded", timeout=30000)
            await self._page.wait_for_timeout(2000)
        except Exception as e:
            self.logger.warning(f"[Stake] Aviso no carregamento inicial: {e}")
        
        self.logger.info("[Stake] Browser pronto")
    
    async def teardown(self):
        """Close Playwright browser and page pool safely."""
        # Close page pool
        for page in self._page_pool:
            try:
                await page.close()
            except Exception:
                pass
        self._page_pool = []
        self._pool_semaphore = None
        
        # Close main page
        try:
            if self._page:
                await self._page.close()
        except Exception:
            pass
        self._page = None
        
        # Close context
        try:
            if self._context:
                await self._context.close()
        except Exception:
            pass
        self._context = None
        
        # Close browser
        try:
            if self._browser:
                await self._browser.close()
        except Exception:
            pass
        self._browser = None
        
        # Stop Playwright
        try:
            if self._playwright:
                await self._playwright.stop()
        except Exception:
            pass
        self._playwright = None
        
        self.logger.info("[Stake] Recursos liberados")

    async def _fetch_json(self, url: str) -> Dict[str, Any]:
        """Fetch JSON data by navigating to URL with main page."""
        try:
            response = await self._page.goto(url, wait_until="domcontentloaded", timeout=15000)
            
            if not response:
                return {}
                
            if response.status != 200:
                self.logger.debug(f"[Stake] Status {response.status} para {url}")
                return {}
            
            # Extract JSON from page body
            content = await self._page.evaluate("() => document.body.innerText")
            
            if content:
                return json.loads(content)
            
            return {}
            
        except json.JSONDecodeError:
            self.logger.debug(f"[Stake] JSON invalido em {url}")
            return {}
        except Exception as e:
            self.logger.debug(f"[Stake] Erro ao buscar {url}: {e}")
            return {}

    async def _fetch_json_with_page(self, page: Page, url: str) -> Dict[str, Any]:
        """Fetch JSON using a specific page from pool."""
        try:
            response = await page.goto(url, wait_until="domcontentloaded", timeout=15000)
            
            if not response or response.status != 200:
                return {}
            
            content = await page.evaluate("() => document.body.innerText")
            
            if content:
                return json.loads(content)
            return {}
            
        except Exception:
            return {}

    async def _fetch_parallel(self, urls: List[str]) -> List[Dict[str, Any]]:
        """Fetch multiple URLs in parallel using page pool."""
        if not urls:
            return []
        
        results = [{}] * len(urls)
        
        async def fetch_one(idx: int, url: str):
            async with self._pool_semaphore:
                page = self._page_pool[idx % self._pool_size]
                results[idx] = await self._fetch_json_with_page(page, url)
        
        await asyncio.gather(*[fetch_one(i, url) for i, url in enumerate(urls)], return_exceptions=True)
        return results

    async def get_available_leagues(self) -> List[LeagueConfig]:
        """Return list of configured leagues (football + basketball)."""
        leagues = []
        for k, v in self.FOOTBALL_LEAGUES.items():
            leagues.append(LeagueConfig(
                league_id=k, 
                name=v["name"], 
                url=f"{self.API_BASE}/tournament/{v['tournament_id']}/live-upcoming",
                country=v["country"]
            ))
        for k, v in self.BASKETBALL_LEAGUES.items():
            leagues.append(LeagueConfig(
                league_id=k, 
                name=v["name"], 
                url=f"{self.API_BASE}/tournament/{v['tournament_id']}/live-upcoming",
                country=v["country"]
            ))
        return leagues
    
    async def scrape_all(self) -> List[ScrapedOdds]:
        """Scrape all leagues for both sports using Playwright page pool."""
        all_odds = []
        # NOTE: setup() is called by run_scraper.py, guard pattern prevents double init
        
        try:
            # Football (SO + PA)
            for league_id, config in self.FOOTBALL_LEAGUES.items():
                try:
                    odds = await self._scrape_football(config)
                    all_odds.extend(odds)
                except Exception as e:
                    self.logger.error(f"[Stake] Erro na liga {config['name']}: {e}")
            
            # Basketball (Moneyline)
            for league_id, config in self.BASKETBALL_LEAGUES.items():
                try:
                    odds = await self._scrape_basketball(config)
                    all_odds.extend(odds)
                except Exception as e:
                    self.logger.error(f"[Stake] Erro na liga {config['name']}: {e}")
                    
        except Exception as e:
            self.logger.error(f"[Stake] Erro geral: {e}")
            raise
        
        # NOTE: teardown() is managed by run_scraper.py, browser stays open between cycles
        
        self.logger.info(f"[Stake] Total: {len(all_odds)} odds coletadas")
        return all_odds
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """Legacy method for compatibility with base scraper."""
        if not self._page:
            await self.setup()
        
        # Check if it's a basketball league
        if league.league_id in self.BASKETBALL_LEAGUES:
            config = self.BASKETBALL_LEAGUES[league.league_id]
            return await self._scrape_basketball(config)
        
        # Otherwise it's football
        if league.league_id in self.FOOTBALL_LEAGUES:
            config = self.FOOTBALL_LEAGUES[league.league_id]
            return await self._scrape_football(config)
        
        return []

    async def _scrape_football(self, config: dict) -> List[ScrapedOdds]:
        """Scrape SO and PA odds for a football league."""
        league_name = config["name"]
        tournament_id = config["tournament_id"]
        
        # Fetch events
        events = await self._fetch_events(tournament_id)
        if not events:
            return []
        
        event_ids = [str(e["id"]) for e in events]
        
        # Fetch SO odds (batch request)
        so_odds_data = await self._fetch_so_odds(event_ids)
        
        # Fetch PA odds (parallel requests using page pool)
        pa_odds_by_event = await self._fetch_all_pa_odds(event_ids)
        
        # Parse all odds
        return self._parse_football_odds(events, so_odds_data, pa_odds_by_event, league_name, tournament_id)
    
    async def _scrape_basketball(self, config: dict) -> List[ScrapedOdds]:
        """Scrape Moneyline odds for a basketball league using parallel requests."""
        league_name = config["name"]
        tournament_id = config["tournament_id"]
        
        # Fetch events
        events = await self._fetch_events(tournament_id)
        if not events:
            return []
        
        # Build URLs for all events
        event_ids = [str(e.get("id", "")) for e in events if e.get("id")]
        urls = [f"{self.API_BASE}/events/{eid}/odds" for eid in event_ids]
        
        # Fetch all odds in parallel
        responses = await self._fetch_parallel(urls)
        
        results = []
        for event, odds_data in zip(events, responses):
            try:
                if not odds_data:
                    continue
                
                event_id = str(event.get("id", ""))
                
                # Extract teams
                teams = event.get("teams") or {}
                home_team = teams.get("home", "Unknown") if isinstance(teams, dict) else "Unknown"
                away_team = teams.get("away", "Unknown") if isinstance(teams, dict) else "Unknown"
                
                # Parse date
                date_str = event.get("dateStart", "")
                try:
                    match_date = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                except:
                    match_date = datetime.now(timezone.utc)
                
                # Extract Moneyline odds
                home_odd, away_odd = self._parse_moneyline_odds(odds_data)
                
                if home_odd and away_odd:
                    results.append(ScrapedOdds(
                        bookmaker_name="stake",
                        home_team_raw=home_team,
                        away_team_raw=away_team,
                        league_raw=league_name,
                        match_date=match_date,
                        home_odd=home_odd,
                        draw_odd=None,
                        away_odd=away_odd,
                        sport="basketball",
                        market_type="moneyline",
                        extra_data={"event_id": event_id}
                    ))
                    
            except Exception as e:
                self.logger.debug(f"[Stake] Erro ao processar evento NBA: {e}")
                continue
        
        self.logger.info(f"[Stake] {league_name} (Moneyline): {len(results)} jogos coletados")
        return results

    async def _fetch_events(self, tournament_id: str) -> List[Dict[str, Any]]:
        """Fetch upcoming events for a tournament via Playwright navigation."""
        url = f"{self.API_BASE}/tournament/{tournament_id}/live-upcoming"
        data = await self._fetch_json(url)
        
        events = data.get("events", [])
        return [e for e in events if not e.get("isLive", False)]
    
    async def _fetch_so_odds(self, event_ids: List[str]) -> Dict[str, Any]:
        """Fetch Super Odds for multiple events (batch request)."""
        if not event_ids:
            return {}
        
        ids_param = ",".join(event_ids)
        url = f"{self.API_BASE}/events/odds?events={ids_param}"
        return await self._fetch_json(url)
    
    async def _fetch_all_pa_odds(self, event_ids: List[str]) -> Dict[str, Dict[int, float]]:
        """Fetch PA odds for all events in parallel using page pool."""
        if not event_ids:
            return {}
        
        # Build URLs
        urls = [f"{self.API_BASE}/events/{eid}/odds" for eid in event_ids]
        
        # Fetch in parallel
        responses = await self._fetch_parallel(urls)
        
        # Process results
        results = {}
        for event_id, data in zip(event_ids, responses):
            if not data:
                continue
            
            odds_map = {}
            for odd in data.get("odds", []):
                if odd.get("marketId") != self.MARKET_PA:
                    continue
                
                column_id = odd.get("columnId")
                odd_values = odd.get("oddValues") or {}
                odd_value = odd_values.get("decimal") if isinstance(odd_values, dict) else None
                
                if column_id is not None and odd_value:
                    odds_map[column_id] = float(odd_value)
            
            if odds_map:
                results[event_id] = odds_map
        
        return results

    def _parse_football_odds(self, events: List[Dict], so_odds_data: Dict, 
                              pa_odds_by_event: Dict[str, Dict[int, float]], 
                              league_name: str, tournament_id: str) -> List[ScrapedOdds]:
        """Parse football odds from SO and PA data."""
        results = []
        so_odds_by_event = self._parse_so_odds(so_odds_data)
        
        for event in events:
            try:
                event_id = str(event.get("id", ""))
                if not event_id:
                    continue
                
                # Extract teams
                teams = event.get("teams") or {}
                home_team = teams.get("home", "Unknown") if isinstance(teams, dict) else "Unknown"
                away_team = teams.get("away", "Unknown") if isinstance(teams, dict) else "Unknown"
                
                # Parse date
                date_str = event.get("dateStart", "")
                try:
                    match_date = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                except:
                    match_date = datetime.now(timezone.utc)
                
                # SO odds
                so_odds = so_odds_by_event.get(event_id, {})
                if 0 in so_odds and 1 in so_odds and 2 in so_odds:
                    results.append(ScrapedOdds(
                        bookmaker_name="stake",
                        home_team_raw=home_team,
                        away_team_raw=away_team,
                        league_raw=league_name,
                        match_date=match_date,
                        home_odd=so_odds[0],
                        draw_odd=so_odds[1],
                        away_odd=so_odds[2],
                        market_type="1x2",
                        odds_type="SO",
                        extra_data={"event_id": event_id, "tournament_id": tournament_id}
                    ))
                
                # PA odds
                pa_odds = pa_odds_by_event.get(event_id, {})
                if 0 in pa_odds and 1 in pa_odds and 2 in pa_odds:
                    results.append(ScrapedOdds(
                        bookmaker_name="stake",
                        home_team_raw=home_team,
                        away_team_raw=away_team,
                        league_raw=league_name,
                        match_date=match_date,
                        home_odd=pa_odds[0],
                        draw_odd=pa_odds[1],
                        away_odd=pa_odds[2],
                        market_type="1x2",
                        odds_type="PA",
                        extra_data={"event_id": event_id, "tournament_id": tournament_id}
                    ))
                    
            except Exception as e:
                continue
        
        so_count = sum(1 for o in results if o.odds_type == "SO")
        pa_count = sum(1 for o in results if o.odds_type == "PA")
        self.logger.info(f"[Stake] {league_name}: {so_count} SO + {pa_count} PA = {len(results)} total")
        return results
    
    def _parse_so_odds(self, odds_data: Dict[str, Any]) -> Dict[str, Dict[int, float]]:
        """Parse batch SO odds response."""
        odds_by_event: Dict[str, Dict[int, float]] = {}
        odds_list = odds_data.get("odds", [])
        
        for odd in odds_list:
            event_id = str(odd.get("eventId", ""))
            market_id = odd.get("marketId", "")
            
            if market_id != self.MARKET_SO:
                continue
            
            column_id = odd.get("columnId")
            odd_values = odd.get("oddValues") or {}
            odd_value = odd_values.get("decimal") if isinstance(odd_values, dict) else None
            
            if event_id and column_id is not None and odd_value:
                if event_id not in odds_by_event:
                    odds_by_event[event_id] = {}
                odds_by_event[event_id][column_id] = float(odd_value)
        
        return odds_by_event
    
    def _parse_moneyline_odds(self, odds_data: Dict[str, Any]) -> tuple:
        """Parse Moneyline odds for basketball."""
        home_odd = None
        away_odd = None
        
        odds_list = odds_data.get("odds", [])
        
        for odd in odds_list:
            market_id = odd.get("marketId", "")
            if market_id != self.MARKET_MONEYLINE:
                continue
            
            column_id = odd.get("columnId")
            odd_values = odd.get("oddValues") or {}
            odd_value = odd_values.get("decimal") if isinstance(odd_values, dict) else None
            
            if column_id is not None and odd_value:
                if column_id == 0:
                    home_odd = float(odd_value)
                elif column_id == 1:
                    away_odd = float(odd_value)
        
        return home_odd, away_odd


# Test
if __name__ == "__main__":
    async def run():
        s = StakeScraper()
        await s.setup()
        
        try:
            odds = await s.scrape_all()
            
            print(f"\n--- Resultado ({len(odds)} odds) ---")
            
            # Football
            football = [o for o in odds if o.sport == "football"]
            print(f"\nFutebol: {len(football)} odds")
            for o in football[:3]:
                print(f"  {o.home_team_raw} x {o.away_team_raw} ({o.odds_type})")
                print(f"    Odds: {o.home_odd:.2f} - {o.draw_odd:.2f} - {o.away_odd:.2f}")
            
            # Basketball
            basketball = [o for o in odds if o.sport == "basketball"]
            print(f"\nBasquete: {len(basketball)} odds")
            for o in basketball[:3]:
                print(f"  {o.home_team_raw} x {o.away_team_raw}")
                print(f"    Odds: {o.home_odd:.2f} - {o.away_odd:.2f}")
        finally:
            await s.teardown()
            
    asyncio.run(run())

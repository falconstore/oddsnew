"""
Betano Unified Scraper - Football (1X2) and Basketball (Moneyline) in single session.

Uses Playwright to capture valid session cookies, then aiohttp for API requests.
This hybrid approach bypasses anti-bot protection while maintaining performance.

Unifica betano_scraper.py + betano_nba_scraper.py em uma única sessão de browser.
"""

import aiohttp
import asyncio
from datetime import datetime
from typing import List, Optional, Dict, Any
from playwright.async_api import async_playwright, Browser, BrowserContext, Page

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig
from loguru import logger


class BetanoUnifiedScraper(BaseScraper):
    """
    Unified Scraper for Betano Brazil - Football and Basketball.
    
    Uses Playwright to bypass anti-bot protection by:
    1. Loading the site in a headless browser
    2. Capturing session cookies
    3. Using those cookies with aiohttp for fast API requests
    
    Football: SO (MR12) + PA (MRES) markets
    Basketball: PA (H2HT) + SO (H2H1) markets
    """
    
    # Football League configurations
    FOOTBALL_LEAGUES = {
        "premier_league": {
            "id": "1",
            "name": "Premier League",
            "country": "Inglaterra",
            "url_path": "/sport/futebol/inglaterra/premier-league/1/"
        },
        "la_liga": {
            "id": "5",
            "name": "La Liga",
            "country": "Espanha",
            "url_path": "/sport/futebol/espanha/laliga/5/"
        },
        "serie_a": {
            "id": "1635",
            "name": "Serie A",
            "country": "Itália",
            "url_path": "/sport/futebol/italia/serie-a/1635/"
        },
        "ligue_1": {
            "id": "215",
            "name": "Ligue 1",
            "country": "França",
            "url_path": "/sport/futebol/franca/ligue-1/215/"
        },
        "bundesliga": {
            "id": "216",
            "name": "Bundesliga",
            "country": "Alemanha",
            "url_path": "/sport/futebol/alemanha/bundesliga/216/"
        },
        "paulistao": {
            "id": "16901",
            "name": "Paulistao",
            "country": "Brasil",
            "url_path": "/sport/futebol/brasil/campeonato-paulista-serie-a1/16901/"
        },
        "fa_cup": {
            "id": "218",
            "name": "FA Cup",
            "country": "Inglaterra",
            "url_path": "/sport/futebol/inglaterra/facup/218/"
        },
        "efl_cup": {
            "id": "10215",
            "name": "EFL Cup",
            "country": "Inglaterra",
            "url_path": "/sport/futebol/inglaterra/efl-cup/10215/"
        },
        "copa_do_rei": {
            "id": "10067",
            "name": "Copa do Rei",
            "country": "Espanha",
            "url_path": "/sport/futebol/espanha/copa-do-rei/10067/"
        },
        "brasileirao_serie_a": {
            "id": "10016",
            "name": "Brasileirao Serie A",
            "country": "Brasil",
            "url_path": "/sport/futebol/brasil/brasileirao-serie-a-betano/10016/"
        },
    }
    
    # Basketball League configurations
    BASKETBALL_LEAGUES = {
        "nba": {
            "id": "441g",
            "name": "NBA",
            "country": "EUA",
            "url_path": "/sport/basquete/eua/nba/441g/"
        }
    }
    
    def __init__(self):
        super().__init__(
            name="betano",
            base_url="https://www.betano.bet.br"
        )
        self._playwright = None
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self._page: Optional[Page] = None
        self._session: Optional[aiohttp.ClientSession] = None
        self._cookies: Dict[str, str] = {}
        self.logger = logger.bind(component="betano_unified")
    
    async def setup(self):
        """Initialize Playwright browser and capture session cookies."""
        # Guard: avoid re-initialization if already set up
        if self._page is not None:
            return
        
        self.logger.info("[Betano] Iniciando browser Playwright...")
        
        # Start Playwright and browser
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=True,
            args=[
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
            ]
        )
        
        # Create browser context with realistic settings
        self._context = await self._browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0",
            locale="pt-BR",
            timezone_id="America/Sao_Paulo",
            viewport={"width": 1920, "height": 1080},
        )
        
        self._page = await self._context.new_page()
        
        # Navigate to site to get valid cookies
        self.logger.debug("Loading Betano homepage to capture cookies...")
        try:
            await self._page.goto(self.base_url, wait_until="domcontentloaded", timeout=30000)
            await self._page.wait_for_timeout(2000)
        except Exception as e:
            self.logger.warning(f"Initial page load issue (continuing anyway): {e}")
        
        # Capture cookies
        cookies = await self._context.cookies()
        self._cookies = {c["name"]: c["value"] for c in cookies}
        self.logger.debug(f"Captured {len(self._cookies)} cookies")
        
        # Create aiohttp session with captured cookies
        cookie_header = "; ".join([f"{k}={v}" for k, v in self._cookies.items()])
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "pt-BR,pt;q=0.8,en-US;q=0.5,en;q=0.3",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "Cookie": cookie_header,
        }
        
        self._session = aiohttp.ClientSession(
            base_url=self.base_url,
            headers=headers
        )
        self.logger.info("[Betano] Browser pronto")
    
    async def teardown(self):
        """Close browser and aiohttp session safely."""
        # Close aiohttp session
        try:
            if self._session:
                await self._session.close()
        except Exception:
            pass
        self._session = None
        
        # Close page
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
        
        self.logger.info("[Betano] Recursos liberados")
    
    async def get_available_leagues(self) -> List[LeagueConfig]:
        """Return list of configured leagues (football + basketball)."""
        leagues = []
        for config in self.FOOTBALL_LEAGUES.values():
            leagues.append(LeagueConfig(
                league_id=config["id"],
                name=config["name"],
                url=f"{self.base_url}{config['url_path']}",
                country=config["country"]
            ))
        for config in self.BASKETBALL_LEAGUES.values():
            leagues.append(LeagueConfig(
                league_id=config["id"],
                name=config["name"],
                url=f"{self.base_url}{config['url_path']}",
                country=config["country"]
            ))
        return leagues
    
    async def scrape_all(self) -> List[ScrapedOdds]:
        """Scrape all leagues for both sports in single session."""
        all_odds = []
        
        # Setup controlado pelo proprio scraper (guard pattern evita dupla inicializacao)
        await self.setup()
        
        try:
            # Football leagues
            for league_id, config in self.FOOTBALL_LEAGUES.items():
                try:
                    league = LeagueConfig(
                        league_id=config["id"],
                        name=config["name"],
                        url=f"{self.base_url}{config['url_path']}",
                        country=config["country"]
                    )
                    odds = await self._scrape_football_league(league)
                    all_odds.extend(odds)
                except Exception as e:
                    self.logger.error(f"[Betano] Erro na liga {config['name']}: {e}")
            
            # Basketball leagues
            for league_id, config in self.BASKETBALL_LEAGUES.items():
                try:
                    odds = await self._scrape_basketball_league(config)
                    all_odds.extend(odds)
                except Exception as e:
                    self.logger.error(f"[Betano] Erro na liga {config['name']}: {e}")
                    
        except Exception as e:
            self.logger.error(f"[Betano] Erro geral: {e}")
            raise
        finally:
            # Teardown ao final de cada ciclo para liberar recursos
            await self.teardown()
        
        self.logger.info(f"[Betano] Total: {len(all_odds)} odds coletadas")
        return all_odds
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """Legacy method for compatibility with base scraper."""
        # Check if it's a basketball league
        if league.name == "NBA":
            config = self.BASKETBALL_LEAGUES.get("nba")
            if config:
                return await self._scrape_basketball_league(config)
        
        # Otherwise it's football
        return await self._scrape_football_league(league)
    
    async def _scrape_football_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """Scrape odds from a specific football league."""
        if not self._session:
            raise RuntimeError("Session not initialized. Call setup() first.")
        
        api_url = f"/api/league/hot/upcoming/?leagueId={league.league_id}&req=s,stnf,c,mb"
        
        self.logger.debug(f"Fetching {league.name} from {api_url}")
        
        # Try with aiohttp first (faster)
        try:
            headers = {"Referer": league.url}
            
            async with self._session.get(api_url, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    return self._parse_football_response(data, league.name)
                elif response.status == 403:
                    self.logger.debug(f"aiohttp got 403, falling back to Playwright for {league.name}")
                else:
                    self.logger.error(f"HTTP {response.status} for {league.name}")
                    return []
                    
        except aiohttp.ClientError as e:
            self.logger.warning(f"aiohttp failed for {league.name}: {e}")
        
        # Fallback: Use Playwright to fetch API directly
        return await self._scrape_football_with_playwright(league, api_url)
    
    async def _scrape_football_with_playwright(self, league: LeagueConfig, api_url: str) -> List[ScrapedOdds]:
        """Fallback: Use Playwright to make API request for football."""
        if not self._page:
            self.logger.error("Playwright page not available")
            return []
        
        try:
            current_url = self._page.url
            if "betano.bet.br" not in current_url:
                await self._page.goto(league.url, wait_until="domcontentloaded", timeout=30000)
                await self._page.wait_for_timeout(1000)
            
            full_url = f"{self.base_url}{api_url}"
            self.logger.debug(f"Playwright fetching: {full_url}")
            
            data = await asyncio.wait_for(
                self._page.evaluate(f"""
                    async () => {{
                        try {{
                            const response = await fetch("{full_url}", {{
                                headers: {{
                                    "Accept": "application/json, text/plain, */*",
                                    "Accept-Language": "pt-BR,pt;q=0.8,en-US;q=0.5,en;q=0.3",
                                }},
                                credentials: "include"
                            }});
                            if (!response.ok) {{
                                return {{ error: response.status }};
                            }}
                            return await response.json();
                        }} catch (e) {{
                            return {{ error: e.message }};
                        }}
                    }}
                """),
                timeout=15.0
            )
            
            if isinstance(data, dict) and "error" in data:
                self.logger.error(f"Playwright fetch error for {league.name}: {data['error']}")
                return []
            
            return self._parse_football_response(data, league.name)
            
        except asyncio.TimeoutError:
            self.logger.error(f"Timeout fetching {league.name}")
            return []
        except Exception as e:
            self.logger.error(f"Playwright scrape failed for {league.name}: {e}")
            return []
    
    def _parse_football_response(self, data: Dict[str, Any], league_name: str) -> List[ScrapedOdds]:
        """Parse the Betano API response for football odds (SO + PA)."""
        odds_list = []
        
        events = data.get("data", {}).get("events", [])
        
        if not events:
            self.logger.warning(f"No events found for {league_name}")
            return odds_list
        
        for event in events:
            # Skip live games
            if event.get("liveNow", False):
                continue
            
            match_name = event.get("name", "")
            start_time_ms = event.get("startTime")
            participants = event.get("participants", [])
            markets = event.get("markets", [])
            
            if not all([match_name, start_time_ms, participants, markets]):
                continue
            
            # Get team names
            if len(participants) >= 2:
                home_team = participants[0].get("name", "")
                away_team = participants[1].get("name", "")
            else:
                parts = match_name.split(" - ")
                if len(parts) == 2:
                    home_team, away_team = parts
                else:
                    continue
            
            match_date = datetime.utcfromtimestamp(start_time_ms / 1000)
            
            # Process both SO (MR12) and PA (MRES) markets
            for market in markets:
                market_type = market.get("type", "")
                
                if market_type == "MR12":
                    odds_type = "SO"
                elif market_type == "MRES":
                    odds_type = "PA"
                else:
                    continue
                
                selections = market.get("selections", [])
                home_odd = None
                draw_odd = None
                away_odd = None
                
                for selection in selections:
                    name = selection.get("name", "")
                    price = selection.get("price")
                    
                    if name == "1":
                        home_odd = price
                    elif name == "X":
                        draw_odd = price
                    elif name == "2":
                        away_odd = price
                
                if home_odd is None or draw_odd is None or away_odd is None:
                    continue
                
                scraped = ScrapedOdds(
                    bookmaker_name="betano",
                    home_team_raw=home_team,
                    away_team_raw=away_team,
                    league_raw=league_name,
                    match_date=match_date,
                    home_odd=float(home_odd),
                    draw_odd=float(draw_odd),
                    away_odd=float(away_odd),
                    market_type="1x2",
                    odds_type=odds_type,
                    extra_data={
                        "betano_event_id": event.get("id"),
                        "betano_market_id": market.get("id"),
                    }
                )
                
                odds_list.append(scraped)
        
        self.logger.info(f"{league_name}: {len(odds_list)} matches parsed")
        return odds_list
    
    async def _scrape_basketball_league(self, config: Dict[str, str]) -> List[ScrapedOdds]:
        """Scrape NBA odds using Playwright (aiohttp gets 403 for basketball)."""
        if not self._page:
            self.logger.error("Playwright page not initialized")
            return []
        
        league_name = config["name"]
        league_id = config["id"]
        api_url = f"{self.base_url}/api/sports/BASK/hot/trending/leagues/{league_id}/events/?req=s,stnf,c,mb"
        
        self.logger.debug(f"Fetching NBA odds from: {api_url}")
        
        try:
            response = await asyncio.wait_for(
                self._page.evaluate(f"""
                    async () => {{
                        const res = await fetch('{api_url}');
                        return await res.json();
                    }}
                """),
                timeout=15.0
            )
            return self._parse_basketball_response(response, league_name)
        except asyncio.TimeoutError:
            self.logger.error(f"Timeout fetching NBA")
            return []
        except Exception as e:
            self.logger.error(f"Error fetching NBA: {e}")
            return []
    
    def _parse_basketball_response(self, data: Dict[str, Any], league_name: str) -> List[ScrapedOdds]:
        """Parse API response for basketball odds (PA + SO)."""
        odds_list = []
        
        events = data.get("data", {}).get("events", [])
        self.logger.debug(f"Found {len(events)} NBA events")
        
        for event in events:
            try:
                participants = event.get("participants", [])
                if len(participants) < 2:
                    continue
                
                home_team = participants[0].get("name", "")
                away_team = participants[1].get("name", "")
                
                if not home_team or not away_team:
                    continue
                
                start_time_ms = event.get("startTime")
                if not start_time_ms:
                    continue
                match_date = datetime.utcfromtimestamp(start_time_ms / 1000)
                
                event_id = event.get("id")
                
                # Extract PA odds from markets (H2HT)
                pa_odds = self._extract_basketball_pa_odds(event)
                if pa_odds:
                    odds_list.append(ScrapedOdds(
                        bookmaker_name="betano",
                        home_team_raw=home_team,
                        away_team_raw=away_team,
                        league_raw=league_name,
                        match_date=match_date,
                        home_odd=pa_odds["home"],
                        draw_odd=None,
                        away_odd=pa_odds["away"],
                        sport="basketball",
                        market_type="moneyline",
                        odds_type="PA",
                        extra_data={
                            "betano_event_id": event_id,
                            "betano_market_id": pa_odds.get("market_id"),
                        }
                    ))
                
                # Extract SO odds from sixPackBlocks (H2H1)
                so_odds = self._extract_basketball_so_odds(event)
                if so_odds:
                    odds_list.append(ScrapedOdds(
                        bookmaker_name="betano",
                        home_team_raw=home_team,
                        away_team_raw=away_team,
                        league_raw=league_name,
                        match_date=match_date,
                        home_odd=so_odds["home"],
                        draw_odd=None,
                        away_odd=so_odds["away"],
                        sport="basketball",
                        market_type="moneyline",
                        odds_type="SO",
                        extra_data={
                            "betano_event_id": event_id,
                            "betano_market_id": so_odds.get("market_id"),
                        }
                    ))
                    
            except Exception as e:
                self.logger.debug(f"Error parsing NBA event: {e}")
                continue
        
        self.logger.info(f"NBA {league_name}: {len(odds_list)} odds entries parsed")
        return odds_list
    
    def _extract_basketball_pa_odds(self, event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Extract PA (Pagamento Antecipado) odds from markets array."""
        markets = event.get("markets", [])
        
        for market in markets:
            if market.get("type") == "H2HT":
                selections = market.get("selections", [])
                if len(selections) >= 2:
                    return {
                        "home": float(selections[0].get("price", 0)),
                        "away": float(selections[1].get("price", 0)),
                        "market_id": market.get("id"),
                    }
        return None
    
    def _extract_basketball_so_odds(self, event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Extract SO (Super Odds) from sixPackBlocks array."""
        six_pack_blocks = event.get("sixPackBlocks", [])
        
        if not six_pack_blocks:
            return None
        
        columns = six_pack_blocks[0].get("columns", [])
        
        for column in columns:
            if column.get("type") == "H2H1":
                selections = column.get("selections", [])
                if len(selections) >= 2:
                    return {
                        "home": float(selections[0].get("price", 0)),
                        "away": float(selections[1].get("price", 0)),
                        "market_id": column.get("id"),
                    }
        return None

"""
Betbra Unified Scraper - Football (1X2) and Basketball (Moneyline) in single session.

Uses Playwright page.goto directly - only BACK odds are collected (lay odds are ignored).
API: https://mexchange-api.betbra.bet.br/api/events

Unifica betbra_scraper.py + betbra_nba_scraper.py em uma única sessão de browser.
"""

import json
import re
from datetime import datetime
from typing import List, Dict, Any, Optional
from playwright.async_api import async_playwright, Browser, BrowserContext, Page

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig
from loguru import logger


class BetbraUnifiedScraper(BaseScraper):
    """
    Unified Scraper for Betbra Brazil Exchange - Football and Basketball.
    
    Uses Playwright page.goto to bypass anti-bot protection.
    Only collects BACK odds (never lay).
    """
    
    # Football League configurations
    FOOTBALL_LEAGUES = {
        "premier_league": {
            "name": "Premier League",
            "country": "England",
            "tag_url_name": "english-premier-league",
        },
        "serie_a": {
            "name": "Serie A",
            "country": "Italy",
            "tag_url_name": "italy-serie-a",
        },
        "la_liga": {
            "name": "La Liga",
            "country": "Spain",
            "tag_url_name": "spain-la-liga",
        },
        "bundesliga": {
            "name": "Bundesliga",
            "country": "Germany",
            "tag_url_name": "germany-bundesliga",
        },
        "ligue_1": {
            "name": "Ligue 1",
            "country": "France",
            "tag_url_name": "france-ligue-1",
        },
        "paulistao": {
            "name": "paulistao",
            "country": "Brazil",
            "tag_url_name": "brazil-paulista-a1",
        },
        "fa_cup": {
            "name": "facup",
            "country": "England",
            "tag_url_name": "england-fa-cup",
        },
        "efl_cup": {
            "name": "EFL Cup",
            "country": "England",
            "tag_url_name": "england-league-cup",
        },
        "copa_do_rei": {
            "name": "Copa do Rei",
            "country": "Spain",
            "tag_url_name": "spain-copa-del-rey",
        },
    }
    
    # Basketball League configurations
    BASKETBALL_LEAGUES = {
        "nba": {
            "name": "NBA",
            "country": "EUA",
            "tag_url_name": "nba",
        },
    }
    
    API_BASE = "https://mexchange-api.betbra.bet.br/api/events"
    
    def __init__(self):
        super().__init__(
            name="betbra",
            base_url="https://betbra.bet.br"
        )
        self._playwright = None
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self._page: Optional[Page] = None
        self.logger = logger.bind(component="betbra_unified")
    
    async def setup(self):
        """Initialize Playwright browser."""
        # Guard: avoid re-initialization if already set up
        if self._page is not None:
            return
        
        self.logger.info("[Betbra] Iniciando browser Playwright...")
        
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
        
        # Navigate to site to establish session
        self.logger.debug("Loading Betbra homepage to establish session...")
        try:
            await self._page.goto(self.base_url, wait_until="domcontentloaded", timeout=30000)
            await self._page.wait_for_timeout(2000)
        except Exception as e:
            self.logger.warning(f"Initial page load issue (continuing anyway): {e}")
        
        self.logger.info("[Betbra] Browser pronto")
    
    async def teardown(self):
        """Close browser safely."""
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
        
        self.logger.info("[Betbra] Recursos liberados")
    
    async def get_available_leagues(self) -> List[LeagueConfig]:
        """Return list of configured leagues (football + basketball)."""
        leagues = []
        for league_id, config in self.FOOTBALL_LEAGUES.items():
            leagues.append(LeagueConfig(
                league_id=league_id,
                name=config["name"],
                url=config["tag_url_name"],
                country=config["country"]
            ))
        for league_id, config in self.BASKETBALL_LEAGUES.items():
            leagues.append(LeagueConfig(
                league_id=league_id,
                name=config["name"],
                url=config["tag_url_name"],
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
                        league_id=league_id,
                        name=config["name"],
                        url=config["tag_url_name"],
                        country=config["country"]
                    )
                    odds = await self._scrape_football_league(league)
                    all_odds.extend(odds)
                except Exception as e:
                    self.logger.error(f"[Betbra] Erro na liga {config['name']}: {e}")
            
            # Basketball leagues
            for league_id, config in self.BASKETBALL_LEAGUES.items():
                try:
                    league = LeagueConfig(
                        league_id=league_id,
                        name=config["name"],
                        url=config["tag_url_name"],
                        country=config["country"]
                    )
                    odds = await self._scrape_basketball_league(league)
                    all_odds.extend(odds)
                except Exception as e:
                    self.logger.error(f"[Betbra] Erro na liga {config['name']}: {e}")
                    
        except Exception as e:
            self.logger.error(f"[Betbra] Erro geral: {e}")
            raise
        finally:
            # Teardown ao final de cada ciclo para liberar recursos
            await self.teardown()
        
        self.logger.info(f"[Betbra] Total: {len(all_odds)} odds coletadas")
        return all_odds
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """Legacy method for compatibility with base scraper."""
        # Check if it's a basketball league
        if league.name == "NBA":
            return await self._scrape_basketball_league(league)
        
        # Otherwise it's football
        return await self._scrape_football_league(league)
    
    async def _scrape_football_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """Scrape odds for a specific football league from Betbra API."""
        if not self._page:
            self.logger.error("Playwright page not initialized")
            return []
        
        try:
            # Build API URL with parameters
            params = f"offset=0&per-page=100&tag-url-names={league.url},soccer&sort-by=volume&sort-direction=desc&en-market-names=Moneyline,Match Odds,Winner"
            full_url = f"{self.API_BASE}?{params}"
            
            self.logger.debug(f"Fetching {league.name} via browser...")
            
            response = await self._page.goto(full_url, wait_until="domcontentloaded", timeout=30000)
            
            if not response:
                self.logger.error(f"No response for {league.name}")
                return []
            
            status = response.status
            self.logger.debug(f"Browser fetch status: {status}")
            
            if status != 200:
                body_text = await self._page.content()
                self.logger.error(f"API error {status} for {league.name}: {body_text[:300]}")
                return []
            
            # Get JSON from page content
            body_text = await self._page.content()
            
            # The response might be wrapped in HTML tags, extract JSON
            json_match = re.search(r'\{.*\}', body_text, re.DOTALL)
            if not json_match:
                self.logger.error(f"No JSON found in response for {league.name}")
                return []
            
            data = json.loads(json_match.group())
            
            if "events" not in data:
                self.logger.warning(f"No events in response for {league.name}")
                return []
            
            odds_list = self._parse_football_response(data, league.name)
            self.logger.info(f"{league.name}: {len(odds_list)} matches parsed")
            return odds_list
            
        except Exception as e:
            self.logger.error(f"Scrape failed for {league.name}: {e}")
            return []
    
    def _parse_football_response(self, data: Dict[str, Any], league_name: str) -> List[ScrapedOdds]:
        """Parse API response for football 1X2 odds (BACK only)."""
        odds_list = []
        
        for event in data.get("events", []):
            try:
                markets = event.get("markets", [])
                
                # Find the 1X2 market
                one_x_two_market = None
                for market in markets:
                    market_type = market.get("market-type", "")
                    if market_type == "one_x_two":
                        one_x_two_market = market
                        break
                
                if not one_x_two_market:
                    continue
                
                # Extract team names from event participants
                participants = {}
                for p in event.get("event-participants", []):
                    number = p.get("number", "")
                    name = p.get("participant-name", "")
                    if number and name:
                        participants[number] = name
                
                home_team = participants.get("1", "")
                away_team = participants.get("2", "")
                
                if not home_team or not away_team:
                    continue
                
                # Extract BACK odds from runners
                home_odd = None
                draw_odd = None
                away_odd = None
                
                for runner in one_x_two_market.get("runners", []):
                    runner_name = runner.get("name", "")
                    
                    # Find BACK price only (ignore LAY)
                    back_price = None
                    for price in runner.get("prices", []):
                        if price.get("side") == "back":
                            back_price = price.get("odds")
                            break
                    
                    if back_price is None:
                        continue
                    
                    # Match runner to outcome
                    if runner_name == home_team:
                        home_odd = float(back_price)
                    elif runner_name == away_team:
                        away_odd = float(back_price)
                    elif runner_name.lower() in ["empate", "draw", "x"]:
                        draw_odd = float(back_price)
                
                # Only create odds if we have all three
                if home_odd is None or draw_odd is None or away_odd is None:
                    continue
                
                # Parse match date
                match_date = None
                start_str = event.get("start", "")
                if start_str:
                    try:
                        match_date = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
                    except ValueError:
                        match_date = datetime.now()
                
                odds_list.append(ScrapedOdds(
                    bookmaker_name="betbra",
                    home_team_raw=home_team,
                    away_team_raw=away_team,
                    league_raw=league_name,
                    match_date=match_date,
                    home_odd=home_odd,
                    draw_odd=draw_odd,
                    away_odd=away_odd,
                    market_type="1x2",
                    odds_type="SO",  # Betbra = Super Odds (exchange)
                    extra_data={
                        "betbra_event_id": event.get("id"),
                        "betbra_market_id": one_x_two_market.get("id"),
                        "odds_type": "back",
                        "volume": one_x_two_market.get("volume", 0),
                    }
                ))
                
            except Exception as e:
                self.logger.warning(f"Error parsing football event: {e}")
                continue
        
        return odds_list
    
    async def _scrape_basketball_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """Scrape NBA odds from Betbra API."""
        if not self._page:
            self.logger.error("Playwright page not initialized")
            return []
        
        try:
            # Build API URL with NBA/basketball parameters
            params = f"offset=0&per-page=100&tag-url-names={league.url},basketball&sort-by=volume&sort-direction=desc&en-market-names=Moneyline"
            full_url = f"{self.API_BASE}?{params}"
            
            self.logger.debug(f"Fetching NBA via browser...")
            
            response = await self._page.goto(full_url, wait_until="domcontentloaded", timeout=30000)
            
            if not response:
                self.logger.error(f"No response for NBA")
                return []
            
            status = response.status
            self.logger.debug(f"Browser fetch status: {status}")
            
            if status != 200:
                body_text = await self._page.content()
                self.logger.error(f"API error {status} for NBA: {body_text[:300]}")
                return []
            
            # Get JSON from page content
            body_text = await self._page.content()
            
            # The response might be wrapped in HTML tags, extract JSON
            json_match = re.search(r'\{.*\}', body_text, re.DOTALL)
            if not json_match:
                self.logger.error(f"No JSON found in response for NBA")
                return []
            
            data = json.loads(json_match.group())
            
            if "events" not in data:
                self.logger.warning(f"No events in response for NBA")
                return []
            
            odds_list = self._parse_basketball_response(data, league.name)
            self.logger.info(f"NBA: {len(odds_list)} matches parsed")
            return odds_list
            
        except Exception as e:
            self.logger.error(f"Scrape failed for NBA: {e}")
            return []
    
    def _parse_basketball_response(self, data: Dict[str, Any], league_name: str) -> List[ScrapedOdds]:
        """Parse API response for basketball Moneyline odds (BACK only)."""
        odds_list = []
        
        for event in data.get("events", []):
            try:
                markets = event.get("markets", [])
                
                # Find the Moneyline market
                moneyline_market = None
                for market in markets:
                    market_type = market.get("market-type", "")
                    if market_type == "money_line":
                        moneyline_market = market
                        break
                
                if not moneyline_market:
                    continue
                
                # CRITICAL: Parse event name to get correct home/away orientation
                # Betbra format: "Away em Home" (e.g., "Minnesota Timberwolves em Miami Heat")
                event_name = event.get("name", "")
                home_team = None
                away_team = None
                
                if " em " in event_name:
                    parts = event_name.split(" em ", 1)
                    if len(parts) == 2:
                        away_team = parts[0].strip()
                        home_team = parts[1].strip()
                
                # Fallback: use event-participants
                if not home_team or not away_team:
                    participants = {}
                    for p in event.get("event-participants", []):
                        number = p.get("number", "")
                        name = p.get("participant-name", "")
                        if number and name:
                            participants[number] = name
                    
                    home_team = participants.get("2", "")
                    away_team = participants.get("1", "")
                
                if not home_team or not away_team:
                    continue
                
                # Extract BACK odds from runners - match by name
                home_odd = None
                away_odd = None
                
                for runner in moneyline_market.get("runners", []):
                    runner_name = runner.get("name", "")
                    
                    # Find BACK price only (ignore LAY)
                    back_price = None
                    for price in runner.get("prices", []):
                        if price.get("side") == "back":
                            back_price = price.get("odds")
                            break
                    
                    if back_price is None:
                        continue
                    
                    # Match runner to outcome by name
                    if runner_name == home_team:
                        home_odd = float(back_price)
                    elif runner_name == away_team:
                        away_odd = float(back_price)
                
                # Only create odds if we have both (no draw in basketball)
                if home_odd is None or away_odd is None:
                    continue
                
                # Parse match date
                match_date = None
                start_str = event.get("start", "")
                if start_str:
                    try:
                        match_date = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
                    except ValueError:
                        match_date = datetime.now()
                
                odds_list.append(ScrapedOdds(
                    bookmaker_name="betbra",
                    home_team_raw=home_team,
                    away_team_raw=away_team,
                    league_raw=league_name,
                    match_date=match_date,
                    home_odd=home_odd,
                    draw_odd=None,  # No draw in basketball
                    away_odd=away_odd,
                    sport="basketball",
                    market_type="moneyline",
                    odds_type="SO",  # Betbra = Super Odds (exchange)
                    extra_data={
                        "betbra_event_id": event.get("id"),
                        "betbra_market_id": moneyline_market.get("id"),
                        "odds_type": "back",
                        "volume": moneyline_market.get("volume", 0),
                    }
                ))
                
            except Exception as e:
                self.logger.warning(f"Error parsing NBA event: {e}")
                continue
        
        return odds_list

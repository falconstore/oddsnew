"""
Jogo de Ouro Unified Scraper - Football + NBA in a single session.
Hybrid approach: Playwright captures token, curl_cffi fetches data.

Consolidates jogodeouro_scraper.py (football) and jogodeouro_nba_scraper.py (NBA)
into a single class with shared token and HTTP session.

Connection fix: Reduced timeouts, optimized Chrome args, retry logic.
"""

import asyncio
import os
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from datetime import datetime

from curl_cffi.requests import AsyncSession
from playwright.async_api import async_playwright
from loguru import logger
from dateutil import parser as date_parser

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


@dataclass
class JogodeOuroLeagueConfig:
    champ_id: str
    name: str
    country: str
    category_id: str = ""
    league_slug: str = ""


class JogodeOuroUnifiedScraper(BaseScraper):
    """Unified scraper for Jogo de Ouro - Football + NBA using Altenar API.
    
    Connection improvements over the original:
    - Reduced Playwright timeout per URL: 60s -> 20s (fail fast, try next)
    - Optimized Chrome args: --single-process, --disable-gpu, --memory-pressure-off
    - Reduced viewport: 800x600 (less resources)
    - More warm-up URLs for faster token capture
    - Retry in scrape_all() if token fails on first attempt
    """
    
    FOOTBALL_LEAGUES = {
        "serie_a": JogodeOuroLeagueConfig(champ_id="2942", name="Serie A", country="italia", category_id="502", league_slug="serie-a"),
        "premier_league": JogodeOuroLeagueConfig(champ_id="2936", name="Premier League", country="inglaterra", category_id="497", league_slug="premier-league"),
        "la_liga": JogodeOuroLeagueConfig(champ_id="2941", name="La Liga", country="espanha", category_id="501", league_slug="laliga"),
        "bundesliga": JogodeOuroLeagueConfig(champ_id="2950", name="Bundesliga", country="alemanha", category_id="503", league_slug="bundesliga"),
        "ligue_1": JogodeOuroLeagueConfig(champ_id="2943", name="Ligue 1", country="franca", category_id="504", league_slug="ligue-1"),
        "paulistao": JogodeOuroLeagueConfig(champ_id="3436", name="Paulistao", country="brasil", category_id="506", league_slug="paulistao"),
        "fa_cup": JogodeOuroLeagueConfig(champ_id="2935", name="FA Cup", country="inglaterra", category_id="497", league_slug="fa-cup"),
        "efl_cup": JogodeOuroLeagueConfig(champ_id="2972", name="EFL Cup", country="inglaterra", category_id="498", league_slug="efl-cup"),
        "copa_do_rei": JogodeOuroLeagueConfig(champ_id="2973", name="Copa do Rei", country="espanha", category_id="499", league_slug="copa-do-rei"),
        "champions_league": JogodeOuroLeagueConfig(champ_id="16808", name="Champions League", country="europa", category_id="499", league_slug="champions-league"),
        "liga_europa": JogodeOuroLeagueConfig(champ_id="16809", name="Liga Europa", country="europa", category_id="499", league_slug="liga-europa"),
        "liga_da_conferencia": JogodeOuroLeagueConfig(champ_id="31608", name="Liga da Conferencia", country="europa", category_id="499", league_slug="liga-da-conferencia"),
        "eredivisie": JogodeOuroLeagueConfig(champ_id="3065", name="Eredivisie", country="holanda", category_id="512", league_slug="eredivisie"),
        "brasileirao_serie_a": JogodeOuroLeagueConfig(champ_id="11318", name="Brasileirão Série A", country="brasil", category_id="505", league_slug="brasileirao-serie-a"),
        "libertadores": JogodeOuroLeagueConfig(champ_id="3709", name="Libertadores", country="América do Sul", category_id="510", league_slug="libertadores"),
        "carioca": JogodeOuroLeagueConfig(champ_id="3357", name="Carioca", country="brasil", category_id="520", league_slug="carioca"),
        "liga_portuguesa": JogodeOuroLeagueConfig(champ_id="3152", name="Liga Portuguesa", country="portugal", category_id="511", league_slug="liga-portuguesa"),
        "championship": JogodeOuroLeagueConfig(champ_id="2937", name="Championship", country="inglaterra", category_id="497", league_slug="championship"),
    }
    
    BASKETBALL_LEAGUES = {
        "nba": JogodeOuroLeagueConfig(champ_id="2980", name="NBA", country="eua"),
    }
    
    API_BASE = "https://sb2frontend-altenar2.biahosted.com/api/widget"
    INTEGRATION = "jogodeouro"
    
    # More warm-up URLs (football pages load faster and more reliably)
    WARMUP_URLS = [
        "https://jogodeouro.bet.br/sports/futebol/italia/serie-a",
        "https://jogodeouro.bet.br/sports/futebol/inglaterra/premier-league",
        "https://jogodeouro.bet.br/sports/futebol",
        "https://jogodeouro.bet.br/sports",
    ]
    
    # Optimized Chrome arguments for VPS
    CHROME_ARGS = [
        '--no-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--single-process',
        '--disable-gpu',
        '--memory-pressure-off',
    ]
    
    UA_STRING = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
    
    def __init__(self):
        super().__init__(name="jogodeouro", base_url="https://jogodeouro.bet.br")
        self.session: Optional[AsyncSession] = None
        self.auth_token: Optional[str] = None
        self.user_agent: Optional[str] = None
        self._setup_attempted: bool = False
        self.logger = logger.bind(component="jogodeouro")
    
    def _init_session(self) -> None:
        """Initialize curl_cffi session with captured credentials."""
        self.session = AsyncSession(impersonate="chrome120")
        self.session.headers = {
            "accept": "*/*",
            "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
            "authorization": self.auth_token,
            "origin": "https://jogodeouro.bet.br",
            "referer": "https://jogodeouro.bet.br/",
            "user-agent": self.user_agent,
            "sec-ch-ua": '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"macOS"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "cross-site",
        }
    
    async def setup(self) -> None:
        """Capture authorization token via Playwright with improved resilience.
        
        Improvements over original:
        - Timeout per URL: 20s (was 60s) - fail fast, try next URL
        - Scroll wait: 2s + 1.5s (was 3s + 2s + 2s) 
        - Chrome args: --single-process, --disable-gpu, --memory-pressure-off
        - Viewport: 800x600 (was default) - less resources
        - Total max time: ~90s (was ~210s)
        """
        
        # Reuse existing token if available
        if self.auth_token and self.user_agent:
            if not self.session:
                self._init_session()
            self.logger.info("[JogodeOuro] Reusing existing token")
            return
        
        # Check for manual token override via env var
        manual_token = os.environ.get("JOGODEOURO_AUTH_TOKEN")
        if manual_token:
            self.logger.info("[JogodeOuro] Using manual token from JOGODEOURO_AUTH_TOKEN env var")
            self.auth_token = manual_token
            self.user_agent = self.UA_STRING
            self._init_session()
            return
        
        # Prevent infinite setup loops
        if self._setup_attempted:
            self.logger.warning("[JogodeOuro] Setup already attempted this cycle, skipping")
            return
        
        self._setup_attempted = True
        self.logger.info("[JogodeOuro] Starting Playwright to capture credentials...")
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=self.CHROME_ARGS
            )
            
            context = await browser.new_context(
                viewport={'width': 800, 'height': 600},
                user_agent=self.UA_STRING
            )
            page = await context.new_page()
            
            token_future = asyncio.get_event_loop().create_future()
            
            async def handle_request(request):
                if "biahosted.com/api" in request.url:
                    headers = request.headers
                    if "authorization" in headers:
                        token = headers["authorization"]
                        if token and len(token) > 20 and not token_future.done():
                            self.logger.info("[JogodeOuro] Token captured via request interception!")
                            token_future.set_result(token)
            
            page.on("request", handle_request)
            
            try:
                for i, target_url in enumerate(self.WARMUP_URLS):
                    if token_future.done():
                        self.logger.info(f"[JogodeOuro] Token captured on URL {i+1}/{len(self.WARMUP_URLS)}")
                        break
                    
                    self.logger.info(f"[JogodeOuro] Trying URL {i+1}/{len(self.WARMUP_URLS)}: {target_url}")
                    
                    try:
                        # Reduced timeout: 20s instead of 60s
                        await page.goto(target_url, wait_until="domcontentloaded", timeout=20000)
                        await page.wait_for_timeout(2000)
                        
                        if not token_future.done():
                            # Single scroll to trigger API calls
                            await page.evaluate("window.scrollTo(0, 1000)")
                            await page.wait_for_timeout(1500)
                            
                    except Exception as url_error:
                        self.logger.warning(f"[JogodeOuro] URL {i+1} failed: {url_error}")
                        continue
                
                # Final wait for token if still not captured
                if not token_future.done():
                    self.logger.info("[JogodeOuro] Waiting final 5s for token...")
                    try:
                        self.auth_token = await asyncio.wait_for(token_future, timeout=5.0)
                    except asyncio.TimeoutError:
                        self.logger.error("[JogodeOuro] FAILED: Could not capture token after all attempts")
                        self.auth_token = None
                else:
                    self.auth_token = token_future.result()
                
                if self.auth_token:
                    self.user_agent = await page.evaluate("navigator.userAgent")
                    self.logger.info("[JogodeOuro] Token capture successful!")
                
            except Exception as e:
                self.logger.error(f"[JogodeOuro] Playwright error: {type(e).__name__}: {e}")
            finally:
                await browser.close()
        
        # Initialize session after getting token
        if self.auth_token and self.user_agent:
            self._init_session()
    
    async def teardown(self) -> None:
        """Close session and reset all state for clean next cycle."""
        if self.session:
            await self.session.close()
            self.session = None
        self.auth_token = None
        self.user_agent = None
        self._setup_attempted = False
        self.logger.info("[JogodeOuro] Session closed")
    
    async def get_available_leagues(self) -> List[LeagueConfig]:
        """Return list of all supported leagues (football + NBA)."""
        leagues = []
        for key, val in self.FOOTBALL_LEAGUES.items():
            full_url = f"https://jogodeouro.bet.br/esportes#/sport/66/category/{val.category_id}/championship/{val.champ_id}"
            leagues.append(LeagueConfig(league_id=key, name=val.name, url=full_url, country=val.country))
        for key, val in self.BASKETBALL_LEAGUES.items():
            full_url = f"https://jogodeouro.bet.br/sports/basquete/eua/nba"
            leagues.append(LeagueConfig(league_id=key, name=val.name, url=full_url, country=val.country))
        return leagues
    
    async def scrape_all(self) -> List[ScrapedOdds]:
        """Main entry point: scrape all football + NBA leagues in one cycle.
        
        Includes retry logic: if token capture fails on first attempt,
        cleans state and tries once more before giving up.
        """
        all_odds: List[ScrapedOdds] = []
        
        try:
            await self.setup()
            
            # Retry logic: if token failed, try once more after cleanup
            if not self.auth_token:
                self.logger.warning("[JogodeOuro] Token failed on first attempt, retrying...")
                self._setup_attempted = False
                if self.session:
                    await self.session.close()
                    self.session = None
                await self.setup()
            
            if not self.auth_token:
                self.logger.error("[JogodeOuro] No token available after retry, skipping cycle")
                return []
            
            # Football leagues
            football_count = 0
            for key, league in self.FOOTBALL_LEAGUES.items():
                try:
                    odds = await self._scrape_football_league(key, league)
                    all_odds.extend(odds)
                    football_count += len(odds)
                except asyncio.CancelledError:
                    self.logger.warning("[JogodeOuro] Cancelled during football scraping, returning partial results")
                    return all_odds
                except Exception as e:
                    self.logger.error(f"[JogodeOuro] Error scraping {league.name}: {e}")
            
            # Basketball leagues
            nba_count = 0
            for key, league in self.BASKETBALL_LEAGUES.items():
                try:
                    odds = await self._scrape_basketball_league(key, league)
                    all_odds.extend(odds)
                    nba_count += len(odds)
                except asyncio.CancelledError:
                    self.logger.warning("[JogodeOuro] Cancelled during NBA scraping, returning partial results")
                    return all_odds
                except Exception as e:
                    self.logger.error(f"[JogodeOuro] Error scraping {league.name}: {e}")
            
            self.logger.info(f"[JogodeOuro] Total: {len(all_odds)} odds (Football: {football_count}, NBA: {nba_count})")
            
        finally:
            await self.teardown()
        
        return all_odds
    
    async def _fetch_league_data(self, champ_id: str, retry_on_auth_fail: bool = True) -> Optional[Dict[str, Any]]:
        """Fetch data from Altenar API for a given championship ID.
        
        Tries GetEvents first, then GetLiveEvents as fallback.
        Handles token expiration with auto-retry (1x).
        """
        if not self.auth_token or not self.session:
            return None
        
        params = {
            "culture": "pt-BR",
            "timezoneOffset": "180",
            "integration": self.INTEGRATION,
            "deviceType": "1",
            "numFormat": "en-GB",
            "countryCode": "BR",
            "eventCount": "0",
            "sportId": "0",
            "champIds": champ_id
        }
        
        endpoints = [
            f"{self.API_BASE}/GetEvents",
            f"{self.API_BASE}/GetLiveEvents"
        ]
        
        for endpoint in endpoints:
            try:
                response = await self.session.get(endpoint, params=params, timeout=20)
                
                if response.status_code == 200:
                    data = response.json()
                    events = data.get("events", [])
                    if events:
                        return data
                    continue
                
                if response.status_code in (400, 401, 403):
                    self.logger.warning(f"[JogodeOuro] Token issue (HTTP {response.status_code})")
                    
                    if retry_on_auth_fail:
                        self.logger.info("[JogodeOuro] Attempting token recapture...")
                        self.auth_token = None
                        self.user_agent = None
                        if self.session:
                            await self.session.close()
                            self.session = None
                        self._setup_attempted = False
                        await self.setup()
                        return await self._fetch_league_data(champ_id, retry_on_auth_fail=False)
                    
                    return None
                    
            except Exception as e:
                self.logger.error(f"[JogodeOuro] Error fetching champ {champ_id}: {e}")
                continue
        
        return None
    
    def _parse_teams(self, event_name: str) -> tuple:
        """Extract home and away team names from event name."""
        if " vs. " in event_name:
            parts = event_name.split(" vs. ")
            return parts[0].strip(), parts[1].strip()
        elif " vs " in event_name:
            parts = event_name.split(" vs ")
            return parts[0].strip(), parts[1].strip()
        return "", ""
    
    async def _scrape_football_league(self, key: str, league: JogodeOuroLeagueConfig) -> List[ScrapedOdds]:
        """Scrape a single football league (market typeId=1, 1x2)."""
        data = await self._fetch_league_data(league.champ_id)
        if not data:
            return []
        
        results = []
        odds_map = {o['id']: o for o in data.get('odds', [])}
        markets_map = {m['id']: m for m in data.get('markets', [])}
        events_list = data.get("events", [])
        
        for event in events_list:
            try:
                event_name = event.get("name", "")
                match_date = event.get("startDate")
                event_id = event.get("id")
                
                if not event_name or not match_date:
                    continue
                
                home_team, away_team = self._parse_teams(event_name)
                if not home_team or not away_team:
                    continue
                
                # Find 1x2 market (typeId=1)
                found_odds = {"home": None, "draw": None, "away": None}
                market_ids = event.get("marketIds", [])
                
                for mid in market_ids:
                    market = markets_map.get(mid)
                    if not market:
                        continue
                    
                    if market.get("typeId") == 1 or market.get("name") == "1x2":
                        for oid in market.get("oddIds", []):
                            odd = odds_map.get(oid)
                            if not odd:
                                continue
                            t_id = odd.get("typeId")
                            price = odd.get("price")
                            if t_id == 1:
                                found_odds["home"] = float(price)
                            elif t_id == 2:
                                found_odds["draw"] = float(price)
                            elif t_id == 3:
                                found_odds["away"] = float(price)
                        break
                
                if not all(found_odds.values()):
                    continue
                
                parsed_date = date_parser.parse(match_date)
                
                results.append(ScrapedOdds(
                    bookmaker_name="jogodeouro",
                    home_team_raw=home_team,
                    away_team_raw=away_team,
                    league_raw=league.name,
                    match_date=parsed_date,
                    home_odd=found_odds["home"],
                    draw_odd=found_odds["draw"],
                    away_odd=found_odds["away"],
                    market_type="1x2",
                    extra_data={
                        "jogodeouro_event_id": str(event_id),
                        "country": league.country.lower(),
                        "league_slug": league.league_slug
                    }
                ))
                
            except Exception as e:
                continue
        
        self.logger.info(f"[JogodeOuro] {league.name}: {len(results)} odds")
        return results
    
    async def _scrape_basketball_league(self, key: str, league: JogodeOuroLeagueConfig) -> List[ScrapedOdds]:
        """Scrape a single basketball league (market typeId=219, Moneyline)."""
        data = await self._fetch_league_data(league.champ_id)
        if not data:
            return []
        
        results = []
        odds_map = {o['id']: o for o in data.get('odds', [])}
        markets_map = {m['id']: m for m in data.get('markets', [])}
        events_list = data.get("events", [])
        
        for event in events_list:
            try:
                event_name = event.get("name", "")
                match_date = event.get("startDate")
                event_id = event.get("id")
                
                if not event_name or not match_date:
                    continue
                
                home_team, away_team = self._parse_teams(event_name)
                if not home_team or not away_team:
                    continue
                
                # Find Moneyline market (typeId=219)
                found_odds = {"home": None, "away": None}
                market_ids = event.get("marketIds", [])
                
                for mid in market_ids:
                    market = markets_map.get(mid)
                    if not market:
                        continue
                    
                    if market.get("typeId") == 219:
                        for oid in market.get("oddIds", []):
                            odd = odds_map.get(oid)
                            if not odd:
                                continue
                            t_id = odd.get("typeId")
                            price_raw = odd.get("price")
                            
                            if isinstance(price_raw, dict):
                                price_raw = price_raw.get("parsedValue", 0)
                            
                            if t_id == 1:
                                found_odds["home"] = float(price_raw)
                            elif t_id == 3:
                                found_odds["away"] = float(price_raw)
                        break
                
                if found_odds["home"] is None or found_odds["away"] is None:
                    continue
                
                parsed_date = date_parser.parse(match_date)
                
                results.append(ScrapedOdds(
                    bookmaker_name="jogodeouro",
                    home_team_raw=home_team,
                    away_team_raw=away_team,
                    league_raw="NBA",
                    match_date=parsed_date,
                    home_odd=found_odds["home"],
                    draw_odd=None,
                    away_odd=found_odds["away"],
                    sport="basketball",
                    market_type="moneyline",
                    extra_data={
                        "jogodeouro_event_id": str(event_id),
                        "country": "eua"
                    }
                ))
                
            except Exception as e:
                self.logger.debug(f"[JogodeOuro NBA] Error parsing event: {e}")
                continue
        
        self.logger.info(f"[JogodeOuro NBA] {league.name}: {len(results)} odds")
        return results
    
    # Legacy interface for compatibility
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """Scrape a single league (legacy interface)."""
        if league.league_id in self.FOOTBALL_LEAGUES:
            return await self._scrape_football_league(league.league_id, self.FOOTBALL_LEAGUES[league.league_id])
        elif league.league_id in self.BASKETBALL_LEAGUES:
            return await self._scrape_basketball_league(league.league_id, self.BASKETBALL_LEAGUES[league.league_id])
        return []


async def main():
    """Test the unified scraper."""
    scraper = JogodeOuroUnifiedScraper()
    odds = await scraper.scrape_all()
    print(f"\nTotal: {len(odds)} odds collected")
    for odd in odds[:5]:
        print(f"  [{odd.sport}] {odd.home_team_raw} vs {odd.away_team_raw}: {odd.home_odd}/{odd.draw_odd}/{odd.away_odd}")


if __name__ == "__main__":
    asyncio.run(main())

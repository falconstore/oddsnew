"""
Jogo de Ouro Unified Scraper - Football + NBA in a single session.
Hybrid approach: Playwright captures token, curl_cffi fetches data.

Based on McgamesUnifiedScraper pattern - both sites use the same Altenar backend.
The token is captured dynamically via Playwright to match the VPS IP.
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
class AltenarLeague:
    champ_id: str
    name: str
    country: str


class JogodeOuroUnifiedScraper(BaseScraper):
    """Unified scraper for Jogo de Ouro - Football + NBA using Altenar API."""
    
    FOOTBALL_LEAGUES = {
        "serie_a": AltenarLeague(champ_id="2942", name="Serie A", country="italia"),
        "premier_league": AltenarLeague(champ_id="2936", name="Premier League", country="inglaterra"),
        "la_liga": AltenarLeague(champ_id="2941", name="La Liga", country="espanha"),
        "bundesliga": AltenarLeague(champ_id="2950", name="Bundesliga", country="alemanha"),
        "ligue_1": AltenarLeague(champ_id="2943", name="Ligue 1", country="franca"),
        "paulistao": AltenarLeague(champ_id="3436", name="Paulistao", country="brasil"),
        "fa_cup": AltenarLeague(champ_id="2935", name="FA Cup", country="inglaterra"),
        "efl_cup": AltenarLeague(champ_id="2972", name="EFL Cup", country="inglaterra"),
        "champions_league": AltenarLeague(champ_id="16808", name="Champions League", country="europa"),
        "liga_europa": AltenarLeague(champ_id="16809", name="Liga Europa", country="europa"),
        "liga_da_conferencia": AltenarLeague(champ_id="31608", name="Liga da Conferencia", country="europa"),
        "copa_do_rei": AltenarLeague(champ_id="2973", name="Copa do Rei", country="espanha"),
        "eredivisie": AltenarLeague(champ_id="3065", name="Eredivisie", country="holanda"),
        "brasileirao_serie_a": AltenarLeague(champ_id="11318", name="Brasileirão Série A", country="brasil"),
        "libertadores": AltenarLeague(champ_id="3709", name="Libertadores", country="América do Sul"),
        "carioca": AltenarLeague(champ_id="3357", name="Carioca", country="brasil"),
        "liga_portuguesa": AltenarLeague(champ_id="3152", name="Liga Portuguesa", country="portugal"),
    }
    
    BASKETBALL_LEAGUES = {
        "nba": AltenarLeague(champ_id="2980", name="NBA", country="eua"),
    }
    
    API_BASE = "https://sb2frontend-altenar2.biahosted.com/api/widget/GetEvents"
    INTEGRATION = "jogodeouro"
    
    # Warm-up URLs for token capture (multiple paths to maximize chances)
    WARMUP_URLS = [
        "https://jogodeouro.bet.br/sports/futebol/italia/serie-a/c-2942",
        "https://jogodeouro.bet.br/sports/futebol/inglaterra/premier-league/c-2936",
        "https://jogodeouro.bet.br/sports/futebol",
        "https://jogodeouro.bet.br/sports",
    ]
    
    CHROME_ARGS = [
        '--no-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--single-process',
        '--disable-gpu',
        '--memory-pressure-off',
        '--disable-dev-shm-usage',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-translate',
        '--no-first-run',
        '--disable-default-apps',
    ]
    
    def __init__(self):
        super().__init__(
            name="jogodeouro",
            base_url="https://jogodeouro.bet.br"
        )
        self.session: Optional[AsyncSession] = None
        self.auth_token: Optional[str] = None
        self.user_agent: Optional[str] = None
        self._setup_attempted: bool = False
        self.logger = logger.bind(component="jogodeouro")
    
    def _init_session(self) -> None:
        """Initialize curl_cffi session."""
        if not self.session:
            self.session = AsyncSession(impersonate="chrome")
            self.logger.info("[JogodeOuro] Session initialized")
    
    async def setup(self) -> None:
        """Capture authorization token via Playwright with stealth + diagnostics."""
        
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
            self.user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
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
                viewport={'width': 1280, 'height': 720},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
                locale="pt-BR",
            )
            
            # Layer 3: Anti-detection stealth injection
            await context.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', { get: () => false });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US', 'en'] });
                window.chrome = { runtime: {} };
                // Remove automation indicators
                delete window.__playwright;
                delete window.__pw_manual;
            """)
            
            page = await context.new_page()
            token_future = asyncio.get_event_loop().create_future()
            
            # Layer 1: Diagnostic logging for ALL relevant requests
            async def handle_request(request):
                url = request.url
                # Log any Altenar/widget API request for diagnostics
                if any(x in url for x in ["biahosted.com", "altenar", "widget"]):
                    self.logger.info(f"[JogodeOuro] API request detected: {url[:120]}")
                    headers = request.headers
                    if "authorization" in headers:
                        token = headers["authorization"]
                        if not token_future.done():
                            token_future.set_result(token)
                            self.logger.info("[JogodeOuro] Token captured via request interception")
            
            page.on("request", handle_request)
            
            try:
                for i, target_url in enumerate(self.WARMUP_URLS):
                    if token_future.done():
                        self.logger.info(f"[JogodeOuro] Token captured on URL {i+1}/{len(self.WARMUP_URLS)}")
                        break
                    
                    self.logger.info(f"[JogodeOuro] Trying URL {i+1}/{len(self.WARMUP_URLS)}: {target_url}")
                    
                    try:
                        # Layer 2: Increased timeout, wait_until="load" instead of "domcontentloaded"
                        await page.goto(target_url, wait_until="load", timeout=30000)
                        await page.wait_for_timeout(3000)
                        
                        # Diagnostic: log page title to detect Cloudflare/blocks
                        title = await page.evaluate("document.title")
                        self.logger.info(f"[JogodeOuro] Page title: '{title}'")
                        
                        if not token_future.done():
                            # Layer 2: Double scroll pattern (500px + 1000px) to trigger widget
                            await page.evaluate("window.scrollTo(0, 500)")
                            await page.wait_for_timeout(2000)
                            await page.evaluate("window.scrollTo(0, 1000)")
                            await page.wait_for_timeout(2000)
                            
                            # Try clicking on a sport link if available
                            try:
                                await page.evaluate("window.scrollTo(0, 0)")
                                await page.wait_for_timeout(1000)
                            except Exception:
                                pass
                            
                    except Exception as url_error:
                        self.logger.warning(f"[JogodeOuro] URL {i+1} failed: {url_error}")
                        continue
                
                # Layer 2: Extended final wait (15s instead of 5s)
                if not token_future.done():
                    self.logger.info("[JogodeOuro] Waiting final 15s for token...")
                    try:
                        self.auth_token = await asyncio.wait_for(token_future, timeout=15.0)
                    except asyncio.TimeoutError:
                        # Diagnostic: log page HTML snippet to understand what loaded
                        try:
                            body_text = await page.evaluate("document.body?.innerText?.substring(0, 300) || 'empty'")
                            self.logger.error(f"[JogodeOuro] FAILED: Could not capture token. Page body preview: {body_text[:200]}")
                        except Exception:
                            self.logger.error("[JogodeOuro] FAILED: Could not capture token after all attempts")
                        self.auth_token = None
                else:
                    self.auth_token = token_future.result()
                
                if self.auth_token:
                    self.user_agent = await page.evaluate("navigator.userAgent")
                    self.logger.info(f"[JogodeOuro] Token capture successful! Token: {self.auth_token[:15]}...")
                
            except Exception as e:
                self.logger.error(f"[JogodeOuro] Playwright error: {type(e).__name__}: {e}")
            finally:
                await browser.close()
        
        # Initialize session after getting token
        if self.auth_token:
            self._init_session()
    
    async def teardown(self) -> None:
        """Close the session and reset state."""
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
        for key, league in self.FOOTBALL_LEAGUES.items():
            leagues.append(LeagueConfig(
                league_id=key, name=league.name,
                url=f"{self.API_BASE}?champIds={league.champ_id}",
                country=league.country
            ))
        for key, league in self.BASKETBALL_LEAGUES.items():
            leagues.append(LeagueConfig(
                league_id=key, name=league.name,
                url=f"{self.API_BASE}?champIds={league.champ_id}",
                country=league.country
            ))
        return leagues
    
    async def scrape_all(self) -> List[ScrapedOdds]:
        """Main entry point: scrape all football + NBA leagues in one cycle."""
        all_odds: List[ScrapedOdds] = []
        
        try:
            await self.setup()
            
            if not self.auth_token:
                self.logger.error("[JogodeOuro] No token available, skipping cycle")
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
    
    async def _fetch_league_data(self, champ_id: str) -> Optional[Dict[str, Any]]:
        """Fetch data from Altenar API for a given championship ID."""
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
        
        headers = {
            "accept": "*/*",
            "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
            "authorization": self.auth_token,
            "origin": "https://jogodeouro.bet.br",
            "referer": "https://jogodeouro.bet.br/",
            "user-agent": self.user_agent or "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
        }
        
        response = await self.session.get(
            self.API_BASE,
            params=params,
            headers=headers,
            timeout=30
        )
        
        # Handle token expiration
        if response.status_code in (400, 401, 403):
            self.logger.warning(f"[JogodeOuro] Token issue (HTTP {response.status_code})")
            self.auth_token = None
            self._setup_attempted = False
            return None
        
        if response.status_code != 200:
            self.logger.error(f"[JogodeOuro] HTTP {response.status_code}")
            return None
        
        return response.json()
    
    def _build_lookup_maps(self, data: Dict[str, Any]) -> tuple:
        """Build lookup maps from API response."""
        events_list = data.get("events", [])
        markets_list = data.get("markets", [])
        odds_list = data.get("odds", [])
        competitors_list = data.get("competitors", [])
        
        events_map = {e["id"]: e for e in events_list}
        competitors_map = {c["id"]: c["name"] for c in competitors_list}
        odds_map = {o["id"]: o for o in odds_list}
        
        market_to_event = {}
        for event in events_list:
            for mid in event.get("marketIds", []):
                market_to_event[mid] = event["id"]
        
        return events_list, markets_list, events_map, competitors_map, odds_map, market_to_event
    
    def _parse_teams(self, event: Dict, competitors_map: Dict) -> tuple:
        """Extract home and away team names from event."""
        event_name = event.get("name", "")
        competitor_ids = event.get("competitorIds", [])
        
        home_team = ""
        away_team = ""
        
        if len(competitor_ids) >= 2:
            home_team = competitors_map.get(competitor_ids[0], "")
            away_team = competitors_map.get(competitor_ids[1], "")
        
        if not home_team or not away_team:
            if " vs. " in event_name:
                parts = event_name.split(" vs. ")
                home_team = parts[0].strip()
                away_team = parts[1].strip() if len(parts) > 1 else ""
            elif " vs " in event_name:
                parts = event_name.split(" vs ")
                home_team = parts[0].strip()
                away_team = parts[1].strip() if len(parts) > 1 else ""
        
        return home_team, away_team
    
    async def _scrape_football_league(self, key: str, league: AltenarLeague) -> List[ScrapedOdds]:
        """Scrape a single football league (market typeId=1, 1x2)."""
        data = await self._fetch_league_data(league.champ_id)
        if not data:
            return []
        
        events_list, markets_list, events_map, competitors_map, odds_map, market_to_event = \
            self._build_lookup_maps(data)
        
        if not events_list:
            self.logger.warning(f"[JogodeOuro] {league.name}: No events found")
            return []
        
        results = []
        
        for market in markets_list:
            try:
                if market.get("typeId") != 1:  # 1x2 market
                    continue
                
                market_id = market.get("id")
                event_id = market_to_event.get(market_id)
                if not event_id:
                    continue
                
                event = events_map.get(event_id, {})
                match_date = event.get("startDate")
                
                home_team, away_team = self._parse_teams(event, competitors_map)
                if not home_team or not away_team:
                    continue
                
                # Get odds (typeId: 1=Home, 2=Draw, 3=Away)
                odd_ids = market.get("oddIds", [])
                found_odds = {"home": None, "draw": None, "away": None}
                
                for odd_id in odd_ids:
                    odd = odds_map.get(odd_id, {})
                    type_id = odd.get("typeId")
                    price = odd.get("price")
                    if price is None:
                        continue
                    if type_id == 1:
                        found_odds["home"] = float(price)
                    elif type_id == 2:
                        found_odds["draw"] = float(price)
                    elif type_id == 3:
                        found_odds["away"] = float(price)
                
                if not all(found_odds.values()):
                    continue
                
                parsed_date = date_parser.parse(match_date) if match_date else datetime.utcnow()
                
                results.append(ScrapedOdds(
                    bookmaker_name="jogodeouro",
                    home_team_raw=home_team,
                    away_team_raw=away_team,
                    league_raw=league.name,
                    match_date=parsed_date,
                    home_odd=found_odds["home"],
                    draw_odd=found_odds["draw"],
                    away_odd=found_odds["away"],
                    sport="football",
                    market_type="1x2",
                    extra_data={
                        "event_id": str(event_id),
                        "country": league.country.lower()
                    }
                ))
                
            except Exception as e:
                self.logger.debug(f"[JogodeOuro] Error parsing football market: {e}")
                continue
        
        self.logger.info(f"[JogodeOuro] {league.name}: {len(results)} odds")
        return results
    
    async def _scrape_basketball_league(self, key: str, league: AltenarLeague) -> List[ScrapedOdds]:
        """Scrape a single basketball league (market typeId=219, Moneyline)."""
        data = await self._fetch_league_data(league.champ_id)
        if not data:
            return []
        
        events_list, markets_list, events_map, competitors_map, odds_map, market_to_event = \
            self._build_lookup_maps(data)
        
        if not events_list:
            return []
        
        results = []
        
        for market in markets_list:
            try:
                if market.get("typeId") != 219:  # Moneyline market
                    continue
                
                market_id = market.get("id")
                event_id = market_to_event.get(market_id)
                if not event_id:
                    continue
                
                event = events_map.get(event_id, {})
                match_date = event.get("startDate")
                
                home_team, away_team = self._parse_teams(event, competitors_map)
                if not home_team or not away_team:
                    continue
                
                # Get odds (typeId: 1=Home, 3=Away, no draw)
                odd_ids = market.get("oddIds", [])
                found_odds = {"home": None, "away": None}
                
                for odd_id in odd_ids:
                    odd = odds_map.get(odd_id, {})
                    type_id = odd.get("typeId")
                    price_raw = odd.get("price")
                    if price_raw is None:
                        continue
                    
                    if isinstance(price_raw, dict):
                        price = float(price_raw.get("parsedValue", 0))
                    else:
                        price = float(price_raw)
                    
                    if type_id == 1:
                        found_odds["home"] = price
                    elif type_id == 3:
                        found_odds["away"] = price
                
                if found_odds["home"] is None or found_odds["away"] is None:
                    continue
                
                parsed_date = date_parser.parse(match_date) if match_date else datetime.utcnow()
                
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
                    odds_type="PA",
                    extra_data={
                        "event_id": str(event_id),
                        "country": "eua",
                        "sport_type": "basketball"
                    }
                ))
                
            except Exception as e:
                self.logger.debug(f"[JogodeOuro] Error parsing NBA market: {e}")
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

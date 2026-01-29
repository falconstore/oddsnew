"""
Mcgames Scraper - Uses Altenar API (same as Br4bet).
Hybrid approach: Playwright captures token, curl_cffi fetches data.
Robust pattern: env var override, multiple warm-up URLs, progressive scroll.
"""

import asyncio
import os
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

from curl_cffi.requests import AsyncSession
from playwright.async_api import async_playwright
from loguru import logger

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


@dataclass
class McgamesLeague:
    champ_id: str
    name: str
    country: str


class McgamesScraper(BaseScraper):
    """Scraper for Mcgames using Altenar API."""
    
    LEAGUES = {
        "serie_a": McgamesLeague(champ_id="2942", name="Serie A", country="italia"),
        "premier_league": McgamesLeague(champ_id="2936", name="Premier League", country="inglaterra"),
        "la_liga": McgamesLeague(champ_id="2941", name="La Liga", country="espanha"),
        "bundesliga": McgamesLeague(champ_id="2950", name="Bundesliga", country="alemanha"),
        "ligue_1": McgamesLeague(champ_id="2943", name="Ligue 1", country="franca"),
        "paulistao": McgamesLeague(champ_id="3436", name="Paulistao A1", country="brasil"),
        "fa_cup": McgamesLeague(champ_id="2935", name="FA Cup", country="inglaterra"),
        "efl_cup": McgamesLeague(champ_id="2972", name="EFL Cup", country="inglaterra"),
        "champions_league": McgamesLeague(champ_id="16808", name="Champions League", country="europa"),
        "liga_europa": McgamesLeague(champ_id="16809", name="Liga Europa", country="europa"),
        "liga_da_conferencia": McgamesLeague(champ_id="31608", name="Liga da Conferencia", country="europa"),
        "copa_do_rei": McgamesLeague(champ_id="2973", name="Copa do Rei", country="espanha"),
        "eredivisie": McgamesLeague(champ_id="3065", name="Eredivisie", country="holanda"),
        "brasileirao_serie_a": McgamesLeague(champ_id="11318", name="Brasileirão Série A", country="brasil"),
    }
    
    API_BASE = "https://sb2frontend-altenar2.biahosted.com/api/widget/GetEvents"
    
    # Reduced warm-up URLs for faster token capture
    WARMUP_URLS = [
        "https://mcgames.bet.br/sports/futebol/italia/serie-a/c-2942",
        "https://mcgames.bet.br/sports/futebol",
    ]
    
    def __init__(self):
        super().__init__(
            name="mcgames",
            base_url="https://mcgames.bet.br"
        )
        self.session: Optional[AsyncSession] = None
        self.auth_token: Optional[str] = None
        self.user_agent: Optional[str] = None
        self._setup_attempted: bool = False
        self.logger = logger.bind(component="mcgames")
    
    def _init_session(self) -> None:
        """Initialize curl_cffi session."""
        if not self.session:
            self.session = AsyncSession(impersonate="chrome")
            self.logger.info("[Mcgames] Session initialized")
    
    async def setup(self) -> None:
        """Capture authorization token via Playwright with robust fallbacks."""
        
        # Reuse existing token if available
        if self.auth_token and self.user_agent:
            if not self.session:
                self._init_session()
            self.logger.info("[Mcgames] Reusing existing token")
            return
        
        # Check for manual token override via env var
        manual_token = os.environ.get("MCGAMES_AUTH_TOKEN")
        if manual_token:
            self.logger.info("[Mcgames] Using manual token from MCGAMES_AUTH_TOKEN env var")
            self.auth_token = manual_token
            self.user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
            self._init_session()
            return
        
        # Prevent infinite setup loops
        if self._setup_attempted:
            self.logger.warning("[Mcgames] Setup already attempted this cycle, skipping")
            return
        
        self._setup_attempted = True
        self.logger.info("[Mcgames] Starting Playwright to capture credentials...")
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=['--no-sandbox', '--disable-blink-features=AutomationControlled']
            )
            
            context = await browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
            )
            
            page = await context.new_page()
            token_future = asyncio.get_event_loop().create_future()
            
            async def handle_request(request):
                if "biahosted.com/api" in request.url:
                    headers = request.headers
                    if "authorization" in headers:
                        token = headers["authorization"]
                        if not token_future.done():
                            token_future.set_result(token)
                            self.logger.info("[Mcgames] Token captured via request interception")
            
            page.on("request", handle_request)
            
            try:
                # Try warm-up URLs with reduced timeouts
                for i, target_url in enumerate(self.WARMUP_URLS):
                    if token_future.done():
                        self.logger.info(f"[Mcgames] Token captured on URL {i+1}/{len(self.WARMUP_URLS)}")
                        break
                    
                    self.logger.info(f"[Mcgames] Trying URL {i+1}/{len(self.WARMUP_URLS)}: {target_url}")
                    
                    try:
                        await page.goto(target_url, wait_until="domcontentloaded", timeout=15000)
                        await page.wait_for_timeout(2000)
                        
                        # Single scroll to trigger API calls
                        if not token_future.done():
                            await page.evaluate("window.scrollTo(0, 1000)")
                            await page.wait_for_timeout(1500)
                            
                    except Exception as url_error:
                        self.logger.warning(f"[Mcgames] URL {i+1} failed: {url_error}")
                        continue
                
                # Final wait for token if still not captured
                if not token_future.done():
                    self.logger.info("[Mcgames] Waiting final 5s for token...")
                    try:
                        self.auth_token = await asyncio.wait_for(token_future, timeout=5.0)
                    except asyncio.TimeoutError:
                        self.logger.error("[Mcgames] FAILED: Could not capture token after all attempts")
                        self.auth_token = None
                else:
                    self.auth_token = token_future.result()
                
                if self.auth_token:
                    self.user_agent = await page.evaluate("navigator.userAgent")
                    self.logger.info("[Mcgames] Token capture successful!")
                
            except Exception as e:
                self.logger.error(f"[Mcgames] Playwright error: {type(e).__name__}: {e}")
            finally:
                await browser.close()
        
        # Initialize session after getting token
        if self.auth_token:
            self._init_session()
    
    async def teardown(self) -> None:
        """Close the session."""
        if self.session:
            await self.session.close()
            self.session = None
        self._setup_attempted = False  # Reset for next cycle
        self.logger.info("[Mcgames] Session closed")
    
    async def get_available_leagues(self) -> List[LeagueConfig]:
        """Return list of supported leagues."""
        return [
            LeagueConfig(
                league_id=key,
                name=league.name,
                url=f"{self.API_BASE}?champIds={league.champ_id}",
                country=league.country
            )
            for key, league in self.LEAGUES.items()
        ]
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """Scrape odds for a specific league."""
        # Capture token if not available
        if not self.auth_token:
            await self.setup()
        
        if not self.auth_token:
            self.logger.error(f"[Mcgames] No token available for {league.name}")
            return []
        
        if league.league_id not in self.LEAGUES:
            self.logger.warning(f"[Mcgames] Unknown league {league.league_id}")
            return []
        
        mcgames_league = self.LEAGUES[league.league_id]
        
        try:
            # Build API URL
            params = {
                "culture": "pt-BR",
                "timezoneOffset": "180",
                "integration": "mcgames2",
                "deviceType": "1",
                "numFormat": "en-GB",
                "countryCode": "BR",
                "eventCount": "0",
                "sportId": "0",
                "champIds": mcgames_league.champ_id
            }
            
            headers = {
                "accept": "*/*",
                "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
                "authorization": self.auth_token,
                "origin": "https://mcgames.bet.br",
                "referer": "https://mcgames.bet.br/",
                "user-agent": self.user_agent or "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
            }
            
            response = await self.session.get(
                self.API_BASE,
                params=params,
                headers=headers,
                timeout=30
            )
            
            # Handle token expiration or bad request (includes 400)
            if response.status_code in (400, 401, 403):
                self.logger.warning(f"[Mcgames] Token issue (HTTP {response.status_code}), will recapture next cycle")
                self.auth_token = None
                self._setup_attempted = False  # Allow recapture next cycle
                return []
            
            if response.status_code != 200:
                self.logger.error(f"[Mcgames] {league.name}: HTTP {response.status_code}")
                return []
            
            data = response.json()
            return self._parse_response(data, mcgames_league)
            
        except Exception as e:
            self.logger.error(f"[Mcgames] {league.name}: {type(e).__name__}: {e}")
            return []
    
    def _parse_response(self, data: Dict[str, Any], league: McgamesLeague) -> List[ScrapedOdds]:
        """Parse Altenar API response."""
        results = []
        
        # Get all data structures
        events_list = data.get("events", [])
        markets_list = data.get("markets", [])
        odds_list = data.get("odds", [])
        competitors_list = data.get("competitors", [])
        
        self.logger.info(f"[Mcgames] {league.name}: {len(events_list)} events, {len(markets_list)} markets, {len(odds_list)} odds")
        
        if not events_list:
            self.logger.warning(f"[Mcgames] {league.name}: No events found")
            return []
        
        # Build lookup maps
        events_map = {e["id"]: e for e in events_list}
        competitors_map = {c["id"]: c["name"] for c in competitors_list}
        odds_map = {o["id"]: o for o in odds_list}
        
        # market_id -> event_id
        market_to_event = {}
        for event in events_list:
            for mid in event.get("marketIds", []):
                market_to_event[mid] = event["id"]
        
        # Process only 1x2 markets (typeId: 1)
        for market in markets_list:
            try:
                if market.get("typeId") != 1:
                    continue
                
                market_id = market.get("id")
                event_id = market_to_event.get(market_id)
                
                if not event_id:
                    continue
                
                event = events_map.get(event_id, {})
                event_name = event.get("name", "")
                match_date = event.get("startDate")
                competitor_ids = event.get("competitorIds", [])
                
                if not event_name or len(competitor_ids) < 2:
                    continue
                
                # Get team names from competitors
                home_team = competitors_map.get(competitor_ids[0], "")
                away_team = competitors_map.get(competitor_ids[1], "")
                
                if not home_team or not away_team:
                    # Fallback: parse from event name
                    if " vs. " in event_name:
                        parts = event_name.split(" vs. ")
                        home_team = parts[0].strip()
                        away_team = parts[1].strip() if len(parts) > 1 else ""
                    elif " vs " in event_name:
                        parts = event_name.split(" vs ")
                        home_team = parts[0].strip()
                        away_team = parts[1].strip() if len(parts) > 1 else ""
                
                if not home_team or not away_team:
                    continue
                
                # Get odds from oddIds
                odd_ids = market.get("oddIds", [])
                found_odds = {"home": None, "draw": None, "away": None}
                
                for odd_id in odd_ids:
                    odd = odds_map.get(odd_id, {})
                    type_id = odd.get("typeId")
                    price = odd.get("price")
                    
                    if price is None:
                        continue
                    
                    # typeId: 1=Home, 2=Draw, 3=Away
                    if type_id == 1:
                        found_odds["home"] = float(price)
                    elif type_id == 2:
                        found_odds["draw"] = float(price)
                    elif type_id == 3:
                        found_odds["away"] = float(price)
                
                # Skip if missing any odds
                if not all(found_odds.values()):
                    continue
                
                # Parse match_date to datetime
                from dateutil import parser as date_parser
                from datetime import datetime
                parsed_date = date_parser.parse(match_date) if match_date else datetime.utcnow()
                
                scraped = ScrapedOdds(
                    bookmaker_name="mcgames",
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
                )
                results.append(scraped)
                
            except Exception as e:
                self.logger.debug(f"[Mcgames] Error parsing market: {e}")
                continue
        
        self.logger.info(f"[Mcgames] {league.name}: {len(results)} odds processed")
        return results


async def main():
    """Test the scraper."""
    import logging
    logging.basicConfig(level=logging.INFO)
    
    scraper = McgamesScraper()
    await scraper.setup()
    
    try:
        leagues = await scraper.get_available_leagues()
        for league in leagues:
            print(f"\n--- {league.name} ---")
            odds = await scraper.scrape_league(league)
            for odd in odds[:3]:
                print(f"  {odd.home_team_raw} vs {odd.away_team_raw}: {odd.home_odd}/{odd.draw_odd}/{odd.away_odd}")
                print(f"    event_id: {odd.extra_data.get('event_id')}, country: {odd.extra_data.get('country')}")
    finally:
        await scraper.teardown()


if __name__ == "__main__":
    asyncio.run(main())

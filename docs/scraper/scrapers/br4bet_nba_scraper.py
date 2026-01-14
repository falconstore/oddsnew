"""
Br4bet NBA Scraper - Uses Altenar API.
Hybrid approach: Playwright captures token, curl_cffi fetches data.
"""

import asyncio
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from loguru import logger
from playwright.async_api import async_playwright
from curl_cffi.requests import AsyncSession
from dateutil import parser as date_parser

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


class Br4betNBAScraper(BaseScraper):
    """Scraper Híbrido para Br4bet NBA (Altenar)."""
    
    LEAGUES = {
        "nba": {
            "champ_id": "2980",
            "name": "NBA",
            "country": "eua"
        },
    }
    
    API_URL = "https://sb2frontend-altenar2.biahosted.com/api/widget/GetEvents"
    
    WARMUP_URLS = [
        "https://br4.bet.br/sports/basquete/eua/nba",
        "https://br4.bet.br/sports/basquete",
    ]
    
    def __init__(self):
        super().__init__(name="br4bet_nba", base_url="https://br4.bet.br")
        self.api_token: Optional[str] = None
        self.user_agent: Optional[str] = None
        self._setup_attempted: bool = False
        self.session: Optional[AsyncSession] = None
        self.logger = logger.bind(component="br4bet_nba")
    
    def _init_session(self) -> None:
        if not self.session:
            self.session = AsyncSession(impersonate="chrome124")
            self.logger.info("[Br4bet NBA] Session initialized")
    
    async def setup(self) -> None:
        # Reuse existing token
        if self.api_token and self.user_agent:
            if not self.session:
                self._init_session()
            self.logger.info("[Br4bet NBA] Reusing existing token")
            return
        
        # Check for manual token override
        manual_token = os.environ.get("BR4BET_AUTH_TOKEN")
        if manual_token:
            self.logger.info("[Br4bet NBA] Using manual token from env var")
            self.api_token = manual_token
            self.user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            self._init_session()
            return
        
        if self._setup_attempted:
            self.logger.warning("[Br4bet NBA] Setup already attempted, skipping")
            return
        
        self._setup_attempted = True
        self.logger.info("[Br4bet NBA] Starting Playwright to capture credentials...")
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=['--no-sandbox', '--disable-blink-features=AutomationControlled']
            )
            
            context = await browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            )
            
            page = await context.new_page()
            token_future = asyncio.Future()
            
            async def handle_request(request):
                if "biahosted.com/api" in request.url:
                    headers = request.headers
                    if "authorization" in headers:
                        token = headers["authorization"]
                        if not token_future.done():
                            token_future.set_result(token)
                            self.logger.info("[Br4bet NBA] Token captured")
            
            page.on("request", handle_request)
            
            try:
                for i, target_url in enumerate(self.WARMUP_URLS):
                    if token_future.done():
                        break
                    
                    self.logger.info(f"[Br4bet NBA] Trying URL {i+1}/{len(self.WARMUP_URLS)}: {target_url}")
                    
                    try:
                        await page.goto(target_url, wait_until="domcontentloaded", timeout=15000)
                        await page.wait_for_timeout(2000)
                        
                        if not token_future.done():
                            await page.evaluate("window.scrollTo(0, 1000)")
                            await page.wait_for_timeout(1500)
                            
                    except Exception as url_error:
                        self.logger.warning(f"[Br4bet NBA] URL {i+1} failed: {url_error}")
                        continue
                
                if not token_future.done():
                    self.logger.info("[Br4bet NBA] Waiting final 5s for token...")
                    try:
                        self.api_token = await asyncio.wait_for(token_future, timeout=5.0)
                    except asyncio.TimeoutError:
                        self.logger.error("[Br4bet NBA] FAILED: Could not capture token")
                        self.api_token = None
                else:
                    self.api_token = token_future.result()
                
                if self.api_token:
                    self.user_agent = await page.evaluate("navigator.userAgent")
                    self.logger.info("[Br4bet NBA] Token capture successful!")
                
            except Exception as e:
                self.logger.error(f"[Br4bet NBA] Playwright error: {type(e).__name__}: {e}")
            finally:
                await browser.close()
        
        if self.api_token:
            self._init_session()
    
    async def teardown(self) -> None:
        if self.session:
            await self.session.close()
            self.session = None
        self._setup_attempted = False
        self.logger.info("[Br4bet NBA] Session closed")

    async def get_available_leagues(self) -> List[LeagueConfig]:
        return [
            LeagueConfig(league_id=v["champ_id"], name=v["name"], url="", country=v["country"])
            for v in self.LEAGUES.values()
        ]

    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        if not self.api_token:
            await self.setup()
        
        if not self.api_token:
            self.logger.error(f"[Br4bet NBA] No token available for {league.name}")
            return []
        
        if not self.session:
            self._init_session()

        headers = {
            "accept": "*/*",
            "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
            "authorization": self.api_token,
            "origin": "https://br4.bet.br",
            "referer": "https://br4.bet.br/",
            "user-agent": self.user_agent or "Mozilla/5.0"
        }

        # Find champ_id
        champ_id = None
        for k, v in self.LEAGUES.items():
            if v["name"] == league.name or v["champ_id"] == league.league_id:
                champ_id = v["champ_id"]
                break
        
        if not champ_id:
            champ_id = "2980"  # Default to NBA

        params = {
            "culture": "pt-BR",
            "timezoneOffset": "-180",
            "integration": "br4bet",
            "deviceType": "1",
            "numFormat": "en-GB",
            "countryCode": "BR",
            "eventCount": "0",
            "sportId": "0",
            "champIds": champ_id,
            "categoryIds": "0"
        }

        try:
            response = await self.session.get(
                self.API_URL,
                params=params,
                headers=headers,
                timeout=30
            )
            
            if response.status_code in (400, 401, 403):
                self.logger.warning(f"[Br4bet NBA] Token issue (HTTP {response.status_code}), will recapture next cycle")
                self.api_token = None
                self._setup_attempted = False
                return []
            
            if response.status_code != 200:
                self.logger.error(f"[Br4bet NBA] {league.name}: HTTP {response.status_code}")
                return []
            
            data = response.json()
            return self._parse_response(data, league)

        except Exception as e:
            self.logger.error(f"[Br4bet NBA] {league.name}: {type(e).__name__}: {e}")
            return []

    def _parse_response(self, data: Dict[str, Any], league: LeagueConfig) -> List[ScrapedOdds]:
        """Parse Altenar API response for NBA Moneyline."""
        results = []
        
        events_list = data.get("events", [])
        markets_list = data.get("markets", [])
        odds_list = data.get("odds", [])
        competitors_list = data.get("competitors", [])
        
        self.logger.info(f"[Br4bet NBA] {league.name}: {len(events_list)} events, {len(markets_list)} markets")
        
        if not events_list:
            return []
        
        # Build lookup maps
        events_map = {e["id"]: e for e in events_list}
        competitors_map = {c["id"]: c["name"] for c in competitors_list}
        odds_map = {o["id"]: o for o in odds_list}
        
        market_to_event = {}
        for event in events_list:
            for mid in event.get("marketIds", []):
                market_to_event[mid] = event["id"]
        
        # Process Moneyline markets (typeId: 219)
        for market in markets_list:
            try:
                if market.get("typeId") != 219:  # Moneyline for basketball
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
                
                # Get team names
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
                
                if not home_team or not away_team:
                    continue
                
                # Get odds
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
                    
                    if type_id == 1:  # Home
                        found_odds["home"] = price
                    elif type_id == 3:  # Away
                        found_odds["away"] = price
                
                # Need both home and away (no draw in basketball)
                if found_odds["home"] is None or found_odds["away"] is None:
                    continue
                
                parsed_date = date_parser.parse(match_date) if match_date else datetime.utcnow()
                
                scraped = ScrapedOdds(
                    bookmaker_name="br4bet",
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
                        "br4bet_event_id": str(event_id),
                        "br4bet_country": "eua",
                        "sport_type": "basketball"
                    }
                )
                results.append(scraped)
                
            except Exception as e:
                self.logger.debug(f"[Br4bet NBA] Error parsing market: {e}")
                continue
        
        self.logger.info(f"[Br4bet NBA] {league.name}: {len(results)} odds processed")
        return results


async def main():
    scraper = Br4betNBAScraper()
    await scraper.setup()
    
    try:
        leagues = await scraper.get_available_leagues()
        for league in leagues:
            print(f"\n--- {league.name} ---")
            odds = await scraper.scrape_league(league)
            for odd in odds[:5]:
                print(f"  {odd.home_team_raw} vs {odd.away_team_raw}: {odd.home_odd}/{odd.away_odd}")
    finally:
        await scraper.teardown()


if __name__ == "__main__":
    asyncio.run(main())

"""
Aposta1 NBA Scraper - Uses Altenar API with GetEventDetails.
Hybrid approach: Playwright captures token, curl_cffi fetches data.
"""

import asyncio
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from datetime import datetime

from curl_cffi.requests import AsyncSession
from playwright.async_api import async_playwright
from loguru import logger
from dateutil import parser as date_parser

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


@dataclass
class Aposta1NBALeague:
    champ_id: str
    category_id: str
    name: str
    country: str


class Aposta1NBAScraper(BaseScraper):
    """Scraper for Aposta1 NBA using Altenar API."""
    
    LEAGUES = {
        "nba": Aposta1NBALeague(champ_id="2980", category_id="503", name="NBA", country="eua"),
    }
    
    EVENTS_API = "https://sb2frontend-altenar2.biahosted.com/api/widget/GetEvents"
    
    def __init__(self):
        super().__init__(name="aposta1_nba", base_url="https://www.aposta1.bet.br")
        self.session: Optional[AsyncSession] = None
        self.auth_token: Optional[str] = None
        self.user_agent: Optional[str] = None
        self.logger = logger.bind(component="aposta1_nba")
    
    async def setup(self) -> None:
        self.logger.info("[Aposta1 NBA] Iniciando captura de token")
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    '--no-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-extensions',
                    '--disable-background-networking',
                    '--disable-sync',
                    '--disable-translate',
                    '--no-first-run',
                    '--disable-default-apps',
                    '--single-process',
                    '--memory-pressure-off',
                ]
            )
            
            ua_string = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            context = await browser.new_context(user_agent=ua_string)
            page = await context.new_page()
            
            token_future = asyncio.get_event_loop().create_future()
            
            async def handle_request(request):
                if "biahosted.com/api" in request.url:
                    headers = request.headers
                    if "authorization" in headers:
                        token = headers["authorization"]
                        if token and len(token) > 20 and not token_future.done():
                            token_future.set_result(token)
            
            page.on("request", handle_request)
            
            try:
                # Try basketball page first
                target_urls = [
                    "https://www.aposta1.bet.br/sports/basquete/eua/nba",
                    "https://www.aposta1.bet.br/esportes",
                ]
                
                for target_url in target_urls:
                    if token_future.done():
                        break
                    
                    self.logger.info(f"[Aposta1 NBA] Navegando para {target_url}")
                    try:
                        await page.goto(target_url, wait_until="domcontentloaded", timeout=30000)
                        await page.wait_for_timeout(3000)
                        
                        if not token_future.done():
                            await page.evaluate("window.scrollTo(0, 500)")
                            await page.wait_for_timeout(2000)
                    except Exception as e:
                        self.logger.warning(f"[Aposta1 NBA] Navegacao falhou: {e}")
                        continue
                
                if not token_future.done():
                    self.auth_token = await asyncio.wait_for(token_future, timeout=10.0)
                else:
                    self.auth_token = token_future.result()
                    
                self.user_agent = await page.evaluate("navigator.userAgent")
                self.logger.info("[Aposta1 NBA] Token capturado com sucesso")
                
            except asyncio.TimeoutError:
                self.logger.error("[Aposta1 NBA] Timeout ao capturar token")
            except Exception as e:
                self.logger.error(f"[Aposta1 NBA] Erro Playwright: {e}")
            finally:
                await browser.close()
        
        if self.auth_token and self.user_agent:
            self.session = AsyncSession(impersonate="chrome120")
            self.session.headers = {
                "Accept": "*/*",
                "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
                "Authorization": self.auth_token,
                "Origin": "https://www.aposta1.bet.br",
                "Referer": "https://www.aposta1.bet.br/",
                "User-Agent": self.user_agent
            }

    async def teardown(self) -> None:
        if self.session:
            await self.session.close()
            self.session = None

    async def get_available_leagues(self) -> List[LeagueConfig]:
        leagues = []
        for key, val in self.LEAGUES.items():
            full_url = f"https://www.aposta1.bet.br/sports/basquete/eua/nba"
            leagues.append(LeagueConfig(league_id=key, name=val.name, url=full_url, country=val.country))
        return leagues

    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        if not self.auth_token:
            await self.setup()
        
        if not self.session:
            return []

        target_champ_id = None
        if hasattr(league, 'league_id') and league.league_id in self.LEAGUES:
            target_champ_id = self.LEAGUES[league.league_id].champ_id
        
        if not target_champ_id:
            target_champ_id = "2980"  # Default to NBA

        try:
            params = {
                "culture": "pt-BR",
                "timezoneOffset": "180",
                "integration": "aposta1",
                "deviceType": "1",
                "numFormat": "en-GB",
                "countryCode": "BR",
                "eventCount": "0",
                "sportId": "0",
                "champIds": target_champ_id
            }
            
            response = await self.session.get(self.EVENTS_API, params=params, timeout=20)
            
            if response.status_code == 200:
                data = response.json()
                return self._parse_response(data, league)
            
            if response.status_code in [401, 403]:
                self.auth_token = None
            
            self.logger.error(f"[Aposta1 NBA] {league.name}: HTTP {response.status_code}")
            return []
            
        except Exception as e:
            self.logger.error(f"[Aposta1 NBA] {league.name}: Erro - {e}")
            return []

    def _parse_response(self, data: Dict[str, Any], league: LeagueConfig) -> List[ScrapedOdds]:
        """Parse Altenar API response for NBA Moneyline."""
        results = []
        
        events_list = data.get("events", [])
        markets_list = data.get("markets", [])
        odds_list = data.get("odds", [])
        competitors_list = data.get("competitors", [])
        
        self.logger.info(f"[Aposta1 NBA] {league.name}: {len(events_list)} events, {len(markets_list)} markets")
        
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
                
                # Need both home and away
                if found_odds["home"] is None or found_odds["away"] is None:
                    continue
                
                parsed_date = date_parser.parse(match_date) if match_date else datetime.utcnow()
                
                scraped = ScrapedOdds(
                    bookmaker_name="aposta1",
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
                        "aposta1_event_id": str(event_id),
                        "country": "eua",
                        "sport_type": "basketball"
                    }
                )
                results.append(scraped)
                
            except Exception as e:
                self.logger.debug(f"[Aposta1 NBA] Error parsing market: {e}")
                continue
        
        self.logger.info(f"[Aposta1 NBA] {league.name}: {len(results)} odds processed")
        return results


async def main():
    scraper = Aposta1NBAScraper()
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

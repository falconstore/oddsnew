import asyncio
from typing import Dict, Any, List, Optional

from curl_cffi.requests import AsyncSession
from playwright.async_api import async_playwright

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


class Aposta1Scraper(BaseScraper):
    """
    Scraper Híbrido para Aposta1 (Altenar).
    """
    
    LEAGUES = {
        "serie_a": {
            "champ_id": "2942",
            "name": "Serie A",
            "country": "italia"
        },
        "premier_league": {
            "champ_id": "2936",
            "name": "Premier League", 
            "country": "inglaterra"
        },
        "la_liga": {
            "champ_id": "2941",
            "name": "La Liga",
            "country": "espanha"
        },
        "bundesliga": {
            "champ_id": "2943",
            "name": "Bundesliga",
            "country": "alemanha"
        },
        "ligue_1": {
            "champ_id": "2944",
            "name": "Ligue 1",
            "country": "franca"
        },
    }
    
    API_URL = "https://sb2frontend-altenar2.biahosted.com/api/widget/GetEvents"
    
    def __init__(self):
        super().__init__(name="aposta1", base_url="https://www.aposta1.bet.br")
        self.api_token: Optional[str] = None
        self.user_agent: Optional[str] = None
    
    async def setup(self) -> None:
        self.logger.info("🔑 Aposta1: Iniciando captura de token...")
        
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
                            self.logger.info(f"🔑 Token capturado via request")
            
            page.on("request", handle_request)
            
            try:
                target_url = "https://www.aposta1.bet.br/sports/futebol/italia/serie-a"
                self.logger.info(f"🌍 Aposta1: Navegando para {target_url}...")
                
                await page.goto(target_url, wait_until="domcontentloaded", timeout=60000)
                
                try:
                    self.api_token = await asyncio.wait_for(token_future, timeout=15.0)
                except asyncio.TimeoutError:
                    self.logger.warning("Token demorou. Scrollando...")
                    await page.evaluate("window.scrollTo(0, 500)")
                    self.api_token = await asyncio.wait_for(token_future, timeout=15.0)
                
                self.user_agent = await page.evaluate("navigator.userAgent")
                self.logger.info(f"✅ Aposta1: Token capturado! UA: {self.user_agent[:30]}...")
                
            except asyncio.TimeoutError:
                self.logger.error("❌ Aposta1: Timeout capturando token.")
            except Exception as e:
                self.logger.error(f"❌ Aposta1: Erro Playwright: {e}")
            finally:
                await browser.close()

    async def teardown(self) -> None:
        pass

    async def get_available_leagues(self) -> List[LeagueConfig]:
        return [
            LeagueConfig(league_id=v["champ_id"], name=v["name"], url="", country=v["country"])
            for v in self.LEAGUES.values()
        ]

    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        if not self.api_token:
            await self.setup()
        
        if not self.api_token:
            return []

        headers = {
            "accept": "*/*",
            "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
            "authorization": self.api_token,
            "origin": "https://www.aposta1.bet.br",
            "referer": "https://www.aposta1.bet.br/",
            "user-agent": self.user_agent or "Mozilla/5.0"
        }

        params = {
            "culture": "pt-BR",
            "timezoneOffset": "-180",
            "integration": "aposta1",
            "deviceType": "1",
            "numFormat": "en-GB",
            "countryCode": "BR",
            "eventCount": "0",
            "sportId": "0",
            "champIds": league.league_id,
            "categoryIds": "0"
        }

        try:
            async with AsyncSession(impersonate="chrome124", headers=headers) as session:
                response = await session.get(self.API_URL, params=params)
                
                if response.status_code == 401:
                    self.logger.warning("Token expirou. Renovando...")
                    self.api_token = None
                    return []
                
                response.raise_for_status()
                data = response.json()
                
                return self._parse_response(data, league)

        except Exception as e:
            self.logger.error(f"❌ Aposta1 {league.name}: Erro request - {e}")
            return []
    
    def _parse_response(self, data: Dict[str, Any], league: LeagueConfig) -> List[ScrapedOdds]:
        """Parse Altenar API response using events structure."""
        results = []
        
        # Get all data structures
        events_list = data.get("events", [])
        markets_list = data.get("markets", [])
        odds_list = data.get("odds", [])
        competitors_list = data.get("competitors", [])
        
        self.logger.info(f"📊 Aposta1 {league.name}: {len(events_list)} events, {len(markets_list)} markets, {len(odds_list)} odds")
        
        if not events_list:
            self.logger.warning(f"⚠️ Aposta1 {league.name}: No events found")
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
                
                scraped = ScrapedOdds(
                    bookmaker_name="aposta1",
                    home_team_raw=home_team,
                    away_team_raw=away_team,
                    league_raw=league.name,
                    match_date=match_date,
                    home_odd=found_odds["home"],
                    draw_odd=found_odds["draw"],
                    away_odd=found_odds["away"],
                    market_type="1x2",
                    extra_data={
                        "aposta1_event_id": str(event_id),
                        "aposta1_country": league.country.lower()
                    }
                )
                results.append(scraped)
                
            except Exception as e:
                self.logger.debug(f"⚠️ Aposta1: Error parsing market: {e}")
                continue
        
        self.logger.info(f"✅ Aposta1 {league.name}: {len(results)} odds processed")
        return results

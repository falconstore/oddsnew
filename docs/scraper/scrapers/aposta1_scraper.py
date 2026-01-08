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
class Aposta1League:
    champ_id: str
    category_id: str
    name: str
    country: str

class Aposta1Scraper(BaseScraper):
    
    LEAGUES = {
        "serie_a": Aposta1League(champ_id="2942", category_id="502", name="Serie A", country="italia"),
        "premier_league": Aposta1League(champ_id="2936", category_id="497", name="Premier League", country="inglaterra"),
        "la_liga": Aposta1League(champ_id="2941", category_id="501", name="La Liga", country="espanha"),
        "bundesliga": Aposta1League(champ_id="2950", category_id="506", name="Bundesliga", country="alemanha"),
        "ligue_1": Aposta1League(champ_id="2943", category_id="503", name="Ligue 1", country="franca"),
    }
    
    EVENTS_API = "https://sb2frontend-altenar2.biahosted.com/api/widget/GetEvents"
    EVENT_DETAILS_API = "https://sb2frontend-altenar2.biahosted.com/api/widget/GetEventDetails"
    
    def __init__(self):
        super().__init__(name="aposta1", base_url="https://www.aposta1.bet.br")
        self.session: Optional[AsyncSession] = None
        self.auth_token: Optional[str] = None
        self.user_agent: Optional[str] = None
        self.logger = logger.bind(component="aposta1")
    
    async def setup(self) -> None:
        self.logger.info("[Aposta1] Iniciando captura de token")
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=['--no-sandbox', '--disable-blink-features=AutomationControlled']
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
                target_url = "https://www.aposta1.bet.br/esportes"
                self.logger.info("[Aposta1] Navegando para pagina de esportes")
                await page.goto(target_url, wait_until="domcontentloaded", timeout=30000)
                
                self.auth_token = await asyncio.wait_for(token_future, timeout=20.0)
                self.user_agent = await page.evaluate("navigator.userAgent")
                
                self.logger.info("[Aposta1] Token capturado com sucesso")
                
            except asyncio.TimeoutError:
                self.logger.error("[Aposta1] Timeout ao capturar token")
            except Exception as e:
                self.logger.error(f"[Aposta1] Erro Playwright: {e}")
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
            full_url = f"https://www.aposta1.bet.br/esportes#/sport/66/category/0/championship/{val.champ_id}"
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
            return []

        try:
            # 1. Buscar lista de eventos
            events = await self._fetch_events(target_champ_id, league)
            if not events:
                return []
            
            # 2. Extrair event_ids
            event_ids = [str(e["id"]) for e in events]
            self.logger.info(f"[Aposta1] {league.name}: {len(event_ids)} eventos encontrados")
            
            # 3. Buscar detalhes de cada evento
            event_details = await self._fetch_all_event_details(event_ids)
            
            # 4. Parsear odds usando campo 'offers'
            results = []
            for event in events:
                event_id = str(event["id"])
                details = event_details.get(event_id)
                if not details:
                    continue
                
                # Parse team names
                event_name = event.get("name", "")
                home_team, away_team = self._parse_teams(event_name)
                if not home_team or not away_team:
                    continue
                
                # Parse date
                match_date_str = event.get("startDate")
                if not match_date_str:
                    continue
                parsed_date = date_parser.parse(match_date_str)
                
                # Parse SO e PA do GetEventDetails
                odds_by_type = self._parse_event_details_odds(details)
                
                for odds_type, odds in odds_by_type.items():
                    scraped = ScrapedOdds(
                        bookmaker_name="aposta1",
                        home_team_raw=home_team,
                        away_team_raw=away_team,
                        league_raw=league.name,
                        match_date=parsed_date,
                        home_odd=odds["home"],
                        draw_odd=odds["draw"],
                        away_odd=odds["away"],
                        market_type="1x2",
                        odds_type=odds_type,
                        extra_data={
                            "aposta1_event_id": event_id,
                            "aposta1_champ_id": self._get_champ_id_for_league(league.name),
                            "aposta1_category_id": self._get_category_id_for_league(league.name),
                            "country": self._get_country_for_league(league.name)
                        }
                    )
                    results.append(scraped)
            
            # Log com contagem separada
            so_count = len([r for r in results if r.odds_type == "SO"])
            pa_count = len([r for r in results if r.odds_type == "PA"])
            self.logger.info(f"[Aposta1] {league.name}: {so_count} SO + {pa_count} PA = {len(results)} total")
            
            return results
            
        except Exception as e:
            self.logger.error(f"[Aposta1] {league.name}: Erro - {e}")
            return []

    async def _fetch_events(self, champ_id: str, league: LeagueConfig) -> List[Dict[str, Any]]:
        """Busca lista de eventos de uma liga."""
        params = {
            "culture": "pt-BR",
            "timezoneOffset": "180",
            "integration": "aposta1",
            "deviceType": "1",
            "numFormat": "en-GB",
            "countryCode": "BR",
            "eventCount": "0",
            "sportId": "0", 
            "champIds": champ_id
        }
        
        try:
            response = await self.session.get(self.EVENTS_API, params=params, timeout=20)
            
            if response.status_code == 200:
                data = response.json()
                return data.get("events", [])
            
            if response.status_code in [401, 403]:
                self.auth_token = None
            
            self.logger.error(f"[Aposta1] {league.name}: HTTP {response.status_code}")
            return []
            
        except Exception as e:
            self.logger.error(f"[Aposta1] Erro ao buscar eventos: {e}")
            return []

    async def _fetch_event_details(self, event_id: str) -> Optional[Dict[str, Any]]:
        """Busca detalhes de um evento específico."""
        params = {
            "culture": "pt-BR",
            "timezoneOffset": "180",
            "integration": "aposta1",
            "deviceType": "1",
            "numFormat": "en-GB",
            "countryCode": "BR",
            "eventId": event_id,
            "showNonBoosts": "false"
        }
        
        try:
            response = await self.session.get(self.EVENT_DETAILS_API, params=params, timeout=15)
            if response.status_code == 200:
                return response.json()
            return None
        except Exception:
            return None

    async def _fetch_all_event_details(self, event_ids: List[str]) -> Dict[str, Dict]:
        """Busca detalhes de múltiplos eventos em paralelo."""
        results = {}
        batch_size = 5
        
        for i in range(0, len(event_ids), batch_size):
            batch = event_ids[i:i + batch_size]
            tasks = [self._fetch_event_details(eid) for eid in batch]
            responses = await asyncio.gather(*tasks, return_exceptions=True)
            
            for eid, resp in zip(batch, responses):
                if isinstance(resp, dict):
                    results[eid] = resp
            
            if i + batch_size < len(event_ids):
                await asyncio.sleep(0.2)
        
        return results

    def _parse_teams(self, event_name: str) -> tuple:
        """Extrai nomes dos times do nome do evento."""
        if " vs. " in event_name:
            parts = event_name.split(" vs. ")
            return parts[0].strip(), parts[1].strip()
        elif " vs " in event_name:
            parts = event_name.split(" vs ")
            return parts[0].strip(), parts[1].strip()
        return "", ""

    def _parse_event_details_odds(self, data: Dict[str, Any]) -> Dict[str, Dict[str, float]]:
        """
        Parseia odds do GetEventDetails.
        
        Regra:
        - typeId: 1 = Home, 2 = Draw, 3 = Away
        - SEM campo 'offers' = Super Odds (SO)
        - COM campo 'offers' = Pagamento Antecipado (PA)
        """
        so_odds = {"home": None, "draw": None, "away": None}
        pa_odds = {"home": None, "draw": None, "away": None}
        
        for odd in data.get("odds", []):
            type_id = odd.get("typeId")
            price = odd.get("price")
            has_offers = "offers" in odd and odd.get("offers")
            
            if type_id not in [1, 2, 3] or not price:
                continue
            
            pos = {1: "home", 2: "draw", 3: "away"}.get(type_id)
            
            if has_offers:
                pa_odds[pos] = float(price)
            else:
                so_odds[pos] = float(price)
        
        result = {}
        if all(v is not None for v in so_odds.values()):
            result["SO"] = so_odds
        if all(v is not None for v in pa_odds.values()):
            result["PA"] = pa_odds
        
        return result

    def _get_country_for_league(self, league_name: str) -> str:
        """Get country code for deep links."""
        for val in self.LEAGUES.values():
            if val.name == league_name:
                return val.country
        return ""
    
    def _get_champ_id_for_league(self, league_name: str) -> str:
        """Get championship ID for deep links."""
        for val in self.LEAGUES.values():
            if val.name == league_name:
                return val.champ_id
        return ""
    
    def _get_category_id_for_league(self, league_name: str) -> str:
        """Get category ID for deep links."""
        for val in self.LEAGUES.values():
            if val.name == league_name:
                return val.category_id
        return ""

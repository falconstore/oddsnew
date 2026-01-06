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
    name: str
    country: str

class Aposta1Scraper(BaseScraper):
    
    # IDs atualizados com base no JSON (ex: Premier League é champId 2936)
    LEAGUES = {
        "serie_a": Aposta1League(champ_id="2942", name="Serie A", country="italia"),
        "premier_league": Aposta1League(champ_id="2936", name="Premier League", country="inglaterra"),
        "la_liga": Aposta1League(champ_id="2941", name="La Liga", country="espanha"),
        "bundesliga": Aposta1League(champ_id="2943", name="Bundesliga", country="alemanha"),
        "ligue_1": Aposta1League(champ_id="2944", name="Ligue 1", country="franca"),
    }
    
    API_URL = "https://sb2frontend-altenar2.biahosted.com/api/widget/GetEvents"
    
    def __init__(self):
        super().__init__(name="aposta1", base_url="https://www.aposta1.bet.br")
        self.session: Optional[AsyncSession] = None
        self.auth_token: Optional[str] = None
        self.user_agent: Optional[str] = None
        self.logger = logger.bind(component="aposta1")
    
    async def setup(self) -> None:
        self.logger.info("🔑 Aposta1: Iniciando captura de token...")
        
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
                self.logger.info(f"🌍 Aposta1: Navegando para {target_url}...")
                await page.goto(target_url, wait_until="domcontentloaded", timeout=30000)
                
                # Aguarda token
                self.auth_token = await asyncio.wait_for(token_future, timeout=20.0)
                self.user_agent = await page.evaluate("navigator.userAgent")
                
                self.logger.info(f"✅ Aposta1: Token capturado! UA: {self.user_agent[:20]}...")
                
            except asyncio.TimeoutError:
                self.logger.error("❌ Aposta1: Timeout capturando token.")
            except Exception as e:
                self.logger.error(f"❌ Aposta1: Erro no Playwright: {e}")
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

        # Identifica ID do campeonato
        target_champ_id = None
        if hasattr(league, 'league_id') and league.league_id in self.LEAGUES:
            target_champ_id = self.LEAGUES[league.league_id].champ_id
        
        if not target_champ_id:
            return []

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
            
            response = await self.session.get(self.API_URL, params=params, timeout=20)
            
            if response.status_code == 200:
                data = response.json()
                return self._parse_response(data, league.name)
            
            if response.status_code in [401, 403]:
                self.auth_token = None
            
            self.logger.error(f"❌ Aposta1 {league.name}: HTTP {response.status_code}")
            return []
            
        except Exception as e:
            self.logger.error(f"❌ Aposta1 {league.name}: Erro - {e}")
            return []
    
    def _parse_response(self, data: Dict[str, Any], league_name: str) -> List[ScrapedOdds]:
        results = []
        
        # 1. CRIAR MAPAS (Lookup Dictionaries)
        # O JSON separa Events, Markets e Odds. Precisamos uni-los pelos IDs.
        
        # Mapa de Odds: ID -> Objeto Odd
        odds_map = {o['id']: o for o in data.get('odds', [])}
        
        # Mapa de Markets: ID -> Objeto Market
        markets_map = {m['id']: m for m in data.get('markets', [])}
        
        events_list = data.get("events", [])
        
        for event in events_list:
            try:
                # Dados Básicos do Evento
                event_name = event.get("name", "")
                match_date = event.get("startDate")
                event_id = event.get("id")
                
                if not event_name or not match_date:
                    continue

                # Separar Times (formato "Time A vs. Time B")
                home_team, away_team = "", ""
                if " vs. " in event_name:
                    parts = event_name.split(" vs. ")
                    home_team, away_team = parts[0].strip(), parts[1].strip()
                elif " vs " in event_name:
                    parts = event_name.split(" vs ")
                    home_team, away_team = parts[0].strip(), parts[1].strip()
                else:
                    continue # Pula se não conseguir separar times

                # Buscar Odds 1x2
                found_odds = {"home": None, "draw": None, "away": None}
                
                # Iterar sobre os IDs de mercado vinculados ao evento
                market_ids = event.get("marketIds", [])
                
                for mid in market_ids:
                    market = markets_map.get(mid)
                    if not market:
                        continue
                        
                    # Verifica se é o mercado 1x2 (TypeId 1 ou Nome "1x2")
                    # O JSON mostra typeId: 1 para "1x2"
                    if market.get("typeId") == 1 or market.get("name") == "1x2":
                        
                        # Agora pegamos os IDs das odds dentro desse mercado
                        odd_ids = market.get("oddIds", [])
                        
                        for oid in odd_ids:
                            odd = odds_map.get(oid)
                            if not odd:
                                continue
                            
                            # No JSON Altenar:
                            # TypeId 1 = Casa (Home)
                            # TypeId 2 = Empate (Draw)
                            # TypeId 3 = Fora (Away)
                            
                            t_id = odd.get("typeId")
                            price = odd.get("price")
                            
                            if t_id == 1:
                                found_odds["home"] = float(price)
                            elif t_id == 2:
                                found_odds["draw"] = float(price)
                            elif t_id == 3:
                                found_odds["away"] = float(price)
                        
                        # Se achou o mercado 1x2, não precisa ver os outros
                        break

                if not all(found_odds.values()):
                    continue

                parsed_date = date_parser.parse(match_date)

                scraped = ScrapedOdds(
                    bookmaker="aposta1",
                    league=league_name,
                    home_team=home_team,
                    away_team=away_team,
                    date=parsed_date,
                    odds=found_odds,
                    raw_data={"event_id": event_id}
                )
                results.append(scraped)

            except Exception as e:
                # self.logger.error(f"Erro parseando evento: {e}")
                continue
        
        self.logger.info(f"✅ Aposta1 {league_name}: {len(results)} odds coletadas")
        return results
import asyncio
from datetime import datetime
from typing import List, Dict, Any, Optional
from loguru import logger
from playwright.async_api import async_playwright
from curl_cffi.requests import AsyncSession

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig

class Br4betScraper(BaseScraper): 
    """
    Scraper Híbrido para Br4bet (Altenar).
    """
    
    LEAGUES = {
        "serie_a": {
            "champ_id": "2942",
            "name": "Serie A",
            "country": "Brasil"
        },
        "premier_league": {
            "champ_id": "2936",
            "name": "Premier League", 
            "country": "Inglaterra"
        },
        "la_liga": {
            "champ_id": "2941",
            "name": "La Liga",
            "country": "Espanha"
        },
    }
    
    API_URL = "https://sb2frontend-altenar2.biahosted.com/api/widget/GetEvents"
    
    def __init__(self):
        super().__init__(name="br4bet", base_url="https://br4.bet.br")
        self.api_token: Optional[str] = None
        self.user_agent: Optional[str] = None
    
    async def setup(self):
        self.logger.info("Iniciando Playwright para capturar credenciais...")
        
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
                # URL Deep Link para forçar carregamento
                target_url = "https://br4.bet.br/sports/futebol/inglaterra/premier-league"
                self.logger.info(f"Navegando para {target_url}...")
                
                await page.goto(target_url, wait_until="domcontentloaded", timeout=60000)
                
                try:
                    self.api_token = await asyncio.wait_for(token_future, timeout=15.0)
                except asyncio.TimeoutError:
                    self.logger.warning("Token demorou. Scrollando...")
                    await page.evaluate("window.scrollTo(0, 500)")
                    self.api_token = await asyncio.wait_for(token_future, timeout=15.0)

                self.user_agent = await page.evaluate("navigator.userAgent")
                
            except asyncio.TimeoutError:
                self.logger.error("❌ Timeout: Site não carregou API.")
            except Exception as e:
                self.logger.error(f"❌ Erro Playwright: {e}")
            finally:
                await browser.close()

    async def teardown(self):
        pass

    async def get_available_leagues(self) -> List[LeagueConfig]:
        return [
            LeagueConfig(league_id=v["champ_id"], name=v["name"], url="", country=v["country"])
            for v in self.LEAGUES.values()
        ]

    # --- CORREÇÃO AQUI: Alinhado corretamente com as outras funções ---
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        if not self.api_token:
            await self.setup()
        
        if not self.api_token:
            return []

        headers = {
            "accept": "*/*",
            "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
            "authorization": self.api_token,
            "origin": "https://br4.bet.br",
            "referer": "https://br4.bet.br/",
            "user-agent": self.user_agent or "Mozilla/5.0"
        }

        # AJUSTE DE PARÂMETROS AQUI
        params = {
            "culture": "pt-BR",
            "timezoneOffset": "-180",
            "integration": "br4bet",
            "deviceType": "1",
            "numFormat": "en-GB",
            "countryCode": "BR",
            "eventCount": "0",
            "sportId": "0",  # 0 = Qualquer esporte (filtrado pelo champId)
            "champIds": league.league_id,
            "categoryIds": "0"
            # Removi dateRange para pegar jogos futuros também
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
            self.logger.error(f"Erro request {league.name}: {e}")
            return []

    def _parse_response(self, data: Dict[str, Any], league: LeagueConfig) -> List[ScrapedOdds]:
        odds_list = []
        
        # Dicionários de acesso rápido
        all_odds_list = data.get("odds", [])
        all_markets_list = data.get("markets", [])
        dates_list = data.get("dates", [])
        
        all_odds = {o["id"]: o for o in all_odds_list}
        
        # Mapear eventId -> data a partir do dates array
        event_dates = {}
        for date_entry in dates_list:
            date_str = date_entry.get("dateTime")
            for eid in date_entry.get("eventIds", []):
                event_dates[eid] = date_str
        
        self.logger.info(f"📊 Estrutura: {len(all_markets_list)} markets, {len(all_odds_list)} odds, {len(dates_list)} dates")
        
        # Processar apenas mercados "Vencedor do encontro" (typeId == 1)
        for market in all_markets_list:
            market_type_id = market.get("typeId")
            market_name = market.get("name", "").lower()
            
            # Filtrar apenas mercado 1X2 (typeId=1 ou nome "vencedor")
            is_1x2 = market_type_id == 1 or "vencedor" in market_name
            if not is_1x2:
                continue
            
            odd_ids = market.get("oddIds", [])
            
            home_odd = None
            draw_odd = None
            away_odd = None
            home_name = None
            away_name = None
            
            for odd_id in odd_ids:
                odd = all_odds.get(odd_id)
                if not odd:
                    continue
                
                price = odd.get("price")
                if not price:
                    continue
                
                price = float(price)
                type_id = odd.get("typeId")
                odd_name = odd.get("name", "")
                
                # typeId nas odds: 1=Home, 2=Draw, 3=Away
                if type_id == 1:
                    home_odd = price
                    home_name = odd_name.strip()
                elif type_id == 2:
                    draw_odd = price
                elif type_id == 3:
                    away_odd = price
                    away_name = odd_name.strip()
            
            # Se encontrou as 3 odds e os nomes dos times, criar o registro
            if home_odd and draw_odd and away_odd and home_name and away_name:
                # Tentar pegar a data do jogo
                match_date = datetime.now()
                
                scraped = ScrapedOdds(
                    bookmaker_name="br4bet",
                    home_team_raw=home_name,
                    away_team_raw=away_name,
                    league_raw=league.name,
                    match_date=match_date,
                    home_odd=home_odd,
                    draw_odd=draw_odd,
                    away_odd=away_odd,
                    market_type="1x2",
                    extra_data={
                        "market_id": str(market.get("id")),
                        "market_name": market.get("name")
                    }
                )
                odds_list.append(scraped)
        
        self.logger.info(f"✅ Br4bet {league.name}: {len(odds_list)} odds processadas")
        return odds_list
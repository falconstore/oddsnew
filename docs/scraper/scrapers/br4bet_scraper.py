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
                
                # LOG DE DEBUG IMPORTANTE
                total_events = len(data.get("events", []))
                self.logger.info(f"📡 API Br4bet retornou {total_events} eventos brutos para {league.name}")
                
                return self._parse_response(data, league)

        except Exception as e:
            self.logger.error(f"Erro request {league.name}: {e}")
            return []

    def _parse_response(self, data: Dict[str, Any], league: LeagueConfig) -> List[ScrapedOdds]:
        odds_list = []
        events = data.get("events", [])
        
        # Dicionários de acesso rápido
        all_odds = {o["id"]: o for o in data.get("odds", [])}
        all_markets = {m["id"]: m for m in data.get("markets", [])}
        
        self.logger.info(f"🔍 Analisando {len(events)} eventos...")

        for event in events:
            event_id = event.get("id")
            competitors = event.get("competitors", [])
            
            # Validação básica de times
            if len(competitors) < 2:
                continue
                
            # Na Altenar, o primeiro costuma ser Home e o segundo Away
            home_team_data = competitors[0]
            away_team_data = competitors[1]
            
            home_id = home_team_data.get("id")
            away_id = away_team_data.get("id")
            
            home_name = home_team_data.get("name")
            away_name = away_team_data.get("name")
            
            # Tenta pegar os IDs dos mercados vinculados a este evento
            market_ids = event.get("marketIds", [])
            
            found_market = False
            
            for m_id in market_ids:
                market = all_markets.get(m_id)
                if not market: continue
                
                m_name = market.get("name", "").lower()
                
                # Filtro mais flexível para achar o mercado de Vencedor
                # Aceita "match winner", "1x2", "vencedor da partida", "resultado final"
                is_winner = ("vencedor" in m_name and "partida" in m_name) or \
                            ("1x2" in m_name) or \
                            ("match" in m_name and "winner" in m_name) or \
                            ("resultado" in m_name and "final" in m_name)

                if not is_winner:
                    continue

                # Se achou um mercado potencial, vamos tentar extrair as odds
                odd_ids = market.get("oddIds", [])
                
                home_odd = None
                draw_odd = None
                away_odd = None
                
                for odd_id in odd_ids:
                    odd = all_odds.get(odd_id)
                    if not odd: continue
                    
                    # Pega o preço (odd decimal)
                    price = odd.get("price") # Às vezes vem direto
                    if isinstance(price, dict): 
                        # As vezes vem dentro de um objeto {decimal: ..., american: ...} ou {parsedValue: ...}
                        price = price.get("parsedValue") or price.get("decimal")
                    
                    if not price: continue
                    
                    price = float(price)
                    odd_competitor_id = odd.get("competitorId")

                    # LÓGICA DE CRUZAMENTO DE ID (Mais segura que typeId)
                    if odd_competitor_id == home_id:
                        home_odd = price
                    elif odd_competitor_id == away_id:
                        away_odd = price
                    else:
                        # Se não é nem casa nem fora, assumimos que é o Empate
                        # (Geralmente o empate tem competitorId null ou 0)
                        draw_odd = price
                
                # Verifica se completou
                if home_odd and away_odd and draw_odd:
                    found_market = True
                    
                    try:
                        start_date = event.get("startDate")
                        # Tratamento de data ISO 8601
                        match_date = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                    except:
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
                            "event_id": str(event_id),
                            "market_id": str(m_id),
                            "market_name": market.get("name")
                        }
                    )
                    odds_list.append(scraped)
                    break # Já achou o 1x2 desse jogo, vai para o próximo evento
            
            if not found_market:
                # Log de debug para saber pq falhou neste jogo específico
                self.logger.debug(f"⚠️ Mercado 1x2 não encontrado para {home_name} vs {away_name}. Mercados vistos: {[all_markets.get(mid, {}).get('name') for mid in market_ids]}")

        self.logger.info(f"Br4bet {league.name}: {len(odds_list)} odds processadas com sucesso.")
        return odds_list
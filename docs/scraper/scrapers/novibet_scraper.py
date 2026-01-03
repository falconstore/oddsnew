import asyncio

from datetime import datetime

from typing import List, Optional, Dict, Any

from loguru import logger

from curl_cffi.requests import AsyncSession

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig



class NovibetScraper(BaseScraper):

    API_BASE = "https://www.novibet.bet.br/spt/feed/marketviews/location/v2"

    SPORT_ID = "4324"  # Futebol

    

    # ✅ ID CONFIRMADO PELO SEU CURL

    LEAGUES = {

        "premier_league": {

            "competition_id": "5909300",  # <--- SEU ID CORRETO AQUI

            "name": "Premier League",

            "country": "Inglaterra"

        },

        # Outros IDs prováveis (você pode descobrir usando o script de discovery se precisarem de ajuste)

        "la_liga": {"competition_id": "5909306", "name": "La Liga", "country": "Espanha"},

        "serie_a": {"competition_id": "5909302", "name": "Serie A", "country": "Italia"},

        "bundesliga": {"competition_id": "5909304", "name": "Bundesliga", "country": "Alemanha"},

        "ligue_1": {"competition_id": "5909305", "name": "Ligue 1", "country": "França"},

        "brasileirao_a": {"competition_id": "5909244", "name": "Brasileirão A", "country": "Brasil"} # Exemplo

    }

    

    def __init__(self):

        super().__init__(name="novibet", base_url="https://www.novibet.bet.br")

        self.session: Optional[AsyncSession] = None

        self.logger = logger.bind(component="novibet")

    

    async def setup(self):

        # Headers retirados do seu CURL (Limpos de cookies de sessão específicos para evitar expiração rápida)

        headers = {

            "authority": "www.novibet.bet.br",

            "accept": "application/json, text/plain, */*",

            "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",

            "referer": "https://www.novibet.bet.br/apostas-esportivas/futebol/4372606/england/premier-league/5908949?t=5909300",

            "origin": "https://www.novibet.bet.br",

            "sec-ch-ua": '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',

            "sec-ch-ua-mobile": "?0",

            "sec-ch-ua-platform": '"macOS"',

            "sec-fetch-dest": "empty",

            "sec-fetch-mode": "cors",

            "sec-fetch-site": "same-origin",

            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",

            # HEADERS CRITICOS DA NOVIBET

            "x-gw-application-name": "NoviBR",

            "x-gw-channel": "WebPC",

            "x-gw-client-timezone": "America/Sao_Paulo",

            "x-gw-cms-key": "_BR",

            "x-gw-country-sysname": "BR",

            "x-gw-currency-sysname": "BRL",

            "x-gw-domain-key": "_BR",

            "x-gw-language-sysname": "pt-BR",

            "x-gw-odds-representation": "Decimal",

        }



        # Inicializa sessão simulando Chrome para passar pelo WAF

        self.session = AsyncSession(

            impersonate="chrome124",

            headers=headers,

            timeout=30.0

        )

        

        # Aquecimento: Acessa a home para gerar cookies válidos (cf_clearance, etc)

        try:

            await self.session.get("https://www.novibet.bet.br/")

        except Exception:

            pass



        self.logger.info("Novibet scraper initialized (curl_cffi)")

    

    async def teardown(self):

        if self.session:

            await self.session.close()

            self.session = None

        self.logger.info("Novibet scraper shutdown")



    async def get_available_leagues(self) -> List[LeagueConfig]:

        leagues = []

        for key, data in self.LEAGUES.items():

            url = f"{self.API_BASE}/{self.SPORT_ID}/{data['competition_id']}/"

            config = LeagueConfig(

                league_id=key,

                name=data["name"],

                url=url,

                country=data["country"]

            )

            leagues.append(config)

        return leagues



    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:

        if not self.session:

            await self.setup()

        

        league_config = self.LEAGUES.get(league.league_id)

        if not league_config:

            return []

        

        competition_id = league_config["competition_id"]

        timestamp = int(datetime.now().timestamp() * 1000000)

        

        url = f"{self.API_BASE}/{self.SPORT_ID}/{competition_id}/"

        

        # Parâmetros exatos do seu CURL

        params = {

            "lang": "pt-BR",

            "timeZ": "E. South America Standard Time",

            "oddsR": "1",

            "usrGrp": "BR",

            "timestamp": str(timestamp)

        }

        

        try:

            response = await self.session.get(url, params=params)

            

            # Tratamento de erros específicos

            if response.status_code == 622:

                self.logger.warning(f"⚠️ Erro 622 na {league.name}: ID {competition_id} inválido/vazio hoje.")

                return []

            if response.status_code == 403:

                self.logger.error(f"⛔ Bloqueio 403 na {league.name}. Cookies expiraram ou WAF pegou.")

                return []



            response.raise_for_status()

            data = response.json()

            

            return self._parse_response(data, league.name)

            

        except Exception as e:

            self.logger.error(f"Erro scraping Novibet {league.name}: {e}")

            return []



    def _parse_response(self, data: List[Dict[str, Any]], league_name: str) -> List[ScrapedOdds]:

        results = []

        if not data: return results

        

        bet_views = data[0].get("betViews", [])

        if not bet_views: return results

        

        items = bet_views[0].get("items", [])

        

        for item in items:

            try:

                captions = item.get("additionalCaptions", {})

                home = captions.get("competitor1")

                away = captions.get("competitor2")

                

                if not home or not away: continue

                # Filtro anti-virtual

                if "SRL" in home or "Esports" in home: continue

                if item.get("isLive", False): continue



                markets = item.get("markets", [])

                home_odd, draw_odd, away_odd = 0.0, 0.0, 0.0

                

                # Busca a melhor odd (Normal vs Early Payout)

                best_market_val = 0.0

                

                for market in markets:

                    if market.get("betTypeSysname") == "SOCCER_MATCH_RESULT":

                        temp_h, temp_d, temp_a = 0.0, 0.0, 0.0

                        

                        for bet in market.get("betItems", []):

                            if not bet.get("isAvailable", True): continue

                            price = float(bet.get("price", 0))

                            code = bet.get("code")

                            

                            if code == "1": temp_h = price

                            elif code == "X": temp_d = price

                            elif code == "2": temp_a = price

                        

                        # Se a odd da casa for maior que a anterior, assumimos este mercado como o melhor

                        if temp_h > best_market_val:

                            best_market_val = temp_h

                            home_odd, draw_odd, away_odd = temp_h, temp_d, temp_a



                if home_odd > 1.0:

                    try:

                        dt = datetime.fromisoformat(item.get("startDate").replace("Z", "+00:00"))

                    except:

                        dt = datetime.now()



                    scraped = ScrapedOdds(

                        bookmaker_name="novibet",

                        home_team_raw=home,

                        away_team_raw=away,

                        league_raw=league_name,

                        match_date=dt,

                        home_odd=home_odd,

                        draw_odd=draw_odd,

                        away_odd=away_odd,

                        market_type="1x2",

                        extra_data={"event_id": str(item.get("eventBetContextId"))}

                    )

                    results.append(scraped)



            except Exception:

                continue

                

        self.logger.info(f"Novibet {league_name}: {len(results)} jogos encontrados.")

        return results
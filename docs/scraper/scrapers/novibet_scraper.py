import asyncio



from datetime import datetime



from typing import List, Optional, Dict, Any



from loguru import logger



from curl_cffi.requests import AsyncSession



from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig







class NovibetScraper(BaseScraper):



    API_BASE = "https://www.novibet.bet.br/spt/feed/marketviews/location/v2"



    SPORT_ID = "4324"  # Futebol



    



    #  ID CONFIRMADO PELO SEU CURL



    LEAGUES = {



        "premier_league": {



            "competition_id": "5909300",  # <--- SEU ID CORRETO AQUI



            "name": "Premier League",



            "country": "Inglaterra"



        },



        # Outros IDs prováveis (você pode descobrir usando o script de discovery se precisarem de ajuste)



        "la_liga": {"competition_id": "5910661", "name": "La Liga", "country": "Espanha"},



        "serie_a": {"competition_id": "5910485", "name": "Serie A", "country": "Italia"},

 	

	"bundesliga": {"competition_id": "5910745", "name": "Bundesliga", "country": "Alemanha"},



        "ligue_1": {"competition_id": "5910637", "name": "Ligue 1", "country": "Franca"},



	"paulistao": {"competition_id": "4381204", "name": "Paulistao A1", "country": "Brasil"},



	"fa_cup": {"competition_id": "4373638", "name": "FA Cup", "country": "Inglaterra"},


	"efl_cup": {"competition_id": "4373738", "name": "EFL Cup", "country": "Inglaterra"},


	"copa_do_rei": {"competition_id": "4375979", "name": "Copa do Rei", "country": "Espanha"},


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



                self.logger.warning(f" Erro 622 na {league.name}: ID {competition_id} inválido/vazio hoje.")



                return []



            if response.status_code == 403:



                self.logger.error(f" Bloqueio 403 na {league.name}. Cookies expiraram ou WAF pegou.")



                return []







            response.raise_for_status()



            data = response.json()



            



            return self._parse_response(data, league.name)



            



        except Exception as e:



            self.logger.error(f"Erro scraping Novibet {league.name}: {e}")



            return []







    # Tags conhecidas da Novibet para identificar tipo de mercado

    TAG_SUPER_ODDS = "ODDS_KEY_0"  # SO - Super Odds (0% margem)

    TAG_EARLY_PAYOUT = "SOCCER_2_GOALS_AHEAD_EARLY_PAYOUT"  # PA - 2 gols = Green



    def _parse_response(self, data: List[Dict[str, Any]], league_name: str) -> List[ScrapedOdds]:

        results = []

        if not data:

            return results

        

        bet_views = data[0].get("betViews", [])

        if not bet_views:

            return results

        

        items = bet_views[0].get("items", [])

        

        for item in items:

            try:

                captions = item.get("additionalCaptions", {})

                home = captions.get("competitor1")

                away = captions.get("competitor2")

                

                if not home or not away:

                    continue

                # Filtro anti-virtual

                if "SRL" in home or "Esports" in home:

                    continue

                if item.get("isLive", False):

                    continue



                # Construir mapa: marketId -> tag

                market_tags = item.get("marketTags", [])

                tag_map = {t["marketId"]: t["tag"] for t in market_tags}



                markets = item.get("markets", [])

                odds_by_type = {}  # {"SO": {...}, "PA": {...}}

                

                for market in markets:

                    if market.get("betTypeSysname") != "SOCCER_MATCH_RESULT":

                        continue

                    

                    market_id = market.get("marketId")

                    tag = tag_map.get(market_id, "")

                    

                    # Identificar tipo baseado na tag

                    if tag == self.TAG_SUPER_ODDS:

                        odds_type = "SO"

                    elif tag == self.TAG_EARLY_PAYOUT:

                        odds_type = "PA"

                    else:

                        # Tag vazia ou desconhecida = assume PA (mercado padrão)

                        if tag:

                            self.logger.info(f"Nova tag encontrada: {tag} - usando PA como default")

                        odds_type = "PA"

                    

                    temp_h, temp_d, temp_a = 0.0, 0.0, 0.0

                    for bet in market.get("betItems", []):

                        if not bet.get("isAvailable", True):

                            continue

                        price = float(bet.get("price", 0))

                        code = bet.get("code")

                        

                        if code == "1":

                            temp_h = price

                        elif code == "X":

                            temp_d = price

                        elif code == "2":

                            temp_a = price

                    

                    if temp_h > 1.0:

                        odds_by_type[odds_type] = {

                            "home": temp_h,

                            "draw": temp_d,

                            "away": temp_a

                        }



                # Parse da data

                try:

                    dt = datetime.fromisoformat(item.get("startDate").replace("Z", "+00:00"))

                except:

                    dt = datetime.now()



                # Criar ScrapedOdds para cada tipo encontrado

                for odds_type, odds in odds_by_type.items():

                    scraped = ScrapedOdds(

                        bookmaker_name="novibet",

                        home_team_raw=home,

                        away_team_raw=away,

                        league_raw=league_name,

                        match_date=dt,

                        home_odd=odds["home"],

                        draw_odd=odds["draw"],

                        away_odd=odds["away"],

                        market_type="1x2",

                        odds_type=odds_type,

                        extra_data={"event_id": str(item.get("eventBetContextId"))}

                    )

                    results.append(scraped)



            except Exception as e:

                self.logger.debug(f"Erro processando item: {e}")

                continue

        

        so_count = len([r for r in results if r.odds_type == "SO"])

        pa_count = len([r for r in results if r.odds_type == "PA"])

        self.logger.info(f"Novibet {league_name}: {so_count} SO + {pa_count} PA = {len(results)} total")

        

        return results
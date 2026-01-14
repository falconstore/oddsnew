"""

Superbet Scraper - Scrapes odds from Superbet Brazil.



Uses simple REST API - no anti-bot protection needed.

"""



import aiohttp

from datetime import datetime, timedelta, timezone

from typing import List, Dict, Any, Optional



from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig





class SuperbetScraper(BaseScraper):

    """

    Scraper for Superbet Brazil.

    

    Uses public REST API - no authentication or cookies required.

    """

    

    # League configurations with Superbet tournament IDs

    LEAGUES = {

        "premier_league": {

            "id": "106",

            "name": "Premier League",

            "country": "Inglaterra",

        },

        "serie_a": {

            "id": "104",

            "name": "Serie A",

            "country": "Itália",

        },

        "la_liga": {

            "id": "98",

            "name": "La Liga",

            "country": "Espanha",

        },

         "bundesliga": {

            "id": "245",

            "name": "Bundesliga",

            "country": "Alemanha",

 	},

         "lingue_1": {

            "id": "100",

            "name": "Ligue 1",

            "country": "Franca",

        },
 	
	"paulistao": {

            "id": "20934",

            "name": "Paulistao A1",

            "country": "Brasil",

        },

	"fa_cup": {

            "id": "107",

            "name": "FA Cup",

            "country": "Inglaterra",

        },

	"efl_cup": {

            "id": "90",

            "name": "EFL Cup",

            "country": "Inglaterra",

        },


	"copa_do_rei": {

            "id": "26",

            "name": "Copa do Rei",

            "country": "Espanha",

        },


    }

    

    API_BASE = "https://production-superbet-offer-br.freetls.fastly.net/v2/pt-BR/events/by-date"

    

    def __init__(self):

        super().__init__(

            name="superbet",

            base_url="https://superbet.bet.br"

        )

        self._session: Optional[aiohttp.ClientSession] = None

    

    async def setup(self):

        """Initialize aiohttp session."""

        await super().setup()

        

        self.logger.debug("Initializing Superbet HTTP session...")

        

        self._session = aiohttp.ClientSession(

            headers={

                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0",

                "Accept": "application/json",

                "Accept-Language": "pt-BR,pt;q=0.8,en-US;q=0.5,en;q=0.3",

            }

        )

        

        self.logger.debug("Superbet session initialized")

    

    async def teardown(self):

        """Close HTTP session."""

        if self._session:

            await self._session.close()

            self._session = None

        await super().teardown()

    

    async def get_available_leagues(self) -> List[LeagueConfig]:

        """Return configured leagues."""

        return [

            LeagueConfig(

                league_id=cfg["id"],

                name=cfg["name"],

                url=f"{self.base_url}/apostas/futebol",

                country=cfg["country"]

            )

            for cfg in self.LEAGUES.values()

        ]

    

    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:

        """

        Scrape odds from Superbet API.

        

        API endpoint: /v2/pt-BR/events/by-date

        Parameters:

            - offerState: prematch

            - sportId: 5 (football)

            - tournamentIds: league ID

            - startDate / endDate: date range

        """

        if not self._session:

            raise RuntimeError("Session not initialized. Call setup() first.")

        

        now = datetime.now(timezone.utc)

        start_date = now.strftime("%Y-%m-%d 00:00:00")

        end_date = (now + timedelta(days=30)).strftime("%Y-%m-%d 00:00:00")

        

        url = (

            f"{self.API_BASE}?"

            f"offerState=prematch"

            f"&sportId=5"

            f"&tournamentIds={league.league_id}"

            f"&startDate={start_date}"

            f"&endDate={end_date}"

        )

        

        self.logger.debug(f"Fetching {league.name} from Superbet API")

        

        try:

            async with self._session.get(url) as response:

                if response.status != 200:

                    self.logger.error(f"HTTP {response.status} for {league.name}")

                    return []

                

                data = await response.json()

                

                if data.get("error"):

                    self.logger.error(f"API error for {league.name}: {data}")

                    return []

                

                return self._parse_response(data, league.name)

                

        except aiohttp.ClientError as e:

            self.logger.error(f"Request failed for {league.name}: {e}")

            return []

        except Exception as e:

            self.logger.error(f"Unexpected error for {league.name}: {e}")

            return []

    

    def _parse_response(self, data: Dict[str, Any], league_name: str) -> List[ScrapedOdds]:

        """

        Parse Superbet API response.

        

        Response structure:

        {

            "data": [

                {

                    "matchName": "Nottingham Forest·Manchester City",

                    "utcDate": "2025-12-27T12:30:00Z",

                    "odds": [

                        {

                            "marketId": 547,  // Resultado Final (1X2)

                            "code": "1",      // 1=Home, 0=Draw, 2=Away

                            "price": 5.5

                        }

                    ]

                }

            ]

        }

        """

        odds_list = []

        

        events = data.get("data", [])

        

        if not events:

            self.logger.warning(f"No events found for {league_name}")

            return odds_list

        

        for event in events:

            # Parse team names (separated by ·)

            match_name = event.get("matchName", "")

            parts = match_name.split("·")

            

            if len(parts) != 2:

                self.logger.warning(f"Could not parse teams from: {match_name}")

                continue

            

            home_team = parts[0].strip()

            away_team = parts[1].strip()

            

            # Parse match date

            utc_date = event.get("utcDate", "")

            try:

                match_date = datetime.fromisoformat(utc_date.replace("Z", "+00:00"))

            except ValueError:

                self.logger.warning(f"Invalid date format: {utc_date}")

                continue

            

            # Extract odds from market 547 (Resultado Final / 1X2)

            home_odd = None

            draw_odd = None

            away_odd = None

            

            event_odds = event.get("odds") or []

            if not event_odds:

                self.logger.debug(f"No odds available for: {match_name}")

                continue

            

            for odd in event_odds:

                if odd.get("marketId") == 547:

                    code = odd.get("code")

                    price = odd.get("price")

                    

                    if code == "1":

                        home_odd = price

                    elif code == "0":

                        draw_odd = price

                    elif code == "2":

                        away_odd = price

            

            # Validate all odds are present

            if home_odd is None or draw_odd is None or away_odd is None:

                self.logger.warning(f"Incomplete odds for: {match_name}")

                continue

            

            # Create ScrapedOdds object

            scraped = ScrapedOdds(

                bookmaker_name="superbet",

                home_team_raw=home_team,

                away_team_raw=away_team,

                league_raw=league_name,

                match_date=match_date,

                home_odd=float(home_odd),

                draw_odd=float(draw_odd),

                away_odd=float(away_odd),

                market_type="1x2",

                extra_data={

                    "superbet_event_id": event.get("eventId"),

                    "superbet_offer_id": event.get("offerId"),

                }

            )

            

            odds_list.append(scraped)

            self.logger.debug(

                f"Parsed: {home_team} vs {away_team} | "

                f"{home_odd:.2f} / {draw_odd:.2f} / {away_odd:.2f}"

            )

        

        self.logger.info(f"{league_name}: {len(odds_list)} matches parsed")

        return odds_list


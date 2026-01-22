"""
Tradeball Scraper - Scrapes odds from Tradeball (Betbra Dball Exchange).

API: https://tradeball.betbra.bet.br/api/feedDball/list
Fetches today + next 3 days of matches.

## Configuration:
    TRADEBALL_AUTH_TOKEN=27464971|PMcTBXps5wUglSWpSs5sbZTAXueeKMJ8sNzy4uZP
    TRADEBALL_COOKIES=<raw cookies from browser>

Para pegar token e cookies:
1. Abra o Tradeball no navegador e faça login
2. DevTools (F12) > Network > filtre "feedDball"
3. Copie o valor do header Authorization (sem o "Bearer ")
4. Copie todos os cookies do request header "Cookie"

Note: VPS must have Brazilian IP or use a Brazilian proxy (site is geo-blocked).
"""

import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

import httpx
from loguru import logger

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig
from config import settings


class TradeballScraper(BaseScraper):
    """
    Scraper for Tradeball (Betbra Dball Exchange).
    API: https://tradeball.betbra.bet.br/api/feedDball/list
    Requires both auth token AND session cookies.
    """
    
    # League name mapping to standardized names
    LEAGUE_MAPPING = {
        "England Premier League": {"name": "Premier League", "country": "England"},
        "Spain LaLiga": {"name": "La Liga", "country": "Spain"},
        "Germany Bundesliga": {"name": "Bundesliga", "country": "Germany"},
        "Italy Serie A": {"name": "Serie A", "country": "Italy"},
        "France Ligue 1": {"name": "Ligue 1", "country": "France"},
        "Portugal Primeira Liga": {"name": "Liga Portugal", "country": "Portugal"},
        "Brazil Paulista": {"name": "Paulistão", "country": "Brazil"},
        "Brazil Serie A": {"name": "Brasileirão Série A", "country": "Brazil"},
        "UEFA Champions League": {"name": "Champions League", "country": "Europe"},
        "UEFA Europa League": {"name": "Europa League", "country": "Europe"},
    }
    
    API_BASE = "https://tradeball.betbra.bet.br/api/feedDball/list"
    APP_ID = "6053e9c1-2e0a-4d83-875b-75a0fb2b3eef"
    
    # Fallback cookies (update periodically)
    RAW_COOKIES = """BIAB_TZ=180; _fbp=fb.2.1764594243222.329168569589903267; _ga=GA1.1.71696818.1764594243; _tt_enable_cookie=1; _ttp=01KBD06NSG1RWAGPZ8AVED2CXY_.tt.2; FPID=FPID2.3.FU9tFb%2Bo1Aoh5eSaTKC16X4CiRmnWFmd9uouQ3bKWck%3D.1764594243; FPAU=1.3.1955468692.1764594243; _gtmeec=eyJjdCI6ImY1MzI0ZGY4ZjBmOTgwZTBjZDBiOWJiZDhhODFiMTI0MzE5ZDk0N2ZkZmQ1MWIxZDhmNGE5MWUyOGNkMDBlMDAiLCJzdCI6ImJlMThiODVmNzdmYzAyNGRiMzc5YWNmMTllOGExY2U2MjMwN2FiN2JiMWJjYTM5NTM4OWVjZmMyZGFmYWY3NDEiLCJjb3VudHJ5IjoiODg1MDM2YTBkYTNkZmYzYzNlMDViYzc5YmY0OTM4MmIxMmJjNTA5ODUxNGVkNTdjZTA4NzVhYmExYWEyYzQwZCIsImV4dGVybmFsX2lkIjoiMzg4Mzc5NGQ3ODM2OWQxY2MyNjM3MWIwZDdmZDNmZDRhZWZlMTA2MDY1OTA2MmIyNzc5Nzk3ZmE5MzNmZTY5ZCJ9; BIAB_CURRENCY=BRL; SESS=d1j03m42lj63oqd6u615iolov5ot0khh752g5fk4830a84ogh80f6c3gampe8vvpqsk3u5; glc=br; ttcsid_D3NA6M3C77U816ERU610=1765130070458::o9ot-yd38141CyT87DPY.18.1765130679785.1; ttcsid_D3R959JC77U816ES3S1G=1765990763055::2x4CjfTFMpuw4Dt9jmXm.41.1765990763284.0; BIAB_LANGUAGE=PT_BR; affid=BAjgxw; FPLC=FPJJKOJURSGEMe6zsflNGXbuv0%2FGdQlsmLme9RFdkoVuh1i4zhg3Xi9cw6bNdITn0yNuVsDDQF%2FyV2PmxpeY0ifmESJGgEU%2FRMZQ12gbXGFgk%2B%2Fx2LXMQ7PBfboMrA%3D%3D; _sp_srt_ses.241e=*; BIAB_CUSTOMER=eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJmYWxjb25zdG9yZSIsImV4cCI6MTc2OTEyMjU2NywibG9naW4iOiJmYWxjb25zdG9yZSIsImRvbWFpbk5hbWUiOiJCRVRCUkEiLCJ1c2VyX3JvbGUiOiJNZW1iZXIiLCJ1c2VySWQiOjQxNzE0LCJsb2dpbklkIjo0OTA3NDMyNSwidW5pcXVlIjoidTk4VGI3bm8iLCJsb25naXR1ZGUiOi00OC4zNjU4MywibGF0aXR1ZGUiOi0yMS42MDMzM30.0vrZemq8eqqz2_TkoUeoIHe3RIDGnPUS29PbzqReVtF2vpnk2FYEkm1IXIhZREmu062GvQSiioh5k57-8PQWtA; sb=eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJmYWxjb25zdG9yZSIsImV4cCI6MTc2OTEyMjU2NywibG9naW4iOiJmYWxjb25zdG9yZSIsImRvbWFpbk5hbWUiOiJCRVRCUkEiLCJ1c2VyX3JvbGUiOiJNZW1iZXIiLCJ1c2VySWQiOjQxNzE0LCJsb2dpbklkIjo0OTA3NDMyNSwidW5pcXVlIjoidTk4VGI3bm8iLCJsb25naXR1ZGUiOi00OC4zNjU4MywibGF0aXR1ZGUiOi0yMS42MDMzM30.0vrZemq8eqqz2_TkoUeoIHe3RIDGnPUS29PbzqReVtF2vpnk2FYEkm1IXIhZREmu062GvQSiioh5k57-8PQWtA; C_U_I=41714; _sp_srt_id.241e=a3c52065-43e6-4919-81e5-0c640b36f559.1764594243.142.1769112828.1769109772.9f27529b-93b6-4f9c-82d9-244095a8e56f.527db5c8-31e7-46d8-b638-e0fea84fcef9...0; ttcsid=1769109772069::JyseRp3GFMxyYXtku0it.160.1769112828126.0; ttcsid_D4RHBNBC77UET7S4G9SG=1769109772070::obcMl7pH_FnaF5LctBqV.143.1769112828126.1; ttcsid_D4RH41JC77U321H5F03G=1769109772069::nDfse9vSmETHw42bygJb.143.1769112828126.1; _ga_8YSC4LQ18Z=GS2.1.s1769111669$o23$g1$t1769112828$j59$l0$h928288745; _ga_28DQ47GH9X=GS2.1.s1769111670$o9$g1$t1769112828$j60$l0$h0"""
    
    def __init__(self):
        super().__init__(
            name="tradeball",
            base_url="https://tradeball.betbra.bet.br"
        )
        self._auth_token: Optional[str] = None
        self._cookies: Dict[str, str] = {}
        self.logger = logger.bind(component="tradeball")
    
    def _parse_cookies(self, raw_cookies: Optional[str]) -> Dict[str, str]:
        """Parse raw cookie string into dictionary."""
        if not raw_cookies:
            return {}
        cookies = {}
        try:
            clean_raw = raw_cookies.replace('\n', '').strip()
            if not clean_raw:
                return {}
            for item in clean_raw.split('; '):
                if '=' in item:
                    key, value = item.split('=', 1)
                    cookies[key] = value
        except Exception:
            pass
        return cookies
    
    async def setup(self):
        """Initialize scraper with token and cookies."""
        self.logger.debug("Inicializando Tradeball scraper...")
        
        # Get auth token
        token_setting = getattr(settings, 'tradeball_auth_token', None)
        if token_setting:
            self._auth_token = token_setting
        else:
            self._auth_token = '27464971|PMcTBXps5wUglSWpSs5sbZTAXueeKMJ8sNzy4uZP'
            self.logger.warning("Usando token hardcoded.")
        
        # Get cookies
        raw_cookies = getattr(settings, 'tradeball_cookies', None)
        if not raw_cookies:
            self.logger.debug("Usando cookies hardcoded (fallback)...")
            raw_cookies = self.RAW_COOKIES
        self._cookies = self._parse_cookies(raw_cookies)
        
        if not self._auth_token or not self._cookies:
            raise Exception("Tradeball precisa de Token E Cookies válidos.")
        
        self.logger.info("Token e Cookies configurados com sucesso.")
    
    async def teardown(self):
        """Cleanup."""
        self.logger.info("Scraper finalizado")
    
    async def get_available_leagues(self) -> List[LeagueConfig]:
        """Return all leagues (we scrape all at once)."""
        return [LeagueConfig(league_id="0", name="Todas", url="", country="World")]
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """Not used - scrape_all handles everything."""
        return []
    
    async def scrape_all(self) -> List[ScrapedOdds]:
        """Fetch today + next 3 days of matches."""
        all_odds = []
        today = datetime.now()
        
        try:
            await self.setup()
            
            # Today
            self.logger.info("Buscando jogos de HOJE...")
            today_odds = await self._fetch_day(None)
            all_odds.extend(today_odds)
            
            # Next 3 days
            for days_ahead in range(1, 4):
                target_date = today + timedelta(days=days_ahead)
                date_str = target_date.strftime("%Y-%m-%d")
                self.logger.info(f"Buscando jogos de {date_str}...")
                day_odds = await self._fetch_day(date_str)
                all_odds.extend(day_odds)
            
            self.logger.info(f"Tradeball Total: {len(all_odds)} jogos coletados")
            
        except Exception as e:
            self.logger.error(f"Erro geral no Tradeball: {e}")
        finally:
            await self.teardown()
        
        return all_odds
    
    async def _fetch_day(self, date_str: Optional[str] = None) -> List[ScrapedOdds]:
        """Fetch all matches for a specific day."""
        # Build filter - always use marketId=3 with explicit date
        if date_str:
            filter_dict = {
                "line": 1,
                "periodTypeId": 1,
                "tradingTypeId": 2,
                "marketId": 3,
                "date": date_str
            }
        else:
            # Today: use marketId=3 with today's date
            filter_dict = {
                "line": 1,
                "periodTypeId": 1,
                "tradingTypeId": 2,
                "marketId": 3,
                "date": datetime.now().strftime("%Y-%m-%d")
            }
        
        params = {
            "page": 1,
            "filter": json.dumps(filter_dict, separators=(',', ':')),
            "start": 0,
            "limit": 50,
            "sort": '[{"property":"created_at","direction":"desc"}]',
            "requiredDictionaries[]": ["LeagueGroup", "TimeZone"],
            "init": "true",
            "version": 0,
            "uniqAppId": self.APP_ID,
            "locale": "pt"
        }
        
        headers = {
            "accept": "application/json, text/plain, */*",
            "authorization": f"Bearer {self._auth_token}",
            "priority": "u=1, i",
            "referer": "https://tradeball.betbra.bet.br/dballTradingFeed",
            "sec-ch-ua": '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"macOS"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
            "x-requested-with": "XMLHttpRequest"
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0, cookies=self._cookies) as client:
                response = await client.get(self.API_BASE, headers=headers, params=params)
                
                if response.status_code == 401:
                    self.logger.error("Token/cookies expirados! Atualize no .env")
                    return []
                
                if response.status_code == 400:
                    self.logger.error(f"HTTP 400 - Bad Request: {response.text[:200]}")
                    return []
                
                if response.status_code != 200:
                    self.logger.error(f"HTTP {response.status_code}: {response.text[:200]}")
                    return []
                
                data = response.json()
                return self._parse_response(data, date_str)
                
        except httpx.TimeoutException:
            self.logger.error("Request timeout")
            return []
        except Exception as e:
            self.logger.error(f"Erro na requisição: {e}")
            return []
    
    def _parse_response(self, data: Dict[str, Any], date_str: Optional[str]) -> List[ScrapedOdds]:
        """Parse API response into ScrapedOdds objects."""
        odds_list = []
        
        # Response uses "init" key, not "data"
        matches = data.get("init", [])
        if not matches:
            return []
        
        self.logger.info(f"Processando {len(matches)} eventos de {date_str or 'hoje'}")
        
        for match in matches:
            try:
                # Get league info from clName
                cl_name = match.get("clName", "").strip()
                
                # Map to standardized league name
                if cl_name in self.LEAGUE_MAPPING:
                    league_name = self.LEAGUE_MAPPING[cl_name]["name"]
                    league_country = self.LEAGUE_MAPPING[cl_name]["country"]
                else:
                    league_name = cl_name
                    league_country = "World"
                
                # Team names
                home_team = match.get("cthName", "Unknown")
                away_team = match.get("ctaName", "Unknown")
                
                # Match date
                match_date = self._parse_match_date(match.get("dg"))
                if not match_date:
                    continue
                
                # Get odds (BACK odds)
                try:
                    home_odds = float(match.get("wldHm", 0))
                    draw_odds = float(match.get("wldDm", 0))
                    away_odds = float(match.get("wldAm", 0))
                except (ValueError, TypeError):
                    continue
                
                # Skip if no valid odds
                if home_odds == 0:
                    continue
                
                # Build match URL
                event_id = match.get("ceId")
                match_url = f"https://tradeball.betbra.bet.br/dballEvent/{event_id}" if event_id else ""
                
                odds = ScrapedOdds(
                    bookmaker=self.name,
                    home_team=home_team,
                    away_team=away_team,
                    league=league_name,
                    country=league_country,
                    match_date=match_date,
                    home_odds=home_odds,
                    draw_odds=draw_odds,
                    away_odds=away_odds,
                    match_url=match_url,
                    sport_type="football",
                    market_type="1x2",
                    odds_type="back",
                    extra_data={
                        "tradeball_event_id": event_id,
                        "cl_id": match.get("clId"),
                        "cl_name": cl_name
                    }
                )
                odds_list.append(odds)
                
            except Exception as e:
                self.logger.debug(f"Erro parseando partida: {e}")
                continue
        
        return odds_list
    
    def _parse_match_date(self, date_value: Any) -> Optional[datetime]:
        """Parse match date from API response."""
        if not date_value:
            return None
        
        try:
            if isinstance(date_value, str):
                # Format: "2026-01-22 20:00:00"
                return datetime.strptime(date_value, "%Y-%m-%d %H:%M:%S")
            if isinstance(date_value, (int, float)):
                # Timestamp in milliseconds
                return datetime.fromtimestamp(date_value / 1000)
        except Exception:
            pass
        
        return None


# For testing
if __name__ == "__main__":
    import asyncio
    
    async def test():
        scraper = TradeballScraper()
        odds = await scraper.scrape_all()
        print(f"\nTotal coletado: {len(odds)}")
        if odds:
            print(f"Exemplo: [{odds[0].league}] {odds[0].home_team} x {odds[0].away_team} -> {odds[0].home_odds}")
    
    asyncio.run(test())

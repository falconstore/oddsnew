"""
Tradeball Scraper - Scrapes odds from Tradeball (Betbra Dball Exchange).

API: https://tradeball.betbra.bet.br/api/feedDball/list
Fetches today + next 3 days of matches.

## Configuration (só precisa disso no .env):

    TRADEBALL_AUTH_TOKEN=27464971|PMcTBXps5wUglSWpSs5sbZTAXueeKMJ8sNzy4uZP

Para pegar o token:
1. Abra o Tradeball no navegador e faça login
2. DevTools (F12) > Network > filtre "feedDball"
3. Copie o valor do header Authorization (sem o "Bearer ")

Note: VPS must have Brazilian IP or use a Brazilian proxy (site is geo-blocked).
"""

import json
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

import httpx
from loguru import logger

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig
from config import settings


class TradeballScraper(BaseScraper):
    """
    Scraper for Tradeball (Betbra Dball Exchange).
    Fetches today + next 3 days of matches.
    Uses direct HTTP requests with auth token - simple and fast.
    """
    
    # League mapping by clId from API
    LEAGUE_MAPPING = {
        # Brasil
        35: {"name": "Paulistão", "country": "Brazil"},
        4: {"name": "Brasileirão Série A", "country": "Brazil"},
        # Europa
        1: {"name": "Premier League", "country": "England"},
        2: {"name": "La Liga", "country": "Spain"},
        3: {"name": "Serie A", "country": "Italy"},
        5: {"name": "Bundesliga", "country": "Germany"},
        6: {"name": "Ligue 1", "country": "France"},
        7: {"name": "Liga Portugal", "country": "Portugal"},
        # Champions/Europa
        10: {"name": "Champions League", "country": "Europe"},
        11: {"name": "Europa League", "country": "Europe"},
    }
    
    API_BASE = "https://tradeball.betbra.bet.br/api/feedDball/list"
    
    def __init__(self):
        super().__init__(
            name="tradeball",
            base_url="https://tradeball.betbra.bet.br"
        )
        self._auth_token: Optional[str] = None
        self.logger = logger.bind(component="tradeball")
    
    async def setup(self):
        """Initialize scraper - just check for token."""
        self.logger.debug("Initializing Tradeball scraper...")
        
        if not settings.tradeball_auth_token:
            raise Exception(
                "TRADEBALL_AUTH_TOKEN não configurado no .env\n"
                "Para pegar o token:\n"
                "1. Abra o Tradeball no navegador e faça login\n"
                "2. DevTools (F12) > Network > filtre 'feedDball'\n"
                "3. Copie o valor do header Authorization (sem o 'Bearer ')"
            )
        
        self._auth_token = settings.tradeball_auth_token
        self.logger.info("Token configurado, pronto para scraping")
    
    async def teardown(self):
        """Nothing to clean up."""
        self.logger.info("Scraper finalizado")
    
    async def get_available_leagues(self) -> List[LeagueConfig]:
        """Return all configured leagues."""
        return [
            LeagueConfig(
                league_id=str(league_id),
                name=config["name"],
                url="",
                country=config["country"]
            )
            for league_id, config in self.LEAGUE_MAPPING.items()
        ]
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """Not used - scrape_all handles all leagues at once."""
        return []
    
    async def scrape_all(self) -> List[ScrapedOdds]:
        """Fetch today + next 3 days of matches."""
        all_odds = []
        today = datetime.now()
        
        try:
            await self.setup()
            
            # Day 1: Today (without date parameter, marketId=2)
            self.logger.info("Fetching today's matches...")
            today_odds = await self._fetch_day(None)
            all_odds.extend(today_odds)
            
            # Days 2-4: Next 3 days (with date parameter, marketId=3)
            for days_ahead in range(1, 4):
                target_date = today + timedelta(days=days_ahead)
                date_str = target_date.strftime("%Y-%m-%d")
                self.logger.info(f"Fetching matches for {date_str}...")
                day_odds = await self._fetch_day(date_str)
                all_odds.extend(day_odds)
            
            self.logger.info(f"Tradeball Total: {len(all_odds)} matches")
            
        except Exception as e:
            self.logger.error(f"Tradeball scraper error: {e}")
        finally:
            await self.teardown()
        
        return all_odds
    
    def _build_api_url(self, date_str: Optional[str] = None) -> str:
        """Build the API URL with proper filters."""
        import urllib.parse
        
        if date_str:
            # Future day: marketId=3, with date in filter
            filter_obj = {
                "line": 1,
                "periodTypeId": 1,
                "tradingTypeId": 2,
                "marketId": 3,
                "date": date_str
            }
        else:
            # Today: marketId=2, without date
            filter_obj = {
                "line": 1,
                "periodTypeId": 1,
                "tradingTypeId": 2,
                "marketId": 2
            }
        
        filter_json = json.dumps(filter_obj, separators=(',', ':'))
        filter_encoded = urllib.parse.quote(filter_json, safe='')
        app_id = str(uuid.uuid4())
        
        return (
            f"{self.API_BASE}?page=1"
            f"&filter={filter_encoded}"
            f"&start=0&limit=50"
            f"&sort=%5B%7B%22property%22:%22created_at%22,%22direction%22:%22desc%22%7D%5D"
            f"&requiredDictionaries%5B%5D=LeagueGroup"
            f"&requiredDictionaries%5B%5D=TimeZone"
            f"&init=true"
            f"&version=0"
            f"&uniqAppId={app_id}"
            f"&locale=pt"
        )
    
    async def _fetch_day(self, date_str: Optional[str] = None) -> List[ScrapedOdds]:
        """Fetch all matches for a specific day."""
        url = self._build_api_url(date_str)
        
        headers = {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "pt-BR,pt;q=0.9",
            "Authorization": f"Bearer {self._auth_token}",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": "https://tradeball.betbra.bet.br/dballTradingFeed",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=headers)
                
                if response.status_code == 401:
                    self.logger.error("Token expirado! Pegue um novo token no DevTools e atualize o .env")
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
            self.logger.error(f"Fetch error: {e}")
            return []
    
    def _parse_response(self, data: Dict[str, Any], date_str: Optional[str]) -> List[ScrapedOdds]:
        """Parse API response into ScrapedOdds objects."""
        odds_list = []
        
        matches = data.get("data", [])
        self.logger.info(f"API retornou {len(matches)} eventos para {date_str or 'today'}")
        
        if not matches:
            return []
        
        # Log clIds encontrados para descobrir mapeamentos faltantes
        cl_ids = set(m.get("clId") for m in matches)
        self.logger.info(f"clIds encontrados: {cl_ids}")
        
        for match in matches:
            try:
                # Get league info
                cl_id = match.get("clId")
                league_info = self.LEAGUE_MAPPING.get(cl_id)
                if not league_info:
                    self.logger.debug(f"Liga ignorada: clId={cl_id}, {match.get('ht')} vs {match.get('at')}")
                    continue  # Skip unknown leagues
                
                # Team names
                home_team = match.get("ht", "Unknown")
                away_team = match.get("at", "Unknown")
                
                # Match date
                match_date = self._parse_match_date(match.get("md"))
                if not match_date:
                    continue
                
                # Get odds (BACK odds only - this is an exchange)
                # rt = result type odds object
                rt = match.get("rt", {})
                
                # Home win (result 1)
                home_odds = None
                r1 = rt.get("1", {})
                if r1:
                    home_odds = r1.get("b")  # BACK odds
                
                # Draw (result X)
                draw_odds = None
                rx = rt.get("X", {})
                if rx:
                    draw_odds = rx.get("b")
                
                # Away win (result 2)
                away_odds = None
                r2 = rt.get("2", {})
                if r2:
                    away_odds = r2.get("b")
                
                # Skip if no valid odds
                if not home_odds and not draw_odds and not away_odds:
                    continue
                
                # Build match URL
                event_id = match.get("id")
                match_url = f"https://tradeball.betbra.bet.br/dballEvent/{event_id}" if event_id else None
                
                odds = ScrapedOdds(
                    bookmaker="tradeball",
                    home_team=home_team,
                    away_team=away_team,
                    league=league_info["name"],
                    country=league_info["country"],
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
                        "cl_id": cl_id
                    }
                )
                odds_list.append(odds)
                
            except Exception as e:
                self.logger.debug(f"Error parsing match: {e}")
                continue
        
        self.logger.info(f"Parsed {len(odds_list)} matches for {date_str or 'today'}")
        return odds_list
    
    def _parse_match_date(self, date_value: Any) -> Optional[datetime]:
        """Parse match date from API response."""
        if not date_value:
            return None
        
        try:
            if isinstance(date_value, (int, float)):
                # Timestamp in milliseconds
                return datetime.fromtimestamp(date_value / 1000)
            elif isinstance(date_value, str):
                # ISO format
                return datetime.fromisoformat(date_value.replace("Z", "+00:00"))
        except Exception:
            pass
        
        return None


# For testing
if __name__ == "__main__":
    import asyncio
    
    async def test():
        scraper = TradeballScraper()
        odds = await scraper.scrape_all()
        print(f"\nTotal: {len(odds)} matches")
        for o in odds[:5]:
            print(f"  {o.home_team} vs {o.away_team}: {o.home_odds}/{o.draw_odds}/{o.away_odds}")
    
    asyncio.run(test())

"""
Novibet Unified Scraper - Football and NBA Basketball.
Uses curl_cffi for browser impersonation to bypass WAF.

Sport IDs:
- Football: 4324
- Basketball: 4324 (same sport category, different competitions)
"""

import asyncio
from datetime import datetime
from typing import List, Optional, Dict, Any
from loguru import logger
from curl_cffi.requests import AsyncSession

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


class NovibetScraper(BaseScraper):
    """
    Unified scraper for Novibet Brasil.
    Handles both Football (1X2 SO/PA) and Basketball (Moneyline SO/PA).
    """
    
    API_BASE = "https://www.novibet.bet.br/spt/feed/marketviews/location/v2"
    
    # Sport IDs
    SPORT_FOOTBALL = "4324"
    SPORT_BASKETBALL = "4324"  # Same sport category, different competitions
    
    # Market type tags
    TAG_SUPER_ODDS = "ODDS_KEY_0"
    TAG_EARLY_PAYOUT_FOOTBALL = "SOCCER_2_GOALS_AHEAD_EARLY_PAYOUT"
    TAG_EARLY_PAYOUT_BASKETBALL = "BASKETBALL_20_PLUS_POINTS_EARLY_PAYOUT"
    
    # Football leagues
    FOOTBALL_LEAGUES = {
        "premier_league": {
            "competition_id": "5909300",
            "name": "Premier League",
            "country": "Inglaterra"
        },
        "la_liga": {"competition_id": "5910661", "name": "La Liga", "country": "Espanha"},
        "serie_a": {"competition_id": "5910485", "name": "Serie A", "country": "Italia"},
        "bundesliga": {"competition_id": "5910745", "name": "Bundesliga", "country": "Alemanha"},
        "ligue_1": {"competition_id": "5910637", "name": "Ligue 1", "country": "Franca"},
        "paulistao": {"competition_id": "4381204", "name": "Paulistao A1", "country": "Brasil"},
        "fa_cup": {"competition_id": "4373638", "name": "FA Cup", "country": "Inglaterra"},
        "efl_cup": {"competition_id": "4373738", "name": "EFL Cup", "country": "Inglaterra"},
        "copa_do_rei": {"competition_id": "4375979", "name": "Copa do Rei", "country": "Espanha"},
        "champions_league": {"competition_id": "6508093", "name": "Champions League", "country": "Europa"},
        "liga_europa": {"competition_id": "6505458", "name": "Liga Europa", "country": "Europa"},
        "liga_da_conferencia": {"competition_id": "6505560", "name": "Liga da Conferencia", "country": "Europa"},
        "eredivisie": {"competition_id": "5910927", "name": "Eredivisie", "country": "Holanda"},
    }
    
    # Basketball leagues
    BASKETBALL_LEAGUES = {
        "nba": {
            "competition_id": "6680221",
            "name": "NBA",
            "country": "USA"
        }
    }
    
    # Compatibility alias
    LEAGUES = FOOTBALL_LEAGUES
    
    def __init__(self):
        super().__init__(name="novibet", base_url="https://www.novibet.bet.br")
        self.session: Optional[AsyncSession] = None
        self.logger = logger.bind(component="novibet")
    
    async def setup(self):
        """Initialize curl_cffi session with browser impersonation."""
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
            # Critical Novibet headers
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

        self.session = AsyncSession(
            impersonate="chrome124",
            headers=headers,
            timeout=30.0
        )
        
        # Warm-up request for cookies
        try:
            await self.session.get("https://www.novibet.bet.br/")
        except Exception:
            pass

        self.logger.info("[Novibet] Scraper inicializado (curl_cffi)")
    
    async def teardown(self):
        """Close curl_cffi session."""
        if self.session:
            await self.session.close()
            self.session = None
        self.logger.info("[Novibet] Sessao encerrada")

    async def get_available_leagues(self) -> List[LeagueConfig]:
        """Return list of configured football leagues (for compatibility)."""
        leagues = []
        for key, data in self.FOOTBALL_LEAGUES.items():
            url = f"{self.API_BASE}/{self.SPORT_FOOTBALL}/{data['competition_id']}/"
            config = LeagueConfig(
                league_id=key,
                name=data["name"],
                url=url,
                country=data["country"]
            )
            leagues.append(config)
        return leagues

    async def scrape_all(self) -> List[ScrapedOdds]:
        """Scrape all sports using shared curl_cffi session."""
        all_odds = []
        await self.setup()
        
        try:
            # Football leagues (1X2 SO/PA)
            for league_id, config in self.FOOTBALL_LEAGUES.items():
                odds = await self._scrape_football(league_id, config)
                all_odds.extend(odds)
            
            # Basketball leagues (Moneyline SO/PA)
            for league_id, config in self.BASKETBALL_LEAGUES.items():
                odds = await self._scrape_basketball(league_id, config)
                all_odds.extend(odds)
            
            self.logger.info(f"[Novibet] Total: {len(all_odds)} odds coletadas")
            
        finally:
            await self.teardown()
        
        return all_odds
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """Scrape odds for a specific football league (compatibility method)."""
        if not self.session:
            await self.setup()
        
        league_config = self.FOOTBALL_LEAGUES.get(league.league_id)
        if not league_config:
            return []
        
        return await self._scrape_football(league.league_id, league_config)

    async def _fetch_competition(self, sport_id: str, competition_id: str) -> Optional[List[Dict]]:
        """Fetch data from Novibet API for a competition."""
        timestamp = int(datetime.now().timestamp() * 1000000)
        url = f"{self.API_BASE}/{sport_id}/{competition_id}/"
        
        params = {
            "lang": "pt-BR",
            "timeZ": "E. South America Standard Time",
            "oddsR": "1",
            "usrGrp": "BR",
            "timestamp": str(timestamp)
        }
        
        try:
            response = await self.session.get(url, params=params)
            
            if response.status_code == 622:
                self.logger.debug(f"[Novibet] Erro 622: competition {competition_id} vazia")
                return None
            if response.status_code == 403:
                self.logger.error(f"[Novibet] Erro 403: WAF block")
                return None

            response.raise_for_status()
            return response.json()
            
        except Exception as e:
            self.logger.error(f"[Novibet] Erro fetch {competition_id}: {e}")
            return None

    async def _scrape_football(self, league_id: str, config: Dict[str, Any]) -> List[ScrapedOdds]:
        """Scrape football odds (1X2 with SO/PA)."""
        competition_id = config["competition_id"]
        league_name = config["name"]
        
        data = await self._fetch_competition(self.SPORT_FOOTBALL, competition_id)
        if not data:
            return []
        
        return self._parse_football_response(data, league_name)

    async def _scrape_basketball(self, league_id: str, config: Dict[str, Any]) -> List[ScrapedOdds]:
        """Scrape basketball odds (Moneyline with SO/PA)."""
        competition_id = config["competition_id"]
        league_name = config["name"]
        
        data = await self._fetch_competition(self.SPORT_BASKETBALL, competition_id)
        if not data:
            return []
        
        return self._parse_basketball_response(data, league_name)

    def _parse_football_response(self, data: List[Dict[str, Any]], league_name: str) -> List[ScrapedOdds]:
        """Parse football API response (1X2 with SO/PA identification)."""
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
                
                # Filter virtual/esports
                if "SRL" in home or "Esports" in home:
                    continue
                if item.get("isLive", False):
                    continue

                # Build tag map: marketId -> tag
                market_tags = item.get("marketTags", [])
                tag_map = {t["marketId"]: t["tag"] for t in market_tags}

                markets = item.get("markets", [])
                odds_by_type = {}
                
                for market in markets:
                    if market.get("betTypeSysname") != "SOCCER_MATCH_RESULT":
                        continue
                    
                    market_id = market.get("marketId")
                    tag = tag_map.get(market_id, "")
                    
                    # Identify odds type by tag
                    if tag == self.TAG_SUPER_ODDS:
                        odds_type = "SO"
                    elif tag == self.TAG_EARLY_PAYOUT_FOOTBALL:
                        odds_type = "PA"
                    else:
                        odds_type = "PA"  # Default
                    
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

                # Parse date
                try:
                    dt = datetime.fromisoformat(item.get("startDate").replace("Z", "+00:00"))
                except:
                    dt = datetime.now()

                # Create ScrapedOdds for each type found
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
                self.logger.debug(f"[Novibet] Erro processando item: {e}")
                continue
        
        so_count = len([r for r in results if r.odds_type == "SO"])
        pa_count = len([r for r in results if r.odds_type == "PA"])
        self.logger.info(f"[Novibet] {league_name}: {so_count} SO + {pa_count} PA = {len(results)} total")
        
        return results

    def _parse_basketball_response(self, data: List[Dict[str, Any]], league_name: str) -> List[ScrapedOdds]:
        """Parse basketball API response (Moneyline with SO/PA identification)."""
        results = []
        if not data:
            return results
        
        bet_views = data[0].get("betViews", [])
        if not bet_views:
            return results
        
        items = bet_views[0].get("items", [])
        self.logger.debug(f"[Novibet NBA] Encontrados {len(items)} eventos")
        
        for item in items:
            try:
                captions = item.get("additionalCaptions", {})
                home = captions.get("competitor1")
                away = captions.get("competitor2")
                
                if not home or not away:
                    continue
                
                if item.get("isLive", False):
                    continue

                # Build tag map
                market_tags = item.get("marketTags", [])
                tag_map = {t["marketId"]: t["tag"] for t in market_tags}

                markets = item.get("markets", [])
                odds_by_type = {}
                
                for market in markets:
                    # Basketball moneyline market
                    if market.get("betTypeSysname") != "BASKETBALL_MATCH_RESULT_NODRAW":
                        continue
                    
                    market_id = market.get("marketId")
                    tag = tag_map.get(market_id, "")
                    
                    # Identify odds type by tag
                    if tag == self.TAG_SUPER_ODDS:
                        odds_type = "SO"
                    elif tag == self.TAG_EARLY_PAYOUT_BASKETBALL:
                        odds_type = "PA"
                    else:
                        odds_type = "PA"  # Default
                    
                    home_odd, away_odd = 0.0, 0.0
                    for bet in market.get("betItems", []):
                        if not bet.get("isAvailable", True):
                            continue
                        price = float(bet.get("price", 0))
                        code = bet.get("code")
                        
                        if code == "1":
                            home_odd = price
                        elif code == "2":
                            away_odd = price
                    
                    if home_odd > 1.0 and away_odd > 1.0:
                        odds_by_type[odds_type] = {
                            "home": home_odd,
                            "away": away_odd
                        }

                # Parse date
                try:
                    dt = datetime.fromisoformat(item.get("startDate").replace("Z", "+00:00"))
                except:
                    dt = datetime.now()

                # Create ScrapedOdds for each type found
                for odds_type, odds in odds_by_type.items():
                    scraped = ScrapedOdds(
                        bookmaker_name="novibet",
                        home_team_raw=home,
                        away_team_raw=away,
                        league_raw=league_name,
                        match_date=dt,
                        home_odd=odds["home"],
                        draw_odd=None,  # No draw in basketball
                        away_odd=odds["away"],
                        sport="basketball",
                        market_type="moneyline",
                        odds_type=odds_type,
                        extra_data={"event_id": str(item.get("eventBetContextId"))}
                    )
                    results.append(scraped)

            except Exception as e:
                self.logger.debug(f"[Novibet NBA] Erro processando evento: {e}")
                continue
        
        so_count = len([r for r in results if r.odds_type == "SO"])
        pa_count = len([r for r in results if r.odds_type == "PA"])
        self.logger.info(f"[Novibet NBA] {league_name}: {so_count} SO + {pa_count} PA = {len(results)} total")
        
        return results


# Direct test
if __name__ == "__main__":
    async def test():
        scraper = NovibetScraper()
        import time
        start = time.time()
        
        odds = await scraper.scrape_all()
        
        elapsed = time.time() - start
        print(f"\n--- Resultado: {len(odds)} odds em {elapsed:.2f}s ---")
        
        football = [o for o in odds if o.sport != "basketball"]
        basketball = [o for o in odds if o.sport == "basketball"]
        
        print(f"Futebol: {len(football)} jogos")
        print(f"Basquete: {len(basketball)} jogos")
        
        for o in basketball[:5]:
            print(f"  {o.home_team_raw} vs {o.away_team_raw} | {o.odds_type} | H:{o.home_odd} A:{o.away_odd}")
    
    asyncio.run(test())

"""
Novibet NBA Scraper - Basketball odds with SO/PA market types.

Collects Moneyline (Vencedor do Jogo) odds for NBA games.
Identifies Super Odds (SO) via ODDS_KEY_0 tag and 
Early Payout (PA) via BASKETBALL_20_PLUS_POINTS_EARLY_PAYOUT tag.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any

from loguru import logger
from curl_cffi.requests import AsyncSession

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


class NovibetNBAScraper(BaseScraper):
    API_BASE = "https://www.novibet.bet.br/spt/feed/marketviews/location/v2"
    SPORT_ID = "4324"  # Basketball
    
    # NBA competition ID from user's curl
    LEAGUES = {
        "nba": {
            "competition_id": "6680221",
            "name": "NBA",
            "country": "USA"
        }
    }
    
    # Tags for identifying market types
    TAG_SUPER_ODDS = "ODDS_KEY_0"  # SO - Super Odds
    TAG_EARLY_PAYOUT = "BASKETBALL_20_PLUS_POINTS_EARLY_PAYOUT"  # PA - 20+ pts = Green
    
    def __init__(self):
        super().__init__(name="novibet_nba", base_url="https://www.novibet.bet.br")
        self.session: Optional[AsyncSession] = None
        self.logger = logger.bind(component="novibet_nba")
    
    async def setup(self):
        headers = {
            "authority": "www.novibet.bet.br",
            "accept": "application/json, text/plain, */*",
            "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
            "referer": "https://www.novibet.bet.br/apostas-esportivas/popular/4795953/nba/nba/6680136",
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
        
        # Warm-up request to generate cookies
        try:
            await self.session.get("https://www.novibet.bet.br/")
        except Exception:
            pass

        self.logger.info("[Novibet NBA] Scraper initialized")
    
    async def teardown(self):
        if self.session:
            await self.session.close()
            self.session = None
        self.logger.info("[Novibet NBA] Scraper shutdown")

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
                self.logger.warning(f"[Novibet NBA] Error 622: Competition {competition_id} invalid/empty")
                return []
            if response.status_code == 403:
                self.logger.error(f"[Novibet NBA] Error 403: WAF block or expired cookies")
                return []

            response.raise_for_status()
            data = response.json()
            
            return self._parse_response(data, league.name)
            
        except Exception as e:
            self.logger.error(f"[Novibet NBA] Error scraping {league.name}: {e}")
            return []

    def _parse_response(self, data: List[Dict[str, Any]], league_name: str) -> List[ScrapedOdds]:
        results = []
        if not data:
            return results
        
        bet_views = data[0].get("betViews", [])
        if not bet_views:
            return results
        
        items = bet_views[0].get("items", [])
        self.logger.debug(f"[Novibet NBA] Found {len(items)} events")
        
        for item in items:
            try:
                # Extract team names
                captions = item.get("additionalCaptions", {})
                home = captions.get("competitor1")
                away = captions.get("competitor2")
                
                if not home or not away:
                    continue
                
                # Skip live matches
                if item.get("isLive", False):
                    continue

                # Build tag map: marketId -> tag
                market_tags = item.get("marketTags", [])
                tag_map = {t["marketId"]: t["tag"] for t in market_tags}

                markets = item.get("markets", [])
                odds_by_type = {}  # {"SO": {...}, "PA": {...}}
                
                for market in markets:
                    # Basketball moneyline market
                    if market.get("betTypeSysname") != "BASKETBALL_MATCH_RESULT_NODRAW":
                        continue
                    
                    market_id = market.get("marketId")
                    tag = tag_map.get(market_id, "")
                    
                    # Identify odds_type based on tag
                    if tag == self.TAG_SUPER_ODDS:
                        odds_type = "SO"
                    elif tag == self.TAG_EARLY_PAYOUT:
                        odds_type = "PA"
                    else:
                        # Unknown tag = default to PA (standard market)
                        if tag:
                            self.logger.debug(f"[Novibet NBA] Unknown tag: {tag} - using PA")
                        odds_type = "PA"
                    
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
                        draw_odd=None,  # Basketball has no draw
                        away_odd=odds["away"],
                        sport="basketball",
                        market_type="moneyline",
                        odds_type=odds_type,
                        extra_data={"event_id": str(item.get("eventBetContextId"))}
                    )
                    results.append(scraped)

            except Exception as e:
                self.logger.debug(f"[Novibet NBA] Error processing event: {e}")
                continue
        
        so_count = len([r for r in results if r.odds_type == "SO"])
        pa_count = len([r for r in results if r.odds_type == "PA"])
        self.logger.info(f"[Novibet NBA] {league_name}: {so_count} SO + {pa_count} PA = {len(results)} total")
        
        return results


# Direct testing
if __name__ == "__main__":
    import asyncio
    
    async def test():
        scraper = NovibetNBAScraper()
        await scraper.setup()
        try:
            leagues = await scraper.get_available_leagues()
            for league in leagues:
                odds = await scraper.scrape_league(league)
                print(f"\n{league.name}: {len(odds)} odds")
                for o in odds[:5]:
                    print(f"  {o.home_team_raw} vs {o.away_team_raw} | {o.odds_type} | H:{o.home_odd} A:{o.away_odd}")
        finally:
            await scraper.teardown()
    
    asyncio.run(test())

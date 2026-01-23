"""
KTO Unified Scraper - Football (SO + PA) and Basketball (Moneyline).
Uses Kambi API with odds divided by 1000.
"""

import httpx
from datetime import datetime
from typing import List, Optional, Dict, Any
from loguru import logger
from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


class KtoScraper(BaseScraper):
    """
    Unified scraper for KTO Brazil - Football and Basketball.
    Uses Kambi API with odds divided by 1000.
    """
    
    API_BASE = "https://us1.offering-api.kambicdn.com/offering/v2018/ktobr/listView"
    
    # Criterion IDs by market
    SO_CRITERION_ID = 1001159858       # Resultado Final (Football Super Odds)
    PA_CRITERION_ID = 2100089307       # Full Time - 2UP (Football Early Payout)
    MONEYLINE_CRITERION_ID = 1001159732  # Vencedor da partida (Basketball)
    
    # Category ID for PA
    PA_CATEGORY_ID = "10028163"
    
    # Football Leagues
    FOOTBALL_LEAGUES = {
        "serie_a": {"path": "football/italy/serie_a", "name": "Serie A", "country": "Itália"},
        "premier_league": {"path": "football/england/premier_league", "name": "Premier League", "country": "Inglaterra"},
        "la_liga": {"path": "football/spain/la_liga", "name": "La Liga", "country": "Espanha"},
        "bundesliga": {"path": "football/germany/bundesliga", "name": "Bundesliga", "country": "Alemanha"},
        "ligue_1": {"path": "football/france/ligue_1", "name": "Ligue 1", "country": "Franca"},
        "paulista": {"path": "football/brazil/paulista_a1", "name": "Paulistao A1", "country": "Brasil"},
        "efl_cup": {"path": "football/england/efl_cup", "name": "EFL Cup", "country": "Inglaterra"},
        "copa_do_rei": {"path": "football/spain/copa_del_rey", "name": "Copa do rei", "country": "Espanha"},
        "champions_league": {"path": "football/champions_league/all", "name": "Champions League", "country": "Europa"},
        "liga_europa": {"path": "football/europa_league/all", "name": "Liga Europa", "country": "Europa"},
        "eredivisie": {"path": "football/netherlands/eredivisie", "name": "Eredivisie", "country": "Holanda"},
    }
    
    # Basketball Leagues
    BASKETBALL_LEAGUES = {
        "nba": {"path": "basketball/nba", "name": "NBA", "country": "EUA"},
    }
    
    def __init__(self):
        super().__init__(name="kto", base_url="https://www.kto.com")
        self.client: Optional[httpx.AsyncClient] = None
        self.logger = logger.bind(component="kto")
    
    async def setup(self):
        """Initialize HTTP client."""
        self.logger.info("[KTO] Iniciando sessao HTTP...")
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "accept": "*/*",
                "origin": "https://www.kto.bet.br",
                "referer": "https://www.kto.bet.br/",
                "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
            }
        )
    
    async def teardown(self):
        """Close HTTP client."""
        if self.client:
            await self.client.aclose()
            self.client = None

    async def get_available_leagues(self) -> List[LeagueConfig]:
        """Return list of configured leagues (football + basketball)."""
        leagues = []
        for k, v in self.FOOTBALL_LEAGUES.items():
            leagues.append(LeagueConfig(league_id=k, name=v["name"], url=v["path"], country=v["country"]))
        for k, v in self.BASKETBALL_LEAGUES.items():
            leagues.append(LeagueConfig(league_id=k, name=v["name"], url=v["path"], country=v["country"]))
        return leagues
    
    async def scrape_all(self) -> List[ScrapedOdds]:
        """Scrape all leagues for both sports using a single HTTP session."""
        all_odds = []
        await self.setup()
        
        try:
            # Football (SO + PA)
            for league_id, config in self.FOOTBALL_LEAGUES.items():
                try:
                    odds = await self._scrape_football(league_id, config)
                    all_odds.extend(odds)
                except Exception as e:
                    self.logger.error(f"[KTO] Erro na liga {config['name']}: {e}")
            
            # Basketball (Moneyline only)
            for league_id, config in self.BASKETBALL_LEAGUES.items():
                try:
                    odds = await self._scrape_basketball(league_id, config)
                    all_odds.extend(odds)
                except Exception as e:
                    self.logger.error(f"[KTO] Erro na liga {config['name']}: {e}")
                    
        finally:
            await self.teardown()
        
        self.logger.info(f"[KTO] Total: {len(all_odds)} odds coletadas")
        return all_odds
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """Legacy method for compatibility with base scraper."""
        if not self.client:
            await self.setup()
        
        # Check if it's a basketball league
        if league.league_id in self.BASKETBALL_LEAGUES:
            config = self.BASKETBALL_LEAGUES[league.league_id]
            return await self._scrape_basketball(league.league_id, config)
        
        # Otherwise it's football
        if league.league_id in self.FOOTBALL_LEAGUES:
            config = self.FOOTBALL_LEAGUES[league.league_id]
            return await self._scrape_football(league.league_id, config)
        
        return []

    async def _scrape_football(self, league_id: str, config: dict) -> List[ScrapedOdds]:
        """Scrape SO and PA odds for a football league."""
        results = []
        path = config["path"]
        league_name = config["name"]
        
        # SO (Super Odds)
        so_results = await self._fetch_odds(path, league_name, "SO", None, "football")
        results.extend(so_results)
        
        # PA (Pagamento Antecipado)
        pa_results = await self._fetch_odds(path, league_name, "PA", self.PA_CATEGORY_ID, "football")
        results.extend(pa_results)
        
        so_count = len([r for r in results if r.odds_type == "SO"])
        pa_count = len([r for r in results if r.odds_type == "PA"])
        self.logger.info(f"[KTO] {league_name}: {so_count} SO + {pa_count} PA = {len(results)} total")
        
        return results
    
    async def _scrape_basketball(self, league_id: str, config: dict) -> List[ScrapedOdds]:
        """Scrape Moneyline odds for a basketball league."""
        path = config["path"]
        league_name = config["name"]
        
        url = f"{self.API_BASE}/{path}/all/all/matches.json"
        params = {
            "channel_id": "1",
            "client_id": "200",
            "lang": "pt_BR",
            "market": "BR",
            "useCombined": "true",
            "useCombinedLive": "true"
        }
        
        self.logger.info(f"[KTO] Buscando {league_name} (Moneyline)...")
        
        try:
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            return self._parse_basketball_response(data, league_name)
        except httpx.HTTPStatusError as e:
            self.logger.error(f"[KTO] Erro HTTP ({league_name}): {e.response.status_code}")
            return []
        except Exception as e:
            self.logger.error(f"[KTO] Erro ({league_name}): {e}")
            return []

    async def _fetch_odds(self, path: str, league_name: str, odds_type: str, 
                          category: Optional[str], sport: str) -> List[ScrapedOdds]:
        """Fetch odds from Kambi API for a specific market type."""
        url = f"{self.API_BASE}/{path}/all/matches.json"
        params = {
            "channel_id": "1",
            "client_id": "200",
            "lang": "pt_BR",
            "market": "BR",
            "useCombined": "true"
        }
        
        if category:
            params["category"] = category
        
        self.logger.debug(f"[KTO] Buscando {odds_type}: {league_name}...")
        
        try:
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            return self._parse_football_response(data, league_name, path, odds_type)
        except httpx.HTTPStatusError as e:
            self.logger.error(f"[KTO] Erro HTTP ({league_name}/{odds_type}): {e.response.status_code}")
            return []
        except Exception as e:
            self.logger.error(f"[KTO] Erro ({league_name}/{odds_type}): {e}")
            return []

    def _parse_football_response(self, data: Dict[str, Any], league_name: str, 
                                  league_path: str, odds_type: str) -> List[ScrapedOdds]:
        """Parse Kambi API response for football (1X2)."""
        results = []
        events_list = data.get("events", [])
        
        # Critérios válidos por tipo
        if odds_type == "SO":
            valid_criteria = {self.SO_CRITERION_ID}
        else:  # PA
            valid_criteria = {self.PA_CRITERION_ID}
        
        for item in events_list:
            try:
                event = item.get("event", {})
                bet_offers = item.get("betOffers", [])
                
                if not event or not bet_offers:
                    continue
                
                event_id = event.get("id")
                home_team = event.get("homeName")
                away_team = event.get("awayName")
                
                if not home_team or not away_team:
                    event_name = event.get("name", "")
                    if " - " in event_name:
                        home_team, away_team = event_name.split(" - ")
                    else:
                        continue

                # Parse date
                try:
                    dt = datetime.fromisoformat(event.get("start", "").replace("Z", "+00:00"))
                except:
                    dt = datetime.now()

                # Find the correct market
                match_offer = None
                for offer in bet_offers:
                    criteria = offer.get("criterion", {})
                    criteria_id = criteria.get("id")
                    if criteria_id in valid_criteria:
                        match_offer = offer
                        break
                
                if not match_offer:
                    continue
                
                # Extract odds (divide by 1000)
                outcomes = match_offer.get("outcomes", [])
                raw_odds = {}
                
                for out in outcomes:
                    label = out.get("label")
                    out_type = out.get("type")
                    odds_int = out.get("odds")
                    
                    if not odds_int:
                        continue
                    
                    decimal_odd = odds_int / 1000.0
                    
                    if label == "1" or out_type == "OT_ONE":
                        raw_odds['home'] = decimal_odd
                    elif label == "X" or out_type == "OT_CROSS":
                        raw_odds['draw'] = decimal_odd
                    elif label == "2" or out_type == "OT_TWO":
                        raw_odds['away'] = decimal_odd
                
                if len(raw_odds) == 3:
                    scraped = ScrapedOdds(
                        bookmaker_name="kto",
                        home_team_raw=home_team.strip(),
                        away_team_raw=away_team.strip(),
                        league_raw=league_name,
                        match_date=dt,
                        home_odd=raw_odds['home'],
                        draw_odd=raw_odds['draw'],
                        away_odd=raw_odds['away'],
                        market_type="1x2",
                        odds_type=odds_type,
                        extra_data={
                            "event_id": str(event_id),
                            "kambi_offer_id": str(match_offer.get("id")),
                            "league_path": league_path,
                            "home_team_slug": home_team.strip(),
                            "away_team_slug": away_team.strip()
                        }
                    )
                    results.append(scraped)
                    
            except Exception as e:
                continue
        
        return results

    def _parse_basketball_response(self, data: Dict[str, Any], league_name: str) -> List[ScrapedOdds]:
        """Parse Kambi API response for basketball (Moneyline)."""
        results = []
        events_list = data.get("events", [])
        
        for item in events_list:
            try:
                event = item.get("event", {})
                bet_offers = item.get("betOffers", [])
                
                if not event or not bet_offers:
                    continue
                
                event_id = event.get("id")
                home_team = event.get("homeName")
                away_team = event.get("awayName")
                
                if not home_team or not away_team:
                    event_name = event.get("name", "")
                    if " - " in event_name:
                        parts = event_name.split(" - ")
                        home_team = parts[0].strip()
                        away_team = parts[1].strip()
                    else:
                        continue

                # Parse date
                try:
                    dt = datetime.fromisoformat(event.get("start", "").replace("Z", "+00:00"))
                except:
                    dt = datetime.now()

                # Find Moneyline market
                match_offer = None
                for offer in bet_offers:
                    criterion = offer.get("criterion", {})
                    if criterion.get("id") == self.MONEYLINE_CRITERION_ID:
                        match_offer = offer
                        break
                
                if not match_offer:
                    continue
                
                # Extract odds (divide by 1000)
                outcomes = match_offer.get("outcomes", [])
                home_odd = None
                away_odd = None
                
                for out in outcomes:
                    out_type = out.get("type")
                    odds_int = out.get("odds")
                    
                    if not odds_int:
                        continue
                    
                    decimal_odd = odds_int / 1000.0
                    
                    if out_type == "OT_ONE":
                        home_odd = decimal_odd
                    elif out_type == "OT_TWO":
                        away_odd = decimal_odd
                
                if home_odd and away_odd:
                    # Generate slugs for deep links
                    home_slug = home_team.strip().lower().replace(" ", "-")
                    away_slug = away_team.strip().lower().replace(" ", "-")
                    
                    scraped = ScrapedOdds(
                        bookmaker_name="kto",
                        home_team_raw=home_team.strip(),
                        away_team_raw=away_team.strip(),
                        league_raw=league_name,
                        match_date=dt,
                        home_odd=home_odd,
                        draw_odd=None,  # No draw in basketball
                        away_odd=away_odd,
                        sport="basketball",
                        market_type="moneyline",
                        extra_data={
                            "event_id": str(event_id),
                            "kambi_offer_id": str(match_offer.get("id")),
                            "sport_type": "basketball",
                            "home_team_slug": home_slug,
                            "away_team_slug": away_slug
                        }
                    )
                    results.append(scraped)
                    
            except Exception as e:
                self.logger.debug(f"[KTO] Erro ao processar evento NBA: {e}")
                continue
        
        self.logger.info(f"[KTO] {league_name} (Moneyline): {len(results)} jogos coletados")
        return results


# Test
if __name__ == "__main__":
    import asyncio

    async def run():
        s = KtoScraper()
        odds = await s.scrape_all()
        
        print(f"\n--- Resultado ({len(odds)} odds) ---")
        
        # Football
        football = [o for o in odds if o.sport == "football"]
        print(f"\nFutebol: {len(football)} odds")
        for o in football[:3]:
            print(f"  {o.home_team_raw} x {o.away_team_raw} ({o.odds_type})")
            print(f"    Odds: {o.home_odd:.2f} - {o.draw_odd:.2f} - {o.away_odd:.2f}")
        
        # Basketball
        basketball = [o for o in odds if o.sport == "basketball"]
        print(f"\nBasquete: {len(basketball)} odds")
        for o in basketball[:3]:
            print(f"  {o.home_team_raw} x {o.away_team_raw}")
            print(f"    Odds: {o.home_odd:.2f} - {o.away_odd:.2f}")
            
    asyncio.run(run())

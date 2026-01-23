"""
Stake Unified Scraper - Football (SO + PA) and Basketball (Moneyline).
Uses Stake API with individual event requests for PA and NBA.
"""

import asyncio
import httpx
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from loguru import logger
from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


class StakeScraper(BaseScraper):
    """
    Unified scraper for Stake.bet.br - Football and Basketball.
    Football: Super Odds (batch) + Pagamento Antecipado (individual requests)
    Basketball: Moneyline (individual requests)
    """
    
    API_BASE = "https://sbweb.stake.bet.br/api/v1/br/pt-br"
    
    # Market IDs
    MARKET_SO = "1001159858"          # Super Odds (Football)
    MARKET_PA = "2100089307_0"        # Pagamento Antecipado (Football)
    MARKET_MONEYLINE = "1001159732"   # Moneyline (Basketball)
    
    # Football Leagues
    FOOTBALL_LEAGUES = {
        "premier_league": {"tournament_id": "1000094985", "name": "Premier League", "country": "Inglaterra"},
        "serie_a": {"tournament_id": "1000095001", "name": "Serie A", "country": "Italia"},
        "la_liga": {"tournament_id": "1000095049", "name": "La Liga", "country": "Espanha"},
        "bundesliga": {"tournament_id": "1000094994", "name": "Bundesliga", "country": "Alemanha"},
        "ligue_1": {"tournament_id": "1000094991", "name": "Ligue 1", "country": "França"},
        "paulistao": {"tournament_id": "1000094970", "name": "Paulistao", "country": "Brasil"},
        "fa_cup": {"tournament_id": "1000094984", "name": "FA Cup", "country": "Inglaterra"},
        "efl_cup": {"tournament_id": "1000094986", "name": "EFL Cup", "country": "Inglaterra"},
        "copa_do_rei": {"tournament_id": "1000095050", "name": "Copa do Rei", "country": "Espanha"},
        "champions_league": {"tournament_id": "1000093381", "name": "Champions League", "country": "Europa"},
        "liga_europa": {"tournament_id": "2000051195", "name": "Liga Europa", "country": "Europa"},
        "liga_da_conferencia": {"tournament_id": "2000130522", "name": "Liga da Conferencia", "country": "Europa"},
        "eredivisie": {"tournament_id": "1000094980", "name": "Eredivisie", "country": "Holanda"},
    }
    
    # Basketball Leagues
    BASKETBALL_LEAGUES = {
        "nba": {"tournament_id": "1000093652", "name": "NBA", "country": "EUA"},
    }
    
    def __init__(self):
        super().__init__(name="stake", base_url="https://stake.bet.br")
        self.client: Optional[httpx.AsyncClient] = None
        self.logger = logger.bind(component="stake")
    
    async def setup(self):
        """Initialize HTTP client."""
        self.logger.info("[Stake] Iniciando sessao HTTP...")
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "Accept": "application/json",
                "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
                "Referer": "https://stake.bet.br/",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
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
            leagues.append(LeagueConfig(
                league_id=k, 
                name=v["name"], 
                url=f"{self.API_BASE}/tournament/{v['tournament_id']}/live-upcoming",
                country=v["country"]
            ))
        for k, v in self.BASKETBALL_LEAGUES.items():
            leagues.append(LeagueConfig(
                league_id=k, 
                name=v["name"], 
                url=f"{self.API_BASE}/tournament/{v['tournament_id']}/live-upcoming",
                country=v["country"]
            ))
        return leagues
    
    async def scrape_all(self) -> List[ScrapedOdds]:
        """Scrape all leagues for both sports using a single HTTP session."""
        all_odds = []
        await self.setup()
        
        try:
            # Football (SO + PA)
            for league_id, config in self.FOOTBALL_LEAGUES.items():
                try:
                    odds = await self._scrape_football(config)
                    all_odds.extend(odds)
                except Exception as e:
                    self.logger.error(f"[Stake] Erro na liga {config['name']}: {e}")
            
            # Basketball (Moneyline)
            for league_id, config in self.BASKETBALL_LEAGUES.items():
                try:
                    odds = await self._scrape_basketball(config)
                    all_odds.extend(odds)
                except Exception as e:
                    self.logger.error(f"[Stake] Erro na liga {config['name']}: {e}")
                    
        finally:
            await self.teardown()
        
        self.logger.info(f"[Stake] Total: {len(all_odds)} odds coletadas")
        return all_odds
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """Legacy method for compatibility with base scraper."""
        if not self.client:
            await self.setup()
        
        # Check if it's a basketball league
        if league.league_id in self.BASKETBALL_LEAGUES:
            config = self.BASKETBALL_LEAGUES[league.league_id]
            return await self._scrape_basketball(config)
        
        # Otherwise it's football
        if league.league_id in self.FOOTBALL_LEAGUES:
            config = self.FOOTBALL_LEAGUES[league.league_id]
            return await self._scrape_football(config)
        
        return []

    async def _scrape_football(self, config: dict) -> List[ScrapedOdds]:
        """Scrape SO and PA odds for a football league."""
        league_name = config["name"]
        tournament_id = config["tournament_id"]
        
        # Fetch events
        events = await self._fetch_events(tournament_id)
        if not events:
            return []
        
        event_ids = [str(e["id"]) for e in events]
        
        # Fetch SO odds (batch request)
        so_odds_data = await self._fetch_so_odds(event_ids)
        
        # Fetch PA odds (individual requests)
        pa_odds_by_event = await self._fetch_all_pa_odds(event_ids)
        
        # Parse all odds
        return self._parse_football_odds(events, so_odds_data, pa_odds_by_event, league_name, tournament_id)
    
    async def _scrape_basketball(self, config: dict) -> List[ScrapedOdds]:
        """Scrape Moneyline odds for a basketball league."""
        league_name = config["name"]
        tournament_id = config["tournament_id"]
        
        # Fetch events
        events = await self._fetch_events(tournament_id)
        if not events:
            return []
        
        results = []
        for event in events:
            try:
                event_id = str(event.get("id", ""))
                if not event_id:
                    continue
                
                # Fetch odds for this event
                odds_data = await self._fetch_event_odds(event_id)
                if not odds_data:
                    continue
                
                # Extract teams
                teams = event.get("teams") or {}
                home_team = teams.get("home", "Unknown") if isinstance(teams, dict) else "Unknown"
                away_team = teams.get("away", "Unknown") if isinstance(teams, dict) else "Unknown"
                
                # Parse date
                date_str = event.get("dateStart", "")
                try:
                    match_date = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                except:
                    match_date = datetime.now(timezone.utc)
                
                # Extract Moneyline odds
                home_odd, away_odd = self._parse_moneyline_odds(odds_data)
                
                if home_odd and away_odd:
                    results.append(ScrapedOdds(
                        bookmaker_name="stake",
                        home_team_raw=home_team,
                        away_team_raw=away_team,
                        league_raw=league_name,
                        match_date=match_date,
                        home_odd=home_odd,
                        draw_odd=None,
                        away_odd=away_odd,
                        sport="basketball",
                        market_type="moneyline",
                        extra_data={"event_id": event_id}
                    ))
                    
            except Exception as e:
                self.logger.debug(f"[Stake] Erro ao processar evento NBA: {e}")
                continue
        
        self.logger.info(f"[Stake] {league_name} (Moneyline): {len(results)} jogos coletados")
        return results

    async def _fetch_events(self, tournament_id: str) -> List[Dict[str, Any]]:
        """Fetch upcoming events for a tournament."""
        url = f"{self.API_BASE}/tournament/{tournament_id}/live-upcoming"
        
        try:
            response = await self.client.get(url)
            response.raise_for_status()
            data = response.json()
            events = data.get("events", [])
            return [e for e in events if not e.get("isLive", False)]
        except Exception as e:
            self.logger.error(f"[Stake] Erro ao buscar eventos: {e}")
            return []
    
    async def _fetch_so_odds(self, event_ids: List[str]) -> Dict[str, Any]:
        """Fetch Super Odds for multiple events (batch request)."""
        if not event_ids:
            return {}
        
        try:
            ids_param = ",".join(event_ids)
            url = f"{self.API_BASE}/events/odds?events={ids_param}"
            response = await self.client.get(url)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            self.logger.debug(f"[Stake] Erro ao buscar SO odds: {e}")
            return {}
    
    async def _fetch_pa_odds(self, event_id: str) -> Dict[int, float]:
        """Fetch PA odds for a single event."""
        try:
            url = f"{self.API_BASE}/events/{event_id}/odds"
            response = await self.client.get(url)
            response.raise_for_status()
            data = response.json()
            
            odds_map = {}
            odds_list = data.get("odds", [])
            
            for odd in odds_list:
                market_id = odd.get("marketId", "")
                if market_id != self.MARKET_PA:
                    continue
                
                column_id = odd.get("columnId")
                odd_values = odd.get("oddValues") or {}
                odd_value = odd_values.get("decimal") if isinstance(odd_values, dict) else None
                
                if column_id is not None and odd_value:
                    odds_map[column_id] = float(odd_value)
            
            return odds_map
        except Exception as e:
            self.logger.debug(f"[Stake] Erro ao buscar PA odds para {event_id}: {e}")
            return {}
    
    async def _fetch_all_pa_odds(self, event_ids: List[str]) -> Dict[str, Dict[int, float]]:
        """Fetch PA odds for all events with rate limiting."""
        results = {}
        batch_size = 10
        
        for i in range(0, len(event_ids), batch_size):
            batch = event_ids[i:i + batch_size]
            tasks = [self._fetch_pa_odds(eid) for eid in batch]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for eid, result in zip(batch, batch_results):
                if isinstance(result, dict) and result:
                    results[eid] = result
            
            if i + batch_size < len(event_ids):
                await asyncio.sleep(0.2)
        
        return results
    
    async def _fetch_event_odds(self, event_id: str) -> Dict[str, Any]:
        """Fetch odds for a single event."""
        try:
            url = f"{self.API_BASE}/events/{event_id}/odds"
            response = await self.client.get(url)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            self.logger.debug(f"[Stake] Erro ao buscar odds para {event_id}: {e}")
            return {}

    def _parse_football_odds(self, events: List[Dict], so_odds_data: Dict, 
                              pa_odds_by_event: Dict[str, Dict[int, float]], 
                              league_name: str, tournament_id: str) -> List[ScrapedOdds]:
        """Parse football odds from SO and PA data."""
        results = []
        so_odds_by_event = self._parse_so_odds(so_odds_data)
        
        for event in events:
            try:
                event_id = str(event.get("id", ""))
                if not event_id:
                    continue
                
                # Extract teams
                teams = event.get("teams") or {}
                home_team = teams.get("home", "Unknown") if isinstance(teams, dict) else "Unknown"
                away_team = teams.get("away", "Unknown") if isinstance(teams, dict) else "Unknown"
                
                # Parse date
                date_str = event.get("dateStart", "")
                try:
                    match_date = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                except:
                    match_date = datetime.now(timezone.utc)
                
                # SO odds
                so_odds = so_odds_by_event.get(event_id, {})
                if 0 in so_odds and 1 in so_odds and 2 in so_odds:
                    results.append(ScrapedOdds(
                        bookmaker_name="stake",
                        home_team_raw=home_team,
                        away_team_raw=away_team,
                        league_raw=league_name,
                        match_date=match_date,
                        home_odd=so_odds[0],
                        draw_odd=so_odds[1],
                        away_odd=so_odds[2],
                        market_type="1x2",
                        odds_type="SO",
                        extra_data={"event_id": event_id, "tournament_id": tournament_id}
                    ))
                
                # PA odds
                pa_odds = pa_odds_by_event.get(event_id, {})
                if 0 in pa_odds and 1 in pa_odds and 2 in pa_odds:
                    results.append(ScrapedOdds(
                        bookmaker_name="stake",
                        home_team_raw=home_team,
                        away_team_raw=away_team,
                        league_raw=league_name,
                        match_date=match_date,
                        home_odd=pa_odds[0],
                        draw_odd=pa_odds[1],
                        away_odd=pa_odds[2],
                        market_type="1x2",
                        odds_type="PA",
                        extra_data={"event_id": event_id, "tournament_id": tournament_id}
                    ))
                    
            except Exception as e:
                continue
        
        so_count = sum(1 for o in results if o.odds_type == "SO")
        pa_count = sum(1 for o in results if o.odds_type == "PA")
        self.logger.info(f"[Stake] {league_name}: {so_count} SO + {pa_count} PA = {len(results)} total")
        return results
    
    def _parse_so_odds(self, odds_data: Dict[str, Any]) -> Dict[str, Dict[int, float]]:
        """Parse batch SO odds response."""
        odds_by_event: Dict[str, Dict[int, float]] = {}
        odds_list = odds_data.get("odds", [])
        
        for odd in odds_list:
            event_id = str(odd.get("eventId", ""))
            market_id = odd.get("marketId", "")
            
            if market_id != self.MARKET_SO:
                continue
            
            column_id = odd.get("columnId")
            odd_values = odd.get("oddValues") or {}
            odd_value = odd_values.get("decimal") if isinstance(odd_values, dict) else None
            
            if event_id and column_id is not None and odd_value:
                if event_id not in odds_by_event:
                    odds_by_event[event_id] = {}
                odds_by_event[event_id][column_id] = float(odd_value)
        
        return odds_by_event
    
    def _parse_moneyline_odds(self, odds_data: Dict[str, Any]) -> tuple:
        """Parse Moneyline odds for basketball."""
        home_odd = None
        away_odd = None
        
        odds_list = odds_data.get("odds", [])
        
        for odd in odds_list:
            market_id = odd.get("marketId", "")
            if market_id != self.MARKET_MONEYLINE:
                continue
            
            column_id = odd.get("columnId")
            odd_values = odd.get("oddValues") or {}
            odd_value = odd_values.get("decimal") if isinstance(odd_values, dict) else None
            
            if column_id is not None and odd_value:
                if column_id == 0:
                    home_odd = float(odd_value)
                elif column_id == 1:
                    away_odd = float(odd_value)
        
        return home_odd, away_odd


# Test
if __name__ == "__main__":
    async def run():
        s = StakeScraper()
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

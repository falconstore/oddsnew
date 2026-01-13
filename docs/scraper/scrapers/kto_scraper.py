"""
Scraper para KTO (API Kambi).
A Kambi retorna odds inteiras (ex: 1580) que precisam ser divididas por 1000.
Suporta SO (Super Odds) e PA (Pagamento Antecipado) via endpoints separados.
"""

import httpx
from datetime import datetime
from typing import List, Optional, Dict, Any
from loguru import logger
from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


class KtoScraper(BaseScraper):
    """
    Scraper para KTO (Usando API da Kambi).
    A Kambi retorna odds inteiras (ex: 1580) que precisam ser divididas por 1000.
    Suporta SO (Super Odds) e PA (Pagamento Antecipado).
    """
    
    # URL base da API Kambi (KTO Brasil)
    API_BASE = "https://us1.offering-api.kambicdn.com/offering/v2018/ktobr/listView"
    
    # Categoria para PA (Pagamento Antecipado / Full Time - 2UP)
    PA_CATEGORY_ID = "10028163"
    
    # Criterion IDs para cada tipo de mercado
    SO_CRITERION_ID = 1001159858  # Resultado Final
    PA_CRITERION_ID = 2100089307  # Full Time - 2UP
    
    # Configuração das Ligas (Caminhos da URL)
    LEAGUES = {
        "serie_a": {
            "path": "football/italy/serie_a", 
            "name": "Serie A",
            "country": "Itália"
        },
        "premier_league": {
            "path": "football/england/premier_league", 
            "name": "Premier League",
            "country": "Inglaterra"
        },
        "la_liga": {
            "path": "football/spain/la_liga", 
            "name": "La Liga",
            "country": "Espanha"
        },
	 "bundesliga": {
            "path": "football/germany/bundesliga", 
            "name": "Bundesliga",
            "country": "Alemanha"
        },
	 "ligue_1": {
            "path": "football/france/ligue_1", 
            "name": "Ligue 1",
            "country": "Franca"
        },
	 "paulista": {
            "path": "football/brazil/paulista_a1", 
            "name": "Paulistao A1",
            "country": "Brasil"
 	},
 	 "fa_cup": {
            "path": "football/england/fa_cup", 
            "name": "FA Cup",
            "country": "Inglaterra"
	},
 	 "efl_cup": {
            "path": "football/england/efl_cup", 
            "name": "EFL Cup",
            "country": "Inglaterra"
        },
 	"copa_do_rei": {
            "path": "/football/spain/copa_del_rey", 
            "name": "Copa do Rei",
            "country": "Espanha"
        },
    }
    
    def __init__(self):
        super().__init__(name="kto", base_url="https://www.kto.com")
        self.client: Optional[httpx.AsyncClient] = None
        self.logger = logger.bind(component="kto")
    
    async def setup(self):
        self.logger.info("Iniciando sessão HTTP KTO...")
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "accept": "*/*",
                "origin": "https://www.kto.bet.br",
                "referer": "https://www.kto.bet.br/",
                "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            }
        )
    
    async def teardown(self):
        if self.client:
            await self.client.aclose()
            self.client = None

    async def get_available_leagues(self) -> List[LeagueConfig]:
        return [
            LeagueConfig(league_id=k, name=v["name"], url=v["path"], country=v["country"]) 
            for k, v in self.LEAGUES.items()
        ]
    
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        if not self.client: 
            await self.setup()
        
        # Pega o caminho da liga
        path = self.LEAGUES.get(league.league_id, {}).get("path")
        if not path:
            for k, v in self.LEAGUES.items():
                if v["name"] == league.name:
                    path = v["path"]
                    break
        
        if not path: 
            return []
        
        all_results = []
        
        # Buscar SO (Super Odds) - sem category
        so_results = await self._fetch_odds(path, league.name, odds_type="SO", category=None)
        all_results.extend(so_results)
        
        # Buscar PA (Pagamento Antecipado) - com category
        pa_results = await self._fetch_odds(path, league.name, odds_type="PA", category=self.PA_CATEGORY_ID)
        all_results.extend(pa_results)
        
        so_count = len([r for r in all_results if r.odds_type == "SO"])
        pa_count = len([r for r in all_results if r.odds_type == "PA"])
        self.logger.info(f"✅ KTO {league.name}: {so_count} SO + {pa_count} PA = {len(all_results)} total")
        
        return all_results

    async def _fetch_odds(self, path: str, league_name: str, odds_type: str, category: Optional[str]) -> List[ScrapedOdds]:
        """Busca odds de um endpoint específico (SO ou PA)."""
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
        
        self.logger.debug(f"Buscando KTO {odds_type}: {league_name}...")
        
        try:
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            return self._parse_kambi_response(data, league_name, path, odds_type)
        except Exception as e:
            self.logger.error(f"Erro na KTO ({odds_type}): {e}")
            return []

    def _parse_kambi_response(self, data: Dict[str, Any], league_name: str, league_path: str, odds_type: str) -> List[ScrapedOdds]:
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
                
                # Se não tiver nomes separados, tenta separar pelo delimitador
                if not home_team or not away_team:
                    event_name = event.get("name", "")
                    if " - " in event_name:
                        home_team, away_team = event_name.split(" - ")
                    else:
                        continue

                # Data
                try:
                    dt = datetime.fromisoformat(event.get("start", "").replace("Z", "+00:00"))
                except:
                    dt = datetime.now()

                # Procurar mercado correto para o tipo
                match_offer = None
                for offer in bet_offers:
                    criteria = offer.get("criterion", {})
                    criteria_id = criteria.get("id")
                    
                    if criteria_id in valid_criteria:
                        match_offer = offer
                        break
                
                if not match_offer: 
                    continue
                
                # Extrair Odds
                outcomes = match_offer.get("outcomes", [])
                raw_odds = {}
                
                for out in outcomes:
                    label = out.get("label")
                    out_type = out.get("type")
                    odds_int = out.get("odds")
                    
                    if not odds_int: 
                        continue
                    
                    decimal_odd = odds_int / 1000.0
                    
                    # Usar label ou type para identificar o outcome
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
                        odds_type=odds_type,  # SO ou PA
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


# Teste direto
if __name__ == "__main__":
    import asyncio

    async def run():
        s = KtoScraper()
        # Teste Premier League
        lg = LeagueConfig(league_id="premier_league", name="Premier League", url="", country="England")
        odds = await s.scrape_league(lg)
        
        print(f"\n--- Resultado ({len(odds)} odds) ---")
        
        # Agrupar por tipo
        so_odds = [o for o in odds if o.odds_type == "SO"]
        pa_odds = [o for o in odds if o.odds_type == "PA"]
        
        print(f"\n SO (Super Odds): {len(so_odds)} jogos")
        for o in so_odds[:3]:
            print(f"  {o.home_team_raw} x {o.away_team_raw}")
            print(f"    Odds: {o.home_odd:.2f} - {o.draw_odd:.2f} - {o.away_odd:.2f}")
        
        print(f"\n PA (Pagamento Antecipado): {len(pa_odds)} jogos")
        for o in pa_odds[:3]:
            print(f"  {o.home_team_raw} x {o.away_team_raw}")
            print(f"    Odds: {o.home_odd:.2f} - {o.draw_odd:.2f} - {o.away_odd:.2f}")
            
    asyncio.run(run())

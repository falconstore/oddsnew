"""
Aposta1 Unified Scraper - Futebol + NBA em uma única sessão Playwright.

Combina a lógica de aposta1_scraper.py e aposta1_nba_scraper.py para:
- Reduzir de 2 processos para 1
- Uma única captura de token via Playwright
- Mesma sessão curl_cffi para ambos os esportes
"""

import asyncio
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from datetime import datetime

from curl_cffi.requests import AsyncSession
from playwright.async_api import async_playwright
from loguru import logger
from dateutil import parser as date_parser

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


@dataclass
class Aposta1League:
    champ_id: str
    category_id: str
    name: str
    country: str
    sport: str = "football"  # "football" or "basketball"


class Aposta1UnifiedScraper(BaseScraper):
    """
    Scraper unificado para Aposta1 (Futebol + NBA).
    
    Características:
    - Única captura de token via Playwright
    - Mesma sessão curl_cffi para Futebol e NBA
    - Guard Pattern no setup() para evitar re-inicialização
    - Teardown robusto com try/except
    """
    
    # ==================== LIGAS DE FUTEBOL ====================
    FOOTBALL_LEAGUES = {
        "serie_a": Aposta1League(champ_id="2942", category_id="502", name="Serie A", country="italia"),
        "premier_league": Aposta1League(champ_id="2936", category_id="497", name="Premier League", country="inglaterra"),
        "la_liga": Aposta1League(champ_id="2941", category_id="501", name="La Liga", country="espanha"),
        "bundesliga": Aposta1League(champ_id="2950", category_id="506", name="Bundesliga", country="alemanha"),
        "ligue_1": Aposta1League(champ_id="2943", category_id="503", name="Ligue 1", country="franca"),
        "paulistao": Aposta1League(champ_id="3436", category_id="593", name="Paulistao A1", country="brasil"),
        "fa_cup": Aposta1League(champ_id="2935", category_id="497", name="FA Cup", country="inglaterra"),
        "efl_cup": Aposta1League(champ_id="2972", category_id="497", name="EFL Cup", country="inglaterra"),
        "copa_do_rei": Aposta1League(champ_id="2973", category_id="501", name="Copa do Rei", country="espanha"),
        "champions_league": Aposta1League(champ_id="16808", category_id="1133", name="Champions League", country="europa"),
        "liga_europa": Aposta1League(champ_id="16809", category_id="1133", name="Liga Europa", country="europa"),
        "liga_da_conferencia": Aposta1League(champ_id="31608", category_id="1133", name="Liga da Conferência", country="europa"),
        "eredivisie": Aposta1League(champ_id="3065", category_id="569", name="Eredivisie", country="holanda"),
        "brasileirao_serie_a": Aposta1League(champ_id="11318", category_id="593", name="Brasileirão Série A", country="brasil"),
    }
    
    # ==================== LIGAS DE BASQUETE ====================
    BASKETBALL_LEAGUES = {
        "nba": Aposta1League(champ_id="2980", category_id="503", name="NBA", country="eua", sport="basketball"),
    }
    
    EVENTS_API = "https://sb2frontend-altenar2.biahosted.com/api/widget/GetEvents"
    EVENT_DETAILS_API = "https://sb2frontend-altenar2.biahosted.com/api/widget/GetEventDetails"
    
    def __init__(self):
        super().__init__(name="aposta1", base_url="https://www.aposta1.bet.br")
        self.session: Optional[AsyncSession] = None
        self.auth_token: Optional[str] = None
        self.user_agent: Optional[str] = None
        self.logger = logger.bind(component="aposta1")
    
    async def setup(self) -> None:
        """
        Captura token de autenticação via Playwright.
        Guard Pattern: evita re-inicialização se já temos token válido.
        """
        # Guard: evita re-inicialização
        if self.auth_token and self.session:
            self.logger.debug("[Aposta1] Reusando token e session existentes")
            return
        
        self.logger.info("[Aposta1] Iniciando captura de token via Playwright")
        
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True,
                    args=['--no-sandbox', '--disable-blink-features=AutomationControlled']
                )
                
                ua_string = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                context = await browser.new_context(user_agent=ua_string)
                page = await context.new_page()
                
                token_future = asyncio.get_event_loop().create_future()
                
                async def handle_request(request):
                    if "biahosted.com/api" in request.url:
                        headers = request.headers
                        if "authorization" in headers:
                            token = headers["authorization"]
                            if token and len(token) > 20 and not token_future.done():
                                token_future.set_result(token)
                
                page.on("request", handle_request)
                
                try:
                    target_url = "https://www.aposta1.bet.br/esportes"
                    self.logger.info("[Aposta1] Navegando para página de esportes")
                    await page.goto(target_url, wait_until="domcontentloaded", timeout=30000)
                    
                    self.auth_token = await asyncio.wait_for(token_future, timeout=20.0)
                    self.user_agent = await page.evaluate("navigator.userAgent")
                    
                    self.logger.info("[Aposta1] Token capturado com sucesso")
                    
                except asyncio.TimeoutError:
                    self.logger.error("[Aposta1] Timeout ao capturar token")
                except Exception as e:
                    self.logger.error(f"[Aposta1] Erro Playwright: {e}")
                finally:
                    await browser.close()
        except Exception as e:
            self.logger.error(f"[Aposta1] Erro fatal no setup: {e}")
        
        # Inicializar session se temos token
        if self.auth_token and self.user_agent:
            self.session = AsyncSession(impersonate="chrome120")
            self.session.headers = {
                "Accept": "*/*",
                "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
                "Authorization": self.auth_token,
                "Origin": "https://www.aposta1.bet.br",
                "Referer": "https://www.aposta1.bet.br/",
                "User-Agent": self.user_agent
            }

    async def teardown(self) -> None:
        """Teardown robusto com try/except para evitar erros de cleanup."""
        try:
            if self.session:
                await self.session.close()
        except Exception:
            pass
        finally:
            self.session = None
            self.auth_token = None
            self.user_agent = None

    async def get_available_leagues(self) -> List[LeagueConfig]:
        """Retorna todas as ligas disponíveis (Futebol + NBA)."""
        leagues = []
        
        # Futebol
        for key, val in self.FOOTBALL_LEAGUES.items():
            full_url = f"https://www.aposta1.bet.br/esportes#/sport/66/category/0/championship/{val.champ_id}"
            leagues.append(LeagueConfig(league_id=key, name=val.name, url=full_url, country=val.country))
        
        # Basquete
        for key, val in self.BASKETBALL_LEAGUES.items():
            full_url = f"https://www.aposta1.bet.br/sports/basquete/eua/nba"
            leagues.append(LeagueConfig(league_id=key, name=val.name, url=full_url, country=val.country))
        
        return leagues

    async def scrape_all(self) -> List[ScrapedOdds]:
        """
        Scrape unificado: Futebol + NBA em uma única execução.
        Gerencia internamente setup/teardown.
        """
        all_odds = []
        
        try:
            await self.setup()
            
            if not self.session:
                self.logger.error("[Aposta1] Falha no setup - sem session")
                return []
            
            # 1. Scrape Futebol
            football_count = 0
            for key, config in self.FOOTBALL_LEAGUES.items():
                try:
                    league = LeagueConfig(league_id=key, name=config.name, url="", country=config.country)
                    odds = await self._scrape_football_league(league, config)
                    all_odds.extend(odds)
                    football_count += len(odds)
                except Exception as e:
                    self.logger.error(f"[Aposta1] Erro {config.name}: {e}")
            
            # 2. Scrape NBA
            nba_count = 0
            try:
                nba_config = self.BASKETBALL_LEAGUES["nba"]
                league = LeagueConfig(league_id="nba", name="NBA", url="", country="eua")
                odds = await self._scrape_basketball_league(league, nba_config)
                all_odds.extend(odds)
                nba_count = len(odds)
            except Exception as e:
                self.logger.error(f"[Aposta1] Erro NBA: {e}")
            
            self.logger.info(f"[Aposta1] Total: {football_count} futebol + {nba_count} NBA = {len(all_odds)} odds")
            
        finally:
            await self.teardown()
        
        return all_odds

    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """Implementação obrigatória da interface BaseScraper."""
        if not self.session:
            await self.setup()
        
        if not self.session:
            return []
        
        # Verificar se é futebol ou basquete
        if league.league_id in self.FOOTBALL_LEAGUES:
            config = self.FOOTBALL_LEAGUES[league.league_id]
            return await self._scrape_football_league(league, config)
        elif league.league_id in self.BASKETBALL_LEAGUES:
            config = self.BASKETBALL_LEAGUES[league.league_id]
            return await self._scrape_basketball_league(league, config)
        
        return []

    # ==================== FUTEBOL ====================
    
    async def _scrape_football_league(self, league: LeagueConfig, config: Aposta1League) -> List[ScrapedOdds]:
        """Scrape uma liga de futebol usando GetEventDetails para SO/PA."""
        try:
            # 1. Buscar lista de eventos
            events = await self._fetch_events(config.champ_id, league.name)
            if not events:
                return []
            
            # 2. Extrair event_ids
            event_ids = [str(e["id"]) for e in events]
            self.logger.info(f"[Aposta1] {league.name}: {len(event_ids)} eventos encontrados")
            
            # 3. Buscar detalhes de cada evento
            event_details = await self._fetch_all_event_details(event_ids)
            
            # 4. Parsear odds usando campo 'offers'
            results = []
            for event in events:
                event_id = str(event["id"])
                details = event_details.get(event_id)
                if not details:
                    continue
                
                # Parse team names
                event_name = event.get("name", "")
                home_team, away_team = self._parse_teams(event_name)
                if not home_team or not away_team:
                    continue
                
                # Parse date
                match_date_str = event.get("startDate")
                if not match_date_str:
                    continue
                parsed_date = date_parser.parse(match_date_str)
                
                # Parse SO e PA do GetEventDetails
                odds_by_type = self._parse_event_details_odds(details)
                
                for odds_type, odds in odds_by_type.items():
                    scraped = ScrapedOdds(
                        bookmaker_name="aposta1",
                        home_team_raw=home_team,
                        away_team_raw=away_team,
                        league_raw=league.name,
                        match_date=parsed_date,
                        home_odd=odds["home"],
                        draw_odd=odds["draw"],
                        away_odd=odds["away"],
                        market_type="1x2",
                        odds_type=odds_type,
                        extra_data={
                            "aposta1_event_id": event_id,
                            "aposta1_champ_id": config.champ_id,
                            "aposta1_category_id": config.category_id,
                            "country": config.country
                        }
                    )
                    results.append(scraped)
            
            # Log com contagem separada
            so_count = len([r for r in results if r.odds_type == "SO"])
            pa_count = len([r for r in results if r.odds_type == "PA"])
            self.logger.info(f"[Aposta1] {league.name}: {so_count} SO + {pa_count} PA = {len(results)} total")
            
            return results
            
        except Exception as e:
            self.logger.error(f"[Aposta1] {league.name}: Erro - {e}")
            return []

    # ==================== BASQUETE ====================
    
    async def _scrape_basketball_league(self, league: LeagueConfig, config: Aposta1League) -> List[ScrapedOdds]:
        """Scrape NBA usando GetEvents (moneyline direto)."""
        try:
            params = {
                "culture": "pt-BR",
                "timezoneOffset": "180",
                "integration": "aposta1",
                "deviceType": "1",
                "numFormat": "en-GB",
                "countryCode": "BR",
                "eventCount": "0",
                "sportId": "0",
                "champIds": config.champ_id
            }
            
            response = await self.session.get(self.EVENTS_API, params=params, timeout=20)
            
            if response.status_code == 200:
                data = response.json()
                return self._parse_basketball_response(data, league)
            
            if response.status_code in [401, 403]:
                self.auth_token = None
            
            self.logger.error(f"[Aposta1 NBA] HTTP {response.status_code}")
            return []
            
        except Exception as e:
            self.logger.error(f"[Aposta1 NBA] Erro: {e}")
            return []

    def _parse_basketball_response(self, data: Dict[str, Any], league: LeagueConfig) -> List[ScrapedOdds]:
        """Parse Altenar API response for NBA Moneyline."""
        results = []
        
        events_list = data.get("events", [])
        markets_list = data.get("markets", [])
        odds_list = data.get("odds", [])
        competitors_list = data.get("competitors", [])
        
        self.logger.info(f"[Aposta1 NBA] {len(events_list)} events, {len(markets_list)} markets")
        
        if not events_list:
            return []
        
        # Build lookup maps
        events_map = {e["id"]: e for e in events_list}
        competitors_map = {c["id"]: c["name"] for c in competitors_list}
        odds_map = {o["id"]: o for o in odds_list}
        
        market_to_event = {}
        for event in events_list:
            for mid in event.get("marketIds", []):
                market_to_event[mid] = event["id"]
        
        # Process Moneyline markets (typeId: 219)
        for market in markets_list:
            try:
                if market.get("typeId") != 219:
                    continue
                
                market_id = market.get("id")
                event_id = market_to_event.get(market_id)
                
                if not event_id:
                    continue
                
                event = events_map.get(event_id, {})
                event_name = event.get("name", "")
                match_date = event.get("startDate")
                competitor_ids = event.get("competitorIds", [])
                
                if not event_name or len(competitor_ids) < 2:
                    continue
                
                # Get team names
                home_team = competitors_map.get(competitor_ids[0], "")
                away_team = competitors_map.get(competitor_ids[1], "")
                
                if not home_team or not away_team:
                    if " vs. " in event_name:
                        parts = event_name.split(" vs. ")
                        home_team = parts[0].strip()
                        away_team = parts[1].strip() if len(parts) > 1 else ""
                    elif " vs " in event_name:
                        parts = event_name.split(" vs ")
                        home_team = parts[0].strip()
                        away_team = parts[1].strip() if len(parts) > 1 else ""
                
                if not home_team or not away_team:
                    continue
                
                # Get odds
                odd_ids = market.get("oddIds", [])
                found_odds = {"home": None, "away": None}
                
                for odd_id in odd_ids:
                    odd = odds_map.get(odd_id, {})
                    type_id = odd.get("typeId")
                    price_raw = odd.get("price")
                    
                    if price_raw is None:
                        continue
                    
                    if isinstance(price_raw, dict):
                        price = float(price_raw.get("parsedValue", 0))
                    else:
                        price = float(price_raw)
                    
                    if type_id == 1:  # Home
                        found_odds["home"] = price
                    elif type_id == 3:  # Away
                        found_odds["away"] = price
                
                # Need both home and away
                if found_odds["home"] is None or found_odds["away"] is None:
                    continue
                
                parsed_date = date_parser.parse(match_date) if match_date else datetime.utcnow()
                
                scraped = ScrapedOdds(
                    bookmaker_name="aposta1",
                    home_team_raw=home_team,
                    away_team_raw=away_team,
                    league_raw="NBA",
                    match_date=parsed_date,
                    home_odd=found_odds["home"],
                    draw_odd=None,
                    away_odd=found_odds["away"],
                    sport="basketball",
                    market_type="moneyline",
                    odds_type="PA",
                    extra_data={
                        "aposta1_event_id": str(event_id),
                        "country": "eua",
                        "sport_type": "basketball"
                    }
                )
                results.append(scraped)
                
            except Exception as e:
                self.logger.debug(f"[Aposta1 NBA] Error parsing market: {e}")
                continue
        
        self.logger.info(f"[Aposta1 NBA] {len(results)} odds processed")
        return results

    # ==================== MÉTODOS AUXILIARES ====================
    
    async def _fetch_events(self, champ_id: str, league_name: str) -> List[Dict[str, Any]]:
        """Busca lista de eventos de uma liga."""
        params = {
            "culture": "pt-BR",
            "timezoneOffset": "180",
            "integration": "aposta1",
            "deviceType": "1",
            "numFormat": "en-GB",
            "countryCode": "BR",
            "eventCount": "0",
            "sportId": "0",
            "champIds": champ_id
        }
        
        try:
            response = await self.session.get(self.EVENTS_API, params=params, timeout=20)
            
            if response.status_code == 200:
                data = response.json()
                return data.get("events", [])
            
            if response.status_code in [401, 403]:
                self.auth_token = None
            
            self.logger.error(f"[Aposta1] {league_name}: HTTP {response.status_code}")
            return []
            
        except Exception as e:
            self.logger.error(f"[Aposta1] Erro ao buscar eventos: {e}")
            return []

    async def _fetch_event_details(self, event_id: str) -> Optional[Dict[str, Any]]:
        """Busca detalhes de um evento específico."""
        params = {
            "culture": "pt-BR",
            "timezoneOffset": "180",
            "integration": "aposta1",
            "deviceType": "1",
            "numFormat": "en-GB",
            "countryCode": "BR",
            "eventId": event_id,
            "showNonBoosts": "false"
        }
        
        try:
            response = await self.session.get(self.EVENT_DETAILS_API, params=params, timeout=15)
            if response.status_code == 200:
                return response.json()
            return None
        except Exception:
            return None

    async def _fetch_all_event_details(self, event_ids: List[str]) -> Dict[str, Dict]:
        """
        Busca detalhes de múltiplos eventos em paralelo.
        Protegido contra asyncio.CancelledError para retornar resultados parciais.
        """
        results = {}
        batch_size = 5
        
        for i in range(0, len(event_ids), batch_size):
            batch = event_ids[i:i + batch_size]
            
            try:
                tasks = [self._fetch_event_details(eid) for eid in batch]
                responses = await asyncio.gather(*tasks, return_exceptions=True)
                
                for eid, resp in zip(batch, responses):
                    if isinstance(resp, dict):
                        results[eid] = resp
                
                if i + batch_size < len(event_ids):
                    await asyncio.sleep(0.2)
                    
            except asyncio.CancelledError:
                self.logger.warning(f"[Aposta1] Batch cancelado, retornando {len(results)} resultados parciais")
                break  # Retorna o que temos até agora
        
        return results

    def _parse_teams(self, event_name: str) -> tuple:
        """Extrai nomes dos times do nome do evento."""
        if " vs. " in event_name:
            parts = event_name.split(" vs. ")
            return parts[0].strip(), parts[1].strip()
        elif " vs " in event_name:
            parts = event_name.split(" vs ")
            return parts[0].strip(), parts[1].strip()
        return "", ""

    def _parse_event_details_odds(self, data: Dict[str, Any]) -> Dict[str, Dict[str, float]]:
        """
        Parseia odds do GetEventDetails.
        
        Estrategia: Agrupar odds em conjuntos de 3 (home/draw/away).
        - Primeiro conjunto completo sem nenhum 'offers' = SO (Odds Aumentadas)
        - Segundo conjunto onde ALGUM item tem 'offers' = PA (Pagamento Antecipado)
        """
        odds_list = data.get("odds", [])
        
        # Filtrar apenas 1x2 (typeId 1, 2, 3) com price valido
        filtered = [o for o in odds_list if o.get("typeId") in [1, 2, 3] and o.get("price")]
        
        # Agrupar em conjuntos de 3 consecutivos
        sets = []
        current_set = {}
        current_has_offers = False
        
        for odd in filtered:
            type_id = odd.get("typeId")
            pos = {1: "home", 2: "draw", 3: "away"}.get(type_id)
            price = float(odd.get("price"))
            has_offers = "offers" in odd and odd.get("offers")
            
            # Se ja tem essa posicao, comeca novo conjunto
            if pos in current_set:
                if len(current_set) == 3:
                    sets.append({"odds": current_set, "has_offers": current_has_offers})
                current_set = {}
                current_has_offers = False
            
            current_set[pos] = price
            if has_offers:
                current_has_offers = True
            
            # Se completou o conjunto, salva
            if len(current_set) == 3:
                sets.append({"odds": current_set, "has_offers": current_has_offers})
                current_set = {}
                current_has_offers = False
        
        result = {}
        
        if len(sets) == 0:
            return result
        
        if len(sets) == 1:
            # Apenas 1 conjunto = sempre PA
            result["PA"] = {
                "home": sets[0]["odds"]["home"],
                "draw": sets[0]["odds"]["draw"],
                "away": sets[0]["odds"]["away"]
            }
        else:
            # 2+ conjuntos: separar por has_offers
            for s in sets:
                if s["has_offers"]:
                    if "PA" not in result:
                        result["PA"] = {
                            "home": s["odds"]["home"],
                            "draw": s["odds"]["draw"],
                            "away": s["odds"]["away"]
                        }
                else:
                    if "SO" not in result:
                        result["SO"] = {
                            "home": s["odds"]["home"],
                            "draw": s["odds"]["draw"],
                            "away": s["odds"]["away"]
                        }
            
            # Se não encontrou PA mas tem SO, converte SO para PA
            if "SO" in result and "PA" not in result:
                result["PA"] = result.pop("SO")
        
        return result


async def main():
    """Teste standalone do scraper unificado."""
    scraper = Aposta1UnifiedScraper()
    
    try:
        odds = await scraper.scrape_all()
        
        football = [o for o in odds if o.sport == "football"]
        basketball = [o for o in odds if o.sport == "basketball"]
        
        print(f"\n=== Aposta1 Unified ===")
        print(f"Futebol: {len(football)} odds")
        print(f"Basquete: {len(basketball)} odds")
        print(f"Total: {len(odds)} odds")
        
        if football:
            print(f"\nExemplo Futebol: {football[0].home_team_raw} vs {football[0].away_team_raw}")
            print(f"  Odds ({football[0].odds_type}): {football[0].home_odd}/{football[0].draw_odd}/{football[0].away_odd}")
        
        if basketball:
            print(f"\nExemplo NBA: {basketball[0].home_team_raw} vs {basketball[0].away_team_raw}")
            print(f"  Odds: {basketball[0].home_odd}/{basketball[0].away_odd}")
            
    except Exception as e:
        print(f"Erro: {e}")


if __name__ == "__main__":
    asyncio.run(main())

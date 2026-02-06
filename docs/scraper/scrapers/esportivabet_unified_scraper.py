"""
Esportivabet Unified Scraper - Futebol + NBA em uma única sessão Playwright.

Combina a lógica de esportivabet_scraper.py e esportivabet_nba_scraper.py para:
- Reduzir de 2 processos para 1
- Uma única captura de token via Playwright
- Mesma sessão curl_cffi para ambos os esportes
"""

import asyncio
import os
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from datetime import datetime

from curl_cffi.requests import AsyncSession
from playwright.async_api import async_playwright
from loguru import logger
from dateutil import parser as date_parser

from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig


@dataclass
class EsportivabetLeague:
    champ_id: str
    category_id: str
    name: str
    country: str
    league_slug: str
    sport: str = "football"  # "football" or "basketball"


class EsportivabetUnifiedScraper(BaseScraper):
    """
    Scraper unificado para Esportivabet (Futebol + NBA).
    
    Características:
    - Única captura de token via Playwright
    - Mesma sessão curl_cffi para Futebol e NBA
    - Guard Pattern no setup() para evitar re-inicialização
    - Teardown robusto com try/except
    """
    
    # ==================== LIGAS DE FUTEBOL ====================
    FOOTBALL_LEAGUES = {
        "serie_a": EsportivabetLeague(champ_id="2942", category_id="502", name="Serie A", country="italia", league_slug="serie-a"),
        "premier_league": EsportivabetLeague(champ_id="2936", category_id="497", name="Premier League", country="inglaterra", league_slug="premier-league"),
        "la_liga": EsportivabetLeague(champ_id="2941", category_id="501", name="La Liga", country="espanha", league_slug="laliga"),
        "bundesliga": EsportivabetLeague(champ_id="2950", category_id="503", name="Bundesliga", country="alemanha", league_slug="bundesliga"),
        "ligue_1": EsportivabetLeague(champ_id="2943", category_id="504", name="Ligue 1", country="franca", league_slug="ligue-1"),
        "paulistao": EsportivabetLeague(champ_id="3436", category_id="505", name="Paulistao", country="brasil", league_slug="paulistao"),
        "fa_cup": EsportivabetLeague(champ_id="2935", category_id="506", name="FA Cup", country="Inglaterra", league_slug="fa-cup"),
        "efl_cup": EsportivabetLeague(champ_id="2972", category_id="507", name="EFL Cup", country="Inglaterra", league_slug="efl-cup"),
        "copa_do_rei": EsportivabetLeague(champ_id="2973", category_id="508", name="Copa do Rei", country="Espanha", league_slug="copa-do-rei"),
        "champions_league": EsportivabetLeague(champ_id="16808", category_id="509", name="Champions League", country="Europa", league_slug="champions-league"),
        "liga_europa": EsportivabetLeague(champ_id="16809", category_id="510", name="Liga Europa", country="Europa", league_slug="liga-europa"),
        "liga_da_conferencia": EsportivabetLeague(champ_id="31608", category_id="511", name="Liga da Conferencia", country="Europa", league_slug="liga-da-conferencia"),
        "eredivisie": EsportivabetLeague(champ_id="3065", category_id="512", name="Eredivisie", country="Holanda", league_slug="eredivisie"),
        "brasileirao_serie_a": EsportivabetLeague(champ_id="11318", category_id="513", name="Brasileirão Série A", country="Brasil", league_slug="brasileirao-serie-a"),
        "carioca": EsportivabetLeague(champ_id="3357", category_id="520", name="Carioca", country="Brasil", league_slug="carioca"),
        "liga_portuguesa": EsportivabetLeague(champ_id="3075", category_id="519", name="Liga Portuguesa", country="Portugal", league_slug="liga-portuguesa"),
        "libertadores": EsportivabetLeague(champ_id="3436", category_id="518", name="Libertadores", country="América do Sul", league_slug="libertadores"),
    }
    
    # ==================== LIGAS DE BASQUETE ====================
    BASKETBALL_LEAGUES = {
        "nba": EsportivabetLeague(champ_id="2980", category_id="503", name="NBA", country="eua", league_slug="nba", sport="basketball"),
    }
    
    API_BASE = "https://sb2frontend-altenar2.biahosted.com/api/widget"
    
    def __init__(self):
        super().__init__(name="esportivabet", base_url="https://esportiva.bet.br")
        self.session: Optional[AsyncSession] = None
        self.auth_token: Optional[str] = None
        self.user_agent: Optional[str] = None
        self.logger = logger.bind(component="esportivabet")
        self._setup_attempted = False
    
    async def setup(self) -> None:
        """
        Captura token de autenticação via Playwright.
        Guard Pattern: evita re-inicialização se já temos token válido.
        """
        # Guard: evita re-inicialização
        if self.auth_token and self.user_agent:
            if not self.session:
                self.logger.info("[Esportivabet] Reusando token existente, reinicializando session")
                self._init_session()
            return
        
        # Check for manual token override via env var
        manual_token = os.environ.get("ESPORTIVABET_AUTH_TOKEN")
        if manual_token:
            self.logger.info("[Esportivabet] Usando token manual da env var")
            self.auth_token = manual_token
            self.user_agent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
            self._init_session()
            return
        
        if self._setup_attempted:
            self.logger.warning("[Esportivabet] Setup já tentado nesta execução, pulando...")
            return
        
        self._setup_attempted = True
        self.logger.info("[Esportivabet] Iniciando captura de token via Playwright...")
        
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True,
                    args=[
                        '--no-sandbox',
                        '--disable-blink-features=AutomationControlled',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                        '--disable-extensions',
                        '--disable-background-networking',
                        '--disable-sync',
                        '--disable-translate',
                        '--no-first-run',
                        '--disable-default-apps',
                        '--single-process',
                        '--memory-pressure-off',
                    ]
                )
                
                ua_string = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
                context = await browser.new_context(user_agent=ua_string)
                page = await context.new_page()
                
                token_future = asyncio.get_event_loop().create_future()
                
                async def handle_request(request):
                    if "biahosted.com/api" in request.url:
                        self.logger.debug(f"[Esportivabet] Request detectada: {request.url[:80]}...")
                        headers = request.headers
                        if "authorization" in headers:
                            token = headers["authorization"]
                            if token and len(token) > 20 and not token_future.done():
                                self.logger.info("[Esportivabet] Token encontrado na request!")
                                token_future.set_result(token)
                
                page.on("request", handle_request)
                
                # URLs para tentar
                target_urls = [
                    "https://esportiva.bet.br/sports/futebol/italia/serie-a",
                    "https://esportiva.bet.br/sports/futebol",
                    "https://esportiva.bet.br/sports",
                ]
                
                try:
                    for target_url in target_urls:
                        if token_future.done():
                            break
                        
                        self.logger.info(f"[Esportivabet] Navegando para {target_url}...")
                        
                        try:
                            await page.goto(target_url, wait_until="domcontentloaded", timeout=60000)
                        except Exception as nav_error:
                            self.logger.warning(f"[Esportivabet] Navegação falhou: {nav_error}")
                            continue
                        
                        # Aguarda um pouco para requests carregarem
                        await page.wait_for_timeout(3000)
                        
                        if not token_future.done():
                            # Tenta scroll para forçar lazy-load
                            self.logger.debug("[Esportivabet] Fazendo scroll para forçar requests...")
                            await page.evaluate("window.scrollTo(0, 500)")
                            await page.wait_for_timeout(2000)
                            await page.evaluate("window.scrollTo(0, 1000)")
                            await page.wait_for_timeout(2000)
                    
                    # Aguarda token com timeout total
                    if not token_future.done():
                        self.auth_token = await asyncio.wait_for(token_future, timeout=10.0)
                    else:
                        self.auth_token = token_future.result()
                    
                    self.user_agent = await page.evaluate("navigator.userAgent")
                    self.logger.info(f"[Esportivabet] Token capturado! UA: {self.user_agent[:30]}...")
                    
                except asyncio.TimeoutError:
                    self.logger.error("[Esportivabet] Timeout capturando token após todas as tentativas.")
                except Exception as e:
                    self.logger.error(f"[Esportivabet] Erro no Playwright: {e}")
                finally:
                    await browser.close()
        except Exception as e:
            self.logger.error(f"[Esportivabet] Erro fatal no setup: {e}")
        
        if self.auth_token and self.user_agent:
            self._init_session()
    
    def _init_session(self):
        """Inicializa a sessão curl_cffi com os headers corretos."""
        self.session = AsyncSession(impersonate="chrome120")
        self.session.headers = {
            "accept": "*/*",
            "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
            "authorization": self.auth_token,
            "origin": "https://esportiva.bet.br",
            "referer": "https://esportiva.bet.br/",
            "user-agent": self.user_agent,
            "sec-ch-ua": '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"macOS"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "cross-site",
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
            # Reset apenas o flag, mantém token para reutilização
            self._setup_attempted = False

    async def get_available_leagues(self) -> List[LeagueConfig]:
        """Retorna todas as ligas disponíveis (Futebol + NBA)."""
        leagues = []
        
        # Futebol
        for key, val in self.FOOTBALL_LEAGUES.items():
            full_url = f"https://esportiva.bet.br/esportes#/sport/66/category/{val.category_id}/championship/{val.champ_id}"
            leagues.append(LeagueConfig(league_id=key, name=val.name, url=full_url, country=val.country))
        
        # Basquete
        for key, val in self.BASKETBALL_LEAGUES.items():
            full_url = f"https://esportiva.bet.br/sports/basquete/eua/nba"
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
                self.logger.error("[Esportivabet] Falha no setup - sem session")
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
                    self.logger.error(f"[Esportivabet] Erro {config.name}: {e}")
            
            # 2. Scrape NBA
            nba_count = 0
            try:
                nba_config = self.BASKETBALL_LEAGUES["nba"]
                league = LeagueConfig(league_id="nba", name="NBA", url="", country="eua")
                odds = await self._scrape_basketball_league(league, nba_config)
                all_odds.extend(odds)
                nba_count = len(odds)
            except Exception as e:
                self.logger.error(f"[Esportivabet] Erro NBA: {e}")
            
            self.logger.info(f"[Esportivabet] Total: {football_count} futebol + {nba_count} NBA = {len(all_odds)} odds")
            
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
    
    async def _scrape_football_league(self, league: LeagueConfig, config: EsportivabetLeague) -> List[ScrapedOdds]:
        """Scrape uma liga de futebol."""
        return await self._fetch_and_parse(config, league, sport="football")
    
    # ==================== BASQUETE ====================
    
    async def _scrape_basketball_league(self, league: LeagueConfig, config: EsportivabetLeague) -> List[ScrapedOdds]:
        """Scrape NBA."""
        return await self._fetch_and_parse(config, league, sport="basketball")
    
    # ==================== FETCH E PARSE ====================
    
    async def _fetch_and_parse(self, config: EsportivabetLeague, league: LeagueConfig, sport: str, retry_on_auth_fail: bool = True) -> List[ScrapedOdds]:
        """
        Busca e parseia eventos de uma liga.
        Protegido contra asyncio.CancelledError para retornar resultados parciais.
        """
        params = {
            "culture": "pt-BR",
            "timezoneOffset": "180",
            "integration": "esportiva",
            "deviceType": "1",
            "numFormat": "en-GB",
            "countryCode": "BR",
            "eventCount": "0",
            "sportId": "0",
            "champIds": config.champ_id
        }

        # Tenta GetEvents primeiro, depois GetLiveEvents como fallback
        endpoints = [
            f"{self.API_BASE}/GetEvents",
            f"{self.API_BASE}/GetLiveEvents"
        ]

        for endpoint in endpoints:
            try:
                response = await self.session.get(endpoint, params=params, timeout=20)
                
                if response.status_code == 200:
                    data = response.json()
                    events = data.get("events", [])
                    
                    if events:
                        self.logger.debug(f"[Esportivabet] {league.name}: {len(events)} eventos em {endpoint.split('/')[-1]}")
                        if sport == "basketball":
                            return self._parse_basketball_response(data, league, config)
                        else:
                            return self._parse_football_response(data, league, config)
                    else:
                        self.logger.debug(f"[Esportivabet] {league.name}: Nenhum evento em {endpoint.split('/')[-1]}, tentando próximo...")
                        continue
                
                if response.status_code in [400, 401, 403]:
                    self.logger.warning(f"[Esportivabet] Token inválido ou expirado (HTTP {response.status_code})")
                    
                    # Auto-retry: limpa token, recaptura e tenta novamente (1x)
                    if retry_on_auth_fail:
                        self.logger.info("[Esportivabet] Tentando recapturar token...")
                        self.auth_token = None
                        self.user_agent = None
                        if self.session:
                            await self.session.close()
                            self.session = None
                        self._setup_attempted = False
                        await self.setup()
                        return await self._fetch_and_parse(config, league, sport, retry_on_auth_fail=False)
                    
                    return []
                
                self.logger.warning(f"[Esportivabet] {league.name}: HTTP {response.status_code} em {endpoint.split('/')[-1]}")
                
            except asyncio.CancelledError:
                self.logger.warning(f"[Esportivabet] {league.name}: Requisição cancelada, retornando resultados parciais")
                return []
            except Exception as e:
                self.logger.error(f"[Esportivabet] {league.name}: Erro em {endpoint.split('/')[-1]} - {e}")
                continue

        self.logger.warning(f"[Esportivabet] {league.name}: Nenhum evento encontrado em ambos endpoints")
        return []
    
    def _parse_football_response(self, data: Dict[str, Any], league: LeagueConfig, config: EsportivabetLeague) -> List[ScrapedOdds]:
        """Parse resposta para futebol (1x2)."""
        results = []
        
        odds_map = {o['id']: o for o in data.get('odds', [])}
        markets_map = {m['id']: m for m in data.get('markets', [])}
        events_list = data.get("events", [])
        
        for event in events_list:
            try:
                event_name = event.get("name", "")
                match_date = event.get("startDate")
                event_id = event.get("id")
                
                if not event_name or not match_date:
                    continue

                # Separar Times (formato "Time A vs. Time B")
                home_team, away_team = "", ""
                if " vs. " in event_name:
                    parts = event_name.split(" vs. ")
                    home_team, away_team = parts[0].strip(), parts[1].strip()
                elif " vs " in event_name:
                    parts = event_name.split(" vs ")
                    home_team, away_team = parts[0].strip(), parts[1].strip()
                else:
                    continue

                # Buscar Odds 1x2
                found_odds = {"home": None, "draw": None, "away": None}
                market_ids = event.get("marketIds", [])
                
                for mid in market_ids:
                    market = markets_map.get(mid)
                    if not market:
                        continue
                        
                    # Verifica se é o mercado 1x2 (TypeId 1)
                    if market.get("typeId") == 1 or market.get("name") == "1x2":
                        odd_ids = market.get("oddIds", [])
                        
                        for oid in odd_ids:
                            odd = odds_map.get(oid)
                            if not odd:
                                continue
                            
                            t_id = odd.get("typeId")
                            price = odd.get("price")
                            
                            if t_id == 1:
                                found_odds["home"] = float(price)
                            elif t_id == 2:
                                found_odds["draw"] = float(price)
                            elif t_id == 3:
                                found_odds["away"] = float(price)
                        
                        break

                if not all(found_odds.values()):
                    continue

                parsed_date = date_parser.parse(match_date)

                scraped = ScrapedOdds(
                    bookmaker_name="esportivabet",
                    home_team_raw=home_team,
                    away_team_raw=away_team,
                    league_raw=league.name,
                    match_date=parsed_date,
                    home_odd=found_odds["home"],
                    draw_odd=found_odds["draw"],
                    away_odd=found_odds["away"],
                    market_type="1x2",
                    extra_data={
                        "esportivabet_event_id": str(event_id),
                        "country": config.country,
                        "league_slug": config.league_slug
                    }
                )
                results.append(scraped)

            except Exception:
                continue
        
        self.logger.info(f"[Esportivabet] {league.name}: {len(results)} odds coletadas")
        return results
    
    def _parse_basketball_response(self, data: Dict[str, Any], league: LeagueConfig, config: EsportivabetLeague) -> List[ScrapedOdds]:
        """Parse resposta para basquete (moneyline)."""
        results = []
        
        odds_map = {o['id']: o for o in data.get('odds', [])}
        markets_map = {m['id']: m for m in data.get('markets', [])}
        events_list = data.get("events", [])
        
        for event in events_list:
            try:
                event_name = event.get("name", "")
                match_date = event.get("startDate")
                event_id = event.get("id")
                
                if not event_name or not match_date:
                    continue

                # Separar Times
                home_team, away_team = "", ""
                if " vs. " in event_name:
                    parts = event_name.split(" vs. ")
                    home_team, away_team = parts[0].strip(), parts[1].strip()
                elif " vs " in event_name:
                    parts = event_name.split(" vs ")
                    home_team, away_team = parts[0].strip(), parts[1].strip()
                else:
                    continue

                # Buscar Odds Moneyline
                market_ids = event.get("marketIds", [])
                
                for mid in market_ids:
                    market = markets_map.get(mid)
                    if not market:
                        continue
                        
                    # Verifica se é o mercado Vencedor/Moneyline (TypeId 219 para NBA)
                    if market.get("typeId") == 219:
                        odds_data = {"home": None, "away": None}
                        odd_ids = market.get("oddIds", [])
                        
                        for oid in odd_ids:
                            odd = odds_map.get(oid)
                            if not odd:
                                continue
                            
                            type_id = odd.get("typeId")
                            price_raw = odd.get("price")
                            
                            if price_raw is None:
                                continue
                            
                            # Price pode ser número ou objeto
                            if isinstance(price_raw, dict):
                                price = float(price_raw.get("parsedValue", 0))
                            else:
                                price = float(price_raw)
                            
                            if price <= 0:
                                continue
                            
                            if type_id == 1:  # Home
                                odds_data["home"] = price
                            elif type_id == 3:  # Away
                                odds_data["away"] = price
                        
                        # Só inclui se tiver ambas odds
                        if odds_data["home"] is not None and odds_data["away"] is not None:
                            parsed_date = date_parser.parse(match_date)
                            
                            scraped = ScrapedOdds(
                                bookmaker_name="esportivabet",
                                home_team_raw=home_team,
                                away_team_raw=away_team,
                                league_raw="NBA",
                                match_date=parsed_date,
                                home_odd=odds_data["home"],
                                draw_odd=None,
                                away_odd=odds_data["away"],
                                sport="basketball",
                                market_type="moneyline",
                                odds_type="PA",
                                extra_data={
                                    "esportivabet_event_id": str(event_id),
                                    "country": "eua",
                                }
                            )
                            results.append(scraped)
                        
                        break  # Encontrou o mercado, sai do loop

            except Exception as e:
                self.logger.debug(f"[Esportivabet NBA] Erro parseando evento: {e}")
                continue
        
        self.logger.info(f"[Esportivabet NBA] {len(results)} odds coletadas")
        return results


async def main():
    """Teste standalone do scraper unificado."""
    scraper = EsportivabetUnifiedScraper()
    
    try:
        odds = await scraper.scrape_all()
        
        football = [o for o in odds if o.sport == "football"]
        basketball = [o for o in odds if o.sport == "basketball"]
        
        print(f"\n=== Esportivabet Unified ===")
        print(f"Futebol: {len(football)} odds")
        print(f"Basquete: {len(basketball)} odds")
        print(f"Total: {len(odds)} odds")
        
        if football:
            print(f"\nExemplo Futebol: {football[0].home_team_raw} vs {football[0].away_team_raw}")
            print(f"  Odds: {football[0].home_odd}/{football[0].draw_odd}/{football[0].away_odd}")
        
        if basketball:
            print(f"\nExemplo NBA: {basketball[0].home_team_raw} vs {basketball[0].away_team_raw}")
            print(f"  Odds: {basketball[0].home_odd}/{basketball[0].away_odd}")
            
    except Exception as e:
        print(f"Erro: {e}")


if __name__ == "__main__":
    asyncio.run(main())
"""
Jogo de Ouro Scraper - Uses Altenar API (same as Esportivabet).
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
class JogodeOuroLeague:
    champ_id: str
    category_id: str
    name: str
    country: str
    league_slug: str


class JogodeOuroScraper(BaseScraper):
    
    LEAGUES = {
        "serie_a": JogodeOuroLeague(champ_id="2942", category_id="502", name="Serie A", country="italia", league_slug="serie-a"),
        "premier_league": JogodeOuroLeague(champ_id="2936", category_id="497", name="Premier League", country="inglaterra", league_slug="premier-league"),
        "la_liga": JogodeOuroLeague(champ_id="2941", category_id="501", name="La Liga", country="espanha", league_slug="laliga"),
        "bundesliga": JogodeOuroLeague(champ_id="2950", category_id="503", name="Bundesliga", country="alemanha", league_slug="bundesliga"),
        "ligue_1": JogodeOuroLeague(champ_id="2943", category_id="504", name="Ligue 1", country="franca", league_slug="ligue-1"),
        "paulistao": JogodeOuroLeague(champ_id="3436", category_id="504", name="Paulistao", country="brasil", league_slug="paulistao"),
    }
    
    API_BASE = "https://sb2frontend-altenar2.biahosted.com/api/widget"
    
    def __init__(self):
        super().__init__(name="jogodeouro", base_url="https://jogodeouro.bet.br")
        self.session: Optional[AsyncSession] = None
        self.auth_token: Optional[str] = None
        self.user_agent: Optional[str] = None
        self.logger = logger.bind(component="jogodeouro")
        self._setup_attempted = False
    
    async def setup(self) -> None:
        import os
        
        # Se já temos token e user_agent, apenas reinicia a session se necessário
        if self.auth_token and self.user_agent:
            if not self.session:
                self.logger.info("[JogodeOuro] Reusando token existente, reinicializando session")
                self._init_session()
            return
        
        # Check for manual token override via env var
        manual_token = os.environ.get("JOGODEOURO_AUTH_TOKEN")
        if manual_token:
            self.logger.info("[JogodeOuro] Usando token manual da env var")
            self.auth_token = manual_token
            self.user_agent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
            self._init_session()
            return
        
        if self._setup_attempted:
            self.logger.warning("[JogodeOuro] Setup ja tentado nesta execucao, pulando...")
            return
        
        self._setup_attempted = True
        self.logger.info("[JogodeOuro] Iniciando captura de token via Playwright...")
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=['--no-sandbox', '--disable-blink-features=AutomationControlled']
            )
            
            ua_string = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
            context = await browser.new_context(user_agent=ua_string)
            page = await context.new_page()
            
            token_future = asyncio.get_event_loop().create_future()
            
            async def handle_request(request):
                if "biahosted.com/api" in request.url:
                    self.logger.debug(f"[JogodeOuro] Request detectada: {request.url[:80]}...")
                    headers = request.headers
                    if "authorization" in headers:
                        token = headers["authorization"]
                        if token and len(token) > 20 and not token_future.done():
                            self.logger.info("[JogodeOuro] Token encontrado na request!")
                            token_future.set_result(token)
            
            page.on("request", handle_request)
            
            # URLs para tentar (paths reais)
            target_urls = [
                "https://jogodeouro.bet.br/sports/futebol/italia/serie-a",
                "https://jogodeouro.bet.br/sports/futebol",
                "https://jogodeouro.bet.br/sports",
            ]
            
            try:
                for target_url in target_urls:
                    if token_future.done():
                        break
                    
                    self.logger.info(f"[JogodeOuro] Navegando para {target_url}...")
                    
                    try:
                        await page.goto(target_url, wait_until="domcontentloaded", timeout=60000)
                    except Exception as nav_error:
                        self.logger.warning(f"[JogodeOuro] Navegacao falhou: {nav_error}")
                        continue
                    
                    # Aguarda um pouco para requests carregarem
                    await page.wait_for_timeout(3000)
                    
                    if not token_future.done():
                        # Tenta scroll para forçar lazy-load
                        self.logger.debug("[JogodeOuro] Fazendo scroll para forcar requests...")
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
                self.logger.info(f"[JogodeOuro] Token capturado! UA: {self.user_agent[:30]}...")
                
            except asyncio.TimeoutError:
                self.logger.error("[JogodeOuro] Timeout capturando token apos todas as tentativas.")
            except Exception as e:
                self.logger.error(f"[JogodeOuro] Erro no Playwright: {e}")
            finally:
                await browser.close()
        
        if self.auth_token and self.user_agent:
            self._init_session()
    
    def _init_session(self):
        self.session = AsyncSession(impersonate="chrome120")
        self.session.headers = {
            "accept": "*/*",
            "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
            "authorization": self.auth_token,
            "origin": "https://jogodeouro.bet.br",
            "referer": "https://jogodeouro.bet.br/",
            "user-agent": self.user_agent,
            "sec-ch-ua": '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"macOS"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "cross-site",
        }

    async def teardown(self) -> None:
        if self.session:
            await self.session.close()
            self.session = None
        # Reset apenas o flag, mantém token para reutilização
        self._setup_attempted = False

    async def get_available_leagues(self) -> List[LeagueConfig]:
        leagues = []
        for key, val in self.LEAGUES.items():
            full_url = f"https://jogodeouro.bet.br/esportes#/sport/66/category/{val.category_id}/championship/{val.champ_id}"
            leagues.append(LeagueConfig(league_id=key, name=val.name, url=full_url, country=val.country))
        return leagues

    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        return await self._scrape_league_impl(league, retry_on_auth_fail=True)
    
    async def _scrape_league_impl(self, league: LeagueConfig, retry_on_auth_fail: bool = True) -> List[ScrapedOdds]:
        if not self.auth_token:
            await self.setup()
        
        if not self.session:
            return []

        # Identifica ID do campeonato
        target_champ_id = None
        if hasattr(league, 'league_id') and league.league_id in self.LEAGUES:
            target_champ_id = self.LEAGUES[league.league_id].champ_id
        
        if not target_champ_id:
            return []

        params = {
            "culture": "pt-BR",
            "timezoneOffset": "180",
            "integration": "jogodeouro",
            "deviceType": "1",
            "numFormat": "en-GB",
            "countryCode": "BR",
            "eventCount": "0",
            "sportId": "0",
            "champIds": target_champ_id
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
                        self.logger.debug(f"[JogodeOuro] {league.name}: {len(events)} eventos em {endpoint.split('/')[-1]}")
                        return self._parse_response(data, league)
                    else:
                        self.logger.debug(f"[JogodeOuro] {league.name}: Nenhum evento em {endpoint.split('/')[-1]}, tentando proximo...")
                        continue
                
                if response.status_code in [400, 401, 403]:
                    self.logger.warning(f"[JogodeOuro] Token invalido ou expirado (HTTP {response.status_code})")
                    
                    # Auto-retry: limpa token, recaptura e tenta novamente (1x)
                    if retry_on_auth_fail:
                        self.logger.info("[JogodeOuro] Tentando recapturar token...")
                        self.auth_token = None
                        self.user_agent = None
                        if self.session:
                            await self.session.close()
                            self.session = None
                        self._setup_attempted = False
                        await self.setup()
                        return await self._scrape_league_impl(league, retry_on_auth_fail=False)
                    
                    return []
                
                self.logger.warning(f"[JogodeOuro] {league.name}: HTTP {response.status_code} em {endpoint.split('/')[-1]}")
                
            except Exception as e:
                self.logger.error(f"[JogodeOuro] {league.name}: Erro em {endpoint.split('/')[-1]} - {e}")
                continue

        self.logger.warning(f"[JogodeOuro] {league.name}: Nenhum evento encontrado em ambos endpoints")
        return []
    
    def _get_country_for_league(self, league_name: str) -> str:
        for val in self.LEAGUES.values():
            if val.name == league_name:
                return val.country
        return "italia"
    
    def _get_league_slug_for_league(self, league_name: str) -> str:
        for val in self.LEAGUES.values():
            if val.name == league_name:
                return val.league_slug
        return "serie-a"
    
    def _parse_response(self, data: Dict[str, Any], league: LeagueConfig) -> List[ScrapedOdds]:
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
                    bookmaker_name="jogodeouro",
                    home_team_raw=home_team,
                    away_team_raw=away_team,
                    league_raw=league.name,
                    match_date=parsed_date,
                    home_odd=found_odds["home"],
                    draw_odd=found_odds["draw"],
                    away_odd=found_odds["away"],
                    market_type="1x2",
                    extra_data={
                        "jogodeouro_event_id": str(event_id),
                        "country": self._get_country_for_league(league.name),
                        "league_slug": self._get_league_slug_for_league(league.name)
                    }
                )
                results.append(scraped)

            except Exception as e:
                continue
        
        self.logger.info(f"[JogodeOuro] {league.name}: {len(results)} odds coletadas")
        return results


async def main():
    scraper = JogodeOuroScraper()
    try:
        await scraper.setup()
        leagues = await scraper.get_available_leagues()
        
        for league in leagues:
            odds = await scraper.scrape_league(league)
            print(f"\n{league.name}: {len(odds)} odds")
            if odds:
                sample = odds[0]
                print(f"  Exemplo: {sample.home_team_raw} vs {sample.away_team_raw}")
                print(f"  Odds: {sample.home_odd} / {sample.draw_odd} / {sample.away_odd}")
                print(f"  Extra: {sample.extra_data}")
    finally:
        await scraper.teardown()


if __name__ == "__main__":
    asyncio.run(main())

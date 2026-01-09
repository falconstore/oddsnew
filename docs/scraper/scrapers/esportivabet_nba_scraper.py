"""
Esportivabet NBA Scraper - Scraper para odds NBA da Esportivabet.
Utiliza a API Altenar (biahosted.com) com captura de token via Playwright.
Suporta Super Odds (SO) e Pagamento Antecipado (PA).
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
class EsportivabetNBALeague:
    champ_id: str
    name: str
    country: str


class EsportivabetNBAScraper(BaseScraper):
    """
    Scraper para odds NBA da Esportivabet.
    
    Características:
    - Usa API Altenar (biahosted.com)
    - Captura token de autenticação via Playwright
    - Suporta SO e PA baseado no campo 'offers'
    - Mercado moneyline (2-way, sem empate)
    """
    
    LEAGUES = {
        "nba": EsportivabetNBALeague(
            champ_id="2980",
            name="NBA",
            country="eua"
        ),
    }
    
    API_BASE = "https://sb2frontend-altenar2.biahosted.com/api/widget"
    
    def __init__(self):
        super().__init__(name="esportivabet_nba", base_url="https://esportiva.bet.br")
        self.session: Optional[AsyncSession] = None
        self.auth_token: Optional[str] = None
        self.user_agent: Optional[str] = None
        self.logger = logger.bind(component="esportivabet_nba")
        self._setup_attempted = False
    
    async def setup(self) -> None:
        import os
        
        # Se já temos token e user_agent, apenas reinicia a session se necessário
        if self.auth_token and self.user_agent:
            if not self.session:
                self.logger.info("[Esportivabet NBA] Reusando token existente, reinicializando session")
                self._init_session()
            return
        
        # Check for manual token override via env var
        manual_token = os.environ.get("ESPORTIVABET_AUTH_TOKEN")
        if manual_token:
            self.logger.info("[Esportivabet NBA] Usando token manual da env var")
            self.auth_token = manual_token
            self.user_agent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
            self._init_session()
            return
        
        if self._setup_attempted:
            self.logger.warning("[Esportivabet NBA] Setup ja tentado nesta execucao, pulando...")
            return
        
        self._setup_attempted = True
        self.logger.info("[Esportivabet NBA] Iniciando captura de token via Playwright...")
        
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
                    self.logger.debug(f"[Esportivabet NBA] Request detectada: {request.url[:80]}...")
                    headers = request.headers
                    if "authorization" in headers:
                        token = headers["authorization"]
                        if token and len(token) > 20 and not token_future.done():
                            self.logger.info("[Esportivabet NBA] Token encontrado na request!")
                            token_future.set_result(token)
            
            page.on("request", handle_request)
            
            # URLs para tentar - inclui basquete
            target_urls = [
                "https://esportiva.bet.br/sports/basquete/eua/nba",
                "https://esportiva.bet.br/sports/basquete",
                "https://esportiva.bet.br/sports/futebol/italia/serie-a",
                "https://esportiva.bet.br/sports",
            ]
            
            try:
                for target_url in target_urls:
                    if token_future.done():
                        break
                    
                    self.logger.info(f"[Esportivabet NBA] Navegando para {target_url}...")
                    
                    try:
                        await page.goto(target_url, wait_until="domcontentloaded", timeout=60000)
                    except Exception as nav_error:
                        self.logger.warning(f"[Esportivabet NBA] Navegacao falhou: {nav_error}")
                        continue
                    
                    # Aguarda um pouco para requests carregarem
                    await page.wait_for_timeout(3000)
                    
                    if not token_future.done():
                        # Tenta scroll para forçar lazy-load
                        self.logger.debug("[Esportivabet NBA] Fazendo scroll para forcar requests...")
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
                self.logger.info(f"[Esportivabet NBA] Token capturado! UA: {self.user_agent[:30]}...")
                
            except asyncio.TimeoutError:
                self.logger.error("[Esportivabet NBA] Timeout capturando token apos todas as tentativas.")
            except Exception as e:
                self.logger.error(f"[Esportivabet NBA] Erro no Playwright: {e}")
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
        if self.session:
            await self.session.close()
            self.session = None
        # Reset apenas o flag, mantém token para reutilização
        self._setup_attempted = False

    async def get_available_leagues(self) -> List[LeagueConfig]:
        leagues = []
        for key, val in self.LEAGUES.items():
            full_url = f"https://esportiva.bet.br/sports/basquete/eua/nba"
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
            "integration": "esportiva",
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
                        self.logger.debug(f"[Esportivabet NBA] {league.name}: {len(events)} eventos em {endpoint.split('/')[-1]}")
                        return self._parse_response(data, league)
                    else:
                        self.logger.debug(f"[Esportivabet NBA] {league.name}: Nenhum evento em {endpoint.split('/')[-1]}, tentando proximo...")
                        continue
                
                if response.status_code in [400, 401, 403]:
                    self.logger.warning(f"[Esportivabet NBA] Token invalido ou expirado (HTTP {response.status_code})")
                    
                    # Auto-retry: limpa token, recaptura e tenta novamente (1x)
                    if retry_on_auth_fail:
                        self.logger.info("[Esportivabet NBA] Tentando recapturar token...")
                        self.auth_token = None
                        self.user_agent = None
                        if self.session:
                            await self.session.close()
                            self.session = None
                        self._setup_attempted = False
                        await self.setup()
                        return await self._scrape_league_impl(league, retry_on_auth_fail=False)
                    
                    return []
                
                self.logger.warning(f"[Esportivabet NBA] {league.name}: HTTP {response.status_code} em {endpoint.split('/')[-1]}")
                
            except Exception as e:
                self.logger.error(f"[Esportivabet NBA] {league.name}: Erro em {endpoint.split('/')[-1]} - {e}")
                continue

        self.logger.warning(f"[Esportivabet NBA] {league.name}: Nenhum evento encontrado em ambos endpoints")
        return []
    
    def _parse_response(self, data: Dict[str, Any], league: LeagueConfig) -> List[ScrapedOdds]:
        """
        Parseia a resposta da API e extrai odds SO e PA.
        
        Para basquete:
        - typeId: 1 = Home
        - typeId: 3 = Away
        - Sem typeId: 2 (empate)
        - Com 'offers' = PA (Pagamento Antecipado)
        - Sem 'offers' = SO (Super Odds)
        """
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

                # Buscar Odds Moneyline
                market_ids = event.get("marketIds", [])
                
                for mid in market_ids:
                    market = markets_map.get(mid)
                    if not market:
                        continue
                        
                    # Verifica se é o mercado Vencedor/Moneyline (TypeId 219 para NBA)
                    if market.get("typeId") == 219:
                        odds_sets = self._group_odds_by_type(market, odds_map)
                        
                        parsed_date = date_parser.parse(match_date)
                        
                        for odds_type, odds in odds_sets.items():
                            scraped = ScrapedOdds(
                                bookmaker_name="esportivabet",
                                home_team_raw=home_team,
                                away_team_raw=away_team,
                                league_raw="NBA",
                                match_date=parsed_date,
                                home_odd=odds["home"],
                                draw_odd=None,  # Sem empate no basquete
                                away_odd=odds["away"],
                                sport="basketball",
                                market_type="moneyline",
                                odds_type=odds_type,  # "SO" ou "PA"
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
        
        self.logger.info(f"[Esportivabet NBA] {league.name}: {len(results)} odds coletadas")
        return results
    
    def _group_odds_by_type(self, market: Dict[str, Any], odds_map: Dict[int, Dict[str, Any]]) -> Dict[str, Dict[str, float]]:
        """
        Extrai odds Home/Away do mercado Moneyline.
        Para NBA, todas as odds são tratadas como PA (Pagamento Antecipado).
        
        Price pode ser:
        - float direto: 1.85
        - objeto: {"source": "3.8000", "parsedValue": 3.8}
        
        Returns:
            Dict com chave "PA" contendo {"home": float, "away": float}
        """
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
            
            # Price pode ser número ou objeto {"source": "3.8", "parsedValue": 3.8}
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
        
        result = {}
        
        # Só inclui se tiver ambas odds (home e away)
        if odds_data["home"] is not None and odds_data["away"] is not None:
            result["PA"] = odds_data  # NBA usa PA por padrão
        
        return result


async def main():
    """Teste standalone do scraper."""
    scraper = EsportivabetNBAScraper()
    try:
        await scraper.setup()
        leagues = await scraper.get_available_leagues()
        
        for league in leagues:
            odds = await scraper.scrape_league(league)
            print(f"\n{league.name}: {len(odds)} odds")
            if odds:
                for sample in odds[:4]:  # Mostra até 4 odds
                    print(f"  {sample.home_team_raw} vs {sample.away_team_raw}")
                    print(f"  Odds ({sample.odds_type}): {sample.home_odd} / {sample.away_odd}")
                    print(f"  Sport: {sample.sport}, Market: {sample.market_type}")
    finally:
        await scraper.teardown()


if __name__ == "__main__":
    asyncio.run(main())

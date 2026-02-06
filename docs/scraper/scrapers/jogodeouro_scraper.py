"""
Jogo de Ouro Scraper - Precision Config (Matches successful CURL).
"""

import asyncio
import os
import re
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from datetime import datetime

from curl_cffi.requests import AsyncSession
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

class JogodeOuroUnifiedScraper(BaseScraper):
    
    LEAGUES = {
        "serie_a": JogodeOuroLeague(champ_id="2942", category_id="502", name="Serie A", country="italia", league_slug="serie-a"),
        "premier_league": JogodeOuroLeague(champ_id="2936", category_id="497", name="Premier League", country="inglaterra", league_slug="premier-league"),
        "la_liga": JogodeOuroLeague(champ_id="2941", category_id="501", name="La Liga", country="espanha", league_slug="laliga"),
        "bundesliga": JogodeOuroLeague(champ_id="2950", category_id="503", name="Bundesliga", country="alemanha", league_slug="bundesliga"),
        "ligue_1": JogodeOuroLeague(champ_id="2943", category_id="504", name="Ligue 1", country="franca", league_slug="ligue-1"),
        "paulistao": JogodeOuroLeague(champ_id="3436", category_id="506", name="Paulistao", country="brasil", league_slug="paulistao"),
        "fa_cup": JogodeOuroLeague(champ_id="2935", category_id="497", name="FA Cup", country="inglaterra", league_slug="fa-cup"),
        "efl_cup": JogodeOuroLeague(champ_id="2972", category_id="498", name="EFL Cup", country="inglaterra", league_slug="efl-cup"),
        "copa_do_rei": JogodeOuroLeague(champ_id="2973", category_id="499", name="Copa do Rei", country="espanha", league_slug="copa-do-rei"),
        "champions_league": JogodeOuroLeague(champ_id="16808", category_id="499", name="Champions League", country="europa", league_slug="champions-league"),
        "liga_europa": JogodeOuroLeague(champ_id="16809", category_id="499", name="Liga Europa", country="europa", league_slug="liga-europa"),
        "liga_da_conferencia": JogodeOuroLeague(champ_id="31608", category_id="499", name="Liga da Conferencia", country="europa", league_slug="liga-da-conferencia"),
        "eredivisie": JogodeOuroLeague(champ_id="3065", category_id="512", name="Eredivisie", country="holanda", league_slug="eredivisie"),
        "libertadores": JogodeOuroLeague(champ_id="3709", category_id="510", name="Libertadores", country="América do Sul", league_slug="libertadores"),
        "carioca": JogodeOuroLeague(champ_id="3357", category_id="520", name="Carioca", country="brasil", league_slug="carioca"),
        "liga_portuguesa": JogodeOuroLeague(champ_id="3152", category_id="511", name="Liga Portuguesa", country="portugal", league_slug="liga-portuguesa"),
        "brasileirao_serie_a": JogodeOuroLeague(champ_id="11318", category_id="505", name="Brasileirão Série A", country="brasil", league_slug="brasileirao-serie-a"),
    }
    
    # URL Base Exata do CURL
    API_BASE = "https://sb2frontend-altenar2.biahosted.com/api/widget"
    TOKEN_FILENAME = "jogodeouro_token.txt"

    def __init__(self):
        super().__init__(name="jogodeouro", base_url="https://jogodeouro.bet.br")
        self.session: Optional[AsyncSession] = None
        self.auth_token: Optional[str] = None
        self.logger = logger.bind(component="jogodeouro")

    async def setup(self) -> None:
        """Lê o token do arquivo jogodeouro_token.txt."""
        token_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), self.TOKEN_FILENAME)
        
        if os.path.exists(token_path):
            try:
                with open(token_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Regex inteligente para extrair o token mesmo se tiver lixo em volta
                match = re.search(r'(?i)(?:Authorization:\s*)?(?:Bearer\s*)?([A-Za-z0-9+/=]{50,})', content)
                
                if match:
                    self.auth_token = match.group(1).strip()
                    self.logger.info(f"[JogodeOuro] Token carregado ({self.auth_token[:10]}...)")
                    await self._init_session()
                else:
                    self.logger.error("[JogodeOuro] Token nao encontrado no arquivo. Cole APENAS o codigo do token.")
            except Exception as e:
                self.logger.error(f"[JogodeOuro] Erro lendo arquivo: {e}")
        else:
            self.logger.error(f"[JogodeOuro] Arquivo '{self.TOKEN_FILENAME}' nao encontrado!")

    async def _init_session(self):
        # Configuração IDÊNTICA ao seu CURL que funcionou
        self.session = AsyncSession(impersonate="chrome120")
        self.session.headers = {
            "accept": "*/*",
            "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
            "authorization": self.auth_token,
            "origin": "https://jogodeouro.bet.br",
            "referer": "https://jogodeouro.bet.br/",
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36", # UA do Mac (igual seu curl)
            "sec-ch-ua": '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"macOS"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "cross-site",
        }

    async def teardown(self) -> None:
        if self.session:
            await self.session.close()

    async def get_available_leagues(self) -> List[LeagueConfig]:
        leagues = []
        for key, val in self.LEAGUES.items():
            full_url = f"https://jogodeouro.bet.br/pt/sports?page=championship&championshipIds={val.champ_id}"
            leagues.append(LeagueConfig(league_id=key, name=val.name, url=full_url, country=val.country))
        return leagues

    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        if not self.session:
            await self.setup()
            if not self.session or not self.auth_token: return []

        champ_id = self.LEAGUES[league.league_id].champ_id
        
        # Parâmetros EXATOS do seu CURL
        params = {
            "culture": "pt-BR",
            "timezoneOffset": "180",
            "integration": "jogodeouro",
            "deviceType": "1",
            "numFormat": "en-GB",
            "countryCode": "BR",
            "eventCount": "0",
            "sportId": "0",
            "champIds": champ_id
        }

        # 1. Tenta GetEvents (Padrão)
        endpoints = [
            f"{self.API_BASE}/GetEvents",
            f"{self.API_BASE}/GetLiveEvents"
        ]

        for endpoint in endpoints:
            try:
                response = await self.session.get(endpoint, params=params, timeout=15)
                
                if response.status_code == 200:
                    data = response.json()
                    return self._parse_response(data, league)
                
                elif response.status_code == 403:
                    self.logger.warning(f"[JogodeOuro] Erro 403: O token no arquivo pode ter expirado ou IP bloqueado.")
                    return []
                    
            except Exception as e:
                self.logger.debug(f"[JogodeOuro] Erro req: {e}")
                continue
        
        return []

    def _parse_response(self, data: Dict[str, Any], league: LeagueConfig) -> List[ScrapedOdds]:
        results = []
        
        # Tenta pegar eventos da raiz ou de 'result'
        events = data.get("events", [])
        if not events and "result" in data:
             events = data["result"].get("events", [])

        if not events: return []
            
        # Mapas de Odds e Markets
        odds_map = {o['id']: o for o in data.get('odds', [])}
        markets_map = {m['id']: m for m in data.get('markets', [])}

        # Fallback se estiverem dentro de 'result'
        if not odds_map and "result" in data: 
            odds_map = {o['id']: o for o in data["result"].get('odds', [])}
        if not markets_map and "result" in data: 
            markets_map = {m['id']: m for m in data["result"].get('markets', [])}

        for event in events:
            try:
                event_name = event.get("name", "")
                if not event_name: continue

                # Parse Times
                if " vs. " in event_name: parts = event_name.split(" vs. ")
                elif " vs " in event_name: parts = event_name.split(" vs ")
                else: 
                    competitors = event.get("competitors", [])
                    if len(competitors) == 2: parts = [c['name'] for c in competitors]
                    else: continue
                
                home_team, away_team = parts[0].strip(), parts[1].strip()
                
                try:
                    match_date = date_parser.parse(event.get("startDate"))
                except:
                    match_date = datetime.now()

                home, draw, away = None, None, None
                
                # Procura 1x2 (Geralmente typeId 1 no Altenar)
                for mid in event.get("marketIds", []):
                    market = markets_map.get(mid)
                    # Verifica se o mercado é 1x2 (TypeId 1)
                    if market and market.get("typeId") == 1:
                        for oid in market.get("oddIds", []):
                            odd = odds_map.get(oid)
                            if odd:
                                # Conforme seu JSON: 1=Home, 2=Draw, 3=Away
                                t_id = odd.get("typeId")
                                if t_id == 1: home = float(odd.get("price"))
                                elif t_id == 2: draw = float(odd.get("price"))
                                elif t_id == 3: away = float(odd.get("price"))
                        break
                
                if home and away:
                    results.append(ScrapedOdds(
                        bookmaker_name="jogodeouro",
                        home_team_raw=home_team,
                        away_team_raw=away_team,
                        league_raw=league.name,
                        match_date=match_date,
                        home_odd=home,
                        draw_odd=draw,
                        away_odd=away,
                        market_type="1x2",
                        extra_data={"event_id": str(event.get("id"))}
                    ))
            except Exception:
                continue
        
        if results:
            self.logger.info(f"[JogodeOuro] {league.name}: {len(results)} odds coletadas")
        return results

if __name__ == "__main__":
    async def main():
        s = JogodeOuroUnifiedScraper()
        await s.setup()
        leagues = await s.get_available_leagues()
        # Testar Premier League (ID 2936)
        target = next((l for l in leagues if l.league_id == "premier_league"), leagues[0])
        print(f"Testando {target.name}...")
        odds = await s.scrape_league(target)
        print(f"Total: {len(odds)}")
    asyncio.run(main())
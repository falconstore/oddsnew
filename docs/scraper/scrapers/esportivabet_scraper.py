"""
Esportivabet Scraper - Altenar Platform
Uses hybrid approach: Playwright for token capture, curl_cffi for API requests.
"""

import asyncio
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

from curl_cffi.requests import AsyncSession
from loguru import logger
from playwright.async_api import async_playwright

from ..base_scraper import BaseScraper, LeagueConfig, ScrapedOdds


@dataclass
class EsportivabetLeague:
    """Configuration for an Esportivabet league."""
    champ_id: str
    category_id: str
    name: str
    country: str


LEAGUES = {
    "serie_a": EsportivabetLeague(champ_id="2942", category_id="502", name="Serie A", country="italia"),
    "premier_league": EsportivabetLeague(champ_id="2936", category_id="497", name="Premier League", country="inglaterra"),
    "la_liga": EsportivabetLeague(champ_id="2941", category_id="501", name="La Liga", country="espanha"),
}


class EsportivabetScraper(BaseScraper):
    """Scraper for Esportivabet using Altenar backend."""

    API_URL = "https://sb2frontend-altenar2.biahosted.com/api/widget/GetEvents"

    def __init__(self):
        super().__init__(name="esportivabet", base_url="https://esportiva.bet.br")
        self.session: Optional[AsyncSession] = None
        self.auth_token: Optional[str] = None
        self.user_agent: Optional[str] = None
        self.logger = logger.bind(component="esportivabet")

    async def setup(self) -> None:
        """Initialize session and capture auth token via Playwright."""
        self.logger.info("Setting up Esportivabet scraper...")

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context()
            page = await context.new_page()

            token_captured = asyncio.Event()

            async def handle_request(request):
                if "biahosted.com/api" in request.url:
                    auth = request.headers.get("authorization")
                    if auth and not self.auth_token:
                        self.auth_token = auth
                        self.user_agent = request.headers.get("user-agent")
                        self.logger.info("Captured auth token")
                        token_captured.set()

            page.on("request", handle_request)

            try:
                await page.goto("https://esportiva.bet.br/esportes", wait_until="networkidle", timeout=30000)
                await asyncio.wait_for(token_captured.wait(), timeout=15)
            except asyncio.TimeoutError:
                self.logger.warning("Token capture timed out, will retry on first request")
            finally:
                await browser.close()

        self.session = AsyncSession(impersonate="chrome")
        self.logger.info("Esportivabet scraper setup complete")

    async def teardown(self) -> None:
        """Cleanup session."""
        if self.session:
            await self.session.close()
            self.session = None

    def get_available_leagues(self) -> List[LeagueConfig]:
        """Return list of available leagues."""
        return [
            LeagueConfig(
                id=league_id,
                name=league.name,
                url=f"{self.API_URL}?champIds={league.champ_id}",
                country=league.country,
            )
            for league_id, league in LEAGUES.items()
        ]

    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """Scrape odds for a specific league."""
        if not self.session:
            await self.setup()

        league_config = LEAGUES.get(league.id)
        if not league_config:
            self.logger.warning(f"Unknown league: {league.id}")
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
            "champIds": league_config.champ_id,
        }

        headers = {
            "accept": "*/*",
            "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
            "origin": "https://esportiva.bet.br",
            "referer": "https://esportiva.bet.br/",
        }

        if self.auth_token:
            headers["authorization"] = self.auth_token
        if self.user_agent:
            headers["user-agent"] = self.user_agent

        try:
            response = await self.session.get(
                self.API_URL,
                params=params,
                headers=headers,
                timeout=30,
            )

            if response.status_code in (401, 403):
                self.logger.warning("Auth expired, will refresh on next cycle")
                self.auth_token = None
                return []

            response.raise_for_status()
            data = response.json()
            return self._parse_response(data, league, league_config)

        except Exception as e:
            self.logger.error(f"Error scraping {league.name}: {e}")
            return []

    def _get_country_for_league(self, league_id: str) -> str:
        """Get country for a league."""
        league_config = LEAGUES.get(league_id)
        return league_config.country if league_config else "brasil"

    def _get_champ_id_for_league(self, league_id: str) -> str:
        """Get champ_id for a league."""
        league_config = LEAGUES.get(league_id)
        return league_config.champ_id if league_config else ""

    def _get_category_id_for_league(self, league_id: str) -> str:
        """Get category_id for a league."""
        league_config = LEAGUES.get(league_id)
        return league_config.category_id if league_config else ""

    def _parse_response(
        self, data: Dict[str, Any], league: LeagueConfig, league_config: EsportivabetLeague
    ) -> List[ScrapedOdds]:
        """Parse Altenar API response into ScrapedOdds objects."""
        results = []

        odds_map = {odd["id"]: odd for odd in data.get("odds", [])}
        markets_map = {market["id"]: market for market in data.get("markets", [])}
        competitors_map = {comp["id"]: comp for comp in data.get("competitors", [])}

        for event in data.get("events", []):
            try:
                event_id = event.get("id")
                event_name = event.get("name", "")
                competitor_ids = event.get("competitorIds", [])

                if len(competitor_ids) < 2:
                    continue

                home_team = competitors_map.get(competitor_ids[0], {}).get("name", "")
                away_team = competitors_map.get(competitor_ids[1], {}).get("name", "")

                if not home_team or not away_team:
                    parts = event_name.split(" vs. ")
                    if len(parts) == 2:
                        home_team, away_team = parts[0].strip(), parts[1].strip()

                start_date_str = event.get("startDate")
                match_date = None
                if start_date_str:
                    try:
                        match_date = datetime.fromisoformat(start_date_str.replace("Z", "+00:00"))
                    except ValueError:
                        pass

                market_1x2 = None
                for market_id in event.get("marketIds", []):
                    market = markets_map.get(market_id)
                    if market and market.get("typeId") == 1:
                        market_1x2 = market
                        break

                if not market_1x2:
                    continue

                home_odd = None
                draw_odd = None
                away_odd = None

                for odd_id in market_1x2.get("oddIds", []):
                    odd = odds_map.get(odd_id)
                    if not odd:
                        continue

                    type_id = odd.get("typeId")
                    price = odd.get("price")

                    if type_id == 1:
                        home_odd = price
                    elif type_id == 2:
                        draw_odd = price
                    elif type_id == 3:
                        away_odd = price

                if home_odd and draw_odd and away_odd:
                    results.append(
                        ScrapedOdds(
                            home_team_raw=home_team,
                            away_team_raw=away_team,
                            league_raw=league.name,
                            match_date=match_date,
                            home_odd=home_odd,
                            draw_odd=draw_odd,
                            away_odd=away_odd,
                            bookmaker_name="esportivabet",
                            extra_data={
                                "esportivabet_event_id": str(event_id),
                                "esportivabet_champ_id": league_config.champ_id,
                                "esportivabet_category_id": league_config.category_id,
                                "country": league_config.country,
                            },
                        )
                    )

            except Exception as e:
                self.logger.error(f"Error parsing event: {e}")
                continue

        self.logger.info(f"Collected {len(results)} odds for {league.name}")
        return results

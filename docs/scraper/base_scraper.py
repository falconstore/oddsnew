"""
Base Scraper - Abstract class for all bookmaker scrapers.
All specific scrapers (Betano, Bet365, etc.) must inherit from this class.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential


@dataclass
class ScrapedOdds:
    """
    Data class representing scraped odds from a bookmaker.
    This is the standardized format for all scrapers.
    """
    bookmaker_name: str
    home_team_raw: str        # Team name as it appears on the bookmaker site
    away_team_raw: str        # Team name as it appears on the bookmaker site
    league_raw: str           # League name as it appears on the bookmaker site
    match_date: datetime
    home_odd: float
    draw_odd: Optional[float]  # None for markets without draw (e.g., basketball)
    away_odd: float
    market_type: str = "1x2"
    scraped_at: datetime = field(default_factory=datetime.utcnow)
    extra_data: Dict[str, Any] = field(default_factory=dict)
    
    def calculate_margin(self) -> float:
        """
        Calculate the bookmaker's margin (overround).
        Formula: (1/home + 1/draw + 1/away - 1) * 100
        """
        try:
            total = (1 / self.home_odd)
            if self.draw_odd:
                total += (1 / self.draw_odd)
            total += (1 / self.away_odd)
            return round((total - 1) * 100, 2)
        except ZeroDivisionError:
            return 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for database insertion."""
        return {
            "bookmaker_name": self.bookmaker_name,
            "home_team_raw": self.home_team_raw,
            "away_team_raw": self.away_team_raw,
            "league_raw": self.league_raw,
            "match_date": self.match_date.isoformat(),
            "home_odd": self.home_odd,
            "draw_odd": self.draw_odd,
            "away_odd": self.away_odd,
            "market_type": self.market_type,
            "scraped_at": self.scraped_at.isoformat(),
            "margin": self.calculate_margin(),
            "extra_data": self.extra_data,
        }


@dataclass
class LeagueConfig:
    """Configuration for a league to scrape."""
    league_id: str
    name: str
    url: str
    country: str = ""


class BaseScraper(ABC):
    """
    Abstract base class for all bookmaker scrapers.
    
    Each scraper must implement:
    - scrape_league(): Scrape odds from a specific league
    - get_available_leagues(): Return list of available leagues
    
    Optional overrides:
    - setup(): Called before scraping starts
    - teardown(): Called after scraping ends
    """
    
    def __init__(self, name: str, base_url: str):
        self.name = name
        self.base_url = base_url
        self.logger = logger.bind(component=name)
        self._browser = None
        self._context = None
    
    @abstractmethod
    async def scrape_league(self, league: LeagueConfig) -> List[ScrapedOdds]:
        """
        Scrape odds from a specific league.
        
        Args:
            league: League configuration with URL and metadata
            
        Returns:
            List of ScrapedOdds objects
        """
        pass
    
    @abstractmethod
    async def get_available_leagues(self) -> List[LeagueConfig]:
        """
        Return list of available leagues for this bookmaker.
        
        Returns:
            List of LeagueConfig objects
        """
        pass
    
    async def setup(self):
        """
        Called before scraping starts.
        Override to initialize browser, session, etc.
        """
        self.logger.info(f"Setting up {self.name} scraper")
    
    async def teardown(self):
        """
        Called after scraping ends.
        Override to cleanup resources.
        """
        self.logger.info(f"Tearing down {self.name} scraper")
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    async def scrape_all(self) -> List[ScrapedOdds]:
        """
        Scrape all configured leagues.
        Includes retry logic for resilience.
        
        Returns:
            List of all scraped odds
        """
        all_odds = []
        
        try:
            await self.setup()
            leagues = await self.get_available_leagues()
            
            self.logger.info(f"Scraping {len(leagues)} leagues from {self.name}")
            
            for league in leagues:
                try:
                    self.logger.debug(f"Scraping league: {league.name}")
                    odds = await self.scrape_league(league)
                    all_odds.extend(odds)
                    self.logger.info(f"Collected {len(odds)} odds from {league.name}")
                except Exception as e:
                    self.logger.error(f"Error scraping {league.name}: {e}")
                    continue
                    
        except Exception as e:
            self.logger.error(f"Fatal error in {self.name} scraper: {e}")
            raise
        finally:
            await self.teardown()
        
        return all_odds
    
    def _parse_odds(self, text: str) -> Optional[float]:
        """
        Parse odds text to float.
        Handles various formats: "1.50", "1,50", "-", etc.
        """
        if not text or text.strip() in ["-", "N/A", ""]:
            return None
        try:
            cleaned = text.strip().replace(",", ".")
            return float(cleaned)
        except ValueError:
            self.logger.warning(f"Could not parse odds: {text}")
            return None
    
    def _parse_date(self, date_str: str, time_str: str = "") -> Optional[datetime]:
        """
        Parse date/time strings to datetime object.
        Handles common formats from bookmaker sites.
        """
        from dateutil import parser
        try:
            full_str = f"{date_str} {time_str}".strip()
            return parser.parse(full_str)
        except Exception as e:
            self.logger.warning(f"Could not parse date: {date_str} {time_str}: {e}")
            return None

"""
Scrapers Package - All bookmaker-specific scrapers.
"""

from .betano_scraper import BetanoScraper
from .superbet_scraper import SuperbetScraper
from .br4bet_scraper import Br4betScraper

__all__ = ["BetanoScraper", "SuperbetScraper", "Br4betScraper"]

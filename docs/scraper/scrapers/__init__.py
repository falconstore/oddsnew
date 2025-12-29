"""
Scrapers Package - All bookmaker-specific scrapers.
"""

from .betano_scraper import BetanoScraper
from .superbet_scraper import SuperbetScraper
from .br4bet_scraper import Br4betScraper
from .kto_scraper import KtoScraper

__all__ = ["BetanoScraper", "SuperbetScraper", "Br4betScraper", "KtoScraper"]

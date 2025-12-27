"""
Scrapers Package - All bookmaker-specific scrapers.
"""

from .betano_scraper import BetanoScraper
from .superbet_scraper import SuperbetScraper

__all__ = ["BetanoScraper", "SuperbetScraper"]

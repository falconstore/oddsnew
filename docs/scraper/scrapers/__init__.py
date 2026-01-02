"""
Scrapers Package - All bookmaker-specific scrapers.
"""

from .betano_scraper import BetanoScraper
from .superbet_scraper import SuperbetScraper
# from .br4bet_scraper import Br4betScraper  # Pausado - problemas com Cloudflare
from .kto_scraper import KtoScraper
from .sportingbet_scraper import SportingbetScraper

__all__ = ["BetanoScraper", "SuperbetScraper", "KtoScraper", "SportingbetScraper"]

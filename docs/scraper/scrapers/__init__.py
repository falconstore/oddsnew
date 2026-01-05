"""
Scrapers Package - All bookmaker-specific scrapers.
"""

from .betano_scraper import BetanoScraper
from .superbet_scraper import SuperbetScraper
from .superbet_nba_scraper import SuperbetNBAScraper
from .betbra_nba_scraper import BetbraNBAScraper
# from .br4bet_scraper import Br4betScraper  # Pausado - problemas com Cloudflare
from .kto_scraper import KtoScraper
from .sportingbet_scraper import SportingbetScraper
from .novibet_scraper import NovibetScraper
from .betnacional_scraper import BetnacionalScraper
from .stake_scraper import StakeScraper
from .mcgames_scraper import McgamesScraper

__all__ = ["BetanoScraper", "SuperbetScraper", "SuperbetNBAScraper", "BetbraNBAScraper", "KtoScraper", "SportingbetScraper", "NovibetScraper", "BetnacionalScraper", "StakeScraper", "McgamesScraper"]

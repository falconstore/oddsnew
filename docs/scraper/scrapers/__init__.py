"""
Scrapers Package - All bookmaker-specific scrapers.
"""

from .betano_scraper import BetanoScraper
from .betano_nba_scraper import BetanoNBAScraper
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
from .aposta1_scraper import Aposta1Scraper
from .esportivabet_scraper import EsportivabetScraper
from .esportivabet_nba_scraper import EsportivabetNBAScraper

__all__ = ["BetanoScraper", "BetanoNBAScraper", "SuperbetScraper", "SuperbetNBAScraper", "BetbraNBAScraper", "KtoScraper", "SportingbetScraper", "NovibetScraper", "BetnacionalScraper", "StakeScraper", "McgamesScraper", "Aposta1Scraper", "EsportivabetScraper", "EsportivabetNBAScraper"]

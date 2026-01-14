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
from .kto_nba_scraper import KtoNBAScraper
from .sportingbet_scraper import SportingbetScraper
from .sportingbet_nba_scraper import SportingbetNBAScraper
from .novibet_scraper import NovibetScraper
from .novibet_nba_scraper import NovibetNBAScraper
from .betnacional_scraper import BetnacionalScraper
from .betnacional_nba_scraper import BetnacionalNBAScraper
from .stake_scraper import StakeScraper
from .mcgames_scraper import McgamesScraper
from .aposta1_scraper import Aposta1Scraper
from .esportivabet_scraper import EsportivabetScraper
from .esportivabet_nba_scraper import EsportivabetNBAScraper
from .jogodeouro_scraper import JogodeOuroScraper
from .jogodeouro_nba_scraper import JogodeOuroNBAScraper

__all__ = [
    "BetanoScraper", "BetanoNBAScraper", 
    "SuperbetScraper", "SuperbetNBAScraper", 
    "BetbraNBAScraper", 
    "KtoScraper", "KtoNBAScraper",
    "SportingbetScraper", "SportingbetNBAScraper",
    "NovibetScraper", "NovibetNBAScraper", 
    "BetnacionalScraper", "BetnacionalNBAScraper",
    "StakeScraper", 
    "McgamesScraper", "Aposta1Scraper", 
    "EsportivabetScraper", "EsportivabetNBAScraper", 
    "JogodeOuroScraper", "JogodeOuroNBAScraper"
]

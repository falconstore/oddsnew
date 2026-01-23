"""
Scrapers Package - All bookmaker-specific scrapers.

Unified scrapers (handle both Football and Basketball):
- SuperbetScraper
- KtoScraper
- StakeScraper
- SportingbetScraper
- NovibetScraper
- BetnacionalScraper
- EstrelabetScraper
"""

from .betano_scraper import BetanoScraper
from .betano_nba_scraper import BetanoNBAScraper
from .superbet_scraper import SuperbetScraper
from .betbra_nba_scraper import BetbraNBAScraper
from .br4bet_nba_scraper import Br4betNBAScraper
from .kto_scraper import KtoScraper
from .sportingbet_scraper import SportingbetScraper
from .novibet_scraper import NovibetScraper
from .betnacional_scraper import BetnacionalScraper
from .stake_scraper import StakeScraper
from .mcgames_scraper import McgamesScraper
from .mcgames_nba_scraper import McgamesNBAScraper
from .aposta1_scraper import Aposta1Scraper
from .aposta1_nba_scraper import Aposta1NBAScraper
from .esportivabet_scraper import EsportivabetScraper
from .esportivabet_nba_scraper import EsportivabetNBAScraper
from .jogodeouro_scraper import JogodeOuroScraper
from .jogodeouro_nba_scraper import JogodeOuroNBAScraper
from .bet365_scraper import Bet365Scraper
from .tradeball_scraper import TradeballScraper

__all__ = [
    "BetanoScraper", "BetanoNBAScraper", 
    "SuperbetScraper",
    "BetbraNBAScraper", "Br4betNBAScraper",
    "KtoScraper",
    "SportingbetScraper",
    "NovibetScraper",
    "BetnacionalScraper",
    "StakeScraper",
    "McgamesScraper", "McgamesNBAScraper",
    "Aposta1Scraper", "Aposta1NBAScraper", 
    "EsportivabetScraper", "EsportivabetNBAScraper", 
    "JogodeOuroScraper", "JogodeOuroNBAScraper",
    "Bet365Scraper",
    "TradeballScraper"
]

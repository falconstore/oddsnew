"""
Scrapers Package - All bookmaker-specific scrapers.

IMPORTANT: This file intentionally does NOT import scrapers automatically.
This prevents a syntax error in one scraper from breaking all others.

Use lazy imports via importlib when you need a specific scraper:
    
    import importlib
    module = importlib.import_module("scrapers.superbet_scraper")
    SuperbetScraper = module.SuperbetScraper

Or import directly when needed:
    
    from scrapers.superbet_scraper import SuperbetScraper

Available scrapers:
    Unified (Football + NBA): superbet, estrelabet, kto, sportingbet, novibet, betnacional, stake
    Football only: betano, betbra, br4bet, mcgames, aposta1, esportivabet, jogodeouro, bet365, tradeball
    NBA only: betano_nba, betbra_nba, br4bet_nba, mcgames_nba, aposta1_nba, esportivabet_nba, jogodeouro_nba
"""

__all__ = [
    # Unified
    "SuperbetScraper", "EstrelabetScraper", "KtoScraper", 
    "SportingbetScraper", "NovibetScraper", "BetnacionalScraper", "StakeScraper",
    # Football
    "BetanoScraper", "BetbraScraper", "Br4betScraper", "McgamesScraper",
    "Aposta1Scraper", "EsportivabetScraper", "JogodeOuroScraper", 
    "Bet365Scraper", "TradeballScraper",
    # NBA
    "BetanoNBAScraper", "BetbraNBAScraper", "Br4betNBAScraper", "McgamesNBAScraper",
    "Aposta1NBAScraper", "EsportivabetNBAScraper", "JogodeOuroNBAScraper",
]

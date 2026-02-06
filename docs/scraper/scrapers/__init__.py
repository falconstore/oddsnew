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
    Unified (Football + NBA): 
        - superbet, estrelabet, kto, sportingbet, novibet, betnacional, stake
        - betano, betbra (Playwright)
        - aposta1, esportivabet (Playwright - unified)
        - mcgames, jogodeouro (Playwright + curl_cffi - unified)
    
    Football only: br4bet, bet365, tradeball
    NBA only: br4bet_nba
"""

__all__ = [
    # Unified (HTTPX)
    "SuperbetScraper", "EstrelabetScraper", "KtoScraper", 
    "SportingbetScraper", "NovibetScraper", "BetnacionalScraper", "StakeScraper",
    # Unified (Playwright)
    "BetanoUnifiedScraper", "BetbraUnifiedScraper",
    "Aposta1UnifiedScraper", "EsportivabetUnifiedScraper",
    # Unified (Playwright + curl_cffi)
    "McgamesUnifiedScraper", "JogodeOuroUnifiedScraper",
    # Football only
    "Br4betScraper", "Bet365Scraper", "TradeballScraper",
    # NBA only
    "Br4betNBAScraper",
]

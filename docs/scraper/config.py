"""
Configuration settings for the Odds Scraper.
Loads environment variables from .env file.
"""

import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Supabase Configuration
    supabase_url: str
    supabase_service_key: str
    
    # Scraping Configuration
    scrape_interval_seconds: int = 20
    stale_data_threshold_minutes: int = 30
    request_timeout_seconds: int = 30
    max_retries: int = 3
    
    # Browser Configuration
    headless: bool = True
    browser_timeout_ms: int = 30000
    
    # Logging
    log_level: str = "INFO"
    log_file: Optional[str] = "scraper.log"
    
    # Proxy Configuration (optional)
    use_proxy: bool = False
    proxy_url: Optional[str] = None
    
    # Alert Thresholds
    value_bet_threshold: float = 5.0  # % edge over fair odds
    arbitrage_threshold: float = 0.0  # % guaranteed profit
    
    # Bookmaker-specific tokens (optional)
    br4bet_authorization: Optional[str] = None
    estrelabet_authorization: Optional[str] = None
    
    # Tradeball (Betbra Dball Exchange)
    tradeball_auth_token: Optional[str] = None
    tradeball_cookies: Optional[str] = None
    tradeball_username: Optional[str] = None
    tradeball_password: Optional[str] = None
    
    # odds-api.io (para Bet365)
    odds_api_key: Optional[str] = None
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"  # Allow extra env vars without error


# Global settings instance
settings = Settings()


# Bookmaker configurations
BOOKMAKERS = {
    "betano": {
        "name": "Betano",
        "base_url": "https://www.betano.com",
        "enabled": True,
        "priority": 1,
    },
    "superbet": {
        "name": "Superbet",
        "base_url": "https://superbet.bet.br",
        "enabled": True,
        "priority": 2,
    },
    "bet365": {
        "name": "Bet365",
        "base_url": "https://www.bet365.com",
        "enabled": True,
        "priority": 3,
    },
    "sportingbet": {
        "name": "Sportingbet",
        "base_url": "https://www.sportingbet.com",
        "enabled": True,
        "priority": 4,
    },
    "betfair": {
        "name": "Betfair",
        "base_url": "https://www.betfair.com",
        "enabled": True,
        "priority": 5,
    },
    "1xbet": {
        "name": "1xBet",
        "base_url": "https://www.1xbet.com",
        "enabled": True,
        "priority": 6,
    },
    "betbra": {
        "name": "Betbra",
        "base_url": "https://betbra.bet.br",
        "enabled": True,
        "priority": 7,
        "type": "exchange",  # Exchange - only uses BACK odds
    },
    "br4bet": {
        "name": "Br4bet",
        "base_url": "https://br4.bet.br",
        "enabled": True,
        "priority": 8,
    },
    "estrelabet": {
        "name": "Estrelabet",
        "base_url": "https://www.estrelabet.bet.br",
        "enabled": True,
        "priority": 9,
    },
    "stake": {
        "name": "Stake",
        "base_url": "https://stake.bet.br",
        "enabled": True,
        "priority": 10,
    },
}

# League mappings (URL paths for each bookmaker)
LEAGUE_CONFIGS = {
    "brasileirao_a": {
        "name": "Brasileirão Série A",
        "country": "Brazil",
        "urls": {
            "betano": "/sport/futebol/brasil/brasileirao-serie-a",
            "bet365": "/soccer/brazil-serie-a",
            "sportingbet": "/sport/futebol/brasil/brasileirao",
        },
    },
    "premier_league": {
        "name": "Premier League",
        "country": "England",
        "urls": {
            "betano": "/sport/futebol/inglaterra/premier-league",
            "bet365": "/soccer/england-premier-league",
            "sportingbet": "/sport/futebol/inglaterra/premier-league",
        },
    },
    "la_liga": {
        "name": "La Liga",
        "country": "Spain",
        "urls": {
            "betano": "/sport/futebol/espanha/laliga",
            "bet365": "/soccer/spain-la-liga",
            "sportingbet": "/sport/futebol/espanha/la-liga",
        },
    },
}

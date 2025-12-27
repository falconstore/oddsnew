"""
Main Entry Point - Odds Scraper Application.

Usage:
    # Run once
    python main.py --once
    
    # Run continuously (default)
    python main.py
    
    # Run with custom interval
    python main.py --interval 120
"""

import asyncio
import argparse
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
from loguru import logger

from config import settings
from orchestrator import Orchestrator

# Import scrapers
from scrapers.betano_scraper import BetanoScraper
from scrapers.superbet_scraper import SuperbetScraper
from scrapers.betbra_scraper import BetbraScraper
# from scrapers.bet365 import Bet365Scraper
# from scrapers.sportingbet import SportingbetScraper
# from scrapers.betfair import BetfairScraper
# from scrapers.onexbet import OneXBetScraper


def setup_logging():
    """Configure structured logging."""
    # Remove default handler
    logger.remove()
    
    # Console output
    logger.add(
        sys.stderr,
        format=(
            "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
            "<level>{level: <8}</level> | "
            "<cyan>{extra[component]}</cyan> | "
            "<level>{message}</level>"
        ),
        level=settings.log_level,
        colorize=True,
    )
    
    # File output (if configured)
    if settings.log_file:
        logger.add(
            settings.log_file,
            format=(
                "{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | "
                "{extra[component]} | {message}"
            ),
            level=settings.log_level,
            rotation="10 MB",
            retention="7 days",
            compression="gz",
        )
    
    # Bind default component
    return logger.bind(component="main")


def create_orchestrator() -> Orchestrator:
    """Create and configure the orchestrator with all scrapers."""
    orchestrator = Orchestrator()
    
    # Register scrapers
    orchestrator.register_scraper(BetanoScraper())
    orchestrator.register_scraper(SuperbetScraper())
    orchestrator.register_scraper(BetbraScraper())  # Exchange - only BACK odds
    # orchestrator.register_scraper(Bet365Scraper())
    # orchestrator.register_scraper(SportingbetScraper())
    # orchestrator.register_scraper(BetfairScraper())
    # orchestrator.register_scraper(OneXBetScraper())
    
    return orchestrator


async def main(run_once: bool = False, interval: int = None):
    """
    Main application entry point.
    
    Args:
        run_once: If True, run a single scraping cycle and exit
        interval: Override the scraping interval (seconds)
    """
    log = setup_logging()
    log.info("=" * 50)
    log.info("Starting Odds Scraper")
    log.info(f"Supabase URL: {settings.supabase_url[:30]}...")
    log.info(f"Interval: {interval or settings.scrape_interval_seconds}s")
    log.info("=" * 50)
    
    orchestrator = create_orchestrator()
    
    if not orchestrator.scrapers:
        log.warning(
            "No scrapers registered! "
            "Uncomment scraper imports in main.py and implement them."
        )
        log.info("Running in demo mode with no scrapers...")
    
    try:
        if run_once:
            await orchestrator.initialize()
            summary = await orchestrator.run_once()
            log.info(f"Single run complete: {summary}")
        else:
            await orchestrator.run_forever(interval_seconds=interval)
    except KeyboardInterrupt:
        log.info("Shutting down (Ctrl+C)...")
    except Exception as e:
        log.exception(f"Fatal error: {e}")
        raise


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Odds Scraper - Collect betting odds from multiple bookmakers"
    )
    
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run a single scraping cycle and exit"
    )
    
    parser.add_argument(
        "--interval",
        type=int,
        default=None,
        help="Override scraping interval in seconds"
    )
    
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug logging"
    )
    
    return parser.parse_args()


if __name__ == "__main__":
    # Load environment variables
    load_dotenv()
    
    # Parse arguments
    args = parse_args()
    
    # Override log level if debug mode
    if args.debug:
        settings.log_level = "DEBUG"
    
    # Run the application
    asyncio.run(main(
        run_once=args.once,
        interval=args.interval
    ))

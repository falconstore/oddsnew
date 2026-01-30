#!/usr/bin/env python3
"""
Cleanup Service - Limpa matches antigos periodicamente.

Serviço de manutenção que roda a cada 5 minutos.

Uso:
    python run_cleanup.py --interval 300
    python run_cleanup.py --interval 300 --debug
"""

import asyncio
import argparse
import sys
from pathlib import Path
from datetime import datetime, timezone

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from loguru import logger

from config import settings
from supabase_client import SupabaseClient


def setup_logging(debug: bool = False):
    """Configura logging estruturado."""
    logger.remove()
    
    log_level = "DEBUG" if debug else settings.log_level
    
    logger.add(
        sys.stderr,
        format=(
            "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
            "<level>{level: <8}</level> | "
            "<cyan>{extra[component]}</cyan> | "
            "<level>{message}</level>"
        ),
        level=log_level,
        colorize=True,
    )
    
    Path("logs").mkdir(exist_ok=True)
    logger.add(
        "logs/cleanup.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {extra[component]} | {message}",
        level=log_level,
        rotation="10 MB",
        retention="3 days",
        compression="gz",
    )
    
    return logger.bind(component="cleanup")


async def cleanup_old_matches(supabase: SupabaseClient, log: logger) -> tuple:
    """
    Remove matches que já começaram.
    
    Returns:
        Tuple (football_cleaned, nba_cleaned)
    """
    football_cleaned = 0
    nba_cleaned = 0
    
    # Cleanup football
    try:
        result = supabase.client.rpc('cleanup_started_matches').execute()
        football_cleaned = result.data if result.data else 0
        if football_cleaned > 0:
            log.info(f"Cleaned {football_cleaned} old football matches")
    except Exception as e:
        log.warning(f"Failed to cleanup football matches: {e}")
    
    # Cleanup NBA
    try:
        result = supabase.client.rpc('cleanup_started_nba_matches').execute()
        nba_cleaned = result.data if result.data else 0
        if nba_cleaned > 0:
            log.info(f"Cleaned {nba_cleaned} old NBA matches")
    except Exception as e:
        log.warning(f"Failed to cleanup NBA matches: {e}")
    
    return football_cleaned, nba_cleaned


async def run_forever(interval: int, log: logger):
    """Loop infinito para limpeza."""
    supabase = SupabaseClient()
    cycle_count = 0
    
    log.info(f"Starting cleanup service with interval: {interval}s ({interval // 60} min)")
    
    while True:
        cycle_count += 1
        start_time = datetime.now(timezone.utc)
        
        try:
            football, nba = await cleanup_old_matches(supabase, log)
            
            duration = (datetime.now(timezone.utc) - start_time).total_seconds()
            
            if football > 0 or nba > 0:
                log.info(
                    f"[Cycle {cycle_count}] "
                    f"Cleaned - Football: {football}, NBA: {nba}, "
                    f"Duration: {duration:.1f}s"
                )
            else:
                log.debug(f"[Cycle {cycle_count}] No matches to clean")
                
        except Exception as e:
            log.error(f"[Cycle {cycle_count}] Error: {e}")
        
        try:
            await asyncio.sleep(interval)
        except asyncio.CancelledError:
            log.info("Shutdown requested during sleep")
            break


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Cleanup Service - Limpa matches antigos"
    )
    
    parser.add_argument(
        "--interval",
        type=int,
        default=300,
        help="Intervalo entre ciclos em segundos (default: 300 = 5 min)"
    )
    
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Ativar logging de debug"
    )
    
    return parser.parse_args()


async def main():
    """Função principal."""
    load_dotenv()
    args = parse_args()
    
    log = setup_logging(args.debug)
    
    log.info("=" * 50)
    log.info("Cleanup Service")
    log.info(f"Supabase URL: {settings.supabase_url[:30]}...")
    log.info(f"Interval: {args.interval}s ({args.interval // 60} min)")
    log.info("=" * 50)
    
    try:
        await run_forever(args.interval, log)
    except (KeyboardInterrupt, asyncio.CancelledError):
        log.info("Shutting down gracefully...")
    except Exception as e:
        log.exception(f"Fatal error: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())

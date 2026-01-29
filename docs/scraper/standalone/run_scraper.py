#!/usr/bin/env python3
"""
Standalone Scraper Runner - Roda um único scraper em loop infinito.

Uso:
    python run_scraper.py --scraper betano --interval 30
    python run_scraper.py --scraper bet365 --interval 45 --debug

Scrapers disponíveis:
    Unified (Futebol + NBA): superbet, estrelabet, kto, sportingbet, novibet, betnacional, stake
    Football only: betano, betbra, br4bet, mcgames, aposta1, esportivabet, jogodeouro, bet365, tradeball
    NBA only: betano_nba, betbra_nba, br4bet_nba, mcgames_nba, aposta1_nba, esportivabet_nba, jogodeouro_nba
"""

import asyncio
import argparse
import sys
from pathlib import Path
from datetime import datetime, timezone

# Adicionar parent directory ao path
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from loguru import logger

from config import settings


def setup_logging(scraper_name: str, debug: bool = False):
    """Configura logging estruturado para o scraper."""
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
    
    # Log file específico por scraper
    log_file = f"logs/{scraper_name}.log"
    Path("logs").mkdir(exist_ok=True)
    
    logger.add(
        log_file,
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {extra[component]} | {message}",
        level=log_level,
        rotation="10 MB",
        retention="3 days",
        compression="gz",
    )
    
    return logger.bind(component=scraper_name)


def get_scraper_class(scraper_name: str):
    """Retorna a classe do scraper pelo nome."""
    from scrapers import (
        BetanoScraper, BetanoNBAScraper,
        SuperbetScraper,
        BetbraNBAScraper, Br4betNBAScraper,
        KtoScraper,
        SportingbetScraper,
        NovibetScraper,
        BetnacionalScraper,
        StakeScraper,
        McgamesScraper, McgamesNBAScraper,
        Aposta1Scraper, Aposta1NBAScraper,
        EsportivabetScraper, EsportivabetNBAScraper,
        JogodeOuroScraper, JogodeOuroNBAScraper,
        Bet365Scraper,
        TradeballScraper,
    )
    
    # Importar scrapers que não estão no __init__.py
    from scrapers.betbra_scraper import BetbraScraper
    from scrapers.br4bet_scraper import Br4betScraper
    from scrapers.estrelabet_scraper import EstrelabetScraper
    
    SCRAPER_MAP = {
        # Unified scrapers (Football + NBA)
        "superbet": SuperbetScraper,
        "estrelabet": EstrelabetScraper,
        "kto": KtoScraper,
        "sportingbet": SportingbetScraper,
        "novibet": NovibetScraper,
        "betnacional": BetnacionalScraper,
        "stake": StakeScraper,
        
        # Football-only scrapers
        "betano": BetanoScraper,
        "betbra": BetbraScraper,
        "br4bet": Br4betScraper,
        "mcgames": McgamesScraper,
        "aposta1": Aposta1Scraper,
        "esportivabet": EsportivabetScraper,
        "jogodeouro": JogodeOuroScraper,
        "bet365": Bet365Scraper,
        "tradeball": TradeballScraper,
        
        # NBA-only scrapers
        "betano_nba": BetanoNBAScraper,
        "betbra_nba": BetbraNBAScraper,
        "br4bet_nba": Br4betNBAScraper,
        "mcgames_nba": McgamesNBAScraper,
        "aposta1_nba": Aposta1NBAScraper,
        "esportivabet_nba": EsportivabetNBAScraper,
        "jogodeouro_nba": JogodeOuroNBAScraper,
    }
    
    scraper_class = SCRAPER_MAP.get(scraper_name.lower())
    if not scraper_class:
        available = ", ".join(sorted(SCRAPER_MAP.keys()))
        raise ValueError(f"Scraper '{scraper_name}' não encontrado. Disponíveis: {available}")
    
    return scraper_class


async def run_forever(scraper_name: str, interval: int, log: logger):
    """Loop infinito para um único scraper."""
    from shared_resources import get_shared_resources
    from normalizer import OddsNormalizer
    from supabase_client import SupabaseClient
    
    log.info(f"Starting standalone scraper: {scraper_name}")
    log.info(f"Interval: {interval}s")
    
    # Inicializar recursos compartilhados
    resources = await get_shared_resources()
    normalizer = OddsNormalizer(resources)
    supabase = SupabaseClient()
    
    # Obter bookmaker_id para o scraper (se disponível)
    bookmaker_name = scraper_name.replace("_nba", "").replace("-nba", "")
    bookmaker_id = await supabase.get_bookmaker_id(bookmaker_name)
    
    # Criar instância do scraper
    scraper_class = get_scraper_class(scraper_name)
    scraper = scraper_class()
    
    # NAO chamar setup() aqui - cada scraper gerencia seu proprio setup/teardown dentro de scrape_all()
    
    cycle_count = 0
    
    while True:  # Loop simples infinito
        cycle_count += 1
        start_time = datetime.now(timezone.utc)
        error_message = None
        odds_collected = 0
        odds_inserted = 0
        
        try:
            # Limpar cache de logs não matcheados
            resources.team_matcher.clear_log_cache()
            
            # Recarregar caches a cada 10 ciclos
            if cycle_count % 10 == 0:
                await resources.reload_caches()
            
            # Executar scraping (scraper gerencia seu proprio setup/teardown)
            odds = await scraper.scrape_all()
            odds_collected = len(odds) if odds else 0
            
            if odds:
                # Normalizar e inserir
                football, nba = await normalizer.normalize_and_insert(odds)
                odds_inserted = football + nba
                
                log.info(
                    f"[Cycle {cycle_count}] "
                    f"Collected: {odds_collected}, "
                    f"Football: {football}, NBA: {nba}, "
                    f"Duration: {(datetime.now(timezone.utc) - start_time).total_seconds():.1f}s"
                )
            else:
                log.warning(f"[Cycle {cycle_count}] No odds collected")
                
        except Exception as e:
            error_message = str(e)[:500]  # Limitar tamanho do erro
            log.error(f"[Cycle {cycle_count}] Error: {e}")
        
        # Enviar heartbeat independente do resultado
        try:
            await supabase.upsert_scraper_status(
                scraper_name=scraper_name,
                bookmaker_id=bookmaker_id,
                odds_collected=odds_collected,
                odds_inserted=odds_inserted,
                cycle_count=cycle_count,
                error=error_message
            )
        except Exception as hb_error:
            log.warning(f"Failed to send heartbeat: {hb_error}")
        
        await asyncio.sleep(interval)


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Standalone Scraper Runner - Roda um único scraper em loop infinito"
    )
    
    parser.add_argument(
        "--scraper",
        required=True,
        help="Nome do scraper (ex: betano, superbet, bet365)"
    )
    
    parser.add_argument(
        "--interval",
        type=int,
        default=30,
        help="Intervalo entre ciclos em segundos (default: 30)"
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
    
    log = setup_logging(args.scraper, args.debug)
    
    log.info("=" * 50)
    log.info(f"Standalone Scraper: {args.scraper}")
    log.info(f"Supabase URL: {settings.supabase_url[:30]}...")
    log.info("=" * 50)
    
    try:
        await run_forever(args.scraper, args.interval, log)
    except KeyboardInterrupt:
        log.info("Shutting down (Ctrl+C)...")
    except Exception as e:
        log.exception(f"Fatal error: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())

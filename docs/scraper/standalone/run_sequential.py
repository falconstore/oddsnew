#!/usr/bin/env python3
"""
Sequential Scraper Runner - Executa scrapers em sequência (um após o outro).

Mantém o sistema leve executando apenas um scraper por vez, sem intervalos entre eles.
Ideal para VPS com recursos limitados.

Uso:
    python run_sequential.py --mode all      # Todos os scrapers em 1 processo
    python run_sequential.py --mode light    # Apenas HTTPX scrapers (ciclo ~2-3 min)
    python run_sequential.py --mode heavy    # Apenas Playwright scrapers (ciclo ~5 min)
    python run_sequential.py --scrapers "superbet,betano,bet365"  # Lista customizada

Rollback para modo paralelo:
    pm2 stop all && pm2 delete all && pm2 start ecosystem.config.js
"""

import asyncio
import argparse
import sys
import time
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Optional

# Adicionar parent directory ao path
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from loguru import logger

from config import settings


# ============================================
# DEFINIÇÃO DOS GRUPOS DE SCRAPERS
# ============================================

# Scrapers leves (HTTPX/aiohttp) - ~10s cada
LIGHT_SCRAPERS = [
    "superbet",
    "novibet", 
    "kto",
    "estrelabet",
    "sportingbet",
    "betnacional",
    "br4bet",
    "mcgames",
    "jogodeouro",
    "tradeball",
    "bet365",
    # NBA-only (HTTPX)
    "br4bet_nba",
    "mcgames_nba",
    "jogodeouro_nba",
]

# Scrapers pesados (Playwright) - ~60s cada
HEAVY_SCRAPERS = [
    "betano",
    "betbra",
    "stake",
    "aposta1",
    "esportivabet",
]

# Ordem intercalada para distribuir carga (modo "all")
# 3 leves -> 1 pesado -> 3 leves -> 1 pesado ...
ALL_SCRAPERS_INTERLEAVED = [
    # Bloco 1: 3 leves + 1 pesado
    "superbet", "novibet", "kto", 
    "betano",  # PESADO
    
    # Bloco 2: 3 leves + 1 pesado
    "estrelabet", "sportingbet", "betnacional",
    "betbra",  # PESADO
    
    # Bloco 3: 3 leves + 1 pesado
    "br4bet", "mcgames", "jogodeouro",
    "stake",  # PESADO (com pool reduzido)
    
    # Bloco 4: 2 leves + 1 pesado
    "tradeball", "bet365",
    "aposta1",  # PESADO
    
    # Bloco 5: 3 leves + 1 pesado
    "br4bet_nba", "mcgames_nba", "jogodeouro_nba",
    "esportivabet",  # PESADO
]

# Timeout máximo por scraper (segundos)
SCRAPER_TIMEOUT = 120


def setup_logging(mode: str, debug: bool = False):
    """Configura logging estruturado para o orquestrador sequencial."""
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
    
    # Log file específico por modo
    log_file = f"logs/sequential-{mode}.log"
    Path("logs").mkdir(exist_ok=True)
    
    logger.add(
        log_file,
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {extra[component]} | {message}",
        level=log_level,
        rotation="10 MB",
        retention="3 days",
        compression="gz",
    )
    
    return logger.bind(component=f"seq-{mode}")


def get_scraper_class(scraper_name: str):
    """Retorna a classe do scraper pelo nome usando lazy import.
    
    Usa importlib para importar APENAS o módulo do scraper solicitado,
    evitando que um erro de sintaxe em um scraper derrube todos os outros.
    """
    import importlib
    
    # Mapeamento: nome_do_scraper -> (módulo, classe)
    SCRAPER_MAP = {
        # Unified scrapers (Football + NBA) - Single browser session
        "superbet": ("scrapers.superbet_scraper", "SuperbetScraper"),
        "estrelabet": ("scrapers.estrelabet_scraper", "EstrelabetScraper"),
        "kto": ("scrapers.kto_scraper", "KtoScraper"),
        "sportingbet": ("scrapers.sportingbet_scraper", "SportingbetScraper"),
        "novibet": ("scrapers.novibet_scraper", "NovibetScraper"),
        "betnacional": ("scrapers.betnacional_scraper", "BetnacionalScraper"),
        "stake": ("scrapers.stake_scraper", "StakeScraper"),
        
        # Unified Playwright scrapers (Football + NBA) - Optimized
        "betano": ("scrapers.betano_unified_scraper", "BetanoUnifiedScraper"),
        "betbra": ("scrapers.betbra_unified_scraper", "BetbraUnifiedScraper"),
        "aposta1": ("scrapers.aposta1_unified_scraper", "Aposta1UnifiedScraper"),
        "esportivabet": ("scrapers.esportivabet_unified_scraper", "EsportivabetUnifiedScraper"),
        
        # HTTPX-based scrapers (light) - Football only
        "br4bet": ("scrapers.br4bet_scraper", "Br4betScraper"),
        "mcgames": ("scrapers.mcgames_scraper", "McgamesScraper"),
        "jogodeouro": ("scrapers.jogodeouro_scraper", "JogodeOuroScraper"),
        "bet365": ("scrapers.bet365_scraper", "Bet365Scraper"),
        "tradeball": ("scrapers.tradeball_scraper", "TradeballScraper"),
        
        # NBA-only scrapers (HTTPX-based, kept for compatibility)
        "br4bet_nba": ("scrapers.br4bet_nba_scraper", "Br4betNBAScraper"),
        "mcgames_nba": ("scrapers.mcgames_nba_scraper", "McgamesNBAScraper"),
        "jogodeouro_nba": ("scrapers.jogodeouro_nba_scraper", "JogodeOuroNBAScraper"),
    }
    
    scraper_key = scraper_name.lower()
    if scraper_key not in SCRAPER_MAP:
        available = ", ".join(sorted(SCRAPER_MAP.keys()))
        raise ValueError(f"Scraper '{scraper_name}' não encontrado. Disponíveis: {available}")
    
    module_path, class_name = SCRAPER_MAP[scraper_key]
    
    try:
        module = importlib.import_module(module_path)
        scraper_class = getattr(module, class_name)
        return scraper_class
    except Exception as e:
        raise ImportError(f"Falha ao importar {class_name} de {module_path}: {e}") from e


async def run_single_scraper(
    scraper_name: str,
    normalizer,
    supabase,
    cycle: int,
    log
) -> dict:
    """
    Executa um único scraper com timeout.
    
    Returns:
        dict com métricas: odds_collected, odds_inserted, duration, error
    """
    start = time.time()
    result = {
        "scraper": scraper_name,
        "odds_collected": 0,
        "odds_inserted": 0,
        "duration": 0,
        "error": None,
    }
    
    try:
        # Lazy import da classe do scraper
        scraper_class = get_scraper_class(scraper_name)
        scraper = scraper_class()
        
        # Executar com timeout
        odds = await asyncio.wait_for(
            scraper.scrape_all(),
            timeout=SCRAPER_TIMEOUT
        )
        
        result["odds_collected"] = len(odds) if odds else 0
        
        # Normalizar e inserir
        if odds:
            football, nba = await normalizer.normalize_and_insert(odds)
            result["odds_inserted"] = football + nba
        
        result["duration"] = time.time() - start
        
        log.info(
            f"{scraper_name}: {result['odds_collected']} -> "
            f"{result['odds_inserted']} em {result['duration']:.1f}s"
        )
        
    except asyncio.TimeoutError:
        result["duration"] = time.time() - start
        result["error"] = f"Timeout após {SCRAPER_TIMEOUT}s"
        log.error(f"{scraper_name} TIMEOUT ({SCRAPER_TIMEOUT}s)")
        
    except asyncio.CancelledError:
        result["duration"] = time.time() - start
        result["error"] = "Cancelled"
        log.warning(f"{scraper_name} cancelled")
        raise  # Re-raise para propagar o cancelamento
        
    except Exception as e:
        result["duration"] = time.time() - start
        result["error"] = str(e)[:500]
        log.error(f"{scraper_name} ERROR: {e}")
    
    # Enviar heartbeat
    try:
        bookmaker_name = scraper_name.replace("_nba", "").replace("-nba", "")
        bookmaker_id = await supabase.get_bookmaker_id(bookmaker_name)
        
        await supabase.upsert_scraper_status(
            scraper_name=scraper_name,
            bookmaker_id=bookmaker_id,
            odds_collected=result["odds_collected"],
            odds_inserted=result["odds_inserted"],
            cycle_count=cycle,
            error=result["error"]
        )
    except Exception as hb_error:
        log.warning(f"Failed to send heartbeat for {scraper_name}: {hb_error}")
    
    return result


async def run_sequential(scrapers: List[str], log):
    """
    Loop principal: executa scrapers em sequência, sem intervalos.
    """
    from shared_resources import get_shared_resources
    from normalizer import OddsNormalizer
    from supabase_client import SupabaseClient
    
    log.info(f"Initializing sequential runner with {len(scrapers)} scrapers")
    log.info(f"Order: {' -> '.join(scrapers)}")
    
    # Inicializar recursos compartilhados (1 vez)
    resources = await get_shared_resources()
    normalizer = OddsNormalizer(resources)
    supabase = SupabaseClient()
    
    cycle = 0
    
    while True:
        cycle += 1
        cycle_start = time.time()
        
        log.info(f"{'='*50}")
        log.info(f"CYCLE {cycle} STARTING ({len(scrapers)} scrapers)")
        log.info(f"{'='*50}")
        
        # Limpar cache de logs não matcheados
        resources.team_matcher.clear_log_cache()
        
        # Recarregar caches a cada 10 ciclos
        if cycle % 10 == 0:
            log.info("Reloading caches...")
            await resources.reload_caches()
        
        # Métricas do ciclo
        total_collected = 0
        total_inserted = 0
        errors = []
        
        # Executar cada scraper em sequência
        for scraper_name in scrapers:
            try:
                result = await run_single_scraper(
                    scraper_name=scraper_name,
                    normalizer=normalizer,
                    supabase=supabase,
                    cycle=cycle,
                    log=log
                )
                
                total_collected += result["odds_collected"]
                total_inserted += result["odds_inserted"]
                
                if result["error"]:
                    errors.append(f"{scraper_name}: {result['error'][:50]}")
                    
            except asyncio.CancelledError:
                log.info("Received shutdown signal during cycle, exiting...")
                return
        
        cycle_duration = time.time() - cycle_start
        
        log.info(f"{'='*50}")
        log.info(
            f"CYCLE {cycle} COMPLETE in {cycle_duration:.1f}s | "
            f"Collected: {total_collected} | Inserted: {total_inserted}"
        )
        if errors:
            log.warning(f"Errors this cycle: {len(errors)}")
        log.info(f"{'='*50}")
        
        # Sem sleep - próximo ciclo imediato


def get_scrapers_for_mode(mode: str, custom_list: Optional[str] = None) -> List[str]:
    """Retorna lista de scrapers baseado no modo selecionado."""
    if custom_list:
        # Lista customizada via --scrapers
        scrapers = [s.strip() for s in custom_list.split(",") if s.strip()]
        return scrapers
    
    if mode == "all":
        # Ordem intercalada para distribuir carga
        return ALL_SCRAPERS_INTERLEAVED
    elif mode == "light":
        return LIGHT_SCRAPERS
    elif mode == "heavy":
        return HEAVY_SCRAPERS
    else:
        raise ValueError(f"Modo inválido: {mode}. Use: all, light, heavy")


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Sequential Scraper Runner - Executa scrapers em sequência"
    )
    
    parser.add_argument(
        "--mode",
        choices=["all", "light", "heavy"],
        default="all",
        help="Modo de execução: all (todos), light (HTTPX), heavy (Playwright)"
    )
    
    parser.add_argument(
        "--scrapers",
        type=str,
        default=None,
        help="Lista customizada de scrapers separados por vírgula"
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
    
    # Determinar scrapers a executar
    scrapers = get_scrapers_for_mode(args.mode, args.scrapers)
    
    if not scrapers:
        print("Nenhum scraper selecionado!")
        sys.exit(1)
    
    log = setup_logging(args.mode, args.debug)
    
    log.info("=" * 60)
    log.info("SEQUENTIAL SCRAPER RUNNER")
    log.info(f"Mode: {args.mode}")
    log.info(f"Scrapers: {len(scrapers)}")
    log.info(f"Timeout per scraper: {SCRAPER_TIMEOUT}s")
    log.info(f"Supabase URL: {settings.supabase_url[:30]}...")
    log.info("=" * 60)
    
    try:
        await run_sequential(scrapers, log)
    except KeyboardInterrupt:
        log.info("Shutting down (Ctrl+C)...")
    except Exception as e:
        log.exception(f"Fatal error: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())

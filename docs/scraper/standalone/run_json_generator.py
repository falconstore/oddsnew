#!/usr/bin/env python3
"""
JSON Generator - Gera odds.json a cada ciclo.

Serviço independente que lê do Supabase e gera o JSON para o frontend.
Não depende de nenhum scraper estar online.

Uso:
    python run_json_generator.py --interval 15
    python run_json_generator.py --interval 20 --debug
"""

import asyncio
import argparse
import json
import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone

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
        "logs/json_generator.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {extra[component]} | {message}",
        level=log_level,
        rotation="10 MB",
        retention="3 days",
        compression="gz",
    )
    
    return logger.bind(component="json_generator")


def group_odds_for_json(raw_data: list, log: logger) -> list:
    """
    Agrupa odds por partida para exportação JSON.
    """
    match_map = {}
    now = datetime.now(timezone.utc)
    five_minutes_ago = now - timedelta(minutes=5)
    
    for row in raw_data:
        match_date_str = row.get("match_date", "")
        try:
            if "T" in match_date_str:
                match_date = datetime.fromisoformat(match_date_str.replace("Z", "+00:00"))
            else:
                match_date = datetime.fromisoformat(match_date_str)
            
            if match_date.tzinfo is None:
                match_date = match_date.replace(tzinfo=timezone.utc)
            
            # Skip matches que já começaram
            if match_date < five_minutes_ago:
                continue
        except (ValueError, TypeError):
            continue
        
        # Composite key para evitar duplicatas
        home_team = row.get("home_team", "")
        away_team = row.get("away_team", "")
        match_date_key = match_date.date().isoformat()
        composite_key = f"{home_team}_{away_team}_{match_date_key}"
        
        if composite_key not in match_map:
            match_map[composite_key] = {
                "match_id": row.get("match_id", ""),
                "match_date": row.get("match_date"),
                "match_status": row.get("match_status"),
                "league_name": row.get("league_name"),
                "league_country": row.get("league_country"),
                "sport_type": row.get("sport_type", "football"),
                "home_team": home_team,
                "home_team_logo": row.get("home_team_logo"),
                "away_team": away_team,
                "away_team_logo": row.get("away_team_logo"),
                "odds": [],
                "best_home": 0,
                "best_draw": 0,
                "best_away": 0,
                "worst_home": float('inf'),
                "worst_draw": float('inf'),
                "worst_away": float('inf')
            }
        
        group = match_map[composite_key]
        
        home_odd = row.get("home_odd", 0) or 0
        draw_odd = row.get("draw_odd", 0) or 0
        away_odd = row.get("away_odd", 0) or 0
        
        bookmaker_odds = {
            "bookmaker_id": row.get("bookmaker_id"),
            "bookmaker_name": row.get("bookmaker_name"),
            "home_odd": home_odd,
            "draw_odd": draw_odd,
            "away_odd": away_odd,
            "odds_type": row.get("odds_type", "PA"),
            "margin_percentage": row.get("margin_percentage"),
            "data_age_seconds": row.get("data_age_seconds"),
            "scraped_at": row.get("scraped_at"),
            "extra_data": row.get("extra_data")
        }
        
        group["odds"].append(bookmaker_odds)
        
        # Track best/worst odds
        if home_odd > group["best_home"]:
            group["best_home"] = home_odd
        if draw_odd > group["best_draw"]:
            group["best_draw"] = draw_odd
        if away_odd > group["best_away"]:
            group["best_away"] = away_odd
        if home_odd > 0 and home_odd < group["worst_home"]:
            group["worst_home"] = home_odd
        if draw_odd > 0 and draw_odd < group["worst_draw"]:
            group["worst_draw"] = draw_odd
        if away_odd > 0 and away_odd < group["worst_away"]:
            group["worst_away"] = away_odd
    
    # Converter infinity para 0 para serialização JSON
    result = []
    for match in match_map.values():
        if match["worst_home"] == float('inf'):
            match["worst_home"] = 0
        if match["worst_draw"] == float('inf'):
            match["worst_draw"] = 0
        if match["worst_away"] == float('inf'):
            match["worst_away"] = 0
        result.append(match)
    
    # Ordenar por data
    result.sort(key=lambda x: x.get("match_date", ""))
    
    return result


async def run_forever(interval: int, log: logger):
    """Loop infinito para geração de JSON."""
    supabase = SupabaseClient()
    cycle_count = 0
    
    log.info(f"Starting JSON generator with interval: {interval}s")
    
    while True:
        cycle_count += 1
        start_time = datetime.now(timezone.utc)
        
        try:
            # Buscar odds de futebol e NBA
            football_data = await supabase.fetch_odds_for_json()
            nba_data = await supabase.fetch_nba_odds_for_json()
            
            all_data = football_data + nba_data
            
            if not all_data:
                log.warning(f"[Cycle {cycle_count}] No odds data available")
                await asyncio.sleep(interval)
                continue
            
            # Agrupar por partida
            matches = group_odds_for_json(all_data, log)
            
            # Gerar JSON
            json_data = {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "matches_count": len(matches),
                "matches": matches
            }
            
            # Upload para Storage
            success = supabase.upload_odds_json(json_data)
            
            if success:
                football_count = len([m for m in matches if m.get("sport_type") != "basketball"])
                nba_count = len([m for m in matches if m.get("sport_type") == "basketball"])
                
                duration = (datetime.now(timezone.utc) - start_time).total_seconds()
                log.info(
                    f"[Cycle {cycle_count}] "
                    f"Football: {football_count}, NBA: {nba_count}, "
                    f"Duration: {duration:.1f}s"
                )
            else:
                log.error(f"[Cycle {cycle_count}] Failed to upload JSON")
                
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
        description="JSON Generator - Gera odds.json para o frontend"
    )
    
    parser.add_argument(
        "--interval",
        type=int,
        default=15,
        help="Intervalo entre ciclos em segundos (default: 15)"
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
    log.info("JSON Generator Service")
    log.info(f"Supabase URL: {settings.supabase_url[:30]}...")
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

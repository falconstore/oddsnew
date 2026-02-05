#!/usr/bin/env python3
"""
Alias Generator Service - Detecta times pendentes e gera SQL para aliases.

Serviço de manutenção que:
1. Busca times não matcheados na tabela unmatched_teams_log
2. Faz fuzzy matching contra times existentes
3. Gera SQL para criar aliases manualmente
4. Auto-cria aliases acima de 95% de confiança

Uso:
    python run_alias_generator.py --interval 300
    python run_alias_generator.py --interval 300 --auto-create
    python run_alias_generator.py --interval 300 --debug
"""

import asyncio
import argparse
import signal
import sys
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Dict, Tuple, Optional
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

from loguru import logger
from rapidfuzz import fuzz, process

from config import settings
from supabase_client import SupabaseClient
from team_matcher import TeamMatcher


# Thresholds
AUTO_CREATE_THRESHOLD = 95   # Auto-criar alias se score >= 95%
SUGGEST_THRESHOLD = 80       # Sugerir SQL se score >= 80%


class AliasGenerator:
    """Detecta times pendentes e gera aliases."""
    
    def __init__(self, supabase: SupabaseClient):
        self.supabase = supabase
        self.team_matcher = TeamMatcher(supabase)
        self.logger = logger.bind(component="alias-gen")
        self.pending_aliases: Dict[str, List[Dict]] = defaultdict(list)
    
    async def initialize(self):
        """Carrega caches de times e aliases."""
        await self.team_matcher.load_cache()
        self.logger.info(
            f"Loaded {len(self.team_matcher.teams_cache)} teams, "
            f"{len(self.team_matcher.aliases_cache)} aliases"
        )
    
    async def fetch_unmatched_from_db(self) -> List[Dict]:
        """
        Busca times não matcheados da tabela unmatched_teams_log.
        Retorna lista de dicts com informações do time pendente.
        """
        try:
            response = await self.supabase.client.table("unmatched_teams_log") \
                .select("*") \
                .eq("resolved", False) \
                .order("scraped_at", desc=True) \
                .limit(100) \
                .execute()
            
            return response.data if response.data else []
        except Exception as e:
            self.logger.error(f"Failed to fetch unmatched teams: {e}")
            return []
    
    def find_best_match(
        self, 
        raw_name: str, 
        league_name: Optional[str] = None
    ) -> Tuple[Optional[str], Optional[str], float]:
        """
        Encontra o melhor match para um nome de time.
        
        Returns:
            Tuple (team_id, standard_name, score)
        """
        normalized = self._normalize_name(raw_name)
        
        # Primeiro: buscar pelo nome exato em reverse_cache
        if normalized.lower() in self.team_matcher.reverse_cache:
            team_id = self.team_matcher.reverse_cache[normalized.lower()]
            standard_name = self.team_matcher.teams_cache.get(team_id, normalized)
            return (team_id, standard_name, 100.0)
        
        # Segundo: busca fuzzy global
        all_names = list(self.team_matcher.teams_cache.values())
        
        if not all_names:
            return (None, None, 0.0)
        
        result = process.extractOne(
            normalized,
            all_names,
            scorer=fuzz.token_sort_ratio,
            score_cutoff=SUGGEST_THRESHOLD
        )
        
        if result:
            matched_name = result[0]
            score = result[1]
            team_id = self.team_matcher.reverse_cache.get(matched_name.lower())
            
            if not team_id:
                # Try normalized version
                team_id = self.team_matcher.reverse_cache.get(
                    self._normalize_name(matched_name).lower()
                )
            
            return (team_id, matched_name, score)
        
        return (None, None, 0.0)
    
    def _normalize_name(self, name: str) -> str:
        """Normaliza nome para comparação."""
        import unicodedata
        name = " ".join(name.split())
        name = unicodedata.normalize('NFD', name)
        name = ''.join(c for c in name if unicodedata.category(c) != 'Mn')
        return name.strip()
    
    def generate_sql(self, pending: List[Dict]) -> str:
        """Gera SQL para criar aliases."""
        if not pending:
            return "-- Nenhum alias pendente\n"
        
        lines = [
            "-- =====================================================",
            f"-- Aliases Pendentes - Gerado em {datetime.now().isoformat()}",
            f"-- Total: {len(pending)} aliases",
            "-- =====================================================",
            "",
        ]
        
        for item in pending:
            escaped_name = item['raw_name'].replace("'", "''")
            lines.extend([
                f"-- {item['raw_name']} ({item['bookmaker']}) -> {item['standard_name']} [{item['score']:.0f}%]",
                f"INSERT INTO team_aliases (team_id, alias_name, bookmaker_source)",
                f"VALUES ('{item['team_id']}', '{escaped_name}', '{item['bookmaker'].lower()}');",
                "",
            ])
        
        return "\n".join(lines)
    
    async def mark_as_resolved(
        self, 
        raw_name: str, 
        bookmaker: str, 
        team_id: str
    ):
        """Marca um time como resolvido na tabela de logs."""
        try:
            await self.supabase.client.table("unmatched_teams_log") \
                .update({
                    "resolved": True,
                    "resolved_at": datetime.now(timezone.utc).isoformat(),
                    "resolved_team_id": team_id,
                }) \
                .eq("raw_name", raw_name) \
                .eq("bookmaker", bookmaker.lower()) \
                .execute()
        except Exception as e:
            self.logger.debug(f"Failed to mark as resolved: {e}")
    
    async def process_pending(
        self, 
        auto_create: bool = False
    ) -> Tuple[int, int, str]:
        """
        Processa times pendentes.
        
        Returns:
            Tuple (auto_created, pending_manual, sql_output)
        """
        auto_created = 0
        pending_manual = []
        
        # Buscar times unmatched do banco
        unmatched_list = await self.fetch_unmatched_from_db()
        
        if not unmatched_list:
            return 0, 0, "-- Nenhum alias pendente\n"
        
        self.logger.info(f"Processing {len(unmatched_list)} unmatched teams...")
        
        for item in unmatched_list:
            raw_name = item.get("raw_name", "")
            bookmaker = item.get("bookmaker", "unknown")
            league_name = item.get("league_name")
            
            if not raw_name:
                continue
            
            team_id, standard_name, score = self.find_best_match(raw_name, league_name)
            
            if not team_id:
                self.logger.debug(f"No match found for: {raw_name}")
                continue
            
            if score >= AUTO_CREATE_THRESHOLD and auto_create:
                # Auto-criar alias
                try:
                    await self.supabase.create_team_alias(
                        team_id=team_id,
                        alias_name=raw_name,
                        bookmaker_source=bookmaker
                    )
                    auto_created += 1
                    self.logger.info(
                        f"[Auto-create] '{raw_name}' -> '{standard_name}' ({score:.0f}%)"
                    )
                    
                    # Marcar como resolvido
                    await self.mark_as_resolved(raw_name, bookmaker, team_id)
                    
                except Exception as e:
                    if "duplicate" not in str(e).lower():
                        self.logger.error(f"Failed to create alias: {e}")
                    else:
                        # Já existe, marcar como resolvido
                        await self.mark_as_resolved(raw_name, bookmaker, team_id)
            else:
                pending_manual.append({
                    "raw_name": raw_name,
                    "team_id": team_id,
                    "standard_name": standard_name,
                    "score": score,
                    "bookmaker": bookmaker,
                    "league_name": league_name,
                })
        
        sql_output = self.generate_sql(pending_manual)
        
        return auto_created, len(pending_manual), sql_output


# Shutdown handling
shutdown_event = asyncio.Event()

def signal_handler(sig, frame):
    """Handle shutdown signals."""
    logger.info("Recebido sinal de shutdown")
    shutdown_event.set()


async def run_forever(interval: int, auto_create: bool, log: logger):
    """Loop infinito para geração de aliases."""
    supabase = SupabaseClient()
    generator = AliasGenerator(supabase)
    
    await generator.initialize()
    
    cycle_count = 0
    output_dir = Path(__file__).parent.parent / "logs"
    output_dir.mkdir(exist_ok=True)
    output_path = output_dir / "pending_aliases.sql"
    
    log.info(f"Starting alias generator with interval: {interval}s")
    log.info(f"Auto-create enabled: {auto_create}")
    log.info(f"SQL output: {output_path}")
    
    while not shutdown_event.is_set():
        cycle_count += 1
        start_time = datetime.now(timezone.utc)
        
        try:
            # Recarregar caches para pegar novos times
            await generator.initialize()
            
            # Processar pendentes
            auto_created, pending, sql = await generator.process_pending(auto_create)
            
            duration = (datetime.now(timezone.utc) - start_time).total_seconds()
            
            if auto_created > 0 or pending > 0:
                log.info(
                    f"[Cycle {cycle_count}] "
                    f"Auto-created: {auto_created}, Pending: {pending}, "
                    f"Duration: {duration:.1f}s"
                )
                
                # Salvar SQL
                with open(output_path, "w") as f:
                    f.write(sql)
                log.info(f"SQL saved to {output_path}")
            else:
                log.debug(f"[Cycle {cycle_count}] No pending aliases ({duration:.1f}s)")
                
        except Exception as e:
            log.error(f"[Cycle {cycle_count}] Error: {e}")
        
        try:
            await asyncio.wait_for(shutdown_event.wait(), timeout=interval)
        except asyncio.TimeoutError:
            pass  # Normal timeout, continue loop
        except asyncio.CancelledError:
            log.info("Shutdown requested")
            break
    
    log.info("Alias generator stopped")


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Alias Generator - Gera SQL para times pendentes"
    )
    
    parser.add_argument(
        "--interval",
        type=int,
        default=300,
        help="Intervalo entre ciclos em segundos (default: 300 = 5 min)"
    )
    
    parser.add_argument(
        "--auto-create",
        action="store_true",
        help="Auto-criar aliases com score >= 95%%"
    )
    
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Ativar logging de debug"
    )
    
    return parser.parse_args()


def main():
    """Entry point."""
    args = parse_args()
    
    # Setup signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Configure logging
    logger.remove()
    log_level = "DEBUG" if args.debug else "INFO"
    logger.add(
        sys.stdout,
        format="{time:HH:mm:ss} | {level:<8} | {extra[component]:<12} | {message}",
        level=log_level,
        filter=lambda record: record["extra"].get("component")
    )
    
    log = logger.bind(component="alias-gen")
    
    try:
        asyncio.run(run_forever(args.interval, args.auto_create, log))
    except KeyboardInterrupt:
        log.info("Interrupted by user")
    except Exception as e:
        log.error(f"Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

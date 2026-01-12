"""
Cleanup Duplicates - Script para identificar e listar times duplicados.

Times com o mesmo nome em ligas diferentes devem ser consolidados
para evitar problemas de cross-league matching (ex: FA Cup, Champions League).

Uso:
    python cleanup_duplicates.py
"""

import asyncio
from collections import defaultdict
from typing import Dict, List
from loguru import logger

from supabase_client import SupabaseClient


async def find_duplicate_teams(supabase: SupabaseClient) -> Dict[str, List[dict]]:
    """
    Encontra times com nomes iguais em ligas diferentes.
    
    Returns:
        Dict com nome normalizado -> lista de registros duplicados
    """
    logger.info("Buscando times duplicados...")
    
    teams = await supabase.fetch_teams()
    leagues = await supabase.fetch_leagues()
    
    # Mapa de league_id -> league_name para exibição
    league_map = {l["id"]: l["name"] for l in leagues}
    
    # Agrupar por nome normalizado (lowercase, stripped)
    by_name: Dict[str, List[dict]] = defaultdict(list)
    for t in teams:
        key = t["standard_name"].lower().strip()
        t["league_name"] = league_map.get(t.get("league_id"), "N/A")
        by_name[key].append(t)
    
    # Filtrar apenas duplicatas (mais de 1 registro com mesmo nome)
    duplicates = {k: v for k, v in by_name.items() if len(v) > 1}
    
    return duplicates


def print_duplicates_report(duplicates: Dict[str, List[dict]]):
    """Imprime um relatório formatado das duplicatas encontradas."""
    if not duplicates:
        logger.success("✅ Nenhum time duplicado encontrado!")
        return
    
    logger.warning(f"⚠️  Encontrados {len(duplicates)} times com registros duplicados:\n")
    
    for name, entries in sorted(duplicates.items()):
        print(f"\n🔴 DUPLICATA: {name.upper()}")
        print("-" * 50)
        for e in entries:
            print(f"   ID: {e['id']}")
            print(f"   Liga: {e['league_name']} ({e.get('league_id', 'N/A')})")
            print()


def generate_merge_sql(duplicates: Dict[str, List[dict]]) -> str:
    """
    Gera SQL para consolidar times duplicados.
    
    O primeiro registro encontrado é considerado o "canônico".
    Todos os outros são migrados e deletados.
    """
    if not duplicates:
        return "-- Nenhuma duplicata para consolidar"
    
    sql_lines = [
        "-- =====================================================",
        "-- SQL para consolidar times duplicados",
        "-- REVISE CUIDADOSAMENTE antes de executar!",
        "-- =====================================================",
        "",
    ]
    
    for name, entries in sorted(duplicates.items()):
        # Primeiro registro é o canônico
        canonical = entries[0]
        duplicates_to_remove = entries[1:]
        
        sql_lines.append(f"-- Consolidar: {name}")
        sql_lines.append(f"-- Canônico: {canonical['id']} ({canonical['league_name']})")
        sql_lines.append("")
        
        for dup in duplicates_to_remove:
            dup_id = dup['id']
            canonical_id = canonical['id']
            
            sql_lines.extend([
                f"-- Migrar {dup_id} ({dup['league_name']}) -> {canonical_id}",
                f"UPDATE team_aliases SET team_id = '{canonical_id}' WHERE team_id = '{dup_id}';",
                f"UPDATE matches SET home_team_id = '{canonical_id}' WHERE home_team_id = '{dup_id}';",
                f"UPDATE matches SET away_team_id = '{canonical_id}' WHERE away_team_id = '{dup_id}';",
                f"UPDATE nba_matches SET home_team_id = '{canonical_id}' WHERE home_team_id = '{dup_id}';",
                f"UPDATE nba_matches SET away_team_id = '{canonical_id}' WHERE away_team_id = '{dup_id}';",
                f"DELETE FROM teams WHERE id = '{dup_id}';",
                "",
            ])
        
        sql_lines.append("")
    
    return "\n".join(sql_lines)


async def main():
    """Função principal do script."""
    logger.info("=== Cleanup Duplicates Tool ===")
    
    supabase = SupabaseClient()
    
    duplicates = await find_duplicate_teams(supabase)
    print_duplicates_report(duplicates)
    
    if duplicates:
        print("\n" + "=" * 60)
        print("SQL PARA CONSOLIDAÇÃO (revise antes de executar):")
        print("=" * 60)
        print(generate_merge_sql(duplicates))
        
        # Salvar em arquivo
        with open("merge_duplicates.sql", "w") as f:
            f.write(generate_merge_sql(duplicates))
        
        logger.info("SQL salvo em: merge_duplicates.sql")


if __name__ == "__main__":
    asyncio.run(main())

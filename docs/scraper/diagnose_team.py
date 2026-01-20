#!/usr/bin/env python
"""
Team Matcher Diagnostic Tool
Usage: python diagnose_team.py "Nome do Time" "Betano" "Paulistao"
       python diagnose_team.py "Ponte Preta" "Betano" "Paulistao"
"""

import asyncio
import sys
import unicodedata
from rapidfuzz import fuzz, process
from supabase_client import SupabaseClient


class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    END = '\033[0m'


COMMON_WORDS = {'de', 'do', 'da', 'del', 'la', 'fc', 'sc', 'cf', 'ac', 'ss', 'club', 'sporting'}


def normalize_name(name: str) -> str:
    """Normalize team name for comparison."""
    name = " ".join(name.split())
    name = unicodedata.normalize('NFD', name)
    name = ''.join(c for c in name if unicodedata.category(c) != 'Mn')
    return name.strip()


def normalize_for_fuzzy(name: str) -> str:
    """Normalize name for fuzzy matching by removing common words."""
    normalized = normalize_name(name).lower()
    words = normalized.split()
    filtered = [w for w in words if w not in COMMON_WORDS]
    if len(filtered) < 2 and len(words) >= 2:
        filtered = [w for w in words if w not in {'de', 'do', 'da', 'del', 'la'}]
    return ' '.join(filtered) if filtered else normalized


def print_step(step: int, title: str):
    """Print a formatted step header."""
    print(f"\n{Colors.BOLD}{Colors.BLUE}[STEP {step}]{Colors.END} {Colors.BOLD}{title}{Colors.END}")
    print("─" * 60)


def print_result(found: bool, message: str):
    """Print a result with color coding."""
    if found:
        print(f"  {Colors.GREEN}✓ ENCONTRADO:{Colors.END} {message}")
    else:
        print(f"  {Colors.YELLOW}✗ Não encontrado:{Colors.END} {message}")


async def diagnose(team_name: str, bookmaker: str, league_name: str):
    """
    Diagnose why a team is not being matched.
    Shows each step of the matching process with detailed output.
    """
    print(f"\n{Colors.BOLD}{'='*60}{Colors.END}")
    print(f"{Colors.CYAN}DIAGNÓSTICO DE TEAM MATCHING{Colors.END}")
    print(f"{'='*60}")
    print(f"  Time: {Colors.BOLD}{team_name}{Colors.END}")
    print(f"  Bookmaker: {Colors.BOLD}{bookmaker}{Colors.END}")
    print(f"  Liga: {Colors.BOLD}{league_name}{Colors.END}")
    print(f"{'='*60}")

    # Initialize Supabase
    supabase = SupabaseClient()

    # Normalized values
    normalized_name = normalize_name(team_name).lower()
    normalized_bookmaker = bookmaker.strip().lower()
    fuzzy_name = normalize_for_fuzzy(team_name)
    is_primary = normalized_bookmaker == "betano"

    print_step(0, "NORMALIZAÇÃO")
    print(f"  Nome original:       '{team_name}'")
    print(f"  Nome normalizado:    '{normalized_name}'")
    print(f"  Para fuzzy matching: '{fuzzy_name}'")
    print(f"  Bookmaker primário:  {Colors.GREEN if is_primary else Colors.YELLOW}{is_primary}{Colors.END}")

    # Step 1: Load aliases
    print_step(1, "BUSCA EM ALIASES")
    aliases = supabase.client.table("team_aliases").select("*").execute()
    aliases_cache = {}
    for alias in aliases.data:
        if alias.get("bookmaker_source"):
            key = (alias["alias_name"].lower(), alias["bookmaker_source"].lower())
            aliases_cache[key] = alias["team_id"]

    # Try exact alias match
    alias_key = (normalized_name, normalized_bookmaker)
    alias_match = aliases_cache.get(alias_key)

    print(f"  Chave de busca: {alias_key}")
    print(f"  Total de aliases no cache: {len(aliases_cache)}")

    # Show aliases for this bookmaker containing similar names
    similar_aliases = [
        (k, v) for k, v in aliases_cache.items()
        if k[1] == normalized_bookmaker and
        (team_name.lower() in k[0] or k[0] in team_name.lower())
    ]
    if similar_aliases:
        print(f"\n  Aliases similares para '{bookmaker}':")
        for (alias, bm), tid in similar_aliases:
            print(f"    - '{alias}' -> {tid[:8]}...")

    if alias_match:
        print_result(True, f"team_id = {alias_match}")
        return alias_match
    else:
        print_result(False, "Nenhum alias exato encontrado")

    # Step 2: Find league
    print_step(2, "IDENTIFICAÇÃO DA LIGA")
    leagues = supabase.client.table("leagues").select("*").execute()
    league_id = None
    league_obj = None
    for league in leagues.data:
        if league["name"].lower() == league_name.lower():
            league_id = league["id"]
            league_obj = league
            break

    if league_id:
        print_result(True, f"league_id = {league_id[:8]}... ('{league_name}')")
    else:
        print_result(False, f"Liga '{league_name}' não encontrada no banco!")
        print(f"\n  Ligas disponíveis:")
        for l in leagues.data[:10]:
            print(f"    - '{l['name']}' ({l['id'][:8]}...)")
        return None

    # Step 3: Load teams for league
    print_step(3, "BUSCA EXATA EM TIMES DA LIGA")
    teams = supabase.client.table("teams").select("*").eq("league_id", league_id).execute()

    teams_by_name = {}
    teams_list = []
    for t in teams.data:
        teams_by_name[t["standard_name"].lower()] = t["id"]
        teams_by_name[normalize_name(t["standard_name"]).lower()] = t["id"]
        teams_list.append(t)

    print(f"  Times na liga '{league_name}': {len(teams.data)}")

    # Check exact match in league
    exact_match = teams_by_name.get(normalized_name)

    if exact_match:
        print_result(True, f"Match exato! team_id = {exact_match}")
        return exact_match
    else:
        print_result(False, "Nenhum match exato na liga")
        print(f"\n  Times disponíveis na liga:")
        for t in teams.data:
            print(f"    - '{t['standard_name']}' ({t['id'][:8]}...)")

    # Step 4: Fuzzy match in league
    print_step(4, "FUZZY MATCHING NA LIGA")

    all_names = [t["standard_name"] for t in teams.data]

    strategies = [
        (fuzz.token_sort_ratio, "token_sort", 85),
        (fuzz.token_set_ratio, "token_set", 85),
        (fuzz.partial_ratio, "partial", 92),
    ]

    print(f"  Input para fuzzy: '{fuzzy_name}'")
    print(f"\n  Resultados por estratégia:")

    best_match = None
    best_score = 0
    best_strategy = None

    for scorer, strategy_name, min_threshold in strategies:
        result = process.extractOne(
            normalize_name(team_name),
            all_names,
            scorer=scorer,
            score_cutoff=0  # Show all scores for diagnosis
        )

        if result:
            color = Colors.GREEN if result[1] >= min_threshold else Colors.YELLOW
            status = "ACEITO" if result[1] >= min_threshold else f"(min: {min_threshold})"
            print(f"    {strategy_name}: '{result[0]}' -> {color}{result[1]:.1f}%{Colors.END} {status}")

            if result[1] >= min_threshold and result[1] > best_score:
                best_match = result[0]
                best_score = result[1]
                best_strategy = strategy_name

    if best_match:
        team_id = teams_by_name.get(best_match.lower())
        print_result(True, f"'{best_match}' via {best_strategy} ({best_score:.1f}%) -> {team_id[:8]}...")
        return team_id
    else:
        print_result(False, "Nenhum fuzzy match acima do threshold")

    # Step 5: Global search (for primary bookmaker)
    print_step(5, "BUSCA GLOBAL (TODAS AS LIGAS)")
    all_teams = supabase.client.table("teams").select("*").execute()

    all_team_names = [t["standard_name"] for t in all_teams.data]

    result = process.extractOne(
        normalize_name(team_name),
        all_team_names,
        scorer=fuzz.token_sort_ratio,
        score_cutoff=0
    )

    if result:
        found_team = next((t for t in all_teams.data if t["standard_name"] == result[0]), None)
        color = Colors.GREEN if result[1] >= 95 else Colors.YELLOW
        print(f"  Melhor match global: '{result[0]}' -> {color}{result[1]:.1f}%{Colors.END}")
        if found_team:
            found_league = next((l for l in leagues.data if l["id"] == found_team.get("league_id")), None)
            league_display = found_league["name"] if found_league else found_team.get('league_id', 'N/A')[:8]
            print(f"  Liga do time: {league_display}")

            if result[1] >= 95:
                print_result(True, f"Match global com 95%+! team_id = {found_team['id'][:8]}...")
            else:
                print_result(False, f"Score {result[1]:.1f}% < 95% (threshold para criar)")

    # Step 6: Auto-create decision
    print_step(6, "DECISÃO DE AUTO-CRIAÇÃO")

    if is_primary:
        print(f"  {Colors.GREEN}✓{Colors.END} É bookmaker primário (Betano)")
        print(f"  {Colors.GREEN}✓{Colors.END} Tem league_id válido")
        print(f"  → {Colors.BOLD}AÇÃO: Time seria AUTO-CRIADO{Colors.END}")
        print(f"\n  {Colors.CYAN}Por que não está funcionando?{Colors.END}")
        print(f"    1. Verifique se o cache foi recarregado após a criação")
        print(f"    2. Verifique se há erros no log do orchestrator")
        print(f"    3. Verifique se a liga 'Paulistao' está no mapeamento do scraper")
    else:
        print(f"  {Colors.YELLOW}✗{Colors.END} Não é bookmaker primário")
        print(f"  → O time precisa existir OU ter um alias para '{bookmaker}'")

    # Summary
    print(f"\n{Colors.BOLD}{'='*60}{Colors.END}")
    print(f"{Colors.RED}RESULTADO FINAL: Time não encontrado{Colors.END}")
    print(f"{'='*60}")
    print(f"\n{Colors.CYAN}Ações sugeridas:{Colors.END}")

    # Find a close match to suggest
    if result and found_team:
        print(f"  1. Se '{result[0]}' é o mesmo time, adicionar alias:")
        print(f"     INSERT INTO team_aliases (team_id, alias_name, bookmaker_source)")
        print(f"     VALUES ('{found_team['id']}', '{team_name}', '{bookmaker.lower()}');")
    else:
        print(f"  1. Criar o time na liga correta via scraper Betano")
        print(f"  2. Ou adicionar manualmente e depois criar alias")

    print(f"\n  3. Verificar se o scraper '{bookmaker}' está enviando a liga corretamente")

    return None


async def batch_diagnose(bookmaker: str, league_name: str):
    """
    Diagnose all teams from a specific league for a bookmaker.
    """
    supabase = SupabaseClient()

    # Get league
    leagues = supabase.client.table("leagues").select("*").execute()
    league_id = None
    for league in leagues.data:
        if league["name"].lower() == league_name.lower():
            league_id = league["id"]
            break

    if not league_id:
        print(f"{Colors.RED}Liga '{league_name}' não encontrada!{Colors.END}")
        return

    # Get teams
    teams = supabase.client.table("teams").select("*").eq("league_id", league_id).execute()

    # Get aliases for this bookmaker
    aliases = supabase.client.table("team_aliases").select("*").execute()
    teams_with_alias = set()
    for alias in aliases.data:
        if alias.get("bookmaker_source", "").lower() == bookmaker.lower():
            teams_with_alias.add(alias["team_id"])

    print(f"\n{Colors.BOLD}{'='*60}{Colors.END}")
    print(f"{Colors.CYAN}ANÁLISE DE COBERTURA: {bookmaker} - {league_name}{Colors.END}")
    print(f"{'='*60}")
    print(f"  Total de times: {len(teams.data)}")
    print(f"  Com alias para {bookmaker}: {len(teams_with_alias)}")
    print(f"  Sem alias: {len(teams.data) - len([t for t in teams.data if t['id'] in teams_with_alias])}")

    print(f"\n{Colors.BOLD}Times SEM alias para {bookmaker}:{Colors.END}")
    missing = []
    for t in teams.data:
        if t['id'] not in teams_with_alias:
            missing.append(t)
            print(f"  - {t['standard_name']}")

    if missing:
        print(f"\n{Colors.CYAN}SQL para adicionar aliases (usando standard_name):{Colors.END}")
        print("INSERT INTO team_aliases (team_id, alias_name, bookmaker_source) VALUES")
        values = []
        for t in missing:
            values.append(f"  ('{t['id']}', '{t['standard_name']}', '{bookmaker.lower()}')")
        print(",\n".join(values) + ";")
    else:
        print(f"\n{Colors.GREEN}Todos os times têm alias para {bookmaker}!{Colors.END}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso:")
        print("  python diagnose_team.py <nome_time> <bookmaker> <liga>")
        print("  python diagnose_team.py --batch <bookmaker> <liga>")
        print()
        print("Exemplos:")
        print("  python diagnose_team.py 'Ponte Preta' 'Betano' 'Paulistao'")
        print("  python diagnose_team.py --batch 'Betano' 'Paulistao'")
        sys.exit(1)

    if sys.argv[1] == "--batch":
        if len(sys.argv) < 4:
            print("Uso: python diagnose_team.py --batch <bookmaker> <liga>")
            sys.exit(1)
        asyncio.run(batch_diagnose(sys.argv[2], sys.argv[3]))
    else:
        if len(sys.argv) < 4:
            print("Uso: python diagnose_team.py <nome_time> <bookmaker> <liga>")
            sys.exit(1)
        asyncio.run(diagnose(sys.argv[1], sys.argv[2], sys.argv[3]))

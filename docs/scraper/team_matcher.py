"""
Team Matcher - Fuzzy matching for team names across bookmakers.
Uses RapidFuzz for fast string similarity matching.
"""

import unicodedata
from typing import Optional, Dict, List, Tuple, Set
from rapidfuzz import fuzz, process
from loguru import logger

from supabase_client import SupabaseClient


# Blocked matches - known incorrect fuzzy matches to prevent
BLOCKED_MATCHES = {
    "inter milan": "ac milan",
    "internazionale": "ac milan",
    "brest": "nottingham forest",
}

# Common words to remove for better fuzzy matching
COMMON_WORDS = {'de', 'do', 'da', 'del', 'la', 'fc', 'sc', 'cf', 'ac', 'ss', 'club', 'sporting'}


class TeamMatcher:
    """
    Normalizes team names from different bookmakers to standard team IDs.
    
    Uses a two-step approach:
    1. Exact match in aliases cache
    2. Fuzzy match against standard names
    
    When fuzzy match is used, a new alias is automatically created
    for faster matching in subsequent runs.
    """
    
    def __init__(self, supabase: SupabaseClient):
        self.supabase = supabase
        self.logger = logger.bind(component="team_matcher")
        
        # Caches
        self.teams_cache: Dict[str, str] = {}  # team_id -> standard_name
        self.aliases_cache: Dict[Tuple[str, str], str] = {}  # (alias, bookmaker) -> team_id
        self.reverse_cache: Dict[str, str] = {}  # standard_name.lower() -> team_id
        self.teams_by_league: Dict[str, Dict[str, str]] = {}  # league_id -> {name.lower(): team_id}
        
        # Log deduplication - tracks already-logged unmatched names this cycle
        self._unmatched_logged: Set[str] = set()
        
        # Configuration
        self.min_score = 85  # Minimum similarity score for fuzzy match
        self.min_score_partial = 92  # Higher threshold for partial matches (avoid false positives)
        self.auto_create_alias = True  # Auto-create aliases for fuzzy matches
        self.auto_create_team = True  # Auto-create teams from primary bookmaker
        self.primary_bookmaker = "superbet"  # Bookmaker that defines standard names
        
        # Competições que permitem busca cross-league (copas e europeias)
        # Times de ligas domésticas serão encontrados nessas competições
        self.cross_league_competitions = {
            "fa cup",
            "efl cup",
            "carabao cup",
            "community shield",
            "champions league",
            "europa league",
            "conference league",
            "copa do brasil",
            "copa america",
            "libertadores",
            "sul-americana",
            "supercopa",
            "recopa",
            "coppa italia",
            "supercoppa",
            "dfb pokal",
            "supercup",
            "coupe de france",
            "trophee des champions",
            "copa do rei",
            "supercopa de espana",
            "taca de portugal",
            "supertaca",
            "knvb beker",
            "johan cruijff schaal",
            "world cup",
            "euro",
            "nations league",
        }
    
    def _normalize_name(self, name: str) -> str:
        """
        Normalize team name for matching.
        - Removes tabs, extra spaces
        - Normalizes accents (Bétis -> Betis)
        """
        # Remove tabs and extra whitespace
        name = " ".join(name.split())
        # Normalize unicode accents
        name = unicodedata.normalize('NFD', name)
        name = ''.join(c for c in name if unicodedata.category(c) != 'Mn')
        return name.strip()
    
    def _normalize_for_fuzzy(self, name: str) -> str:
        """
        Remove common words for better fuzzy matching.
        E.g., "Atlético de Madrid" -> "Atlético Madrid"
        This prevents mismatches when bookmakers use variations with/without prepositions.
        """
        normalized = self._normalize_name(name).lower()
        words = normalized.split()
        # Filter out common words, but keep at least 2 words to maintain meaning
        filtered = [w for w in words if w not in COMMON_WORDS]
        if len(filtered) < 2 and len(words) >= 2:
            # If we removed too much, use original but without just articles
            filtered = [w for w in words if w not in {'de', 'do', 'da', 'del', 'la'}]
        return ' '.join(filtered) if filtered else normalized
    
    def clear_log_cache(self):
        """Clear the unmatched log cache. Call at the start of each cycle."""
        self._unmatched_logged.clear()
    
    async def load_cache(self):
        """
        Load teams and aliases from the database into memory.
        Should be called before processing any odds.
        """
        self.logger.info("Loading team cache...")
        
        # Load teams
        teams = await self.supabase.fetch_teams()
        self.teams_cache = {t["id"]: t["standard_name"] for t in teams}
        
        # Build reverse_cache - keep FIRST encountered team_id for each name
        # Log warning if duplicates exist (same name in different leagues)
        self.reverse_cache = {}
        duplicates_found = []
        for t in teams:
            name_lower = t["standard_name"].lower()
            if name_lower in self.reverse_cache:
                # Duplicata detectada - coletar para relatório
                duplicates_found.append({
                    "name": t["standard_name"],
                    "canonical_id": self.reverse_cache[name_lower],
                    "duplicate_id": t["id"],
                    "league_id": t.get("league_id")
                })
            else:
                self.reverse_cache[name_lower] = t["id"]
        
        # Log all duplicates found with consolidation SQL hint
        if duplicates_found:
            self.logger.warning(
                f"[DUPLICATE] Found {len(duplicates_found)} duplicate team(s). "
                "Run cleanup_duplicates.py to generate merge SQL."
            )
            for dup in duplicates_found:
                self.logger.warning(
                    f"  - '{dup['name']}': keep {dup['canonical_id']}, merge {dup['duplicate_id']}"
                )
        
        # Build league-scoped cache for fuzzy matching within leagues
        self.teams_by_league = {}
        for t in teams:
            league_id = t.get("league_id")
            if league_id:
                if league_id not in self.teams_by_league:
                    self.teams_by_league[league_id] = {}
                self.teams_by_league[league_id][t["standard_name"].lower()] = t["id"]
                # Also add normalized version
                normalized = self._normalize_name(t["standard_name"]).lower()
                if normalized not in self.teams_by_league[league_id]:
                    self.teams_by_league[league_id][normalized] = t["id"]
        
        # Also add normalized versions to reverse cache
        for t in teams:
            normalized = self._normalize_name(t["standard_name"]).lower()
            if normalized not in self.reverse_cache:
                self.reverse_cache[normalized] = t["id"]
        
        # Load aliases
        aliases = await self.supabase.fetch_team_aliases()
        self.aliases_cache = {}
        for alias in aliases:
            key = (alias["alias_name"].lower(), alias["bookmaker_source"].lower())
            self.aliases_cache[key] = alias["team_id"]
            # Also add normalized version
            normalized_key = (self._normalize_name(alias["alias_name"]).lower(), alias["bookmaker_source"].lower())
            if normalized_key not in self.aliases_cache:
                self.aliases_cache[normalized_key] = alias["team_id"]
        
        self.logger.info(
            f"Loaded {len(self.teams_cache)} teams and "
            f"{len(self.aliases_cache)} aliases across {len(self.teams_by_league)} leagues"
        )
    
    def find_team_id_cached(
        self, 
        raw_name: str, 
        bookmaker: str, 
        league_id: str = None,
        league_name: str = None
    ) -> Optional[str]:
        """
        Find team ID using only in-memory cache (no DB calls).
        Fast path for batch processing. Now supports league-scoped matching
        AND cross-league fallback for cups/european competitions.
        
        Args:
            raw_name: Team name as it appears on the bookmaker site
            bookmaker: Name of the bookmaker
            league_id: League ID for scoped matching
            league_name: League name to detect cross-league competitions
        """
        if not raw_name:
            return None
        
        normalized_name = self._normalize_name(raw_name).lower()
        normalized_bookmaker = bookmaker.strip().lower()
        
        # Step 1: Exact match in aliases (try both raw and normalized)
        for name_variant in [raw_name.strip().lower(), normalized_name]:
            alias_key = (name_variant, normalized_bookmaker)
            if alias_key in self.aliases_cache:
                return self.aliases_cache[alias_key]
        
        # Step 2: Exact match in standard names (league-scoped ONLY when league_id is present)
        if league_id and league_id in self.teams_by_league:
            if normalized_name in self.teams_by_league[league_id]:
                return self.teams_by_league[league_id][normalized_name]
            # Fuzzy match within league
            result = self._fuzzy_match_in_league(raw_name, league_id)
            if result:
                return result
        
        # Step 3: Cross-league fallback para copas/europeias
        if league_name:
            is_cross_league = any(
                comp in league_name.lower() for comp in self.cross_league_competitions
            )
            if is_cross_league:
                # Buscar no cache global (reverse_cache) - match exato
                if normalized_name in self.reverse_cache:
                    return self.reverse_cache[normalized_name]
                
                # Fuzzy match global com threshold do min_score (85)
                all_names = list(self.teams_cache.values())
                if all_names:
                    # Usar _normalize_for_fuzzy para melhor matching
                    fuzzy_name = self._normalize_for_fuzzy(raw_name)
                    result = process.extractOne(
                        fuzzy_name,
                        [self._normalize_for_fuzzy(n) for n in all_names],
                        scorer=fuzz.token_sort_ratio,
                        score_cutoff=self.min_score  # 85
                    )
                    if result:
                        # Encontrar o nome original correspondente
                        matched_idx = [self._normalize_for_fuzzy(n) for n in all_names].index(result[0])
                        matched_name = all_names[matched_idx]
                        team_id = self.reverse_cache.get(matched_name.lower())
                        if not team_id:
                            team_id = self.reverse_cache.get(
                                self._normalize_name(matched_name).lower()
                            )
                        if team_id:
                            return team_id
        
        # Step 4: Fallback global só se não tiver league_id
        if not league_id and normalized_name in self.reverse_cache:
            return self.reverse_cache[normalized_name]
        
        return None
    
    async def find_team_id(
        self, 
        raw_name: str, 
        bookmaker: str,
        league_id: str = None,
        league_name: str = None
    ) -> Optional[str]:
        """
        Find the team ID for a raw team name from a specific bookmaker.
        
        Args:
            raw_name: Team name as it appears on the bookmaker site
            bookmaker: Name of the bookmaker (e.g., "Betano")
            league_id: League ID (required for auto-creating teams)
            league_name: League name for logging purposes
            
        Returns:
            Team ID if found, None otherwise
        """
        if not raw_name:
            return None
        
        normalized_name = self._normalize_name(raw_name).lower()
        normalized_bookmaker = bookmaker.strip().lower()
        is_primary = normalized_bookmaker == self.primary_bookmaker
        
        # [DIAG] logs removed - only log on failure (handled in orchestrator)
        
        # Step 1: Exact match in aliases (try both raw and normalized)
        for name_variant in [raw_name.strip().lower(), normalized_name]:
            alias_key = (name_variant, normalized_bookmaker)
            if alias_key in self.aliases_cache:
                self.logger.debug(f"Exact alias match: {raw_name} -> {self.aliases_cache[alias_key]}")
                return self.aliases_cache[alias_key]
        
        # Step 2: Exact match in standard names (league-scoped ONLY when league_id is present)
        if league_id and league_id in self.teams_by_league:
            if normalized_name in self.teams_by_league[league_id]:
                return self.teams_by_league[league_id][normalized_name]
        
        # Step 3: Fuzzy match - ONLY within the same league (skip global reverse_cache when league_id exists)
        team_id = None
        if league_id and league_id in self.teams_by_league:
            team_id = self._fuzzy_match_in_league(raw_name, league_id)
        elif not league_id and normalized_name in self.reverse_cache:
            # Fallback to global reverse cache ONLY when no league_id (rare case)
            return self.reverse_cache[normalized_name]
        
        # [DIAG] log removed - failure logging handled in orchestrator
        
        if team_id and self.auto_create_alias:
            # Create alias for future exact matches
            self._create_alias_async(team_id, raw_name, bookmaker)
            return team_id
        
        # Step 3.5: Cross-league search para copas/europeias
        # Se não encontrou na liga específica, tenta em outras ligas
        if not team_id and league_name:
            team_id = self._find_team_cross_league(raw_name, league_id, league_name)
            
            if team_id and self.auto_create_alias:
                # Criar alias para matches futuros
                self._create_alias_async(team_id, raw_name, bookmaker)
                self.logger.info(
                    f"[Cross-league] Found '{raw_name}' from another league -> {team_id}"
                )
                return team_id
        
        # Step 4: Auto-create team if primary bookmaker (Betano) and has league_id
        # This is triggered when NO match was found in the league OR cross-league
        if self.auto_create_team and is_primary and league_id and not team_id:
            # NOVO: Para competições cross-league, NÃO criar time novo
            # Primeiro buscar em TODAS as ligas para evitar duplicatas
            is_cross_league = any(
                comp in (league_name or '').lower() for comp in self.cross_league_competitions
            )
            
            if is_cross_league:
                # Buscar em TODAS as ligas primeiro antes de criar
                existing = self._find_team_global(raw_name)
                if existing:
                    self.logger.info(
                        f"[Cross-league] Reusing existing team: '{raw_name}' -> {existing}"
                    )
                    # Criar alias para matches futuros
                    if self.auto_create_alias:
                        self._create_alias_async(existing, raw_name, bookmaker)
                    return existing
            
            self.logger.info(
                f"[Auto-create] Attempting to create team: '{raw_name}' "
                f"league={league_name or league_id} bookmaker={bookmaker}"
            )
            team_id = await self._create_team(raw_name.strip(), league_id)
            if team_id:
                self.logger.info(f"[Auto-create] Success: '{raw_name}' -> {team_id}")
                return team_id
            else:
                self.logger.warning(f"[Auto-create] Failed to create team: '{raw_name}'")
        
        # Log unmatched only if we couldn't find OR create the team
        self._log_unmatched(raw_name, bookmaker, league_name, is_primary)
        return None
    
    def _find_team_global(self, raw_name: str) -> Optional[str]:
        """
        Busca um time em TODAS as ligas pelo nome exato ou fuzzy.
        Usado para evitar duplicatas em competições cross-league.
        
        Diferente de _find_team_cross_league, este método:
        - Não requer league_name
        - Usa threshold mais alto (95) para evitar falsos positivos
        - É usado ANTES de criar um novo time
        """
        normalized = self._normalize_name(raw_name).lower()
        
        # Match exato global
        if normalized in self.reverse_cache:
            return self.reverse_cache[normalized]
        
        # Fuzzy match global com threshold alto
        all_names = list(self.teams_cache.values())
        if not all_names:
            return None
        
        result = process.extractOne(
            self._normalize_name(raw_name),
            all_names,
            scorer=fuzz.token_sort_ratio,
            score_cutoff=95  # Threshold alto para evitar falsos positivos
        )
        
        if result:
            match_name = result[0]
            team_id = self.reverse_cache.get(match_name.lower())
            if not team_id:
                team_id = self.reverse_cache.get(self._normalize_name(match_name).lower())
            
            if team_id:
                self.logger.debug(
                    f"[Global] Found existing team: '{raw_name}' -> '{match_name}' ({result[1]:.0f}%)"
                )
                return team_id
        
        return None

    async def _create_team(self, name: str, league_id: str) -> Optional[str]:
        """Create a new team in the database and update all caches."""
        try:
            team = await self.supabase.create_team(name, league_id)
            if team:
                team_id = team["id"]
                # Update global caches
                self.teams_cache[team_id] = name
                self.reverse_cache[name.lower()] = team_id
                
                # Also add normalized version for accented names (e.g., München -> Munchen)
                normalized = self._normalize_name(name).lower()
                if normalized != name.lower():
                    self.reverse_cache[normalized] = team_id
                
                # Update league-scoped cache
                if league_id not in self.teams_by_league:
                    self.teams_by_league[league_id] = {}
                self.teams_by_league[league_id][name.lower()] = team_id
                if normalized != name.lower():
                    self.teams_by_league[league_id][normalized] = team_id
                
                return team_id
        except Exception as e:
            self.logger.error(f"Failed to create team '{name}': {e}")
        return None
    
    def _fuzzy_match_in_league(self, raw_name: str, league_id: str) -> Optional[str]:
        """
        Perform fuzzy matching ONLY against teams in the specified league.
        This prevents cross-league matches (e.g., matching a Bundesliga team to a Serie A team).
        """
        league_teams = self.teams_by_league.get(league_id, {})
        if not league_teams:
            return None
        
        # Normalize the input name
        normalized_input = self._normalize_name(raw_name)
        
        # Get team names for this league only
        all_names = [self.teams_cache[tid] for tid in league_teams.values() if tid in self.teams_cache]
        if not all_names:
            return None
        
        # Try different matching strategies with variable thresholds
        strategies = [
            (fuzz.token_sort_ratio, "token_sort", self.min_score),
            (fuzz.token_set_ratio, "token_set", self.min_score),
            (fuzz.partial_ratio, "partial", self.min_score_partial),
        ]
        
        best_match = None
        best_score = 0
        best_strategy = None
        
        # Also try matching with normalized names (without common words like "de", "do")
        fuzzy_input = self._normalize_for_fuzzy(raw_name)
        fuzzy_names = {name: self._normalize_for_fuzzy(name) for name in all_names}
        
        for scorer, strategy_name, min_threshold in strategies:
            # Try standard matching first
            result = process.extractOne(
                normalized_input,
                all_names,
                scorer=scorer,
                score_cutoff=min_threshold
            )
            
            if result and result[1] > best_score:
                best_match = result[0]
                best_score = result[1]
                best_strategy = strategy_name
            
            # Also try matching with normalized names (without "de", "do", "da")
            # This helps match "Atlético de Madrid" with "Atlético Madrid"
            for original_name, fuzzy_name in fuzzy_names.items():
                score = scorer(fuzzy_input, fuzzy_name)
                if score >= min_threshold and score > best_score:
                    best_match = original_name
                    best_score = score
                    best_strategy = f"{strategy_name}_fuzzy"
        
        if best_match:
            # Check if this match is blocked
            input_lower = normalized_input.lower()
            match_lower = best_match.lower()
            
            if input_lower in BLOCKED_MATCHES:
                blocked_target = BLOCKED_MATCHES[input_lower]
                if blocked_target in match_lower or match_lower in blocked_target:
                    self.logger.debug(f"Blocked match: '{raw_name}' -> '{best_match}'")
                    return None
            
            # Find the team_id from the league-scoped cache
            team_id = league_teams.get(best_match.lower())
            if not team_id:
                # Try normalized version
                team_id = league_teams.get(self._normalize_name(best_match).lower())
            
            if team_id:
                # Log only low-confidence matches (< 90)
                if best_score < 90:
                    self.logger.info(
                        f"Fuzzy match in-league ({best_strategy}): '{raw_name}' -> "
                        f"'{best_match}' (score: {best_score:.1f})"
                    )
                return team_id
        
        return None
    
    def _find_team_cross_league(
        self, 
        raw_name: str, 
        current_league_id: str,
        league_name: str
    ) -> Optional[str]:
        """
        Busca um time em TODAS as ligas quando não encontrado na liga atual.
        Útil para copas e competições europeias (FA Cup, Champions League, etc).
        
        Só é ativado para competições configuradas em self.cross_league_competitions.
        
        Args:
            raw_name: Nome do time
            current_league_id: ID da liga atual (para excluir da busca)
            league_name: Nome da liga (para verificar se é cross-league)
            
        Returns:
            team_id se encontrado em outra liga, None caso contrário
        """
        # Verifica se é uma competição que permite cross-league
        league_lower = league_name.lower()
        is_cross_league_comp = any(
            comp in league_lower for comp in self.cross_league_competitions
        )
        
        if not is_cross_league_comp:
            return None
        
        normalized_name = self._normalize_name(raw_name).lower()
        
        # Step 1: Match exato no reverse_cache global
        if normalized_name in self.reverse_cache:
            return self.reverse_cache[normalized_name]
        
        # Step 2: Fuzzy match em TODAS as ligas (exceto a atual)
        all_names = list(self.teams_cache.values())
        if not all_names:
            return None
        
        # Usar estratégias de matching similares ao in-league
        strategies = [
            (fuzz.token_sort_ratio, self.min_score),
            (fuzz.token_set_ratio, self.min_score),
        ]
        
        best_match = None
        best_score = 0
        
        # Also prepare normalized versions for fuzzy matching
        fuzzy_input = self._normalize_for_fuzzy(raw_name)
        fuzzy_names = {name: self._normalize_for_fuzzy(name) for name in all_names}
        
        for scorer, min_threshold in strategies:
            # Standard matching
            result = process.extractOne(
                self._normalize_name(raw_name),
                all_names,
                scorer=scorer,
                score_cutoff=min_threshold
            )
            
            if result and result[1] > best_score:
                best_match = result[0]
                best_score = result[1]
            
            # Also try matching with normalized names (without "de", "do", "da")
            for original_name, fuzzy_name in fuzzy_names.items():
                score = scorer(fuzzy_input, fuzzy_name)
                if score >= min_threshold and score > best_score:
                    best_match = original_name
                    best_score = score
        
        if best_match:
            # Verificar blocked matches
            input_lower = self._normalize_name(raw_name).lower()
            match_lower = best_match.lower()
            
            if input_lower in BLOCKED_MATCHES:
                blocked_target = BLOCKED_MATCHES[input_lower]
                if blocked_target in match_lower or match_lower in blocked_target:
                    self.logger.debug(
                        f"[Cross-league] Blocked match: '{raw_name}' -> '{best_match}'"
                    )
                    return None
            
            # Encontrar o team_id no reverse_cache
            team_id = self.reverse_cache.get(best_match.lower())
            if not team_id:
                team_id = self.reverse_cache.get(self._normalize_name(best_match).lower())
            
            if team_id:
                self.logger.info(
                    f"[Cross-league] Fuzzy match: '{raw_name}' -> '{best_match}' "
                    f"(score: {best_score:.1f}) in competition '{league_name}'"
                )
                return team_id
        
        return None
    
    def _log_unmatched(
        self, 
        raw_name: str, 
        bookmaker: str = None, 
        league_name: str = None,
        is_primary: bool = False
    ):
        """Log unmatched team name with context, but only once per cycle."""
        normalized = self._normalize_name(raw_name).lower()
        
        if normalized not in self._unmatched_logged:
            self._unmatched_logged.add(normalized)
            
            context_parts = []
            if bookmaker:
                context_parts.append(f"bookmaker={bookmaker}")
            if league_name:
                context_parts.append(f"league={league_name}")
            if is_primary:
                context_parts.append("primary=true")
            
            context = f" ({', '.join(context_parts)})" if context_parts else ""
            self.logger.warning(f"No match found for: '{raw_name}'{context}")
    
    def _create_alias_async(self, team_id: str, alias_name: str, bookmaker: str):
        """
        Create a new alias in the database.
        This is fire-and-forget - errors are logged but not raised.
        """
        import asyncio
        
        # Check if alias already exists in cache to avoid duplicate key errors
        key = (alias_name.lower(), bookmaker.lower())
        if key in self.aliases_cache:
            self.logger.debug(f"Alias already exists: '{alias_name}' ({bookmaker})")
            return
        
        # Add to cache immediately to prevent duplicate attempts
        self.aliases_cache[key] = team_id
        
        async def _create():
            try:
                await self.supabase.create_team_alias(
                    team_id=team_id,
                    alias_name=alias_name,
                    bookmaker_source=bookmaker
                )
                self.logger.info(f"Created alias: '{alias_name}' ({bookmaker}) -> {team_id}")
            except Exception as e:
                # Remove from cache if creation failed (but keep if it's a duplicate key error)
                if "duplicate key" not in str(e).lower():
                    self.aliases_cache.pop(key, None)
                    self.logger.error(f"Failed to create alias: {e}")
                else:
                    self.logger.debug(f"Alias already exists in DB: '{alias_name}' ({bookmaker})")
        
        # Schedule the async task
        try:
            loop = asyncio.get_event_loop()
            loop.create_task(_create())
        except RuntimeError:
            # No event loop, skip alias creation
            pass
    
    def get_unmatched_report(
        self, 
        raw_names: List[Tuple[str, str]]
    ) -> List[Dict]:
        """
        Generate a report of unmatched team names.
        
        Args:
            raw_names: List of (team_name, bookmaker) tuples
            
        Returns:
            List of dicts with unmatched names and their closest matches
        """
        unmatched = []
        
        for name, bookmaker in raw_names:
            team_id = self.find_team_id(name, bookmaker)
            
            if not team_id:
                # Get top 3 closest matches
                all_names = list(self.teams_cache.values())
                matches = process.extract(
                    name,
                    all_names,
                    scorer=fuzz.token_sort_ratio,
                    limit=3
                )
                
                unmatched.append({
                    "raw_name": name,
                    "bookmaker": bookmaker,
                    "closest_matches": [
                        {"name": m[0], "score": m[1]} for m in matches
                    ]
                })
        
        return unmatched


class LeagueMatcher:
    """
    Similar to TeamMatcher but for league names.
    """
    
    def __init__(self, supabase: SupabaseClient):
        self.supabase = supabase
        self.logger = logger.bind(component="league_matcher")
        self.leagues_cache: Dict[str, str] = {}  # league_id -> name
        self.reverse_cache: Dict[str, str] = {}  # name.lower() -> league_id
    
    async def load_cache(self):
        """Load leagues from database."""
        leagues = await self.supabase.fetch_leagues()
        self.leagues_cache = {l["id"]: l["name"] for l in leagues}
        self.reverse_cache = {l["name"].lower(): l["id"] for l in leagues}
        self.logger.info(f"Loaded {len(self.leagues_cache)} leagues")
    
    def find_league_id(self, raw_name: str) -> Optional[str]:
        """Find league ID by name using fuzzy matching."""
        normalized = raw_name.strip().lower()
        
        # Exact match
        if normalized in self.reverse_cache:
            return self.reverse_cache[normalized]
        
        # Fuzzy match
        all_names = list(self.leagues_cache.values())
        result = process.extractOne(
            raw_name,
            all_names,
            scorer=fuzz.token_sort_ratio,
            score_cutoff=80
        )
        
        if result:
            return next(
                (lid for lid, name in self.leagues_cache.items() 
                 if name == result[0]),
                None
            )
        
        return None

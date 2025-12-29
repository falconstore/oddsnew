"""
Team Matcher - Fuzzy matching for team names across bookmakers.
Uses RapidFuzz for fast string similarity matching.
"""

from typing import Optional, Dict, List, Tuple
from rapidfuzz import fuzz, process
from loguru import logger

from supabase_client import SupabaseClient


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
        
        # Configuration
        self.min_score = 85  # Minimum similarity score for fuzzy match
        self.auto_create_alias = True  # Auto-create aliases for fuzzy matches
        self.auto_create_team = True  # Auto-create teams from primary bookmaker
        self.primary_bookmaker = "betano"  # Bookmaker that defines standard names
    
    async def load_cache(self):
        """
        Load teams and aliases from the database into memory.
        Should be called before processing any odds.
        """
        self.logger.info("Loading team cache...")
        
        # Load teams
        teams = await self.supabase.fetch_teams()
        self.teams_cache = {t["id"]: t["standard_name"] for t in teams}
        self.reverse_cache = {
            t["standard_name"].lower(): t["id"] for t in teams
        }
        
        # Load aliases
        aliases = await self.supabase.fetch_team_aliases()
        self.aliases_cache = {}
        for alias in aliases:
            key = (alias["alias_name"].lower(), alias["bookmaker_source"].lower())
            self.aliases_cache[key] = alias["team_id"]
        
        self.logger.info(
            f"Loaded {len(self.teams_cache)} teams and "
            f"{len(self.aliases_cache)} aliases"
        )
    
    def find_team_id_cached(self, raw_name: str, bookmaker: str) -> Optional[str]:
        """
        Find team ID using only in-memory cache (no DB calls).
        Fast path for batch processing.
        """
        if not raw_name:
            return None
        
        normalized_name = raw_name.strip().lower()
        normalized_bookmaker = bookmaker.strip().lower()
        
        # Step 1: Exact match in aliases
        alias_key = (normalized_name, normalized_bookmaker)
        if alias_key in self.aliases_cache:
            return self.aliases_cache[alias_key]
        
        # Step 2: Exact match in standard names
        if normalized_name in self.reverse_cache:
            return self.reverse_cache[normalized_name]
        
        # Step 3: Fuzzy match (uses only cache)
        return self._fuzzy_match(raw_name)
    
    async def find_team_id(
        self, 
        raw_name: str, 
        bookmaker: str,
        league_id: str = None
    ) -> Optional[str]:
        """
        Find the team ID for a raw team name from a specific bookmaker.
        
        Args:
            raw_name: Team name as it appears on the bookmaker site
            bookmaker: Name of the bookmaker (e.g., "Betano")
            league_id: League ID (required for auto-creating teams)
            
        Returns:
            Team ID if found, None otherwise
        """
        if not raw_name:
            return None
        
        normalized_name = raw_name.strip().lower()
        normalized_bookmaker = bookmaker.strip().lower()
        
        # Step 1: Exact match in aliases
        alias_key = (normalized_name, normalized_bookmaker)
        if alias_key in self.aliases_cache:
            self.logger.debug(f"Exact alias match: {raw_name} -> {self.aliases_cache[alias_key]}")
            return self.aliases_cache[alias_key]
        
        # Step 2: Exact match in standard names
        if normalized_name in self.reverse_cache:
            return self.reverse_cache[normalized_name]
        
        # Step 3: Fuzzy match
        team_id = self._fuzzy_match(raw_name)
        
        if team_id and self.auto_create_alias:
            # Create alias for future exact matches
            self._create_alias_async(team_id, raw_name, bookmaker)
            return team_id
        
        # Step 4: Auto-create team if primary bookmaker (Betano)
        if self.auto_create_team and normalized_bookmaker == self.primary_bookmaker and league_id:
            team_id = await self._create_team(raw_name.strip(), league_id)
            if team_id:
                return team_id
        
        return None
    
    async def _create_team(self, name: str, league_id: str) -> Optional[str]:
        """Create a new team in the database and update cache."""
        try:
            team = await self.supabase.create_team(name, league_id)
            if team:
                team_id = team["id"]
                # Update local caches
                self.teams_cache[team_id] = name
                self.reverse_cache[name.lower()] = team_id
                self.logger.info(f"Auto-created team: '{name}' in league {league_id}")
                return team_id
        except Exception as e:
            self.logger.error(f"Failed to create team '{name}': {e}")
        return None
    
    def _fuzzy_match(self, raw_name: str) -> Optional[str]:
        """
        Perform fuzzy matching against all standard team names.
        
        Uses multiple scoring algorithms and takes the best match:
        - Token Sort Ratio: Good for word order differences
        - Token Set Ratio: Good for partial matches
        - Partial Ratio: Good for substring matches
        """
        if not self.teams_cache:
            self.logger.warning("Teams cache is empty!")
            return None
        
        all_names = list(self.teams_cache.values())
        
        # Try different matching strategies
        strategies = [
            (fuzz.token_sort_ratio, "token_sort"),
            (fuzz.token_set_ratio, "token_set"),
            (fuzz.partial_ratio, "partial"),
        ]
        
        best_match = None
        best_score = 0
        best_strategy = None
        
        for scorer, strategy_name in strategies:
            result = process.extractOne(
                raw_name,
                all_names,
                scorer=scorer,
                score_cutoff=self.min_score
            )
            
            if result and result[1] > best_score:
                best_match = result[0]
                best_score = result[1]
                best_strategy = strategy_name
        
        if best_match:
            team_id = next(
                (tid for tid, name in self.teams_cache.items() 
                 if name == best_match),
                None
            )
            self.logger.info(
                f"Fuzzy match ({best_strategy}): '{raw_name}' -> "
                f"'{best_match}' (score: {best_score})"
            )
            return team_id
        
        self.logger.warning(f"No match found for: '{raw_name}'")
        return None
    
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

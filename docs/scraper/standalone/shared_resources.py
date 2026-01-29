"""
Shared Resources - Inicialização de caches e recursos compartilhados.

Cada processo PM2 carrega seus próprios caches (read-only).
"""

import sys
from pathlib import Path
from typing import Dict, Any

# Adicionar parent directory ao path para imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from loguru import logger
from supabase_client import SupabaseClient
from team_matcher import TeamMatcher, LeagueMatcher


class SharedResources:
    """
    Gerencia recursos compartilhados entre scrapers standalone.
    
    Cada processo carrega sua própria instância (caches são read-only).
    """
    
    _instance = None
    
    def __init__(self):
        self.supabase = SupabaseClient()
        self.team_matcher = TeamMatcher(self.supabase)
        self.league_matcher = LeagueMatcher(self.supabase)
        self.bookmaker_ids: Dict[str, str] = {}
        self.logger = logger.bind(component="shared_resources")
        self._initialized = False
    
    @classmethod
    def get_instance(cls) -> "SharedResources":
        """Singleton pattern para evitar múltiplas inicializações."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    async def initialize(self):
        """
        Carrega todos os caches necessários.
        Deve ser chamado antes de usar os matchers.
        """
        if self._initialized:
            self.logger.debug("Resources already initialized, skipping")
            return
        
        self.logger.info("Initializing shared resources...")
        
        # Carregar caches de teams e leagues
        await self.team_matcher.load_cache()
        await self.league_matcher.load_cache()
        
        # Carregar IDs dos bookmakers
        bookmakers = await self.supabase.fetch_bookmakers()
        self.bookmaker_ids = {b["name"].lower(): b["id"] for b in bookmakers}
        
        self._initialized = True
        
        self.logger.info(
            f"Initialized: {len(self.team_matcher.teams_cache)} teams, "
            f"{len(self.league_matcher.leagues_cache)} leagues, "
            f"{len(self.bookmaker_ids)} bookmakers"
        )
    
    async def reload_caches(self):
        """
        Recarrega caches para pegar novos teams/aliases/leagues.
        Chamado periodicamente durante o loop.
        """
        try:
            prev_teams = len(self.team_matcher.teams_cache)
            prev_aliases = len(self.team_matcher.aliases_cache)
            prev_leagues = len(self.league_matcher.leagues_cache)
            
            await self.team_matcher.load_cache()
            await self.league_matcher.load_cache()
            
            bookmakers = await self.supabase.fetch_bookmakers()
            self.bookmaker_ids = {b["name"].lower(): b["id"] for b in bookmakers}
            
            new_teams = len(self.team_matcher.teams_cache)
            new_aliases = len(self.team_matcher.aliases_cache)
            new_leagues = len(self.league_matcher.leagues_cache)
            
            if new_teams != prev_teams or new_aliases != prev_aliases or new_leagues != prev_leagues:
                self.logger.info(
                    f"Cache reloaded: teams {prev_teams}→{new_teams}, "
                    f"aliases {prev_aliases}→{new_aliases}, "
                    f"leagues {prev_leagues}→{new_leagues}"
                )
        except Exception as e:
            self.logger.error(f"Failed to reload caches: {e}")


async def get_shared_resources() -> SharedResources:
    """
    Função helper para obter recursos inicializados.
    """
    resources = SharedResources.get_instance()
    await resources.initialize()
    return resources

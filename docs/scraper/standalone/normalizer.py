"""
Normalizer - Normalização e inserção de odds no Supabase.

Extraído do Orchestrator para uso standalone.
"""

import sys
from pathlib import Path
from typing import List, Dict, Any, Tuple
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

from loguru import logger
from base_scraper import ScrapedOdds
from shared_resources import SharedResources


class OddsNormalizer:
    """
    Normaliza odds brutas e insere no banco de dados.
    """
    
    def __init__(self, resources: SharedResources):
        self.resources = resources
        self.supabase = resources.supabase
        self.team_matcher = resources.team_matcher
        self.league_matcher = resources.league_matcher
        self.bookmaker_ids = resources.bookmaker_ids
        self.logger = logger.bind(component="normalizer")
    
    async def normalize_and_insert(
        self, 
        odds_list: List[ScrapedOdds]
    ) -> Tuple[int, int]:
        """
        Normaliza e insere odds no banco.
        
        Returns:
            Tuple (football_inserted, nba_inserted)
        """
        if not odds_list:
            return 0, 0
        
        # Separar por esporte
        football_pre = []
        nba_pre = []
        
        for odds in odds_list:
            # Obter bookmaker ID
            bookmaker_id = self.bookmaker_ids.get(odds.bookmaker_name.lower())
            if not bookmaker_id:
                self.logger.warning(f"Unknown bookmaker: {odds.bookmaker_name}")
                continue
            
            # Match league
            league_id = self.league_matcher.find_league_id(odds.league_raw)
            if not league_id:
                continue  # Liga não cadastrada, ignorar silenciosamente
            
            # Determinar esporte
            is_basketball = odds.sport == "basketball" or odds.league_raw.upper() == "NBA"
            
            # Match teams
            normalized_bookmaker = odds.bookmaker_name.strip().lower()
            
            if normalized_bookmaker == self.team_matcher.primary_bookmaker:
                home_team_id = await self.team_matcher.find_team_id(
                    odds.home_team_raw, 
                    odds.bookmaker_name,
                    league_id,
                    odds.league_raw
                )
                away_team_id = await self.team_matcher.find_team_id(
                    odds.away_team_raw, 
                    odds.bookmaker_name,
                    league_id,
                    odds.league_raw
                )
            else:
                home_team_id = self.team_matcher.find_team_id_cached(
                    odds.home_team_raw, 
                    odds.bookmaker_name,
                    league_id,
                    odds.league_raw
                )
                away_team_id = self.team_matcher.find_team_id_cached(
                    odds.away_team_raw, 
                    odds.bookmaker_name,
                    league_id,
                    odds.league_raw
                )
            
            if not home_team_id or not away_team_id:
                continue
            
            item = {
                "odds": odds,
                "bookmaker_id": bookmaker_id,
                "league_id": league_id,
                "home_team_id": home_team_id,
                "away_team_id": away_team_id,
            }
            
            if is_basketball:
                nba_pre.append(item)
            else:
                football_pre.append(item)
        
        # Buscar/criar matches em batch
        football_inserted = 0
        nba_inserted = 0
        
        if football_pre:
            football_inserted = await self._process_football(football_pre)
        
        if nba_pre:
            nba_inserted = await self._process_nba(nba_pre)
        
        return football_inserted, nba_inserted
    
    async def _process_football(self, items: List[Dict[str, Any]]) -> int:
        """Processa odds de futebol."""
        matches_to_find = [
            {
                "league_id": item["league_id"],
                "home_team_id": item["home_team_id"],
                "away_team_id": item["away_team_id"],
                "match_date": item["odds"].match_date,
            }
            for item in items
        ]
        
        match_map = await self.supabase.find_or_create_matches_batch(matches_to_find)
        
        odds_to_insert = []
        for item in items:
            key = (item["league_id"], item["home_team_id"], item["away_team_id"])
            match = match_map.get(key)
            
            if not match:
                continue
            
            odds = item["odds"]
            odds_to_insert.append({
                "match_id": match["id"],
                "bookmaker_id": item["bookmaker_id"],
                "market_type": odds.market_type,
                "home_odd": odds.home_odd,
                "draw_odd": odds.draw_odd,
                "away_odd": odds.away_odd,
                "odds_type": odds.odds_type,
                "scraped_at": odds.scraped_at.isoformat(),
                "extra_data": odds.extra_data or {},
            })
        
        if odds_to_insert:
            return await self.supabase.insert_odds(odds_to_insert)
        return 0
    
    async def _process_nba(self, items: List[Dict[str, Any]]) -> int:
        """Processa odds de NBA/basquete."""
        matches_to_find = [
            {
                "league_id": item["league_id"],
                "home_team_id": item["home_team_id"],
                "away_team_id": item["away_team_id"],
                "match_date": item["odds"].match_date,
            }
            for item in items
        ]
        
        match_map = await self.supabase.find_or_create_nba_matches_batch(matches_to_find)
        
        odds_to_insert = []
        for item in items:
            key = (item["league_id"], item["home_team_id"], item["away_team_id"])
            match = match_map.get(key)
            
            if not match:
                continue
            
            odds = item["odds"]
            home_odd = odds.home_odd
            away_odd = odds.away_odd
            extra_data = odds.extra_data.copy() if odds.extra_data else {}
            
            # Swap odds se match foi encontrado invertido
            if match.get("_is_inverted"):
                home_odd, away_odd = away_odd, home_odd
                extra_data["teams_swapped"] = True
            
            odds_to_insert.append({
                "match_id": match["id"],
                "bookmaker_id": item["bookmaker_id"],
                "home_odd": home_odd,
                "away_odd": away_odd,
                "odds_type": odds.odds_type,
                "scraped_at": odds.scraped_at.isoformat(),
                "extra_data": extra_data,
            })
        
        if odds_to_insert:
            return await self.supabase.insert_nba_odds(odds_to_insert)
        return 0

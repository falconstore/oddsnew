"""
Supabase Client - Database operations for the Odds Scraper.
Handles all interactions with the Supabase database.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from supabase import create_client, Client
from loguru import logger

from config import settings


class SupabaseClient:
    """
    Client for interacting with Supabase database.
    
    Uses the service role key for full access to all tables,
    bypassing Row Level Security (RLS) policies.
    """
    
    def __init__(self):
        self.client: Client = create_client(
            settings.supabase_url,
            settings.supabase_service_key
        )
        self.logger = logger.bind(component="supabase")
    
    # ==========================================
    # TEAMS
    # ==========================================
    
    async def fetch_teams(self) -> List[Dict[str, Any]]:
        """Fetch all teams from the database."""
        try:
            response = self.client.table("teams").select("*").execute()
            return response.data
        except Exception as e:
            self.logger.error(f"Error fetching teams: {e}")
            return []
    
    async def find_team_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Find a team by standard name."""
        try:
            response = (
                self.client.table("teams")
                .select("*")
                .ilike("standard_name", f"%{name}%")
                .limit(1)
                .execute()
            )
            return response.data[0] if response.data else None
        except Exception as e:
            self.logger.error(f"Error finding team: {e}")
            return None
    
    # ==========================================
    # TEAM ALIASES
    # ==========================================
    
    async def fetch_team_aliases(self) -> List[Dict[str, Any]]:
        """Fetch all team aliases from the database."""
        try:
            response = self.client.table("team_aliases").select("*").execute()
            return response.data
        except Exception as e:
            self.logger.error(f"Error fetching team aliases: {e}")
            return []
    
    async def create_team_alias(
        self, 
        team_id: str, 
        alias_name: str, 
        bookmaker_source: str
    ) -> Optional[Dict[str, Any]]:
        """Create a new team alias."""
        try:
            response = (
                self.client.table("team_aliases")
                .insert({
                    "team_id": team_id,
                    "alias_name": alias_name,
                    "bookmaker_source": bookmaker_source,
                })
                .execute()
            )
            return response.data[0] if response.data else None
        except Exception as e:
            self.logger.error(f"Error creating team alias: {e}")
            return None
    
    # ==========================================
    # LEAGUES
    # ==========================================
    
    async def fetch_leagues(self, active_only: bool = True) -> List[Dict[str, Any]]:
        """Fetch all leagues from the database."""
        try:
            query = self.client.table("leagues").select("*")
            if active_only:
                query = query.eq("is_active", True)
            response = query.execute()
            return response.data
        except Exception as e:
            self.logger.error(f"Error fetching leagues: {e}")
            return []
    
    # ==========================================
    # BOOKMAKERS
    # ==========================================
    
    async def fetch_bookmakers(self, active_only: bool = True) -> List[Dict[str, Any]]:
        """Fetch all bookmakers from the database."""
        try:
            query = self.client.table("bookmakers").select("*")
            if active_only:
                query = query.eq("is_active", True)
            response = query.execute()
            return response.data
        except Exception as e:
            self.logger.error(f"Error fetching bookmakers: {e}")
            return []
    
    async def get_bookmaker_id(self, name: str) -> Optional[str]:
        """Get bookmaker ID by name."""
        try:
            response = (
                self.client.table("bookmakers")
                .select("id")
                .eq("name", name)
                .limit(1)
                .execute()
            )
            return response.data[0]["id"] if response.data else None
        except Exception as e:
            self.logger.error(f"Error getting bookmaker ID: {e}")
            return None
    
    # ==========================================
    # MATCHES
    # ==========================================
    
    async def fetch_upcoming_matches(
        self, 
        hours_ahead: int = 48
    ) -> List[Dict[str, Any]]:
        """Fetch upcoming matches within the specified time window."""
        try:
            now = datetime.utcnow()
            future = now + timedelta(hours=hours_ahead)
            
            response = (
                self.client.table("matches")
                .select("*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)")
                .gte("match_date", now.isoformat())
                .lte("match_date", future.isoformat())
                .eq("status", "scheduled")
                .execute()
            )
            return response.data
        except Exception as e:
            self.logger.error(f"Error fetching upcoming matches: {e}")
            return []
    
    async def find_or_create_match(
        self,
        league_id: str,
        home_team_id: str,
        away_team_id: str,
        match_date: datetime
    ) -> Optional[Dict[str, Any]]:
        """
        Find an existing match or create a new one.
        Uses a time window of ±2 hours to match games.
        """
        try:
            # Try to find existing match
            date_min = match_date - timedelta(hours=2)
            date_max = match_date + timedelta(hours=2)
            
            response = (
                self.client.table("matches")
                .select("*")
                .eq("league_id", league_id)
                .eq("home_team_id", home_team_id)
                .eq("away_team_id", away_team_id)
                .gte("match_date", date_min.isoformat())
                .lte("match_date", date_max.isoformat())
                .limit(1)
                .execute()
            )
            
            if response.data:
                return response.data[0]
            
            # Create new match
            new_match = {
                "league_id": league_id,
                "home_team_id": home_team_id,
                "away_team_id": away_team_id,
                "match_date": match_date.isoformat(),
                "status": "scheduled",
            }
            
            response = (
                self.client.table("matches")
                .insert(new_match)
                .execute()
            )
            
            return response.data[0] if response.data else None
            
        except Exception as e:
            self.logger.error(f"Error finding/creating match: {e}")
            return None
    
    # ==========================================
    # ODDS HISTORY
    # ==========================================
    
    async def insert_odds(self, odds_list: List[Dict[str, Any]]) -> int:
        """
        Insert multiple odds records into the database.
        
        Args:
            odds_list: List of normalized odds dictionaries
            
        Returns:
            Number of records inserted
        """
        if not odds_list:
            return 0
        
        try:
            response = (
                self.client.table("odds_history")
                .insert(odds_list)
                .execute()
            )
            count = len(response.data) if response.data else 0
            self.logger.info(f"Inserted {count} odds records")
            return count
        except Exception as e:
            self.logger.error(f"Error inserting odds: {e}")
            return 0
    
    async def get_latest_odds(
        self, 
        match_id: str
    ) -> List[Dict[str, Any]]:
        """Get the latest odds for a specific match from all bookmakers."""
        try:
            response = (
                self.client.table("odds_history")
                .select("*, bookmaker:bookmakers(*)")
                .eq("match_id", match_id)
                .order("scraped_at", desc=True)
                .execute()
            )
            
            # Get only the latest per bookmaker
            seen_bookmakers = set()
            latest = []
            for odd in response.data:
                bm_id = odd["bookmaker_id"]
                if bm_id not in seen_bookmakers:
                    seen_bookmakers.add(bm_id)
                    latest.append(odd)
            
            return latest
        except Exception as e:
            self.logger.error(f"Error getting latest odds: {e}")
            return []
    
    # ==========================================
    # ALERTS
    # ==========================================
    
    async def create_alert(
        self,
        match_id: str,
        alert_type: str,
        message: str,
        data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Create a new alert."""
        try:
            response = (
                self.client.table("alerts")
                .insert({
                    "match_id": match_id,
                    "alert_type": alert_type,
                    "message": message,
                    "data": data,
                    "is_read": False,
                })
                .execute()
            )
            return response.data[0] if response.data else None
        except Exception as e:
            self.logger.error(f"Error creating alert: {e}")
            return None
    
    async def fetch_unread_alerts(self) -> List[Dict[str, Any]]:
        """Fetch all unread alerts."""
        try:
            response = (
                self.client.table("alerts")
                .select("*, match:matches(*)")
                .eq("is_read", False)
                .order("created_at", desc=True)
                .execute()
            )
            return response.data
        except Exception as e:
            self.logger.error(f"Error fetching alerts: {e}")
            return []

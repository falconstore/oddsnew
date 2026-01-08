"""
Supabase Client - Database operations for the Odds Scraper.
Handles all interactions with the Supabase database.
"""

import json
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta, timezone
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
    
    async def create_team(
        self, 
        standard_name: str, 
        league_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Create a new team. If INSERT returns empty data (PostgREST minimal mode),
        falls back to SELECT to retrieve the created record.
        """
        try:
            response = (
                self.client.table("teams")
                .insert({
                    "standard_name": standard_name,
                    "league_id": league_id,
                })
                .execute()
            )
            
            if response.data:
                return response.data[0]
            
            # Fallback: SELECT the team we just created
            self.logger.debug(f"INSERT returned empty, fetching team '{standard_name}'")
            select_response = (
                self.client.table("teams")
                .select("*")
                .eq("standard_name", standard_name)
                .eq("league_id", league_id)
                .limit(1)
                .execute()
            )
            return select_response.data[0] if select_response.data else None
            
        except Exception as e:
            # Handle duplicate key - team may already exist
            if "duplicate key" in str(e).lower() or "23505" in str(e):
                self.logger.debug(f"Team already exists: '{standard_name}'")
                select_response = (
                    self.client.table("teams")
                    .select("*")
                    .eq("standard_name", standard_name)
                    .eq("league_id", league_id)
                    .limit(1)
                    .execute()
                )
                return select_response.data[0] if select_response.data else None
            self.logger.error(f"Error creating team: {e}")
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
                query = query.eq("status", "active")
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
                query = query.eq("status", "active")
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
    
    async def find_or_create_matches_batch(
        self,
        matches_data: List[Dict[str, Any]]
    ) -> Dict[str, Dict[str, Any]]:
        """
        Find or create multiple matches in batch.
        
        Args:
            matches_data: List of dicts with league_id, home_team_id, away_team_id, match_date
            
        Returns:
            Dict mapping (league_id, home_team_id, away_team_id) -> match record
        """
        if not matches_data:
            return {}
        
        result_map = {}
        
        try:
            # Get unique match keys and calculate dynamic date window from batch data
            unique_keys = set()
            all_dates = []
            for m in matches_data:
                key = (m["league_id"], m["home_team_id"], m["away_team_id"])
                unique_keys.add(key)
                # Parse match_date for dynamic window - ensure UTC aware
                md = m["match_date"]
                if isinstance(md, str):
                    md = datetime.fromisoformat(md.replace("Z", "+00:00"))
                # Normalize to UTC aware
                if md.tzinfo is None:
                    md = md.replace(tzinfo=timezone.utc)
                else:
                    md = md.astimezone(timezone.utc)
                all_dates.append(md)
            
            # Dynamic date window based on actual batch data (not fixed now+7 days)
            if all_dates:
                date_min = min(all_dates) - timedelta(days=1)
                date_max = max(all_dates) + timedelta(days=1)
            else:
                now = datetime.now(timezone.utc)
                date_min = now - timedelta(days=1)
                date_max = now + timedelta(days=30)
            
            response = (
                self.client.table("matches")
                .select("*")
                .gte("match_date", date_min.isoformat())
                .lte("match_date", date_max.isoformat())
                .execute()
            )
            
            # Index existing matches by key
            existing = {}
            for match in response.data or []:
                key = (match["league_id"], match["home_team_id"], match["away_team_id"])
                if key not in existing:
                    existing[key] = match
            
            # Find matches that need to be created
            to_create = []
            for m in matches_data:
                key = (m["league_id"], m["home_team_id"], m["away_team_id"])
                if key in result_map:
                    continue  # Already processed
                
                if key in existing:
                    result_map[key] = existing[key]
                else:
                    to_create.append({
                        "league_id": m["league_id"],
                        "home_team_id": m["home_team_id"],
                        "away_team_id": m["away_team_id"],
                        "match_date": m["match_date"].isoformat() if isinstance(m["match_date"], datetime) else m["match_date"],
                        "status": "scheduled",
                    })
                    result_map[key] = None  # Mark as pending
            
            # Batch insert new matches with conflict handling
            if to_create:
                try:
                    insert_response = (
                        self.client.table("matches")
                        .insert(to_create)
                        .execute()
                    )
                except Exception as insert_error:
                    # Handle potential duplicate key errors gracefully
                    self.logger.warning(f"Some matches may already exist: {insert_error}")
                    insert_response = type('obj', (object,), {'data': []})()
                    # Re-fetch to get the existing records
                    refetch = (
                        self.client.table("matches")
                        .select("*")
                        .gte("match_date", date_min.isoformat())
                        .lte("match_date", date_max.isoformat())
                        .execute()
                    )
                    for match in refetch.data or []:
                        key = (match["league_id"], match["home_team_id"], match["away_team_id"])
                        if key in result_map and result_map[key] is None:
                            result_map[key] = match
                
                for match in insert_response.data or []:
                    key = (match["league_id"], match["home_team_id"], match["away_team_id"])
                    result_map[key] = match
            
            self.logger.info(f"Batch matches: {len(existing)} found, {len(to_create)} created")
            return result_map
            
        except Exception as e:
            self.logger.error(f"Error in batch match lookup: {e}")
            return {}
    
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
        title: str,
        details: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Create a new alert."""
        try:
            response = (
                self.client.table("alerts")
                .insert({
                    "match_id": match_id,
                    "alert_type": alert_type,
                    "title": title,
                    "details": details,
                    "is_read": False,
                })
                .execute()
            )
            return response.data[0] if response.data else None
        except Exception as e:
            self.logger.error(f"Error creating alert: {e}")
            return None
    
    async def insert_alerts_batch(
        self,
        alerts: List[Dict[str, Any]]
    ) -> int:
        """
        Insert multiple alerts in a single batch operation.
        
        Args:
            alerts: List of alert dicts with match_id, type, message, data
            
        Returns:
            Number of alerts inserted
        """
        if not alerts:
            return 0
        
        try:
            alert_records = [
                {
                    "match_id": alert["match_id"],
                    "alert_type": alert["type"],
                    "title": alert["message"],
                    "details": alert["data"],
                    "is_read": False,
                }
                for alert in alerts
            ]
            
            response = (
                self.client.table("alerts")
                .insert(alert_records)
                .execute()
            )
            count = len(response.data) if response.data else 0
            self.logger.info(f"Inserted {count} alert records")
            return count
        except Exception as e:
            self.logger.error(f"Error inserting alerts batch: {e}")
            return 0
    
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
    
    # ==========================================
    # NBA MATCHES (Basketball - Separate Tables)
    # ==========================================
    
    async def find_or_create_nba_matches_batch(
        self,
        matches_data: List[Dict[str, Any]]
    ) -> Dict[str, Dict[str, Any]]:
        """
        Find or create multiple NBA matches in batch.
        Uses the nba_matches table (separate from football).
        
        IMPORTANT: Also checks for inverted matches (away_team <-> home_team)
        to prevent duplicate match creation from bookmakers that invert team order.
        
        Args:
            matches_data: List of dicts with league_id, home_team_id, away_team_id, match_date
            
        Returns:
            Dict mapping (league_id, home_team_id, away_team_id) -> match record
            Note: If an inverted match exists, returns that match with a flag.
        """
        if not matches_data:
            return {}
        
        result_map = {}
        
        try:
            # Get unique match keys and calculate dynamic date window from batch data
            unique_keys = set()
            all_dates = []
            for m in matches_data:
                key = (m["league_id"], m["home_team_id"], m["away_team_id"])
                unique_keys.add(key)
                # Parse match_date for dynamic window - ensure UTC aware
                md = m["match_date"]
                if isinstance(md, str):
                    md = datetime.fromisoformat(md.replace("Z", "+00:00"))
                # Normalize to UTC aware
                if md.tzinfo is None:
                    md = md.replace(tzinfo=timezone.utc)
                else:
                    md = md.astimezone(timezone.utc)
                all_dates.append(md)
            
            # Dynamic date window based on actual batch data (not fixed now+7 days)
            if all_dates:
                date_min = min(all_dates) - timedelta(days=1)
                date_max = max(all_dates) + timedelta(days=1)
            else:
                now = datetime.now(timezone.utc)
                date_min = now - timedelta(days=1)
                date_max = now + timedelta(days=30)
            
            response = (
                self.client.table("nba_matches")
                .select("*")
                .gte("match_date", date_min.isoformat())
                .lte("match_date", date_max.isoformat())
                .execute()
            )
            
            # Index existing matches by BOTH normal and inverted keys
            existing = {}
            existing_inverted = {}  # Maps inverted key -> original match
            for match in response.data or []:
                key = (match["league_id"], match["home_team_id"], match["away_team_id"])
                inverted_key = (match["league_id"], match["away_team_id"], match["home_team_id"])
                if key not in existing:
                    existing[key] = match
                # Also store inverted mapping for lookups
                if inverted_key not in existing_inverted:
                    existing_inverted[inverted_key] = match
            
            # Find matches that need to be created
            to_create = []
            for m in matches_data:
                key = (m["league_id"], m["home_team_id"], m["away_team_id"])
                if key in result_map:
                    continue  # Already processed
                
                if key in existing:
                    # Found exact match
                    result_map[key] = existing[key]
                elif key in existing_inverted:
                    # Found inverted match - use it instead of creating duplicate
                    inverted_match = existing_inverted[key]
                    # Mark that this is inverted so orchestrator can swap odds
                    inverted_match["_is_inverted"] = True
                    result_map[key] = inverted_match
                    self.logger.debug(
                        f"Using inverted match for {m['home_team_id']} vs {m['away_team_id']}"
                    )
                else:
                    to_create.append({
                        "league_id": m["league_id"],
                        "home_team_id": m["home_team_id"],
                        "away_team_id": m["away_team_id"],
                        "match_date": m["match_date"].isoformat() if isinstance(m["match_date"], datetime) else m["match_date"],
                        "status": "scheduled",
                    })
                    result_map[key] = None  # Mark as pending
            
            # Batch insert new matches with conflict handling
            if to_create:
                try:
                    insert_response = (
                        self.client.table("nba_matches")
                        .insert(to_create)
                        .execute()
                    )
                except Exception as insert_error:
                    # Handle potential duplicate key errors gracefully
                    self.logger.warning(f"Some NBA matches may already exist: {insert_error}")
                    insert_response = type('obj', (object,), {'data': []})()
                    # Re-fetch to get the existing records
                    refetch = (
                        self.client.table("nba_matches")
                        .select("*")
                        .gte("match_date", date_min.isoformat())
                        .lte("match_date", date_max.isoformat())
                        .execute()
                    )
                    for match in refetch.data or []:
                        key = (match["league_id"], match["home_team_id"], match["away_team_id"])
                        inverted_key = (match["league_id"], match["away_team_id"], match["home_team_id"])
                        if key in result_map and result_map[key] is None:
                            result_map[key] = match
                        elif inverted_key in result_map and result_map[inverted_key] is None:
                            match["_is_inverted"] = True
                            result_map[inverted_key] = match
                
                for match in insert_response.data or []:
                    key = (match["league_id"], match["home_team_id"], match["away_team_id"])
                    result_map[key] = match
            
            self.logger.info(f"NBA batch matches: {len(existing)} found, {len(to_create)} created")
            return result_map
            
        except Exception as e:
            self.logger.error(f"Error in NBA batch match lookup: {e}")
            return {}
    
    # ==========================================
    # NBA ODDS HISTORY
    # ==========================================
    
    async def insert_nba_odds(self, odds_list: List[Dict[str, Any]]) -> int:
        """
        Insert NBA odds into the nba_odds_history table.
        
        Args:
            odds_list: List of normalized NBA odds dictionaries
            
        Returns:
            Number of records inserted
        """
        if not odds_list:
            return 0
        
        try:
            response = (
                self.client.table("nba_odds_history")
                .insert(odds_list)
                .execute()
            )
            count = len(response.data) if response.data else 0
            self.logger.info(f"Inserted {count} NBA odds records")
            return count
        except Exception as e:
            self.logger.error(f"Error inserting NBA odds: {e}")
            return 0
    
    # ==========================================
    # JSON EXPORT (for frontend)
    # ==========================================
    
    async def fetch_odds_for_json(self) -> List[Dict[str, Any]]:
        """Fetch all football odds data from the comparison view for JSON export."""
        try:
            response = (
                self.client.table("odds_comparison")
                .select("*")
                .order("match_date", desc=False)
                .execute()
            )
            return response.data or []
        except Exception as e:
            self.logger.error(f"Error fetching odds for JSON: {e}")
            return []
    
    async def fetch_nba_odds_for_json(self) -> List[Dict[str, Any]]:
        """Fetch all NBA odds data from the nba_odds_comparison view for JSON export."""
        try:
            response = (
                self.client.table("nba_odds_comparison")
                .select("*")
                .order("match_date", desc=False)
                .execute()
            )
            return response.data or []
        except Exception as e:
            self.logger.error(f"Error fetching NBA odds for JSON: {e}")
            return []
    
    def upload_odds_json(self, data: Dict[str, Any]) -> bool:
        """
        Upload odds JSON to Supabase Storage.
        
        Args:
            data: The structured odds data to upload
            
        Returns:
            True if successful, False otherwise
        """
        try:
            json_content = json.dumps(data, ensure_ascii=False, default=str)
            
            # Upload/overwrite the file using upsert
            self.client.storage.from_("odds-data").upload(
                path="odds.json",
                file=json_content.encode("utf-8"),
                file_options={"content-type": "application/json", "upsert": "true"}
            )
            
            self.logger.info(f"Uploaded odds.json ({len(json_content)} bytes)")
            return True
        except Exception as e:
            self.logger.error(f"Error uploading odds JSON: {e}")
            return False

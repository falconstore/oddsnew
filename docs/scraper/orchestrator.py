"""
Orchestrator - Main controller for the odds scraping system.
Manages parallel execution of scrapers, normalization, and database insertion.
"""

import asyncio
from typing import List, Dict, Any, Optional, Type
from datetime import datetime, timedelta
from loguru import logger

from config import settings, BOOKMAKERS
from base_scraper import BaseScraper, ScrapedOdds
from supabase_client import SupabaseClient
from team_matcher import TeamMatcher, LeagueMatcher


class AlertDetector:
    """
    Detects notable conditions in odds data:
    - Value bets (odds significantly higher than average)
    - Arbitrage opportunities (guaranteed profit across bookmakers)
    - Significant odds movements
    """
    
    def __init__(self, supabase: SupabaseClient):
        self.supabase = supabase
        self.logger = logger.bind(component="alert_detector")
    
    async def check_for_alerts(
        self, 
        match_odds: Dict[str, List[Dict[str, Any]]]
    ) -> List[Dict[str, Any]]:
        """
        Check for alert conditions across all matches.
        
        Args:
            match_odds: Dict mapping match_id to list of odds from different bookmakers
            
        Returns:
            List of created alerts
        """
        alerts = []
        
        for match_id, odds_list in match_odds.items():
            if len(odds_list) < 2:
                continue
            
            # Check for arbitrage
            arb_alert = self._check_arbitrage(match_id, odds_list)
            if arb_alert:
                alerts.append(arb_alert)
            
            # Check for value bets
            value_alerts = self._check_value_bets(match_id, odds_list)
            alerts.extend(value_alerts)
        
        # Batch insert all alerts in a single database call
        if alerts:
            await self.supabase.insert_alerts_batch(alerts)
        
        return alerts
    
    def _check_arbitrage(
        self, 
        match_id: str, 
        odds_list: List[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """
        Check if there's an arbitrage opportunity.
        
        Arbitrage exists when: 1/best_home + 1/best_draw + 1/best_away < 1
        """
        best_home = max(o["home_odd"] for o in odds_list)
        best_draw = max((o["draw_odd"] or 0) for o in odds_list)
        best_away = max(o["away_odd"] for o in odds_list)
        
        if best_draw == 0:
            # No draw market
            total = (1 / best_home) + (1 / best_away)
        else:
            total = (1 / best_home) + (1 / best_draw) + (1 / best_away)
        
        profit_pct = (1 - total) * 100
        
        if profit_pct > settings.arbitrage_threshold:
            return {
                "match_id": match_id,
                "type": "arbitrage",
                "message": f"Arbitragem detectada! Lucro garantido: {profit_pct:.2f}%",
                "data": {
                    "profit_percentage": round(profit_pct, 2),
                    "best_home": best_home,
                    "best_draw": best_draw,
                    "best_away": best_away,
                    "home_bookmaker": next(
                        o["bookmaker_id"] for o in odds_list 
                        if o["home_odd"] == best_home
                    ),
                    "draw_bookmaker": next(
                        (o["bookmaker_id"] for o in odds_list 
                         if o["draw_odd"] == best_draw),
                        None
                    ),
                    "away_bookmaker": next(
                        o["bookmaker_id"] for o in odds_list 
                        if o["away_odd"] == best_away
                    ),
                }
            }
        
        return None
    
    def _check_value_bets(
        self, 
        match_id: str, 
        odds_list: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Check for value bets (odds significantly above average).
        
        A value bet exists when a bookmaker's odds are significantly
        higher than the average across all bookmakers.
        """
        alerts = []
        
        # Calculate average odds
        avg_home = sum(o["home_odd"] for o in odds_list) / len(odds_list)
        avg_draw = sum(o["draw_odd"] or 0 for o in odds_list) / len(odds_list)
        avg_away = sum(o["away_odd"] for o in odds_list) / len(odds_list)
        
        for odds in odds_list:
            # Check each outcome
            for outcome, avg, value in [
                ("home", avg_home, odds["home_odd"]),
                ("draw", avg_draw, odds["draw_odd"]),
                ("away", avg_away, odds["away_odd"]),
            ]:
                if value is None or avg == 0:
                    continue
                
                edge = ((value - avg) / avg) * 100
                
                if edge >= settings.value_bet_threshold:
                    alerts.append({
                        "match_id": match_id,
                        "type": "value_bet",
                        "message": (
                            f"Value bet detectado! {outcome.upper()} @ {value:.2f} "
                            f"({edge:.1f}% acima da média)"
                        ),
                        "data": {
                            "outcome": outcome,
                            "odds": value,
                            "average_odds": round(avg, 2),
                            "edge_percentage": round(edge, 2),
                            "bookmaker_id": odds["bookmaker_id"],
                        }
                    })
        
        return alerts


class Orchestrator:
    """
    Main orchestrator for the odds scraping system.
    
    Responsibilities:
    - Initialize and manage all scrapers
    - Execute scrapers in parallel
    - Normalize team/league names
    - Insert data into database
    - Trigger alert detection
    """
    
    def __init__(self):
        self.supabase = SupabaseClient()
        self.team_matcher = TeamMatcher(self.supabase)
        self.league_matcher = LeagueMatcher(self.supabase)
        self.alert_detector = AlertDetector(self.supabase)
        self.logger = logger.bind(component="orchestrator")
        
        # Scrapers will be registered here
        self.scrapers: List[BaseScraper] = []
        
        # Bookmaker ID cache
        self.bookmaker_ids: Dict[str, str] = {}
    
    def register_scraper(self, scraper: BaseScraper):
        """Register a scraper for execution."""
        self.scrapers.append(scraper)
        self.logger.info(f"Registered scraper: {scraper.name}")
    
    async def initialize(self):
        """
        Initialize the orchestrator.
        Loads caches and validates configuration.
        """
        self.logger.info("Initializing orchestrator...")
        
        # Load team and league caches
        await self.team_matcher.load_cache()
        await self.league_matcher.load_cache()
        
        # Load bookmaker IDs
        bookmakers = await self.supabase.fetch_bookmakers()
        self.bookmaker_ids = {b["name"].lower(): b["id"] for b in bookmakers}
        
        self.logger.info(
            f"Initialized with {len(self.scrapers)} scrapers, "
            f"{len(self.bookmaker_ids)} bookmakers"
        )
    
    async def run_once(self) -> Dict[str, Any]:
        """
        Execute a single scraping cycle.
        
        Returns:
            Summary of the scraping cycle
        """
        start_time = datetime.utcnow()
        self.logger.info("Starting scraping cycle...")
        
        # Clear unmatched log cache at the start of each cycle
        self.team_matcher.clear_log_cache()
        
        # Reload caches to pick up new teams/aliases/leagues added via UI
        await self._reload_caches()
        
        # Run all scrapers in parallel
        tasks = [scraper.scrape_all() for scraper in self.scrapers]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Collect all odds
        all_odds: List[ScrapedOdds] = []
        errors = []
        
        for i, result in enumerate(results):
            scraper_name = self.scrapers[i].name
            if isinstance(result, BaseException):
                self.logger.error(f"Scraper {scraper_name} failed: {result}")
                errors.append({"scraper": scraper_name, "error": str(result)})
            else:
                all_odds.extend(result)
                self.logger.info(f"{scraper_name}: collected {len(result)} odds")
        
        # Log pre-normalization NBA count
        nba_pre = [o for o in all_odds if o.league_raw.upper() == "NBA" or o.sport == "basketball"]
        if nba_pre:
            self.logger.info(f"NBA pre-normalization: {len(nba_pre)} odds from scrapers")
        
        # Normalize odds - returns separate lists for football and NBA
        football_normalized, nba_normalized = await self._normalize_odds(all_odds)
        
        # Log post-normalization counts
        self.logger.info(f"Football normalized: {len(football_normalized)} odds")
        if nba_normalized:
            self.logger.info(f"NBA normalized: {len(nba_normalized)} odds")
        
        # Insert football odds into matches/odds_history tables
        football_inserted = await self._insert_odds(football_normalized)
        
        # Insert NBA odds into nba_matches/nba_odds_history tables
        nba_inserted = await self.supabase.insert_nba_odds(nba_normalized)
        
        inserted = football_inserted + nba_inserted
        
        # Check for alerts (only football for now - NBA uses nba_matches table,
        # but alerts.match_id references matches table, causing FK violations)
        if football_normalized:
            match_odds = self._group_by_match(football_normalized)
            alerts = await self.alert_detector.check_for_alerts(match_odds)
        else:
            alerts = []
        
        # Cleanup old matches
        cleaned = await self._cleanup_old_matches()
        
        # Generate and upload JSON for frontend
        json_uploaded = await self._generate_and_upload_json()
        
        # Summary
        elapsed = (datetime.utcnow() - start_time).total_seconds()
        summary = {
            "timestamp": start_time.isoformat(),
            "duration_seconds": round(elapsed, 2),
            "scrapers_run": len(self.scrapers),
            "scrapers_failed": len(errors),
            "odds_collected": len(all_odds),
            "football_normalized": len(football_normalized),
            "nba_normalized": len(nba_normalized),
            "odds_inserted": inserted,
            "alerts_created": len(alerts),
            "matches_cleaned": cleaned,
            "json_uploaded": json_uploaded,
            "errors": errors,
}
        
        self.logger.info(
            f"Cycle complete: {inserted} odds inserted, "
            f"{len(alerts)} alerts created, {cleaned} old matches cleaned, "
            f"JSON uploaded: {json_uploaded} in {elapsed:.2f}s"
        )
        
        return summary
    
    async def _reload_caches(self):
        """
        Reload team/league/bookmaker caches to pick up new entries.
        Called at the start of each scraping cycle.
        """
        try:
            # Track previous counts for logging
            prev_team_count = len(self.team_matcher.teams_cache)
            prev_alias_count = len(self.team_matcher.aliases_cache)
            prev_league_count = len(self.league_matcher.leagues_cache)
            prev_bookmaker_count = len(self.bookmaker_ids)
            
            # Reload all caches
            await self.team_matcher.load_cache()
            await self.league_matcher.load_cache()
            
            # Reload bookmaker IDs
            bookmakers = await self.supabase.fetch_bookmakers()
            self.bookmaker_ids = {b["name"].lower(): b["id"] for b in bookmakers}
            
            # Log changes
            new_team_count = len(self.team_matcher.teams_cache)
            new_alias_count = len(self.team_matcher.aliases_cache)
            new_league_count = len(self.league_matcher.leagues_cache)
            new_bookmaker_count = len(self.bookmaker_ids)
            
            changes = []
            if new_team_count != prev_team_count:
                changes.append(f"teams: {prev_team_count}→{new_team_count}")
            if new_alias_count != prev_alias_count:
                changes.append(f"aliases: {prev_alias_count}→{new_alias_count}")
            if new_league_count != prev_league_count:
                changes.append(f"leagues: {prev_league_count}→{new_league_count}")
            if new_bookmaker_count != prev_bookmaker_count:
                changes.append(f"bookmakers: {prev_bookmaker_count}→{new_bookmaker_count}")
            
            if changes:
                self.logger.info(f"Cache reloaded with changes: {', '.join(changes)}")
            else:
                self.logger.debug("Cache reloaded (no changes)")
                
        except Exception as e:
            self.logger.error(f"Failed to reload caches: {e}")
            # Continue with existing cache - don't break the cycle
    
    async def run_forever(self, interval_seconds: Optional[int] = None):
        """
        Run continuous scraping cycles.
        
        Args:
            interval_seconds: Seconds between cycles (default from settings)
        """
        interval = interval_seconds or settings.scrape_interval_seconds
        self.logger.info(f"Starting continuous scraping (interval: {interval}s)")
        
        await self.initialize()
        
        while True:
            try:
                summary = await self.run_once()
                self.logger.info(f"Cycle summary: {summary}")
            except Exception as e:
                self.logger.error(f"Cycle failed: {e}")
            
            self.logger.info(f"Sleeping for {interval} seconds...")
            await asyncio.sleep(interval)
    
    async def _normalize_odds(
        self, 
        odds_list: List[ScrapedOdds]
    ) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Normalize scraped odds with optimized batch processing.
        Separates football and basketball into different flows.
        
        Returns:
            Tuple of (football_odds, nba_odds)
        """
        if not odds_list:
            return [], []
        
        # Phase 1: Fast normalization using cache only - separate by sport
        football_pre = []
        nba_pre = []
        unmatched_teams = []
        
        for odds in odds_list:
            # Get bookmaker ID (cache lookup)
            bookmaker_id = self.bookmaker_ids.get(odds.bookmaker_name.lower())
            if not bookmaker_id:
                self.logger.warning(f"Unknown bookmaker: {odds.bookmaker_name}")
                continue
            
            # Match league (cache lookup)
        league_id = self.league_matcher.find_league_id(odds.league_raw)
        if not league_id:
            # Silenciado - ligas não cadastradas são ignoradas sem log
            continue
            
            # Determine if this is basketball
            is_basketball = odds.sport == "basketball" or odds.league_raw.upper() == "NBA"
            
            # NBA normalization logging removed (too verbose)
            
            # Match teams - use full method for primary bookmaker to auto-create
            normalized_bookmaker = odds.bookmaker_name.strip().lower()
            
            # [DIAG] logs moved to after team matching (only when failing)
            
            if normalized_bookmaker == self.team_matcher.primary_bookmaker:
                home_team_id = await self.team_matcher.find_team_id(
                    odds.home_team_raw, 
                    odds.bookmaker_name,
                    league_id,
                    odds.league_raw  # Pass league name for better logging
                )
                away_team_id = await self.team_matcher.find_team_id(
                    odds.away_team_raw, 
                    odds.bookmaker_name,
                    league_id,
                    odds.league_raw  # Pass league name for better logging
                )
            else:
                # Other bookmakers use cache-only with league-scoping + cross-league fallback
                home_team_id = self.team_matcher.find_team_id_cached(
                    odds.home_team_raw, 
                    odds.bookmaker_name,
                    league_id,
                    odds.league_raw  # Pass league name for cross-league detection
                )
                away_team_id = self.team_matcher.find_team_id_cached(
                    odds.away_team_raw, 
                    odds.bookmaker_name,
                    league_id,
                    odds.league_raw  # Pass league name for cross-league detection
                )
            
        if not home_team_id:
            unmatched_teams.append((odds.home_team_raw, odds.bookmaker_name))
            continue
        if not away_team_id:
            unmatched_teams.append((odds.away_team_raw, odds.bookmaker_name))
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
        
        # Phase 2: Batch match lookup/creation - SEPARATE for football and NBA
        
        # Football matches
        football_matches_to_find = [
            {
                "league_id": item["league_id"],
                "home_team_id": item["home_team_id"],
                "away_team_id": item["away_team_id"],
                "match_date": item["odds"].match_date,
            }
            for item in football_pre
        ]
        football_match_map = await self.supabase.find_or_create_matches_batch(football_matches_to_find)
        
        # NBA matches (uses separate table)
        nba_matches_to_find = [
            {
                "league_id": item["league_id"],
                "home_team_id": item["home_team_id"],
                "away_team_id": item["away_team_id"],
                "match_date": item["odds"].match_date,
            }
            for item in nba_pre
        ]
        nba_match_map = await self.supabase.find_or_create_nba_matches_batch(nba_matches_to_find)
        
        # Phase 3: Build final normalized records
        football_normalized = []
        nba_normalized = []
        
        # Process football
        for item in football_pre:
            key = (item["league_id"], item["home_team_id"], item["away_team_id"])
            match = football_match_map.get(key)
            
            if not match:
                continue
            
            odds = item["odds"]
            football_normalized.append({
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
        
        # Process NBA (different structure - no draw_odd)
        # IMPORTANT: Handle inverted matches from bookmakers that swap home/away
        for item in nba_pre:
            key = (item["league_id"], item["home_team_id"], item["away_team_id"])
            match = nba_match_map.get(key)
            
            if not match:
                continue
            
            odds = item["odds"]
            home_odd = odds.home_odd
            away_odd = odds.away_odd
            extra_data = odds.extra_data.copy() if odds.extra_data else {}
            
            # Check if this match was found via inverted lookup
            # If so, swap the odds to align with the correct match orientation
            if match.get("_is_inverted"):
                home_odd, away_odd = away_odd, home_odd
                extra_data["teams_swapped"] = True
                self.logger.debug(
                    f"Swapped odds for inverted match: {item['home_team_id']} vs {item['away_team_id']}"
                )
            
            nba_normalized.append({
                "match_id": match["id"],
                "bookmaker_id": item["bookmaker_id"],
                "home_odd": home_odd,
                "away_odd": away_odd,
                "odds_type": odds.odds_type,
                "scraped_at": odds.scraped_at.isoformat(),
                "extra_data": extra_data,
            })
        
        # Log unmatched teams
        if unmatched_teams:
            unique_unmatched = list(set(unmatched_teams))
            self.logger.warning(
                f"{len(unique_unmatched)} unmatched team names. "
                "Consider adding aliases."
            )
            for name, bookmaker in unique_unmatched[:10]:
                self.logger.debug(f"  - '{name}' ({bookmaker})")
        
        return football_normalized, nba_normalized
    
    async def _insert_odds(self, odds_list: List[Dict[str, Any]]) -> int:
        """Insert normalized odds into the database."""
        if not odds_list:
            return 0
        
        return await self.supabase.insert_odds(odds_list)
    
    def _group_by_match(
        self, 
        odds_list: List[Dict[str, Any]]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Group odds by match ID for alert detection."""
        grouped: Dict[str, List[Dict[str, Any]]] = {}
        
        for odds in odds_list:
            match_id = odds["match_id"]
            if match_id not in grouped:
                grouped[match_id] = []
            grouped[match_id].append(odds)
        
        return grouped
    
    async def _cleanup_old_matches(self) -> int:
        """Remove matches that have already started from the database (football + NBA)."""
        football_cleaned = 0
        nba_cleaned = 0
        
        try:
            result = self.supabase.client.rpc('cleanup_started_matches').execute()
            football_cleaned = result.data if result.data else 0
            if football_cleaned > 0:
                self.logger.info(f"Cleaned up {football_cleaned} old football matches")
        except Exception as e:
            self.logger.warning(f"Failed to cleanup old football matches: {e}")
        
        try:
            result = self.supabase.client.rpc('cleanup_started_nba_matches').execute()
            nba_cleaned = result.data if result.data else 0
            if nba_cleaned > 0:
                self.logger.info(f"Cleaned up {nba_cleaned} old NBA matches")
        except Exception as e:
            self.logger.warning(f"Failed to cleanup old NBA matches: {e}")
        
        return football_cleaned + nba_cleaned
    
    async def _generate_and_upload_json(self) -> bool:
        """
        Generate odds JSON and upload to Supabase Storage.
        Combines football and NBA data into a single JSON file.
        """
        try:
            # Fetch football odds from the football view
            football_data = await self.supabase.fetch_odds_for_json()
            
            # Fetch NBA odds from the NBA view
            nba_data = await self.supabase.fetch_nba_odds_for_json()
            
            self.logger.info(f"JSON export: {len(football_data)} football, {len(nba_data)} NBA odds")
            
            # Combine all data
            all_data = football_data + nba_data
            
            if not all_data:
                self.logger.warning("No odds data to export to JSON")
                return False
            
            # Group by match (similar to frontend groupOddsByMatch)
            matches = self._group_odds_for_json(all_data)
            
            # Build final JSON structure
            json_data = {
                "generated_at": datetime.utcnow().isoformat(),
                "matches_count": len(matches),
                "matches": matches
            }
            
            # Upload to storage
            success = self.supabase.upload_odds_json(json_data)
            
            if success:
                football_count = len([m for m in matches if m.get("sport_type") != "basketball"])
                nba_count = len([m for m in matches if m.get("sport_type") == "basketball"])
                self.logger.info(f"Uploaded odds.json with {football_count} football + {nba_count} NBA matches")
            
            return success
            
        except Exception as e:
            self.logger.error(f"Failed to generate/upload JSON: {e}")
            return False
    
    def _group_odds_for_json(self, raw_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Group raw odds data by match for JSON export.
        Uses composite key (home_team + away_team + date) to prevent duplicates.
        """
        from datetime import timezone
        
        match_map: Dict[str, Dict[str, Any]] = {}
        now = datetime.now(timezone.utc)
        five_minutes_ago = now - timedelta(minutes=5)
        
        for row in raw_data:
            match_date_str = row.get("match_date", "")
            try:
                # Parse the match date
                if "T" in match_date_str:
                    match_date = datetime.fromisoformat(match_date_str.replace("Z", "+00:00"))
                else:
                    match_date = datetime.fromisoformat(match_date_str)
                
                # Make timezone-aware if not
                if match_date.tzinfo is None:
                    match_date = match_date.replace(tzinfo=timezone.utc)
                
                # Skip matches that started more than 5 minutes ago
                if match_date < five_minutes_ago:
                    continue
            except (ValueError, TypeError):
                continue
            
            # Use composite key to prevent duplicates from different match_ids
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
                    "sport_type": row.get("sport_type", "football"),  # Include sport_type
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
                "odds_type": row.get("odds_type", "PA"),  # SO = Super Odds, PA = Pagamento Antecipado
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
        
        # Convert infinity to 0 for JSON serialization
        result = []
        for match in match_map.values():
            if match["worst_home"] == float('inf'):
                match["worst_home"] = 0
            if match["worst_draw"] == float('inf'):
                match["worst_draw"] = 0
            if match["worst_away"] == float('inf'):
                match["worst_away"] = 0
            result.append(match)
        
        # Sort by match_date
        result.sort(key=lambda x: x.get("match_date", ""))
        
        return result

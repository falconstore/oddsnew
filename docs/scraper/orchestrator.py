"""
Orchestrator - Main controller for the odds scraping system.
Manages parallel execution of scrapers, normalization, and database insertion.
"""

import asyncio
from typing import List, Dict, Any, Optional, Type
from datetime import datetime
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
        
        # Run all scrapers in parallel
        tasks = [scraper.scrape_all() for scraper in self.scrapers]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Collect all odds
        all_odds: List[ScrapedOdds] = []
        errors = []
        
        for i, result in enumerate(results):
            scraper_name = self.scrapers[i].name
            if isinstance(result, Exception):
                self.logger.error(f"Scraper {scraper_name} failed: {result}")
                errors.append({"scraper": scraper_name, "error": str(result)})
            else:
                all_odds.extend(result)
                self.logger.info(f"{scraper_name}: collected {len(result)} odds")
        
        # Normalize and insert odds
        normalized = await self._normalize_odds(all_odds)
        inserted = await self._insert_odds(normalized)
        
        # Check for alerts
        match_odds = self._group_by_match(normalized)
        alerts = await self.alert_detector.check_for_alerts(match_odds)
        
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
            "odds_normalized": len(normalized),
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
    ) -> List[Dict[str, Any]]:
        """
        Normalize scraped odds with optimized batch processing:
        - Uses cache-only team lookup (no DB calls per team)
        - Batches match lookups/creation
        """
        if not odds_list:
            return []
        
        # Phase 1: Fast normalization using cache only
        pre_normalized = []
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
                self.logger.warning(f"Unknown league: {odds.league_raw}")
                continue
            
            # Match teams using cache-only method (no DB calls)
            home_team_id = self.team_matcher.find_team_id_cached(
                odds.home_team_raw, 
                odds.bookmaker_name
            )
            away_team_id = self.team_matcher.find_team_id_cached(
                odds.away_team_raw, 
                odds.bookmaker_name
            )
            
            if not home_team_id:
                unmatched_teams.append((odds.home_team_raw, odds.bookmaker_name))
                continue
            if not away_team_id:
                unmatched_teams.append((odds.away_team_raw, odds.bookmaker_name))
                continue
            
            pre_normalized.append({
                "odds": odds,
                "bookmaker_id": bookmaker_id,
                "league_id": league_id,
                "home_team_id": home_team_id,
                "away_team_id": away_team_id,
            })
        
        # Phase 2: Batch match lookup/creation
        matches_to_find = [
            {
                "league_id": item["league_id"],
                "home_team_id": item["home_team_id"],
                "away_team_id": item["away_team_id"],
                "match_date": item["odds"].match_date,
            }
            for item in pre_normalized
        ]
        
        match_map = await self.supabase.find_or_create_matches_batch(matches_to_find)
        
        # Phase 3: Build final normalized records
        normalized = []
        for item in pre_normalized:
            key = (item["league_id"], item["home_team_id"], item["away_team_id"])
            match = match_map.get(key)
            
            if not match:
                continue
            
            odds = item["odds"]
            normalized.append({
                "match_id": match["id"],
                "bookmaker_id": item["bookmaker_id"],
                "market_type": odds.market_type,
                "home_odd": odds.home_odd,
                "draw_odd": odds.draw_odd,
                "away_odd": odds.away_odd,
                "scraped_at": odds.scraped_at.isoformat(),
                "extra_data": odds.extra_data or {},
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
        
        return normalized
    
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
        """Remove matches that have already started from the database."""
        try:
            result = self.supabase.client.rpc('cleanup_started_matches').execute()
            deleted = result.data if result.data else 0
            if deleted > 0:
                self.logger.info(f"Cleaned up {deleted} old matches")
            return deleted
        except Exception as e:
            self.logger.warning(f"Failed to cleanup old matches: {e}")
            return 0
    
    async def _generate_and_upload_json(self) -> bool:
        """
        Generate odds JSON and upload to Supabase Storage.
        This provides the frontend with a static JSON file instead of direct DB queries.
        """
        try:
            # Fetch all current odds from the view
            raw_data = await self.supabase.fetch_odds_for_json()
            
            if not raw_data:
                self.logger.warning("No odds data to export to JSON")
                return False
            
            # Group by match (similar to frontend groupOddsByMatch)
            matches = self._group_odds_for_json(raw_data)
            
            # Build final JSON structure
            json_data = {
                "generated_at": datetime.utcnow().isoformat(),
                "matches_count": len(matches),
                "matches": matches
            }
            
            # Upload to storage
            success = self.supabase.upload_odds_json(json_data)
            
            if success:
                self.logger.info(f"Uploaded odds.json with {len(matches)} matches")
            
            return success
            
        except Exception as e:
            self.logger.error(f"Failed to generate/upload JSON: {e}")
            return False
    
    def _group_odds_for_json(self, raw_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Group raw odds data by match for JSON export.
        Similar logic to frontend's groupOddsByMatch function.
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
            
            match_id = row.get("match_id", "")
            
            if match_id not in match_map:
                match_map[match_id] = {
                    "match_id": match_id,
                    "match_date": row.get("match_date"),
                    "match_status": row.get("match_status"),
                    "league_name": row.get("league_name"),
                    "league_country": row.get("league_country"),
                    "home_team": row.get("home_team"),
                    "away_team": row.get("away_team"),
                    "odds": [],
                    "best_home": 0,
                    "best_draw": 0,
                    "best_away": 0,
                    "worst_home": float('inf'),
                    "worst_draw": float('inf'),
                    "worst_away": float('inf')
                }
            
            group = match_map[match_id]
            
            home_odd = row.get("home_odd", 0) or 0
            draw_odd = row.get("draw_odd", 0) or 0
            away_odd = row.get("away_odd", 0) or 0
            
            bookmaker_odds = {
                "bookmaker_id": row.get("bookmaker_id"),
                "bookmaker_name": row.get("bookmaker_name"),
                "home_odd": home_odd,
                "draw_odd": draw_odd,
                "away_odd": away_odd,
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

-- Migration: Prevent duplicate matches
-- This migration removes existing duplicates and adds a unique constraint

-- Step 1: Remove duplicate matches (keep the oldest one for each unique combination)
WITH duplicates AS (
  SELECT id, 
         ROW_NUMBER() OVER (
           PARTITION BY league_id, home_team_id, away_team_id, DATE_TRUNC('day', match_date)
           ORDER BY created_at ASC
         ) as rn
  FROM matches
)
DELETE FROM matches 
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Step 2: Add unique index to prevent future duplicates
-- This index ensures only one match per league/home/away/day combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_unique_per_day 
ON public.matches (league_id, home_team_id, away_team_id, (match_date::date));

-- Note: Run this in Supabase SQL Editor
-- The index will prevent any INSERT that violates the uniqueness constraint

-- Migration: Add sport_type support for basketball (NBA)
-- This migration adds sport type enum and updates the leagues table

-- Step 1: Create sport_type enum
CREATE TYPE public.sport_type AS ENUM ('football', 'basketball');

-- Step 2: Add sport_type column to leagues table
ALTER TABLE public.leagues ADD COLUMN sport_type public.sport_type DEFAULT 'football';

-- Step 3: Update all existing leagues to football (they are all football)
UPDATE public.leagues SET sport_type = 'football' WHERE sport_type IS NULL;

-- Step 4: Add 'moneyline' to market_type enum for basketball
ALTER TYPE public.market_type ADD VALUE 'moneyline';

-- Step 5: Recreate the odds_comparison view to include sport_type and market_type
DROP VIEW IF EXISTS public.odds_comparison;

CREATE VIEW public.odds_comparison AS
SELECT 
    m.id AS match_id,
    m.match_date,
    m.status AS match_status,
    l.name AS league_name,
    l.country AS league_country,
    l.sport_type,
    ht.standard_name AS home_team,
    at.standard_name AS away_team,
    b.name AS bookmaker_name,
    b.id AS bookmaker_id,
    oh.home_odd,
    oh.draw_odd,
    oh.away_odd,
    oh.market_type,
    oh.odds_type,
    oh.extra_data,
    oh.scraped_at,
    CASE 
        WHEN oh.draw_odd IS NOT NULL AND oh.draw_odd > 0 THEN
            ROUND(((1/oh.home_odd + 1/oh.draw_odd + 1/oh.away_odd) - 1) * 100, 2)
        ELSE
            ROUND(((1/oh.home_odd + 1/oh.away_odd) - 1) * 100, 2)
    END AS margin_percentage,
    EXTRACT(EPOCH FROM (NOW() - oh.scraped_at)) AS data_age_seconds
FROM public.matches m
JOIN public.leagues l ON m.league_id = l.id
JOIN public.teams ht ON m.home_team_id = ht.id
JOIN public.teams at ON m.away_team_id = at.id
JOIN public.odds_history oh ON m.id = oh.match_id AND oh.is_latest = TRUE
JOIN public.bookmakers b ON oh.bookmaker_id = b.id
WHERE l.status = 'active' AND b.status = 'active'
  AND m.match_date > (NOW() - INTERVAL '30 minutes');

-- Step 6: Insert NBA league
INSERT INTO public.leagues (name, country, sport_type, status) 
VALUES ('NBA', 'EUA', 'basketball', 'active')
ON CONFLICT DO NOTHING;

-- NOTES:
-- After running this migration:
-- 1. Add NBA teams to the teams table
-- 2. Create NBA scrapers for each bookmaker
-- 3. The frontend will automatically detect sport_type and render accordingly

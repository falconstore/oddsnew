-- Migration: Add team logos to odds_comparison and nba_odds_comparison views
-- This migration updates the views to include logo_url from the teams table

-- =====================================================
-- Football odds_comparison view with logos
-- =====================================================

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
    ht.logo_url AS home_team_logo,
    at.standard_name AS away_team,
    at.logo_url AS away_team_logo,
    b.name AS bookmaker_name,
    b.id AS bookmaker_id,
    oh.home_odd,
    oh.draw_odd,
    oh.away_odd,
    oh.odds_type,
    oh.extra_data,
    oh.scraped_at,
    CASE 
        WHEN l.sport_type = 'basketball' THEN
            ROUND(((1/oh.home_odd + 1/oh.away_odd) - 1) * 100, 2)
        WHEN oh.home_odd > 0 AND oh.draw_odd > 0 AND oh.away_odd > 0 THEN
            ROUND(((1/oh.home_odd + 1/oh.draw_odd + 1/oh.away_odd) - 1) * 100, 2)
        ELSE NULL 
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


-- =====================================================
-- NBA odds_comparison view with logos
-- =====================================================

DROP VIEW IF EXISTS public.nba_odds_comparison;

CREATE VIEW public.nba_odds_comparison AS
SELECT 
    m.id AS match_id,
    m.match_date,
    m.status AS match_status,
    l.name AS league_name,
    l.country AS league_country,
    'basketball'::text AS sport_type,
    ht.standard_name AS home_team,
    ht.logo_url AS home_team_logo,
    at.standard_name AS away_team,
    at.logo_url AS away_team_logo,
    b.name AS bookmaker_name,
    b.id AS bookmaker_id,
    oh.home_odd,
    NULL::numeric AS draw_odd,
    oh.away_odd,
    oh.odds_type,
    oh.extra_data,
    oh.scraped_at,
    ROUND(((1/oh.home_odd + 1/oh.away_odd) - 1) * 100, 2) AS margin_percentage,
    EXTRACT(EPOCH FROM (NOW() - oh.scraped_at)) AS data_age_seconds
FROM public.nba_matches m
JOIN public.leagues l ON m.league_id = l.id
JOIN public.teams ht ON m.home_team_id = ht.id
JOIN public.teams at ON m.away_team_id = at.id
JOIN public.nba_odds_history oh ON m.id = oh.match_id AND oh.is_latest = TRUE
JOIN public.bookmakers b ON oh.bookmaker_id = b.id
WHERE l.status = 'active' AND b.status = 'active'
  AND m.match_date > (NOW() - INTERVAL '30 minutes');

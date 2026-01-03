-- Migration: Cleanup duplicated NBA matches from inverted team orders
-- This handles the case where Betbra (or other bookmakers) inverted home/away teams
-- Run this AFTER deploying the scraper fixes to clean up existing duplicates

-- ============================================
-- STEP 1: PREVIEW - Find duplicated match pairs
-- ============================================
-- This shows matches that have a "twin" with swapped home/away teams
-- Run this SELECT first to see what will be affected

/*
SELECT 
    m1.id as match1_id,
    m1.home_team_id as m1_home,
    m1.away_team_id as m1_away,
    m1.match_date as m1_date,
    m2.id as match2_id,
    m2.home_team_id as m2_home,
    m2.away_team_id as m2_away,
    m2.match_date as m2_date,
    (SELECT COUNT(*) FROM nba_odds_history WHERE match_id = m1.id) as m1_odds_count,
    (SELECT COUNT(*) FROM nba_odds_history WHERE match_id = m2.id) as m2_odds_count
FROM nba_matches m1
JOIN nba_matches m2 ON 
    m1.league_id = m2.league_id
    AND m1.home_team_id = m2.away_team_id
    AND m1.away_team_id = m2.home_team_id
    AND m1.id < m2.id  -- Avoid duplicating pairs
    AND DATE(m1.match_date) = DATE(m2.match_date)
ORDER BY m1.match_date;
*/

-- ============================================
-- STEP 2: Migrate odds from duplicate matches
-- ============================================
-- Move odds from the "wrong" match to the "correct" one
-- We keep the match with MORE odds (or the older one if equal)
-- and SWAP home_odd <-> away_odd when migrating

DO $$
DECLARE
    pair RECORD;
    keep_match_id UUID;
    delete_match_id UUID;
    migrated_count INT := 0;
BEGIN
    -- Find all duplicate pairs
    FOR pair IN
        SELECT 
            m1.id as m1_id,
            m2.id as m2_id,
            (SELECT COUNT(*) FROM nba_odds_history WHERE match_id = m1.id) as m1_count,
            (SELECT COUNT(*) FROM nba_odds_history WHERE match_id = m2.id) as m2_count
        FROM nba_matches m1
        JOIN nba_matches m2 ON 
            m1.league_id = m2.league_id
            AND m1.home_team_id = m2.away_team_id
            AND m1.away_team_id = m2.home_team_id
            AND m1.id < m2.id
            AND DATE(m1.match_date) = DATE(m2.match_date)
    LOOP
        -- Keep the match with more odds, or the first one (m1) if equal
        IF pair.m1_count >= pair.m2_count THEN
            keep_match_id := pair.m1_id;
            delete_match_id := pair.m2_id;
        ELSE
            keep_match_id := pair.m2_id;
            delete_match_id := pair.m1_id;
        END IF;
        
        -- Migrate odds from delete_match to keep_match with SWAPPED odds
        -- (since the match orientation is inverted)
        INSERT INTO nba_odds_history (
            match_id, bookmaker_id, home_odd, away_odd, 
            odds_type, scraped_at, is_latest, extra_data
        )
        SELECT 
            keep_match_id,
            bookmaker_id,
            away_odd,  -- SWAP: away becomes home
            home_odd,  -- SWAP: home becomes away
            odds_type,
            scraped_at,
            FALSE,  -- Mark as not latest, trigger will sort it out
            jsonb_set(COALESCE(extra_data, '{}'::jsonb), '{migrated_from}', to_jsonb(delete_match_id::text))
        FROM nba_odds_history
        WHERE match_id = delete_match_id
        ON CONFLICT DO NOTHING;
        
        -- Delete odds from the duplicate match
        DELETE FROM nba_odds_history WHERE match_id = delete_match_id;
        
        -- Delete the duplicate match
        DELETE FROM nba_matches WHERE id = delete_match_id;
        
        migrated_count := migrated_count + 1;
        
        RAISE NOTICE 'Migrated match % into %, deleted duplicate', delete_match_id, keep_match_id;
    END LOOP;
    
    RAISE NOTICE 'Total duplicate pairs processed: %', migrated_count;
END $$;

-- ============================================
-- STEP 3: Refresh is_latest flags
-- ============================================
-- After migration, ensure is_latest is correct for all records

UPDATE nba_odds_history oh
SET is_latest = FALSE
WHERE is_latest = TRUE
AND EXISTS (
    SELECT 1 FROM nba_odds_history newer
    WHERE newer.match_id = oh.match_id
    AND newer.bookmaker_id = oh.bookmaker_id
    AND newer.odds_type = oh.odds_type
    AND newer.scraped_at > oh.scraped_at
);

-- Set the actual latest records
UPDATE nba_odds_history oh
SET is_latest = TRUE
WHERE scraped_at = (
    SELECT MAX(scraped_at) 
    FROM nba_odds_history sub 
    WHERE sub.match_id = oh.match_id 
    AND sub.bookmaker_id = oh.bookmaker_id
    AND sub.odds_type = oh.odds_type
);

-- ============================================
-- VERIFICATION
-- ============================================
-- Run this to confirm no more duplicates exist

/*
SELECT COUNT(*) as remaining_duplicates
FROM nba_matches m1
JOIN nba_matches m2 ON 
    m1.league_id = m2.league_id
    AND m1.home_team_id = m2.away_team_id
    AND m1.away_team_id = m2.home_team_id
    AND m1.id < m2.id
    AND DATE(m1.match_date) = DATE(m2.match_date);
-- Should return 0
*/

RAISE NOTICE 'NBA duplicate cleanup complete!';

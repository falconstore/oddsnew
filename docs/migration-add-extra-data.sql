-- =====================================================
-- MIGRAÇÃO: Adicionar coluna extra_data para links das partidas
-- Execute este script no SQL Editor do Supabase
-- =====================================================

-- 1. Adicionar coluna extra_data na tabela odds_history
ALTER TABLE public.odds_history 
ADD COLUMN IF NOT EXISTS extra_data JSONB DEFAULT '{}'::jsonb;

-- 2. Atualizar a VIEW odds_comparison para incluir extra_data
CREATE OR REPLACE VIEW public.odds_comparison AS
SELECT 
    m.id AS match_id,
    m.match_date,
    m.status AS match_status,
    l.name AS league_name,
    l.country AS league_country,
    ht.standard_name AS home_team,
    at.standard_name AS away_team,
    b.name AS bookmaker_name,
    b.id AS bookmaker_id,
    oh.home_odd,
    oh.draw_odd,
    oh.away_odd,
    oh.extra_data, -- Links das partidas (betbra_event_id, betbra_market_id, etc.)
    oh.scraped_at,
    -- Cálculo de margem
    CASE 
        WHEN oh.home_odd > 0 AND oh.draw_odd > 0 AND oh.away_odd > 0 
        THEN ROUND(((1/oh.home_odd + 1/oh.draw_odd + 1/oh.away_odd) - 1) * 100, 2)
        ELSE NULL 
    END AS margin_percentage,
    -- Idade dos dados em segundos
    EXTRACT(EPOCH FROM (NOW() - oh.scraped_at)) AS data_age_seconds
FROM public.matches m
JOIN public.leagues l ON m.league_id = l.id
JOIN public.teams ht ON m.home_team_id = ht.id
JOIN public.teams at ON m.away_team_id = at.id
JOIN public.odds_history oh ON m.id = oh.match_id AND oh.is_latest = TRUE
JOIN public.bookmakers b ON oh.bookmaker_id = b.id
WHERE l.status = 'active' AND b.status = 'active';

-- =====================================================
-- RESULTADO ESPERADO:
-- 
-- Cada registro de odds terá extra_data com:
-- {
--   "betbra_event_id": "31976431850500045",
--   "betbra_market_id": "31976432131000045",
--   "odds_type": "back",
--   "volume": 532083.7874
-- }
--
-- Link gerado:
-- https://betbra.bet.br/b/exchange/sport/soccer/event/{betbra_event_id}/market/{betbra_market_id}
-- =====================================================

-- =====================================================
-- MIGRAÇÃO: Adicionar coluna odds_type à tabela odds_history
-- Execute este script no SQL Editor do Supabase
-- =====================================================

-- 1. Adicionar coluna odds_type (SO = Super Odds, PA = Pagamento Antecipado)
ALTER TABLE public.odds_history 
ADD COLUMN IF NOT EXISTS odds_type TEXT DEFAULT 'PA';

-- 2. Criar índice para filtros por tipo de odds
CREATE INDEX IF NOT EXISTS idx_odds_type ON public.odds_history(odds_type);

-- 3. Atualizar a função do trigger para considerar odds_type
-- Cada combinação (match_id, bookmaker_id, odds_type) tem seu próprio is_latest
CREATE OR REPLACE FUNCTION public.mark_old_odds_not_latest()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.odds_history
    SET is_latest = FALSE
    WHERE match_id = NEW.match_id 
      AND bookmaker_id = NEW.bookmaker_id 
      AND odds_type = NEW.odds_type  -- Separar por tipo (SO vs PA)
      AND id != NEW.id
      AND is_latest = TRUE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Recriar a view odds_comparison para incluir odds_type
DROP VIEW IF EXISTS public.odds_comparison;

CREATE VIEW public.odds_comparison AS
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
    oh.odds_type, -- SO = Super Odds, PA = Pagamento Antecipado
    oh.extra_data,
    oh.scraped_at,
    CASE 
        WHEN oh.home_odd > 0 AND oh.draw_odd > 0 AND oh.away_odd > 0 
        THEN ROUND(((1/oh.home_odd + 1/oh.draw_odd + 1/oh.away_odd) - 1) * 100, 2)
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

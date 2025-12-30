-- ============================================
-- LIMPEZA AUTOMÁTICA DE PARTIDAS ANTIGAS
-- Execute este script no Supabase SQL Editor
-- ============================================

-- ============================================
-- FASE 1: FUNÇÃO DE LIMPEZA
-- ============================================

-- Função para limpar partidas que já começaram (30 minutos de margem)
CREATE OR REPLACE FUNCTION public.cleanup_started_matches()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Deletar partidas cuja data já passou
    -- ON DELETE CASCADE remove automaticamente odds_history e alerts
    DELETE FROM public.matches
    WHERE match_date < (NOW() - INTERVAL '30 minutes');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$;

-- ============================================
-- FASE 2: AGENDAR VIA PG_CRON
-- Executa a cada 30 minutos
-- ============================================

-- Habilitar extensão pg_cron (se não estiver habilitada)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Agendar limpeza a cada 30 minutos
SELECT cron.schedule(
    'cleanup-started-matches',
    '*/30 * * * *',
    'SELECT public.cleanup_started_matches()'
);

-- ============================================
-- FASE 3: ATUALIZAR VIEW ODDS_COMPARISON
-- Adiciona filtro para não retornar partidas antigas
-- ============================================

DROP VIEW IF EXISTS public.odds_comparison;

CREATE VIEW public.odds_comparison AS
SELECT 
    m.id AS match_id,
    m.match_date,
    m.status AS match_status,
    l.id AS league_id,
    l.name AS league_name,
    l.country AS league_country,
    ht.id AS home_team_id,
    ht.standard_name AS home_team_name,
    at.id AS away_team_id,
    at.standard_name AS away_team_name,
    oh.id AS odds_id,
    oh.market_type,
    oh.home_odd,
    oh.draw_odd,
    oh.away_odd,
    oh.scraped_at,
    oh.extra_data,
    b.id AS bookmaker_id,
    b.name AS bookmaker_name,
    b.website_url AS bookmaker_url,
    -- Campos calculados
    CASE 
        WHEN oh.draw_odd IS NOT NULL THEN
            ROUND(((1.0/oh.home_odd + 1.0/oh.draw_odd + 1.0/oh.away_odd) - 1) * 100, 2)
        ELSE
            ROUND(((1.0/oh.home_odd + 1.0/oh.away_odd) - 1) * 100, 2)
    END AS margin_percentage,
    EXTRACT(EPOCH FROM (NOW() - oh.scraped_at)) AS data_age_seconds
FROM public.matches m
JOIN public.leagues l ON m.league_id = l.id
JOIN public.teams ht ON m.home_team_id = ht.id
JOIN public.teams at ON m.away_team_id = at.id
JOIN public.odds_history oh ON m.id = oh.match_id AND oh.is_latest = TRUE
JOIN public.bookmakers b ON oh.bookmaker_id = b.id
WHERE l.status = 'active' 
  AND b.status = 'active'
  AND m.match_date > (NOW() - INTERVAL '30 minutes');

-- ============================================
-- LIMPEZA INICIAL (EXECUTAR UMA VEZ)
-- Remove todas as partidas antigas já existentes
-- ============================================

-- Descomente e execute manualmente:
-- SELECT public.cleanup_started_matches();

-- ============================================
-- VERIFICAÇÃO
-- ============================================

-- Verificar cron job criado:
-- SELECT * FROM cron.job WHERE jobname = 'cleanup-started-matches';

-- Verificar quantidade de partidas (deve mostrar apenas futuras):
-- SELECT COUNT(*) FROM public.matches WHERE match_date > NOW();

-- ============================================
-- Migration: Tabelas Separadas para NBA/Basquete
-- Cria estrutura completamente independente do futebol
-- ============================================

-- 1. Verificar se a funcao match_day_utc existe (necessaria para o indice unico)
CREATE OR REPLACE FUNCTION public.match_day_utc(ts TIMESTAMPTZ)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT (ts AT TIME ZONE 'UTC')::DATE;
$$;

-- 2. Criar tabela de partidas NBA
CREATE TABLE IF NOT EXISTS public.nba_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE NOT NULL,
    home_team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
    away_team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
    match_date TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'scheduled',
    home_score INTEGER,
    away_score INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Criar indices para performance
CREATE INDEX IF NOT EXISTS idx_nba_matches_date ON public.nba_matches(match_date);
CREATE INDEX IF NOT EXISTS idx_nba_matches_league ON public.nba_matches(league_id);

-- 4. Criar indice unico para evitar duplicatas no mesmo dia
CREATE UNIQUE INDEX IF NOT EXISTS idx_nba_matches_unique_per_day 
ON public.nba_matches (league_id, home_team_id, away_team_id, public.match_day_utc(match_date));

-- 5. Criar tabela de historico de odds NBA (sem draw_odd)
CREATE TABLE IF NOT EXISTS public.nba_odds_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES public.nba_matches(id) ON DELETE CASCADE NOT NULL,
    bookmaker_id UUID REFERENCES public.bookmakers(id) ON DELETE CASCADE NOT NULL,
    home_odd DECIMAL(6,3) NOT NULL,
    away_odd DECIMAL(6,3) NOT NULL,
    odds_type TEXT DEFAULT 'PA',
    extra_data JSONB DEFAULT '{}'::jsonb,
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    is_latest BOOLEAN DEFAULT TRUE
);

-- 6. Criar indices para performance de odds NBA
CREATE INDEX IF NOT EXISTS idx_nba_odds_match ON public.nba_odds_history(match_id);
CREATE INDEX IF NOT EXISTS idx_nba_odds_bookmaker ON public.nba_odds_history(bookmaker_id);
CREATE INDEX IF NOT EXISTS idx_nba_odds_latest ON public.nba_odds_history(is_latest) WHERE is_latest = TRUE;

-- 7. Criar funcao para marcar odds antigas como nao-latest
CREATE OR REPLACE FUNCTION public.mark_old_nba_odds_not_latest()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.nba_odds_history
    SET is_latest = FALSE
    WHERE match_id = NEW.match_id 
      AND bookmaker_id = NEW.bookmaker_id 
      AND odds_type = NEW.odds_type
      AND id != NEW.id
      AND is_latest = TRUE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Criar trigger para marcar odds antigas
DROP TRIGGER IF EXISTS trg_mark_old_nba_odds ON public.nba_odds_history;
CREATE TRIGGER trg_mark_old_nba_odds
AFTER INSERT ON public.nba_odds_history
FOR EACH ROW
EXECUTE FUNCTION public.mark_old_nba_odds_not_latest();

-- 9. Criar trigger para updated_at em nba_matches
DROP TRIGGER IF EXISTS trg_nba_matches_updated ON public.nba_matches;
CREATE TRIGGER trg_nba_matches_updated 
BEFORE UPDATE ON public.nba_matches 
FOR EACH ROW 
EXECUTE FUNCTION public.update_updated_at();

-- 10. Criar view de comparacao de odds NBA
CREATE OR REPLACE VIEW public.nba_odds_comparison AS
SELECT 
    m.id AS match_id,
    m.match_date,
    m.status AS match_status,
    l.name AS league_name,
    l.country AS league_country,
    'basketball'::TEXT AS sport_type,
    ht.standard_name AS home_team,
    at.standard_name AS away_team,
    b.name AS bookmaker_name,
    b.id AS bookmaker_id,
    oh.home_odd,
    NULL::DECIMAL(6,3) AS draw_odd,  -- Sempre NULL para basquete
    oh.away_odd,
    'moneyline'::TEXT AS market_type,
    oh.odds_type,
    oh.extra_data,
    oh.scraped_at,
    -- Calculo de margem 2-way (sem empate)
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

-- 11. Criar funcao de cleanup para partidas NBA antigas
CREATE OR REPLACE FUNCTION public.cleanup_started_nba_matches()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.nba_matches
    WHERE match_date < (NOW() - INTERVAL '30 minutes');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 12. Verificar que tudo foi criado corretamente
DO $$
BEGIN
    RAISE NOTICE 'Migration NBA Tables concluida com sucesso!';
    RAISE NOTICE 'Tabelas criadas: nba_matches, nba_odds_history';
    RAISE NOTICE 'View criada: nba_odds_comparison';
    RAISE NOTICE 'Funcoes criadas: cleanup_started_nba_matches, mark_old_nba_odds_not_latest';
END $$;

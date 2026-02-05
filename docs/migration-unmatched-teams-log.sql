-- =====================================================
-- MIGRATION: Tabela de logs de times não matcheados
-- Execute este script no SQL Editor do seu Supabase
-- =====================================================

-- Tabela para persistir times não matcheados entre ciclos
CREATE TABLE IF NOT EXISTS public.unmatched_teams_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_name text NOT NULL,
    bookmaker text NOT NULL,
    league_name text,
    scraped_at timestamptz DEFAULT now(),
    resolved boolean DEFAULT false,
    resolved_at timestamptz,
    resolved_team_id uuid REFERENCES public.teams(id),
    UNIQUE(raw_name, bookmaker)
);

-- Index para busca de pendentes
CREATE INDEX IF NOT EXISTS idx_unmatched_pending 
ON public.unmatched_teams_log(resolved) 
WHERE resolved = false;

-- Index para ordenação por data
CREATE INDEX IF NOT EXISTS idx_unmatched_scraped_at 
ON public.unmatched_teams_log(scraped_at DESC);

-- Função para auto-cleanup de logs antigos resolvidos
CREATE OR REPLACE FUNCTION public.cleanup_old_unmatched_logs()
RETURNS integer AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM public.unmatched_teams_log 
    WHERE resolved = true 
    AND resolved_at < NOW() - INTERVAL '7 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comentários para documentação
COMMENT ON TABLE public.unmatched_teams_log IS 'Log de times não matcheados pelos scrapers para análise e criação de aliases';
COMMENT ON COLUMN public.unmatched_teams_log.raw_name IS 'Nome original do time como aparece no bookmaker';
COMMENT ON COLUMN public.unmatched_teams_log.bookmaker IS 'Nome do bookmaker em minúsculo';
COMMENT ON COLUMN public.unmatched_teams_log.league_name IS 'Nome da liga para contexto';
COMMENT ON COLUMN public.unmatched_teams_log.resolved IS 'Se o time já foi resolvido (alias criado ou ignorado)';
COMMENT ON COLUMN public.unmatched_teams_log.resolved_team_id IS 'ID do time para o qual o alias foi criado';

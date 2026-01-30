-- Migration: Scraper Status Monitoring
-- Tabela para rastrear o status e heartbeat de cada scraper

-- Tabela principal de status
CREATE TABLE IF NOT EXISTS public.scraper_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scraper_name TEXT NOT NULL UNIQUE,
    bookmaker_id UUID REFERENCES public.bookmakers(id),
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_success TIMESTAMPTZ,
    odds_collected INTEGER DEFAULT 0,
    odds_inserted INTEGER DEFAULT 0,
    cycle_count INTEGER DEFAULT 0,
    last_error TEXT,
    status TEXT DEFAULT 'unknown',
    extra_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comentarios
COMMENT ON TABLE public.scraper_status IS 'Rastreia o status de cada scraper em tempo real';
COMMENT ON COLUMN public.scraper_status.scraper_name IS 'Nome unico do scraper (ex: betano, bet365, superbet_nba)';
COMMENT ON COLUMN public.scraper_status.last_heartbeat IS 'Timestamp do ultimo heartbeat recebido';
COMMENT ON COLUMN public.scraper_status.last_success IS 'Timestamp da ultima vez que odds foram inseridas com sucesso';
COMMENT ON COLUMN public.scraper_status.odds_collected IS 'Numero de odds coletadas no ultimo ciclo';
COMMENT ON COLUMN public.scraper_status.odds_inserted IS 'Numero de odds inseridas no ultimo ciclo';
COMMENT ON COLUMN public.scraper_status.cycle_count IS 'Contador total de ciclos executados';
COMMENT ON COLUMN public.scraper_status.last_error IS 'Mensagem do ultimo erro ocorrido';
COMMENT ON COLUMN public.scraper_status.status IS 'Status atual: ok, warning, error, offline';

-- Indices para consultas rapidas
CREATE INDEX IF NOT EXISTS idx_scraper_status_name ON public.scraper_status(scraper_name);
CREATE INDEX IF NOT EXISTS idx_scraper_status_heartbeat ON public.scraper_status(last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_scraper_status_status ON public.scraper_status(status);

-- View para monitoramento com tempo calculado desde ultimo heartbeat
CREATE OR REPLACE VIEW public.scraper_status_view AS
SELECT 
    ss.id,
    ss.scraper_name,
    ss.bookmaker_id,
    ss.last_heartbeat,
    ss.last_success,
    ss.odds_collected,
    ss.odds_inserted,
    ss.cycle_count,
    ss.last_error,
    ss.status,
    ss.extra_data,
    ss.created_at,
    ss.updated_at,
    b.name AS bookmaker_display_name,
    b.logo_url AS bookmaker_logo,
    EXTRACT(EPOCH FROM (NOW() - ss.last_heartbeat))::INTEGER AS seconds_since_heartbeat,
    CASE 
        WHEN EXTRACT(EPOCH FROM (NOW() - ss.last_heartbeat)) < 60 THEN 'ok'
        WHEN EXTRACT(EPOCH FROM (NOW() - ss.last_heartbeat)) < 180 THEN 'warning'
        ELSE 'error'
    END AS computed_status,
    CASE 
        WHEN ss.cycle_count > 0 THEN 
            EXTRACT(EPOCH FROM (NOW() - ss.created_at))::INTEGER / ss.cycle_count
        ELSE 
            NULL
    END AS avg_cycle_seconds
FROM public.scraper_status ss
LEFT JOIN public.bookmakers b ON ss.bookmaker_id = b.id
ORDER BY ss.scraper_name;

-- RLS Policies
ALTER TABLE public.scraper_status ENABLE ROW LEVEL SECURITY;

-- Admins podem ver tudo
CREATE POLICY "Admins can view scraper status" ON public.scraper_status
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'
        )
    );

-- Service role pode fazer tudo (scrapers usam service key)
CREATE POLICY "Service role full access" ON public.scraper_status
    FOR ALL
    USING (auth.role() = 'service_role');

-- Grant para view
GRANT SELECT ON public.scraper_status_view TO authenticated;

-- =====================================================
-- ODDS COMPARISON SYSTEM - DATABASE SCHEMA
-- Execute este script no SQL Editor do seu Supabase
-- =====================================================

-- 1. Criar enum para status
CREATE TYPE public.entity_status AS ENUM ('active', 'inactive');

-- 2. Criar enum para tipos de alerta
CREATE TYPE public.alert_type AS ENUM ('value_bet', 'line_movement', 'arbitrage');

-- 3. Criar enum para tipos de mercado
CREATE TYPE public.market_type AS ENUM ('1x2', 'over_under', 'both_teams_score', 'handicap');

-- =====================================================
-- TABELAS PRINCIPAIS
-- =====================================================

-- Ligas/Campeonatos
CREATE TABLE public.leagues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    country TEXT,
    status entity_status DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Times
CREATE TABLE public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    standard_name TEXT NOT NULL,
    league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE,
    logo_url TEXT,
    status entity_status DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Aliases de times (para normalização/fuzzy matching)
CREATE TABLE public.team_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
    alias_name TEXT NOT NULL,
    bookmaker_source TEXT, -- Qual casa usa esse alias
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(alias_name, bookmaker_source)
);

-- Casas de Apostas
CREATE TABLE public.bookmakers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    website_url TEXT,
    logo_url TEXT,
    status entity_status DEFAULT 'active',
    priority INTEGER DEFAULT 0, -- Para ordenação
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partidas/Eventos
CREATE TABLE public.matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE NOT NULL,
    home_team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
    away_team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
    match_date TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'scheduled', -- scheduled, live, finished, postponed
    home_score INTEGER,
    away_score INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Histórico de Odds
CREATE TABLE public.odds_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
    bookmaker_id UUID REFERENCES public.bookmakers(id) ON DELETE CASCADE NOT NULL,
    market_type market_type DEFAULT '1x2',
    home_odd DECIMAL(6,3),
    draw_odd DECIMAL(6,3),
    away_odd DECIMAL(6,3),
    over_line DECIMAL(4,2), -- Para over/under
    over_odd DECIMAL(6,3),
    under_odd DECIMAL(6,3),
    extra_data JSONB DEFAULT '{}'::jsonb, -- Links e metadados (betbra_event_id, betbra_market_id, etc.)
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    is_latest BOOLEAN DEFAULT TRUE
);

-- Alertas
CREATE TABLE public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
    bookmaker_id UUID REFERENCES public.bookmakers(id) ON DELETE CASCADE,
    alert_type alert_type NOT NULL,
    title TEXT NOT NULL,
    details JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configurações do sistema
CREATE TABLE public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX idx_matches_date ON public.matches(match_date);
CREATE INDEX idx_matches_league ON public.matches(league_id);
CREATE INDEX idx_odds_match ON public.odds_history(match_id);
CREATE INDEX idx_odds_bookmaker ON public.odds_history(bookmaker_id);
CREATE INDEX idx_odds_scraped ON public.odds_history(scraped_at);
CREATE INDEX idx_odds_latest ON public.odds_history(is_latest) WHERE is_latest = TRUE;
CREATE INDEX idx_team_aliases_name ON public.team_aliases(alias_name);
CREATE INDEX idx_alerts_unread ON public.alerts(is_read) WHERE is_read = FALSE;

-- =====================================================
-- VIEW PARA COMPARAÇÃO DE ODDS (OTIMIZADA)
-- =====================================================

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
-- FUNÇÕES AUXILIARES
-- =====================================================

-- Função para marcar odds antigas como não-latest
CREATE OR REPLACE FUNCTION public.mark_old_odds_not_latest()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.odds_history
    SET is_latest = FALSE
    WHERE match_id = NEW.match_id 
      AND bookmaker_id = NEW.bookmaker_id 
      AND id != NEW.id
      AND is_latest = TRUE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para marcar odds antigas
CREATE TRIGGER trg_mark_old_odds
AFTER INSERT ON public.odds_history
FOR EACH ROW
EXECUTE FUNCTION public.mark_old_odds_not_latest();

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER trg_leagues_updated BEFORE UPDATE ON public.leagues FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_teams_updated BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_bookmakers_updated BEFORE UPDATE ON public.bookmakers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_matches_updated BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- Desabilitado para acesso público via service_role
-- =====================================================

-- Se você quiser habilitar RLS, descomente as linhas abaixo:
-- ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
-- ... etc

-- =====================================================
-- DADOS INICIAIS DE EXEMPLO
-- =====================================================

-- Inserir algumas casas de apostas
INSERT INTO public.bookmakers (name, website_url, priority) VALUES
('Bet365', 'https://bet365.com', 1),
('Betano', 'https://betano.com', 2),
('Sportingbet', 'https://sportingbet.com', 3),
('Betfair', 'https://betfair.com', 4),
('1xBet', 'https://1xbet.com', 5);

-- Inserir algumas ligas populares
INSERT INTO public.leagues (name, country) VALUES
('Premier League', 'Inglaterra'),
('La Liga', 'Espanha'),
('Bundesliga', 'Alemanha'),
('Serie A', 'Itália'),
('Ligue 1', 'França'),
('Brasileirão Série A', 'Brasil'),
('Champions League', 'Europa'),
('Europa League', 'Europa');

-- Inserir configurações padrão
INSERT INTO public.system_settings (key, value) VALUES
('stale_data_threshold_seconds', '30'),
('value_bet_margin_threshold', '5'),
('refresh_interval_seconds', '10');

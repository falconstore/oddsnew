-- =====================================================
-- MIGRATION: Telegram Bot Duplo Green
-- =====================================================
-- Este script cria as tabelas necessárias para o bot
-- de Telegram que envia alertas de Duplo Green.
-- =====================================================

-- Tabela de configuração do bot
CREATE TABLE public.telegram_bot_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled BOOLEAN DEFAULT false,
  roi_minimo DECIMAL(5,2) DEFAULT -5.0,
  stake_base DECIMAL(10,2) DEFAULT 1000.00,
  intervalo_segundos INTEGER DEFAULT 60,
  horario_inicio TIME DEFAULT '06:00',
  horario_fim TIME DEFAULT '23:00',
  url_site TEXT DEFAULT 'WWW.BETSHARKPRO.COM.BR',
  bookmakers_links JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir configuração inicial
INSERT INTO public.telegram_bot_config (id) 
VALUES (gen_random_uuid());

-- Histórico de DGs enviados
CREATE TABLE public.telegram_dg_enviados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL,
  team1 TEXT NOT NULL,
  team2 TEXT NOT NULL,
  competition TEXT NOT NULL,
  match_date TEXT NOT NULL,
  roi DECIMAL(5,2) NOT NULL,
  stake_casa DECIMAL(10,2),
  stake_empate DECIMAL(10,2),
  stake_fora DECIMAL(10,2),
  retorno_green DECIMAL(10,2) NOT NULL,
  casa_bookmaker TEXT,
  casa_odd DECIMAL(5,2),
  empate_bookmaker TEXT,
  empate_odd DECIMAL(5,2),
  fora_bookmaker TEXT,
  fora_odd DECIMAL(5,2),
  telegram_message_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para evitar duplicatas (mesmo match no mesmo dia)
CREATE UNIQUE INDEX idx_telegram_dg_match_date 
ON public.telegram_dg_enviados(match_id, match_date);

-- Índice para busca por data (ordenação DESC)
CREATE INDEX idx_telegram_dg_created 
ON public.telegram_dg_enviados(created_at DESC);

-- =====================================================
-- RLS Policies
-- =====================================================

ALTER TABLE public.telegram_bot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_dg_enviados ENABLE ROW LEVEL SECURITY;

-- Permitir leitura para usuários autenticados
CREATE POLICY "Allow authenticated read config" 
ON public.telegram_bot_config FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Allow authenticated read enviados" 
ON public.telegram_dg_enviados FOR SELECT 
TO authenticated USING (true);

-- Permitir UPDATE para usuários autenticados
CREATE POLICY "Allow authenticated update config" 
ON public.telegram_bot_config FOR UPDATE 
TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- Comentários para documentação
-- =====================================================

COMMENT ON TABLE public.telegram_bot_config IS 
  'Configurações do bot de Telegram para alertas de Duplo Green';

COMMENT ON TABLE public.telegram_dg_enviados IS 
  'Histórico de oportunidades de Duplo Green enviadas ao Telegram';

COMMENT ON COLUMN public.telegram_bot_config.roi_minimo IS 
  'ROI mínimo para enviar alerta (pode ser negativo)';

COMMENT ON COLUMN public.telegram_bot_config.stake_base IS 
  'Valor base para cálculo de stakes';

COMMENT ON COLUMN public.telegram_dg_enviados.roi IS 
  'Return on Investment calculado: (1 - (1/oddCasa + 1/oddFora)) * 100';

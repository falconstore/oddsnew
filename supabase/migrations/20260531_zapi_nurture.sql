-- Migration: zapi_nurture
-- Adiciona colunas para funil de cobrança de inatividade e nurture de 7 dias

-- ── Ponto 1: Cobrança de inatividade (lead ficou em awaiting_choice sem clicar) ──
ALTER TABLE zapi_conversation_state
  ADD COLUMN IF NOT EXISTS nudge_count   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nudge_at      timestamptz;    -- próxima cobrança agendada

-- ── Ponto 3: Nurture de 7 dias ──
ALTER TABLE trial_leads
  ADD COLUMN IF NOT EXISTS nurture_day          integer  NOT NULL DEFAULT 0,  -- último dia enviado
  ADD COLUMN IF NOT EXISTS nurture_sent_at      timestamptz,                   -- timestamp do último envio
  ADD COLUMN IF NOT EXISTS day7_offer_sent_at   timestamptz,                   -- quando enviou a oferta do dia 7
  ADD COLUMN IF NOT EXISTS day7_nudge1_sent_at  timestamptz,                   -- +1h após oferta
  ADD COLUMN IF NOT EXISTS day7_nudge2_sent_at  timestamptz;                   -- +4h após oferta

-- ── Ponto 2 + Ponto 3: Resultado diário às 23h ──
-- Nenhuma coluna nova necessária — usa `procedures` existente

-- Índice para facilitar busca de nudge pendente
CREATE INDEX IF NOT EXISTS idx_zapi_conv_nudge
  ON zapi_conversation_state (nudge_at)
  WHERE nudge_at IS NOT NULL AND step = 'awaiting_choice';

-- Índice para nurture
CREATE INDEX IF NOT EXISTS idx_trial_leads_nurture
  ON trial_leads (entered_at, status, nurture_day)
  WHERE status IN ('active','pending') AND entered_at IS NOT NULL;

-- ── Cron: zapi-nurture a cada 5 minutos ──
SELECT cron.schedule(
  'zapi-nurture-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url    := (SELECT value FROM vault.secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/zapi-nurture',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM vault.secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body   := '{"source":"cron"}'::jsonb
  );
  $$
);

-- ── Cron: resultado diário às 23h (horário de Brasília = 02:00 UTC) ──
SELECT cron.schedule(
  'zapi-daily-result-23h',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url    := (SELECT value FROM vault.secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/zapi-nurture',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM vault.secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body   := '{"source":"daily_result"}'::jsonb
  );
  $$
);

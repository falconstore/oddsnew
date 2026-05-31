-- Migration: zapi_followup
-- Adiciona suporte ao follow-up de 10 minutos pós-escolha do menu Z-API
-- e agenda o cron job que dispara a mensagem de confirmação.

-- ── Novas colunas em zapi_conversation_state ─────────────────────────────
ALTER TABLE public.zapi_conversation_state
  ADD COLUMN IF NOT EXISTS follow_up_at    timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_sent  boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_zapi_state_followup
  ON public.zapi_conversation_state (follow_up_at)
  WHERE follow_up_sent = false AND step = 'done';

-- ── Cron job: zapi-followup a cada 2 minutos ─────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'zapi-followup-every-2min') THEN
    PERFORM cron.unschedule('zapi-followup-every-2min');
  END IF;
END
$$;

SELECT cron.schedule(
  'zapi-followup-every-2min',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL')
               || '/functions/v1/zapi-followup',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1
      )
    ),
    body    := '{"source":"cron"}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);

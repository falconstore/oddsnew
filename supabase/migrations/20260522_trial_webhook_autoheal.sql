-- =====================================================
-- Trial Webhook Auto-heal
--
-- Defesa de 2ª camada contra "sequestro" do webhook do bot do Telegram.
-- Quando outro projeto que compartilha o mesmo bot token chama setWebhook
-- apontando pra outra URL, o Telegram derruba o nosso webhook silenciosamente
-- (só aceita 1 webhook por bot). Esse cron detecta o drift a cada 5min e
-- re-instala o webhook correto chamando a edge function `trial-webhook-guard`.
--
-- Componentes:
--   1) Flag `webhook_autoheal_enabled` em trial_settings (default ligado)
--   2) Tabela `trial_webhook_audit` com histórico de correções
--   3) pg_cron `trial-webhook-autoheal-5min` rodando a cada 5min
--
-- A edge function `trial-webhook-guard` faz a checagem real e o setWebhook;
-- aqui só agendamos a chamada usando o vault secret `trial_cron_secret` já
-- existente (reaproveitado como x-cron-secret do guard).
-- =====================================================

-- 1) Toggle do auto-heal
ALTER TABLE public.trial_settings
  ADD COLUMN IF NOT EXISTS webhook_autoheal_enabled boolean NOT NULL DEFAULT true;

-- 2) Tabela de auditoria
CREATE TABLE IF NOT EXISTS public.trial_webhook_audit (
  id bigserial PRIMARY KEY,
  checked_at timestamptz NOT NULL DEFAULT now(),
  was_drifted boolean NOT NULL DEFAULT false,
  previous_url text,
  previous_allowed_updates text[],
  new_url text,
  action_taken text NOT NULL,
  telegram_response jsonb,
  error_message text
);

CREATE INDEX IF NOT EXISTS trial_webhook_audit_checked_at_idx
  ON public.trial_webhook_audit (checked_at DESC);

CREATE INDEX IF NOT EXISTS trial_webhook_audit_drift_idx
  ON public.trial_webhook_audit (checked_at DESC)
  WHERE was_drifted = true;

ALTER TABLE public.trial_webhook_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trial_webhook_audit_admins_can_read" ON public.trial_webhook_audit;
CREATE POLICY "trial_webhook_audit_admins_can_read" ON public.trial_webhook_audit
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_email = (auth.jwt() ->> 'email')
        AND (up.can_view_trial = true OR up.is_super_admin = true)
    )
  );

-- 3) Schedule pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'trial-webhook-autoheal-5min') THEN
    PERFORM cron.unschedule('trial-webhook-autoheal-5min');
  END IF;
END
$$;

SELECT cron.schedule(
  'trial-webhook-autoheal-5min',
  '*/5 * * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://wspsuempnswljkphatur.functions.supabase.co/trial-webhook-guard',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'trial_cron_secret' LIMIT 1
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $cmd$
);

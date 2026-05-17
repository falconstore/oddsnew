-- =====================================================
-- Trial Recall — pg_cron schedule
-- Roda 1x ao dia (10:00 UTC = 07:00 Brasília) e chama
-- POST /functions/v1/trial-recall com body { "cron": true }.
--
-- Reusa o segredo 'trial_cron_secret' já existente no Vault
-- (criado na 20260501_trial_cron_schedule.sql), igual ao trial-cron.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'trial-recall-daily') THEN
    PERFORM cron.unschedule('trial-recall-daily');
  END IF;
END
$$;

SELECT cron.schedule(
  'trial-recall-daily',
  '0 10 * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://wspsuempnswljkphatur.functions.supabase.co/trial-recall',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'trial_cron_secret'
        LIMIT 1
      )
    ),
    body := '{"cron":true}'::jsonb,
    timeout_milliseconds := 120000
  ) AS request_id;
  $cmd$
);

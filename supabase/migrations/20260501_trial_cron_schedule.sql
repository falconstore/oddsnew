-- =====================================================
-- Trial Cron Schedule
-- Activates the pg_cron job that drives the Trial Telegram system:
--   * 24h reminder DMs
--   * 1h reminder DMs
--   * Auto-expire (banChatMember + unbanChatMember) of expired v2 leads
--
-- Pre-requisite (manual, ONE-TIME, do NOT commit the value):
--   The service_role JWT must already be stored in Supabase Vault under
--   the name 'trial_cron_service_role'. Create it once via SQL editor:
--
--     SELECT vault.create_secret(
--       '<SERVICE_ROLE_JWT>',
--       'trial_cron_service_role',
--       'Service role JWT used by trial-cron pg_cron job'
--     );
--
-- The schedule below reads the secret at runtime via vault.decrypted_secrets,
-- so the value never leaves the database.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Idempotent: drop any prior schedule with the same name before recreating.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'trial-cron-every-30min') THEN
    PERFORM cron.unschedule('trial-cron-every-30min');
  END IF;
END
$$;

-- Run every 30 minutes. The 1h reminder window inside trial-cron looks ahead
-- 90 minutes, so a 30-min cadence guarantees every lead is hit at least once
-- inside that window before expiring.
SELECT cron.schedule(
  'trial-cron-every-30min',
  '*/30 * * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://wspsuempnswljkphatur.functions.supabase.co/trial-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'trial_cron_service_role'
        LIMIT 1
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) AS request_id;
  $cmd$
);

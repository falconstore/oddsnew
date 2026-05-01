-- =====================================================
-- Trial Cron Schedule
-- Activates the pg_cron job that drives the Trial Telegram system:
--   * 24h reminder DMs
--   * 1h reminder DMs
--   * Auto-expire (banChatMember + unbanChatMember) of expired v2 leads
--
-- Pre-requisites (manual, ONE-TIME, do NOT commit the value):
--
-- 1. Generate a strong random shared secret and set it as an Edge Function
--    secret named TRIAL_CRON_SECRET (via Supabase dashboard or Mgmt API).
--    The trial-cron Edge Function accepts this value as Bearer token in
--    addition to the auto-injected SUPABASE_SERVICE_ROLE_KEY. Decoupling
--    from SUPABASE_SERVICE_ROLE_KEY protects this job from silent breakage
--    when the platform rotates the auto-injected key.
--
-- 2. Store the same value in Supabase Vault under the name 'trial_cron_secret':
--
--      SELECT vault.create_secret(
--        '<TRIAL_CRON_SECRET_VALUE>',
--        'trial_cron_secret',
--        'Custom shared secret for trial-cron pg_cron job'
--      );
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
        WHERE name = 'trial_cron_secret'
        LIMIT 1
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 90000
  ) AS request_id;
  $cmd$
);

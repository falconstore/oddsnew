-- =====================================================
-- FreeBet PRO Re-sync Cron — intervalo 5 minutos
-- Reduz o intervalo de 1h pra 5min pra minimizar o delay
-- quando o servidor de homologação da FreeBet PRO (Replit)
-- está em sleep e a sync inicial falha silenciosamente.
-- =====================================================

-- Remove jobs com qualquer nome anterior (idempotente)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'freebetpro-resync-every-hour') THEN
    PERFORM cron.unschedule('freebetpro-resync-every-hour');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'freebetpro-resync-5min') THEN
    PERFORM cron.unschedule('freebetpro-resync-5min');
  END IF;
END
$$;

-- Roda a cada 5 minutos
SELECT cron.schedule(
  'freebetpro-resync-5min',
  '*/5 * * * *',
  'SELECT net.http_post(url := ''https://wspsuempnswljkphatur.functions.supabase.co/freebetpro-resync-cron'', headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', ''Bearer '' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''trial_cron_secret'' LIMIT 1)), body := ''{}''::jsonb, timeout_milliseconds := 90000) AS request_id;'
);

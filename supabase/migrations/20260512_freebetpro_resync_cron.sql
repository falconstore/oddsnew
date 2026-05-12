-- =====================================================
-- FreeBet PRO Re-sync Cron
-- Agenda um job pg_cron que roda a cada hora e reenvia
-- ao FreeBet PRO qualquer procedure que ainda não foi
-- sincronizado (freebetpro_external_id IS NULL), tem
-- platform preenchida e data >= FREEBETPRO_DATA_DE_CORTE.
--
-- 100% idempotente: procedures já com freebetpro_external_id
-- nunca são reprocessados — sem risco de reenvio duplicado.
--
-- Reutiliza o vault secret 'trial_cron_secret' que já existe
-- no projeto — nenhum setup adicional necessário.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Idempotent: remove schedule anterior antes de recriar
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'freebetpro-resync-every-hour') THEN
    PERFORM cron.unschedule('freebetpro-resync-every-hour');
  END IF;
END
$$;

-- Roda a cada hora no minuto 15 (offset do trial-cron que roda em */30)
SELECT cron.schedule(
  'freebetpro-resync-every-hour',
  '15 * * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://wspsuempnswljkphatur.functions.supabase.co/freebetpro-resync-cron',
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

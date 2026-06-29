-- =====================================================
-- Relatório de Procedimentos em Aberto — Cron horário
-- Agenda um job pg_cron que roda a cada hora (no minuto 0)
-- e chama a Edge Function `procedure-open-report`, que monta
-- e envia ao Telegram a lista de procedimentos com status
-- "Enviada Partida em Aberto".
--
-- Destino padrão: GRUPO PRÉ ENVIO (definido na própria função,
-- DEFAULT_CHAT_ID). Trocar para o VIP é alterar a função (ou
-- passar chatId no body via outra chamada).
--
-- A função roda com verify_jwt=true (a plataforma valida o JWT), então o
-- cron passa a service_role do Vault (SUPABASE_SERVICE_ROLE_KEY), que é um
-- JWT válido e fica sincronizada com rotações de chave do projeto.
-- 100% idempotente.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Idempotent: remove schedule anterior antes de recriar
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'procedure-open-report-hourly') THEN
    PERFORM cron.unschedule('procedure-open-report-hourly');
  END IF;
END
$$;

-- Roda a cada hora no minuto 0
SELECT cron.schedule(
  'procedure-open-report-hourly',
  '0 * * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://wspsuempnswljkphatur.functions.supabase.co/procedure-open-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
        LIMIT 1
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 90000
  ) AS request_id;
  $cmd$
);

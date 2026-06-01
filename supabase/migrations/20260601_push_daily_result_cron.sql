-- Push Daily Result Cron
-- Dispara notificação push às 23h Brasília (02:00 UTC) com lucro do dia + projeção 5 CPFs

SELECT cron.unschedule('push-daily-result-23h')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'push-daily-result-23h'
);

SELECT cron.schedule(
  'push-daily-result-23h',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/push-daily-result',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);

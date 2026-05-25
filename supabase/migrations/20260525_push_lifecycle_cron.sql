-- Push Lifecycle Cron
-- Chama push-lifecycle a cada hora para disparar notificações automáticas
-- (trial expirando, trial expirado, remarketing, assinatura vencendo/cancelada)

-- Garante que a extensão pg_cron está habilitada
-- (já habilitada pelo projeto, não precisa criar de novo)

-- Remove cron anterior se existir
SELECT cron.unschedule('push-lifecycle-hourly')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'push-lifecycle-hourly'
);

-- Agenda: todo início de hora
SELECT cron.schedule(
  'push-lifecycle-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/push-lifecycle',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body    := '{"source":"cron"}'::jsonb
  ) AS request_id;
  $$
);

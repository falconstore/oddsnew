-- =====================================================
-- Snapshots diários do total de inscritos do CANAL Grupo Free.
--
-- O Grupo Free é um CANAL do Telegram — canais não notificam entrada/saída
-- individual via bot. A única métrica de crescimento disponível é o total de
-- inscritos (getChatMemberCount). O cron free-group-snapshot grava 1x/dia.
--
-- 1 linha por dia (UNIQUE em `dia`) — reexecutar no mesmo dia faz UPSERT.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.free_group_snapshots (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dia         date NOT NULL UNIQUE,
  total       integer NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS: admins com can_view_trial (ou super admin) leem. Service role bypassa.
ALTER TABLE public.free_group_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "free_group_snapshots_read" ON public.free_group_snapshots;
CREATE POLICY "free_group_snapshots_read" ON public.free_group_snapshots
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_email = (auth.jwt() ->> 'email')
        AND (up.can_view_trial = true OR up.is_super_admin = true)
    )
  );

-- Agendamento (pg_cron) — roda 1x/dia às 06:00 UTC (03:00 BRT):
--   select cron.schedule('free-group-snapshot-daily', '0 6 * * *', $$
--     SELECT net.http_post(
--       url := 'https://wspsuempnswljkphatur.functions.supabase.co/free-group-snapshot',
--       headers := jsonb_build_object('Content-Type','application/json',
--         'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='trial_cron_secret' LIMIT 1)),
--       body := '{}'::jsonb, timeout_milliseconds := 30000) AS request_id;
--   $$);

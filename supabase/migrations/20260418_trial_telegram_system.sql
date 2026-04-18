-- =====================================================
-- Trial Telegram System — Schema + permissions
-- Roda no Supabase do projeto principal
-- (mesmo onde a tabela `user_permissions` vive)
-- =====================================================

-- 1. Coluna de permissão (DEVE vir antes da policy abaixo)
ALTER TABLE public.user_permissions
  ADD COLUMN IF NOT EXISTS can_view_trial boolean NOT NULL DEFAULT false;

-- 2. Tabela trial_leads
CREATE TABLE IF NOT EXISTS public.trial_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  whatsapp text NOT NULL,            -- normalizado: somente dígitos
  telegram_username text NOT NULL,   -- normalizado: lowercase, sem @
  telegram_user_id bigint,
  invite_link text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','expired','removed','blocked')),
  entered_at timestamptz,
  expires_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Índices únicos para deduplicação (case-insensitive p/ email/telegram)
CREATE UNIQUE INDEX IF NOT EXISTS trial_leads_email_unique
  ON public.trial_leads (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS trial_leads_whatsapp_unique
  ON public.trial_leads (whatsapp);
CREATE UNIQUE INDEX IF NOT EXISTS trial_leads_telegram_unique
  ON public.trial_leads (lower(telegram_username));

-- 4. Índices para cron e webhook
CREATE INDEX IF NOT EXISTS trial_leads_status_expires_idx
  ON public.trial_leads (status, expires_at);
CREATE INDEX IF NOT EXISTS trial_leads_invite_link_idx
  ON public.trial_leads (invite_link);

-- 5. RLS: padrão deny-all; service_role bypassa automaticamente
ALTER TABLE public.trial_leads ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados com can_view_trial leem (admin CRM)
DROP POLICY IF EXISTS "trial_admins_can_read" ON public.trial_leads;
CREATE POLICY "trial_admins_can_read" ON public.trial_leads
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_email = (auth.jwt() ->> 'email')
        AND (up.can_view_trial = true OR up.is_super_admin = true)
    )
  );

-- =====================================================
-- (Opcional) Agendamento via pg_cron — rodar 1x ao dia
-- Ajuste a URL/service-role-key abaixo antes de aplicar.
-- =====================================================
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- CREATE EXTENSION IF NOT EXISTS pg_net;
--
-- SELECT cron.schedule(
--   'trial-cron-daily',
--   '0 3 * * *',  -- 03:00 UTC = 00:00 Brasília
--   $$
--   SELECT net.http_post(
--     url := 'https://SEU-PROJETO.functions.supabase.co/trial-cron',
--     headers := jsonb_build_object(
--       'Content-Type','application/json',
--       'Authorization','Bearer SUA_SERVICE_ROLE_KEY'
--     ),
--     body := '{}'::jsonb
--   ) AS request_id;
--   $$
-- );

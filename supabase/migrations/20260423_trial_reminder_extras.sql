-- 2026-04-23 — Aviso de 1h adicional + cupom configurável + botão suporte
--
-- 1) Coluna `reminder_1h_sent_at` em trial_leads para o segundo aviso
--    (1h antes da expiração). Independente de `reminder_sent_at` (24h).
-- 2) Tabela singleton `trial_settings` para configurações editáveis pelo
--    admin sem redeploy (cupom da DM).

ALTER TABLE public.trial_leads
  ADD COLUMN IF NOT EXISTS reminder_1h_sent_at timestamptz;

CREATE TABLE IF NOT EXISTS public.trial_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  reminder_coupon text NOT NULL DEFAULT 'PODPROMO',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

INSERT INTO public.trial_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

ALTER TABLE public.trial_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trial_settings_admins_can_read" ON public.trial_settings;
CREATE POLICY "trial_settings_admins_can_read" ON public.trial_settings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_email = (auth.jwt() ->> 'email')
        AND (up.can_view_trial = true OR up.is_super_admin = true)
    )
  );

DROP POLICY IF EXISTS "trial_settings_admins_can_update" ON public.trial_settings;
CREATE POLICY "trial_settings_admins_can_update" ON public.trial_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_email = (auth.jwt() ->> 'email')
        AND (up.can_view_trial = true OR up.is_super_admin = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_email = (auth.jwt() ->> 'email')
        AND (up.can_view_trial = true OR up.is_super_admin = true)
    )
  );

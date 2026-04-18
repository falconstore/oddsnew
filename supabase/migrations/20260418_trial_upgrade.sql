-- =====================================================
-- Trial Upgrade — coluna de aviso prévio + métricas
-- =====================================================

-- 1. Coluna que registra quando o aviso de 24h foi enviado.
ALTER TABLE public.trial_leads
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

-- Índice parcial para o cron localizar rapidamente quem precisa de aviso.
CREATE INDEX IF NOT EXISTS trial_leads_reminder_due_idx
  ON public.trial_leads (expires_at)
  WHERE status = 'active' AND reminder_sent_at IS NULL;

-- 2. Tabela de eventos da página /trial-upgrade
CREATE TABLE IF NOT EXISTS public.trial_upgrade_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.trial_leads(id) ON DELETE SET NULL,
  event_type text NOT NULL
    CHECK (event_type IN ('view','cta_whatsapp','cta_checkout','cta_telegram')),
  source text,
  user_agent text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trial_upgrade_events_lead_idx
  ON public.trial_upgrade_events (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS trial_upgrade_events_type_idx
  ON public.trial_upgrade_events (event_type, created_at DESC);

-- 3. RLS: deny por padrão; admins (mesma policy de trial_leads) podem ler.
ALTER TABLE public.trial_upgrade_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trial_admins_can_read_upgrade_events" ON public.trial_upgrade_events;
CREATE POLICY "trial_admins_can_read_upgrade_events" ON public.trial_upgrade_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_email = (auth.jwt() ->> 'email')
        AND (up.can_view_trial = true OR up.is_super_admin = true)
    )
  );

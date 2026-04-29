-- =====================================================
-- Trial CAPI — log de eventos enviados pra Conversions API da Meta
-- =====================================================
-- Cada linha representa uma tentativa de enviar um evento server-side
-- pro endpoint /events do Meta. Guarda o status (success/error), o
-- event_name (ex.: 'Lead', 'PageView') e o event_id usado pro dedupe
-- com o pixel do navegador. Usado pelo painel /trial-admin pra mostrar
-- contagem das últimas 24h.

CREATE TABLE IF NOT EXISTS public.trial_capi_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.trial_leads(id) ON DELETE SET NULL,
  event_name text NOT NULL,
  event_id text,
  source text,
  status text NOT NULL CHECK (status IN ('success', 'error')),
  http_status int,
  fb_trace_id text,
  error_message text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trial_capi_events_created_idx
  ON public.trial_capi_events (created_at DESC);
CREATE INDEX IF NOT EXISTS trial_capi_events_status_idx
  ON public.trial_capi_events (status, created_at DESC);
CREATE INDEX IF NOT EXISTS trial_capi_events_event_idx
  ON public.trial_capi_events (event_name, created_at DESC);

-- RLS: deny por padrão; admins do trial leem (mesma policy de trial_leads).
ALTER TABLE public.trial_capi_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trial_admins_can_read_capi_events" ON public.trial_capi_events;
CREATE POLICY "trial_admins_can_read_capi_events" ON public.trial_capi_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_email = (auth.jwt() ->> 'email')
        AND (up.can_view_trial = true OR up.is_super_admin = true)
    )
  );

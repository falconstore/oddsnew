-- Tabela de estado da conversa WhatsApp (funil Z-API)
-- Guarda em que etapa do funil cada número de WhatsApp está.
-- TTL implícito: cron pode limpar registros > 7 dias (opcional).

CREATE TABLE IF NOT EXISTS public.zapi_conversation_state (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         text NOT NULL UNIQUE,          -- número normalizado (55XXXXXXXXXXX)
  lead_id       uuid REFERENCES public.trial_leads(id) ON DELETE SET NULL,
  step          text NOT NULL DEFAULT 'initial', -- 'initial' | 'awaiting_choice' | 'done'
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zapi_conv_state_phone ON public.zapi_conversation_state(phone);

-- RLS desativado (acesso só via service_role na edge function)
ALTER TABLE public.zapi_conversation_state DISABLE ROW LEVEL SECURITY;

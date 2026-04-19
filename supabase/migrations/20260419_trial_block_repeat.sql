-- =====================================================
-- Trial Telegram — bloqueio de repetidores por telegram_user_id
-- Aditivo: NÃO altera nada existente, apenas adiciona:
--   - status novo 'blocked_repeat' (mantém todos os antigos)
--   - coluna previous_lead_id (FK pro lead anterior)
--   - índice parcial em telegram_user_id pra checagem rápida
-- =====================================================

-- 1) Estender o CHECK de status sem perder os valores antigos.
-- DROP/ADD é necessário porque CHECK não suporta ALTER incremental no PG.
ALTER TABLE public.trial_leads
  DROP CONSTRAINT IF EXISTS trial_leads_status_check;

ALTER TABLE public.trial_leads
  ADD CONSTRAINT trial_leads_status_check
  CHECK (status IN (
    'pending','active','expired','removed','blocked','blocked_repeat'
  ));

-- 2) Coluna nova: ponteiro pro lead anterior do mesmo Telegram user.
ALTER TABLE public.trial_leads
  ADD COLUMN IF NOT EXISTS previous_lead_id uuid
    REFERENCES public.trial_leads(id) ON DELETE SET NULL;

-- 3) Índice parcial — acelera o SELECT que checa repetidores
-- (todos os leads ativados acabam com telegram_user_id, então este index
-- cobre a maioria das linhas; o WHERE evita NULLs inflarem o b-tree).
CREATE INDEX IF NOT EXISTS trial_leads_telegram_user_id_idx
  ON public.trial_leads (telegram_user_id)
  WHERE telegram_user_id IS NOT NULL;

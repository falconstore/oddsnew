-- =====================================================
-- Trial Recall System
-- Adiciona infraestrutura pra "Recall" de leads travados em
-- status='pending' por causa de webhook caído.
--
-- Permite o admin (via botão em /trial-admin) e o pg_cron diário
-- dispararem uma DM amigável pelo bot com um invite_link NOVO
-- (fresco, 1 uso, 24h).
-- =====================================================

-- 1) Colunas no trial_leads pra rastrear envio
ALTER TABLE public.trial_leads
  ADD COLUMN IF NOT EXISTS last_recall_at timestamptz,
  ADD COLUMN IF NOT EXISTS recall_count integer NOT NULL DEFAULT 0;

-- Índice pra acelerar a query do cron (pending + has telegram_user_id +
-- ordenar por last_recall_at). Como o cron filtra primeiro por status
-- e telegram_user_id NOT NULL, um índice simples ajuda nas datas.
CREATE INDEX IF NOT EXISTS trial_leads_pending_recall_idx
  ON public.trial_leads (status, last_recall_at)
  WHERE status = 'pending' AND telegram_user_id IS NOT NULL;

-- 2) Configuração do recall em trial_settings (singleton)
ALTER TABLE public.trial_settings
  ADD COLUMN IF NOT EXISTS recall_after_hours integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS recall_repeat_after_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS recall_daily_cap integer NOT NULL DEFAULT 100;

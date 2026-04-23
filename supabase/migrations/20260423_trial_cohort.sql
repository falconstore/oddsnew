-- 2026-04-23 — Adiciona "cohort" para separar leads do grupo antigo (v1)
-- dos leads do grupo novo (v2).
--
-- Contexto: o grupo Telegram original foi excluído sem querer. Os 40 leads
-- já cadastrados foram removidos junto e não serão re-adicionados ao novo
-- grupo. Queremos:
--   1) preservar os dados deles (não apagar do banco)
--   2) NÃO disparar a DM de aviso de 24h (eles não estão em grupo nenhum)
--   3) NÃO tentar kickar/expirar via Telegram (chat_id deles aponta pro
--      grupo morto; chat_id novo eles nem estão dentro)
--   4) marcar visualmente no painel quem é v1 vs v2
--
-- Estratégia:
--   - Coluna `cohort` text NOT NULL DEFAULT 'v2'
--   - CHECK ('v1' | 'v2')
--   - Backfill: TODOS os leads existentes (anteriores a esta migração)
--     viram 'v1', e já marcamos `reminder_sent_at = now()` para defesa
--     em profundidade (caso o cron rode antes do deploy do código que
--     filtra por cohort).

ALTER TABLE public.trial_leads
  ADD COLUMN IF NOT EXISTS cohort text NOT NULL DEFAULT 'v2';

-- Backfill: tudo que já existe é v1
UPDATE public.trial_leads
SET cohort = 'v1',
    reminder_sent_at = COALESCE(reminder_sent_at, now())
WHERE cohort = 'v2';

-- Aplica o CHECK depois do backfill
ALTER TABLE public.trial_leads
  DROP CONSTRAINT IF EXISTS trial_leads_cohort_check;
ALTER TABLE public.trial_leads
  ADD CONSTRAINT trial_leads_cohort_check
  CHECK (cohort IN ('v1', 'v2'));

CREATE INDEX IF NOT EXISTS trial_leads_cohort_idx
  ON public.trial_leads (cohort);

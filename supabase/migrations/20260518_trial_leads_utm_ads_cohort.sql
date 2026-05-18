-- =====================================================
-- trial_leads: colunas UTM + cohort 'ads'
-- Adiciona rastreio de anúncios (UTM + fbclid) à tabela
-- de leads e expande a constraint de cohort para incluir 'ads'.
-- =====================================================

-- 1. Colunas UTM / fbclid (todas nullable, sem impacto em leads existentes)
ALTER TABLE public.trial_leads
  ADD COLUMN IF NOT EXISTS utm_source   text NULL,
  ADD COLUMN IF NOT EXISTS utm_medium   text NULL,
  ADD COLUMN IF NOT EXISTS utm_campaign text NULL,
  ADD COLUMN IF NOT EXISTS utm_content  text NULL,
  ADD COLUMN IF NOT EXISTS utm_term     text NULL,
  ADD COLUMN IF NOT EXISTS fbclid       text NULL;

-- 2. Expande constraint de cohort pra incluir 'ads'
--    (mantém 'v1', 'v2', 'direct' que já existem)
ALTER TABLE public.trial_leads
  DROP CONSTRAINT IF EXISTS trial_leads_cohort_check;

ALTER TABLE public.trial_leads
  ADD CONSTRAINT trial_leads_cohort_check
  CHECK (cohort IN ('v1', 'v2', 'direct', 'ads'));

-- 3. Índices opcionais pra consultas de atribuição
CREATE INDEX IF NOT EXISTS trial_leads_utm_campaign_idx
  ON public.trial_leads (utm_campaign)
  WHERE utm_campaign IS NOT NULL;

CREATE INDEX IF NOT EXISTS trial_leads_fbclid_idx
  ON public.trial_leads (fbclid)
  WHERE fbclid IS NOT NULL;

-- Adiciona 'free_group' aos valores válidos do cohort em trial_leads
ALTER TABLE trial_leads
  DROP CONSTRAINT IF EXISTS trial_leads_cohort_check;

ALTER TABLE trial_leads
  ADD CONSTRAINT trial_leads_cohort_check
  CHECK (cohort IN ('v1', 'v2', 'direct', 'ads', 'free_group'));

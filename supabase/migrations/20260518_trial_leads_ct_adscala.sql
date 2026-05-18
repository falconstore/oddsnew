-- Adiciona coluna `ct` para rastrear o parâmetro de tracking do AdsScala
-- Ex: ct=CT-USER-001-ADMIN (identificador da campanha no painel AdsScala)
ALTER TABLE public.trial_leads
  ADD COLUMN IF NOT EXISTS ct text;

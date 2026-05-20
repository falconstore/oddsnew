-- Anti-abuso: IP + fingerprint no signup de trial
-- Adiciona colunas signup_ip e signup_fingerprint em trial_leads
-- com índices eficientes para a verificação de abuso.

ALTER TABLE public.trial_leads
  ADD COLUMN IF NOT EXISTS signup_ip text,
  ADD COLUMN IF NOT EXISTS signup_fingerprint text;

-- Índice geral em signup_ip
CREATE INDEX IF NOT EXISTS trial_leads_signup_ip_idx
  ON public.trial_leads (signup_ip);

-- Índice geral em signup_fingerprint
CREATE INDEX IF NOT EXISTS trial_leads_signup_fingerprint_idx
  ON public.trial_leads (signup_fingerprint);

-- Índice parcial apenas para leads problemáticos — torna a verificação de abuso rápida
CREATE INDEX IF NOT EXISTS trial_leads_abuse_ip_idx
  ON public.trial_leads (signup_ip)
  WHERE status IN ('expired', 'blocked', 'blocked_repeat');

CREATE INDEX IF NOT EXISTS trial_leads_abuse_fingerprint_idx
  ON public.trial_leads (signup_fingerprint)
  WHERE status IN ('expired', 'blocked', 'blocked_repeat');

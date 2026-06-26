-- =====================================================
-- Rastreio de entrada/saída no GRUPO FREE (t.me/sharkgreenfree2).
--
-- O trial-webhook passa a escutar também o chat do Grupo Free
-- (env TELEGRAM_FREE_GROUP_CHAT_ID). Ao detectar JOIN/LEFT desse chat,
-- grava os timestamps abaixo no lead correspondente (cohort='free_group').
--
-- free_group_entered_at — quando entrou no grupo free (último JOIN).
-- free_group_left_at    — quando saiu (último LEFT/KICKED); zera ao reentrar.
-- =====================================================

ALTER TABLE public.trial_leads
  ADD COLUMN IF NOT EXISTS free_group_entered_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS free_group_left_at    timestamptz NULL;

-- Índice pra listar/filtrar quem está no grupo free (entrou e não saiu).
CREATE INDEX IF NOT EXISTS trial_leads_free_group_idx
  ON public.trial_leads (cohort, free_group_entered_at)
  WHERE cohort = 'free_group';

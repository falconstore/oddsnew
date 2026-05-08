-- Bot Review: sinaliza procedimentos registrados via Telegram para verificação do gerente
-- bot_needs_review = TRUE para todo proc inserido pelo bot (dados podem estar errados)
-- bot_missing_fields = lista de campos que faltaram no parse (inserção parcial)
-- bot_raw_message = mensagem original do Telegram (referência para o gerente corrigir)

ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS bot_needs_review   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bot_missing_fields text[],
  ADD COLUMN IF NOT EXISTS bot_raw_message    text;

COMMENT ON COLUMN public.procedures.bot_needs_review   IS 'TRUE para procs registrados pelo bot Telegram que ainda não foram verificados por um gerente';
COMMENT ON COLUMN public.procedures.bot_missing_fields IS 'Campos ausentes no parse do bot (inserção parcial)';
COMMENT ON COLUMN public.procedures.bot_raw_message    IS 'Texto original da mensagem Telegram que gerou este procedimento';

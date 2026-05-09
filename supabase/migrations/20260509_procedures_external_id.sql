-- Identificador externo do procedimento usado pelo bot Telegram
-- Formato: "bsk:NNN" — permite deduplicação de mensagens já registradas
ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS external_id text UNIQUE;

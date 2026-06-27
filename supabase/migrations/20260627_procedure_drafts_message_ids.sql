-- Guarda os message_id das mensagens que o procedimento gerou no grupo do
-- Telegram, pra permitir apagar tudo depois ("Excluir do Telegram").
ALTER TABLE public.procedure_drafts
  ADD COLUMN IF NOT EXISTS sent_chat_id   bigint,
  ADD COLUMN IF NOT EXISTS sent_message_ids integer[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_from_telegram_at timestamptz;

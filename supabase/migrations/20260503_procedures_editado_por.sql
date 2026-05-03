-- Coluna pedida pela FreeBet Pro na resposta da auditoria (§1.2). Aditiva, default
-- NULL — não toca em rows existentes. Será preenchida pela UI no save quando o
-- usuário editar/criar/conferir/arquivar um procedimento (auth.uid()::text ou e-mail).
ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS editado_por text;

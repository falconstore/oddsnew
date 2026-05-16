-- =====================================================
-- Flag estruturada `is_extra` em procedures
--
-- Hoje "EXTRA / REENVIO" só vive enxertado no texto (palavra "EXTRA" no
-- `procedure_number` ou na mensagem do Telegram). A flag aqui persiste a
-- info como booleano pra:
--   1. Renderizar badge "EXTRA" na UI do BetShark
--   2. Enviar campo estruturado `is_extra` pro FreeBet PRO (eles renderizam
--      etiqueta no card deles)
--
-- Default `false`. Parsers (botParser.ts + telegram-procedure-bot/parser.ts)
-- já detectam EXTRA via regex pra montar `external_id`; agora também
-- populam essa coluna.
-- =====================================================

ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS is_extra boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.procedures.is_extra IS
  'Procedimento extra/reenvio (reentrada do mesmo número). Renderizado como badge "EXTRA" na UI e enviado como campo estruturado pro FreeBet PRO.';

-- Backfill one-shot: procedimentos antigos onde a palavra EXTRA aparece no
-- `procedure_number` (ex: "174 EXTRA", "EXTRA 174") são marcados como extra.
UPDATE public.procedures
   SET is_extra = true
 WHERE is_extra = false
   AND procedure_number ~* '\yEXTRA\y';

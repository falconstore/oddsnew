-- Paridade essencial com FreeBet Pro (§8.1–§8.4 do checklist do Painel de Envios).
-- Aditiva. Todas as colunas nullable ou com default seguro.

-- 1) Jogo / Evento
ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS data_partida date,
  ADD COLUMN IF NOT EXISTS horario_partida time,
  ADD COLUMN IF NOT EXISTS partida_descricao text;

-- 2) Tipo de Freebet (Sem / Ganhar / Queimar)
ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'SEM_FB';

ALTER TABLE public.procedures DROP CONSTRAINT IF EXISTS procedures_tipo_check;
ALTER TABLE public.procedures ADD CONSTRAINT procedures_tipo_check
  CHECK (tipo IN ('SEM_FB','GANHAR_FB','QUEIMAR_FB'));

-- 3) Arquivamento (soft delete; delete continua existindo como ação separada)
ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- 4) Previsional × Realizado
ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS lucro_prejuizo_previsto numeric,
  ADD COLUMN IF NOT EXISTS freebet_valor_previsto  numeric,
  ADD COLUMN IF NOT EXISTS resultado_lucro          numeric,
  ADD COLUMN IF NOT EXISTS resultado_freebet_ganha  numeric,
  ADD COLUMN IF NOT EXISTS freebet_creditada        text,
  ADD COLUMN IF NOT EXISTS resultado_observacao     text;

ALTER TABLE public.procedures DROP CONSTRAINT IF EXISTS procedures_freebet_creditada_check;
ALTER TABLE public.procedures ADD CONSTRAINT procedures_freebet_creditada_check
  CHECK (freebet_creditada IS NULL OR freebet_creditada IN ('SIM','NAO'));

-- Backfill (idempotente): rows existentes só tinham `profit_loss` e `freebet_value`,
-- que ficavam misturados entre previsional e realizado. Tratamos como realizado.
UPDATE public.procedures SET resultado_lucro = profit_loss
  WHERE resultado_lucro IS NULL;

UPDATE public.procedures SET freebet_valor_previsto = freebet_value
  WHERE freebet_valor_previsto IS NULL AND freebet_value IS NOT NULL;

-- 5) Sync com FreeBet Pro (preparar terreno; uso real entra na §8.5 com o endpoint)
ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS freebetpro_external_id text,
  ADD COLUMN IF NOT EXISTS freebetpro_synced_at   timestamptz,
  ADD COLUMN IF NOT EXISTS freebetpro_last_error  text;

-- Index parcial pro caminho quente (lista de não-arquivados ordenada por data).
CREATE INDEX IF NOT EXISTS idx_procedures_not_archived
  ON public.procedures (date DESC) WHERE archived = false;

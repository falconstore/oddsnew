-- Adiciona 'TENTATIVA_DG' (Tentativa de Duplo Green) ao CHECK de procedures.tipo
-- e atualiza o cron auto_update_procedure_statuses para incluí-lo no branch Concluído.

-- 1. Atualiza CHECK constraint
ALTER TABLE public.procedures
  DROP CONSTRAINT IF EXISTS procedures_tipo_check;

ALTER TABLE public.procedures
  ADD CONSTRAINT procedures_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'SEM_FB'::text,
    'GANHAR_FB'::text,
    'QUEIMAR_FB'::text,
    'ASR'::text,
    'TENTATIVA_DG'::text
  ]));

-- 2. Recria função do cron incluindo TENTATIVA_DG no branch → 'Concluído'
CREATE OR REPLACE FUNCTION public.auto_update_procedure_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt1 integer;
  cnt2 integer;
  cnt3 integer;
  cnt4 integer;
BEGIN
  -- 1. Backfill legado: qualquer 'Enviado' vira 'Enviada Partida em Aberto'
  UPDATE procedures
  SET status = 'Enviada Partida em Aberto'
  WHERE status = 'Enviado'
    AND archived = false
    AND tachado = false;

  GET DIAGNOSTICS cnt1 = ROW_COUNT;
  IF cnt1 > 0 THEN
    RAISE LOG 'auto_update_procedure_statuses: % proc(s) Enviado → Enviada Partida em Aberto', cnt1;
  END IF;

  -- 2a. GANHAR_FB pós-jogo → 'Falta Girar Freebet'
  UPDATE procedures
  SET status = 'Falta Girar Freebet'
  WHERE status IN ('Enviada Partida em Aberto', 'Enviada partida em Aberto', 'Aguardando Resultado')
    AND tipo = 'GANHAR_FB'
    AND kickoff_at IS NOT NULL
    AND kickoff_at + interval '150 minutes' <= now()
    AND archived = false
    AND tachado = false;

  GET DIAGNOSTICS cnt2 = ROW_COUNT;
  IF cnt2 > 0 THEN
    RAISE LOG 'auto_update_procedure_statuses: % proc(s) GANHAR_FB → Falta Girar Freebet', cnt2;
  END IF;

  -- 2b. ASR (Cashback) pós-jogo → 'Aguardando Resultado'
  UPDATE procedures
  SET status = 'Aguardando Resultado'
  WHERE status IN ('Enviada Partida em Aberto', 'Enviada partida em Aberto')
    AND tipo = 'ASR'
    AND kickoff_at IS NOT NULL
    AND kickoff_at + interval '150 minutes' <= now()
    AND archived = false
    AND tachado = false;

  GET DIAGNOSTICS cnt3 = ROW_COUNT;
  IF cnt3 > 0 THEN
    RAISE LOG 'auto_update_procedure_statuses: % proc(s) ASR → Aguardando Resultado', cnt3;
  END IF;

  -- 2c. QUEIMAR_FB / SEM_FB / TENTATIVA_DG / NULL pós-jogo → 'Concluído'
  UPDATE procedures
  SET status = 'Concluído'
  WHERE status IN ('Enviada Partida em Aberto', 'Enviada partida em Aberto', 'Aguardando Resultado')
    AND (tipo IS NULL OR tipo IN ('QUEIMAR_FB', 'SEM_FB', 'TENTATIVA_DG'))
    AND kickoff_at IS NOT NULL
    AND kickoff_at + interval '150 minutes' <= now()
    AND archived = false
    AND tachado = false;

  GET DIAGNOSTICS cnt4 = ROW_COUNT;
  IF cnt4 > 0 THEN
    RAISE LOG 'auto_update_procedure_statuses: % proc(s) (QUEIMAR_FB/SEM_FB/TENTATIVA_DG) → Concluído', cnt4;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_update_procedure_statuses() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_update_procedure_statuses() TO service_role;

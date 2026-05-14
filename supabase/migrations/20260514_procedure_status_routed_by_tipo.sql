-- =====================================================
-- Cron auto_update_procedure_statuses — roteamento por tipo
--
-- Antes (migrations 20260512 + 20260513):
--   Enviado → Enviada Partida em Aberto (kickoff passou)
--   Enviada Partida em Aberto → Aguardando Resultado (kickoff + 150min)
--
-- Problema: a 2ª transição manda TUDO pra 'Aguardando Resultado',
-- inclusive procedimentos GANHAR_FB que deveriam ir pra 'Falta
-- Girar Freebet' e procedimentos QUEIMAR_FB/SEM_FB que poderiam
-- já fechar em 'Concluído'.
--
-- Agora: a 2ª transição é roteada por `tipo`:
--   tipo='GANHAR_FB'                   → 'Falta Girar Freebet'
--   tipo IN ('QUEIMAR_FB','SEM_FB','ASR') OR tipo IS NULL → 'Concluído'
--
-- Proteções mantidas:
--   • kickoff_at IS NOT NULL
--   • kickoff_at + 150min <= now()
--   • archived = false AND tachado = false
--   • Status atual em ('Enviada Partida em Aberto','Enviada partida em Aberto')
-- =====================================================

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
BEGIN
  -- 1. Enviado → Enviada Partida em Aberto (kickoff já passou)
  UPDATE procedures
  SET status = 'Enviada Partida em Aberto'
  WHERE status = 'Enviado'
    AND kickoff_at IS NOT NULL
    AND kickoff_at <= now()
    AND archived = false
    AND tachado = false;

  GET DIAGNOSTICS cnt1 = ROW_COUNT;
  IF cnt1 > 0 THEN
    RAISE LOG 'auto_update_procedure_statuses: % proc(s) → Enviada Partida em Aberto', cnt1;
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

  -- 2b. Demais tipos pós-jogo (QUEIMAR_FB / SEM_FB / ASR / NULL) → 'Concluído'
  UPDATE procedures
  SET status = 'Concluído'
  WHERE status IN ('Enviada Partida em Aberto', 'Enviada partida em Aberto', 'Aguardando Resultado')
    AND (tipo IS NULL OR tipo IN ('QUEIMAR_FB', 'SEM_FB', 'ASR'))
    AND kickoff_at IS NOT NULL
    AND kickoff_at + interval '150 minutes' <= now()
    AND archived = false
    AND tachado = false;

  GET DIAGNOSTICS cnt3 = ROW_COUNT;
  IF cnt3 > 0 THEN
    RAISE LOG 'auto_update_procedure_statuses: % proc(s) (QUEIMAR_FB/SEM_FB/ASR) → Concluído', cnt3;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_update_procedure_statuses() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_update_procedure_statuses() TO service_role;

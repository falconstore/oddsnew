-- =====================================================
-- Adiciona transição automática:
--   Enviada Partida em Aberto → Aguardando Resultado
--
-- Quando kickoff_at + 150 min <= now(), o jogo encerrou.
-- O status muda explicitamente para 'Aguardando Resultado'
-- tornando óbvio para os gerentes que a partida acabou e
-- o resultado precisa ser definido — sem depender do badge.
--
-- Expande a função auto_update_procedure_statuses existente
-- para incluir o segundo passo da transição.
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

  -- 2. Enviada Partida em Aberto → Aguardando Resultado (jogo encerrado: kickoff + 150 min)
  UPDATE procedures
  SET status = 'Aguardando Resultado'
  WHERE status IN ('Enviada Partida em Aberto', 'Enviada partida em Aberto')
    AND kickoff_at IS NOT NULL
    AND kickoff_at + interval '150 minutes' <= now()
    AND archived = false
    AND tachado = false;

  GET DIAGNOSTICS cnt2 = ROW_COUNT;
  IF cnt2 > 0 THEN
    RAISE LOG 'auto_update_procedure_statuses: % proc(s) → Aguardando Resultado', cnt2;
  END IF;
END;
$$;

-- Mantém as permissões idênticas à função original
REVOKE ALL ON FUNCTION public.auto_update_procedure_statuses() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_update_procedure_statuses() TO service_role;

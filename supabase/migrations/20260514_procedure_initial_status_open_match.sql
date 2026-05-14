-- =====================================================
-- Cron auto_update_procedure_statuses + estado inicial
--
-- Mudanças:
--   1. Estado inicial muda de 'Enviado' → 'Enviada Partida em Aberto'
--      (procs nascem já como "match aberto, aguardando jogo")
--   2. Cron migra qualquer 'Enviado' restante (legado) → 'Enviada Partida em Aberto'
--      independente de kickoff_at
--   3. 2ª transição (pós-jogo, kickoff + 150min):
--        tipo='GANHAR_FB' → 'Falta Girar Freebet'
--        tipo='ASR'       → 'Aguardando Resultado'  (era Concluído)
--        tipo IN ('QUEIMAR_FB','SEM_FB') OR NULL → 'Concluído'
--
-- Função public.bot_insert_procedure: default de status muda pra
-- 'Enviada Partida em Aberto'.
-- =====================================================

-- 1. Recria função auto_update_procedure_statuses
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
  --    (estado inicial agora é "Enviada Partida em Aberto"; cron limpa o legado)
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

  -- 2c. QUEIMAR_FB / SEM_FB / NULL pós-jogo → 'Concluído'
  UPDATE procedures
  SET status = 'Concluído'
  WHERE status IN ('Enviada Partida em Aberto', 'Enviada partida em Aberto', 'Aguardando Resultado')
    AND (tipo IS NULL OR tipo IN ('QUEIMAR_FB', 'SEM_FB'))
    AND kickoff_at IS NOT NULL
    AND kickoff_at + interval '150 minutes' <= now()
    AND archived = false
    AND tachado = false;

  GET DIAGNOSTICS cnt4 = ROW_COUNT;
  IF cnt4 > 0 THEN
    RAISE LOG 'auto_update_procedure_statuses: % proc(s) (QUEIMAR_FB/SEM_FB) → Concluído', cnt4;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_update_procedure_statuses() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_update_procedure_statuses() TO service_role;

-- 2. Recria bot_insert_procedure (retorno jsonb mantido) com novo default de status.
--    Corpo idêntico à versão 20260514_bot_insert_procedure_telegram_link.sql,
--    única mudança: COALESCE(p_data->>'status', 'Enviada Partida em Aberto').
CREATE OR REPLACE FUNCTION public.bot_insert_procedure(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_result jsonb;
BEGIN
  INSERT INTO public.procedures (
    procedure_number, external_id, promotion_name, date, created_date,
    platform, category, status, tipo,
    partida_descricao, kickoff_at, data_partida, horario_partida,
    lucro_prejuizo_previsto, freebet_valor_previsto, freebet_value,
    profit_loss, dp, freebet_reference, freebet_reference_id,
    tags, is_favorite, archived, tachado, reenviado_count,
    duplo_green_confirmado, esporte,
    observacoes,
    bot_needs_review, bot_raw_message, bot_missing_fields,
    telegram_link
  ) VALUES (
    p_data->>'procedure_number',
    p_data->>'external_id',
    p_data->>'promotion_name',
    (p_data->>'date')::date,
    COALESCE((p_data->>'created_date')::timestamptz, now()),
    p_data->>'platform',
    p_data->>'category',
    COALESCE(p_data->>'status', 'Enviada Partida em Aberto'),
    p_data->>'tipo',
    p_data->>'partida_descricao',
    (p_data->>'kickoff_at')::timestamptz,
    (p_data->>'data_partida')::date,
    CASE WHEN p_data->>'horario_partida' IS NOT NULL
         THEN (p_data->>'horario_partida')::time
         ELSE NULL END,
    (p_data->>'lucro_prejuizo_previsto')::numeric,
    (p_data->>'freebet_valor_previsto')::numeric,
    (p_data->>'freebet_value')::numeric,
    COALESCE((p_data->>'profit_loss')::numeric, 0),
    COALESCE((p_data->>'dp')::boolean, false),
    p_data->>'freebet_reference',
    CASE WHEN p_data->>'freebet_reference_id' IS NOT NULL
         THEN (p_data->>'freebet_reference_id')::uuid
         ELSE NULL END,
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_data->'tags', '[]'::jsonb))),
    COALESCE((p_data->>'is_favorite')::boolean, false),
    COALESCE((p_data->>'archived')::boolean, false),
    COALESCE((p_data->>'tachado')::boolean, false),
    COALESCE((p_data->>'reenviado_count')::integer, 0),
    COALESCE((p_data->>'duplo_green_confirmado')::boolean, false),
    COALESCE(p_data->>'esporte', 'futebol'),
    p_data->>'observacoes',
    COALESCE((p_data->>'bot_needs_review')::boolean, true),
    p_data->>'bot_raw_message',
    CASE WHEN p_data->'bot_missing_fields' IS NOT NULL AND p_data->'bot_missing_fields' != 'null'::jsonb
         THEN ARRAY(SELECT jsonb_array_elements_text(p_data->'bot_missing_fields'))
         ELSE NULL::text[] END,
    p_data->>'telegram_link'
  )
  RETURNING id INTO v_id;

  SELECT row_to_json(p.*)::jsonb INTO v_result
  FROM public.procedures p
  WHERE p.id = v_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_insert_procedure(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bot_insert_procedure(jsonb) TO service_role, authenticated;

-- 3. Backfill: procs existentes em 'Enviado' → 'Enviada Partida em Aberto'
UPDATE public.procedures
SET status = 'Enviada Partida em Aberto'
WHERE status = 'Enviado'
  AND archived = false
  AND tachado = false;

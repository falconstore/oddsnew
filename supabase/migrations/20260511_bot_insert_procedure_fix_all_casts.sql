-- Fix bot_insert_procedure: corrige todos os casts de tipo
-- horario_partida é time without time zone, precisa de ::time
-- tags usa ARRAY(SELECT jsonb_array_elements_text(...)) em vez de ::text[]
CREATE OR REPLACE FUNCTION public.bot_insert_procedure(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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
    bot_needs_review, bot_raw_message, bot_missing_fields
  ) VALUES (
    p_data->>'procedure_number',
    p_data->>'external_id',
    p_data->>'promotion_name',
    (p_data->>'date')::date,
    COALESCE((p_data->>'created_date')::timestamptz, now()),
    p_data->>'platform',
    p_data->>'category',
    COALESCE(p_data->>'status', 'Enviado'),
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
         ELSE NULL::text[] END
  )
  RETURNING id INTO v_id;

  SELECT row_to_json(p.*) INTO v_result
  FROM public.procedures p
  WHERE p.id = v_id;

  RETURN v_result;
END;
$$;

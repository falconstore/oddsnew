-- =====================================================
-- Multi-origem por QUEIMAR_FB
--
-- Permite que UMA QUEIMAR_FB consuma várias FBs origem (caso comum:
-- usuário recebe 2-3 FBs no mesmo evento e gira tudo em uma aposta só).
--
-- - Coluna nova `freebet_reference_ids uuid[]` com TODAS as origens vinculadas.
-- - Coluna existente `freebet_reference_id uuid` continua valendo como
--   "origem primária" (= primeiro elemento do array). Mantida pra back-compat
--   com a edge `freebetpro-sync` (FreeBet PRO suporta apenas 1 vínculo) e com
--   leituras existentes (FreebetsGanhas, DefinirResultadosModal, badges).
-- - App garante consistência: ao salvar, sempre escreve as duas colunas
--   (singular = ids[0] || null, array = ids inteiro).
-- - Cascade trigger reescrito pra computar added/removed via diff de array
--   e aplicar a TODAS as origens afetadas.
-- =====================================================

ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS freebet_reference_ids uuid[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.procedures.freebet_reference_ids IS
  'Lista de FBs origem que esta QUEIMAR_FB queima. Inclui o primário (= freebet_reference_id). Vazio quando tipo != QUEIMAR_FB ou sem vínculo.';

-- Backfill: replica singular existente no array.
UPDATE public.procedures
   SET freebet_reference_ids = ARRAY[freebet_reference_id]
 WHERE freebet_reference_id IS NOT NULL
   AND (freebet_reference_ids IS NULL OR cardinality(freebet_reference_ids) = 0);

CREATE INDEX IF NOT EXISTS idx_procedures_freebet_reference_ids
  ON public.procedures USING GIN (freebet_reference_ids);

-- =====================================================
-- Cascade reescrito: diff de array (added vs removed)
-- =====================================================

CREATE OR REPLACE FUNCTION public.tg_cascade_origem_queima_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_ids uuid[] := '{}';
  v_new_ids uuid[] := '{}';
  v_added uuid[]   := '{}';
  v_removed uuid[] := '{}';
  v_id uuid;
  v_origem_creditada text;
  v_origem_freebet_valor numeric;
  v_resultado_just_set boolean := false;
  v_resultado_just_cleared boolean := false;
BEGIN
  -- Resolve set de origens efetivas no OLD (se aplicável).
  -- Prioriza array; fallback pra singular pra cobrir linhas legadas.
  IF TG_OP IN ('UPDATE','DELETE') AND COALESCE(OLD.tipo,'') = 'QUEIMAR_FB' THEN
    IF OLD.freebet_reference_ids IS NOT NULL AND cardinality(OLD.freebet_reference_ids) > 0 THEN
      v_old_ids := OLD.freebet_reference_ids;
    ELSIF OLD.freebet_reference_id IS NOT NULL THEN
      v_old_ids := ARRAY[OLD.freebet_reference_id];
    END IF;
  END IF;

  -- Resolve set de origens efetivas no NEW.
  IF TG_OP IN ('INSERT','UPDATE') AND COALESCE(NEW.tipo,'') = 'QUEIMAR_FB' THEN
    IF NEW.freebet_reference_ids IS NOT NULL AND cardinality(NEW.freebet_reference_ids) > 0 THEN
      v_new_ids := NEW.freebet_reference_ids;
    ELSIF NEW.freebet_reference_id IS NOT NULL THEN
      v_new_ids := ARRAY[NEW.freebet_reference_id];
    END IF;
  END IF;

  -- Diff
  SELECT COALESCE(array_agg(x), '{}'::uuid[]) INTO v_added
    FROM (SELECT unnest(v_new_ids) AS x EXCEPT SELECT unnest(v_old_ids)) t;
  SELECT COALESCE(array_agg(x), '{}'::uuid[]) INTO v_removed
    FROM (SELECT unnest(v_old_ids) AS x EXCEPT SELECT unnest(v_new_ids)) t;

  -- Forward: fecha origens recém-vinculadas
  IF cardinality(v_added) > 0 THEN
    UPDATE public.procedures
       SET status = 'Concluído',
           updated_date = now()
     WHERE id = ANY(v_added)
       AND status IN ('Falta Girar Freebet', 'Freebet Pendente');
  END IF;

  -- Reverse: ressuscita origens desvinculadas (se ainda têm FB creditada)
  IF cardinality(v_removed) > 0 THEN
    FOREACH v_id IN ARRAY v_removed LOOP
      SELECT freebet_creditada, COALESCE(resultado_freebet_ganha, 0)
        INTO v_origem_creditada, v_origem_freebet_valor
        FROM public.procedures
       WHERE id = v_id;

      IF v_origem_freebet_valor > 0
         AND COALESCE(v_origem_creditada,'') IN ('SIM','AGUARDANDO') THEN
        UPDATE public.procedures
           SET status = 'Falta Girar Freebet',
               updated_date = now()
         WHERE id = v_id
           AND status IN ('Concluído', 'Lucro Direto');
      END IF;
    END LOOP;
  END IF;

  -- ============== Caminho legado: resultado_lucro ==============
  -- Aplica forward/reverse a TODAS as origens vinculadas em NEW quando
  -- resultado_lucro é preenchido/limpo (ciclo da FB fechado/reaberto via UI antiga).
  IF TG_OP = 'UPDATE' AND COALESCE(NEW.tipo,'') = 'QUEIMAR_FB' THEN
    v_resultado_just_set     := (NEW.resultado_lucro IS NOT NULL AND OLD.resultado_lucro IS NULL);
    v_resultado_just_cleared := (NEW.resultado_lucro IS NULL AND OLD.resultado_lucro IS NOT NULL);

    IF v_resultado_just_set AND cardinality(v_new_ids) > 0 THEN
      UPDATE public.procedures
         SET status = 'Concluído',
             updated_date = now()
       WHERE id = ANY(v_new_ids)
         AND status IN ('Falta Girar Freebet', 'Freebet Pendente');
    END IF;

    IF v_resultado_just_cleared AND cardinality(v_new_ids) > 0 THEN
      FOREACH v_id IN ARRAY v_new_ids LOOP
        SELECT freebet_creditada, COALESCE(resultado_freebet_ganha, 0)
          INTO v_origem_creditada, v_origem_freebet_valor
          FROM public.procedures
         WHERE id = v_id;

        IF v_origem_freebet_valor > 0
           AND COALESCE(v_origem_creditada,'') IN ('SIM','AGUARDANDO') THEN
          UPDATE public.procedures
             SET status = 'Falta Girar Freebet',
                 updated_date = now()
           WHERE id = v_id
             AND status IN ('Concluído', 'Lucro Direto');
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.tg_cascade_origem_queima_status IS
  'Cascade origem GANHAR_FB ↔ queimador QUEIMAR_FB. Suporta multi-origem (freebet_reference_ids uuid[]). Forward fecha em Concluído, reverse ressuscita pra Falta Girar Freebet (se FB ainda creditada). Compat: aceita Concluído OU Lucro Direto no reverse, e cai pra freebet_reference_id quando array vazio.';

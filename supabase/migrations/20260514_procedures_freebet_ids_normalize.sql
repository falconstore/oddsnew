-- =====================================================
-- BEFORE trigger pra normalizar consistência singular ↔ array
--
-- Garantias (independente de quem escreveu — UI, edge sync, SQL manual):
--   1. Dedup do array preservando ordem (primeiro = primário).
--   2. Remove self-reference (NEW.id nunca vai entrar como sua própria origem).
--   3. freebet_reference_id sempre = freebet_reference_ids[1] (PG é 1-indexed).
--      Se app só atualizou o singular sem mexer no array, espelha pro array.
--      Se app só atualizou o array, espelha o primeiro pro singular.
--      Se ambos vieram, o array vence (singular é derivado do array).
--   4. Quando tipo != QUEIMAR_FB, ambos viram NULL/{} (consistência por construção).
-- =====================================================

CREATE OR REPLACE FUNCTION public.tg_normalize_freebet_reference_ids()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_dedup uuid[] := '{}';
  v_id uuid;
  v_singular_changed boolean := false;
  v_array_changed boolean := false;
BEGIN
  -- tipo != QUEIMAR_FB: zera ambos.
  IF COALESCE(NEW.tipo, '') <> 'QUEIMAR_FB' THEN
    NEW.freebet_reference_id := NULL;
    NEW.freebet_reference_ids := '{}'::uuid[];
    RETURN NEW;
  END IF;

  -- Detecta o que mudou pra decidir quem é a fonte de verdade.
  IF TG_OP = 'INSERT' THEN
    v_singular_changed := NEW.freebet_reference_id IS NOT NULL;
    v_array_changed := COALESCE(cardinality(NEW.freebet_reference_ids), 0) > 0;
  ELSE
    v_singular_changed := NEW.freebet_reference_id IS DISTINCT FROM OLD.freebet_reference_id;
    v_array_changed := NEW.freebet_reference_ids IS DISTINCT FROM OLD.freebet_reference_ids;
  END IF;

  -- Se só o singular mudou (UI antiga, edge legado), espelha pro array.
  IF v_singular_changed AND NOT v_array_changed THEN
    IF NEW.freebet_reference_id IS NULL THEN
      NEW.freebet_reference_ids := '{}'::uuid[];
    ELSE
      NEW.freebet_reference_ids := ARRAY[NEW.freebet_reference_id];
    END IF;
  END IF;

  -- Dedup preservando ordem + remove self-reference + remove NULLs.
  IF NEW.freebet_reference_ids IS NOT NULL AND cardinality(NEW.freebet_reference_ids) > 0 THEN
    FOREACH v_id IN ARRAY NEW.freebet_reference_ids LOOP
      IF v_id IS NOT NULL
         AND v_id <> NEW.id
         AND NOT (v_id = ANY(v_dedup)) THEN
        v_dedup := array_append(v_dedup, v_id);
      END IF;
    END LOOP;
    NEW.freebet_reference_ids := v_dedup;
  ELSE
    NEW.freebet_reference_ids := '{}'::uuid[];
  END IF;

  -- Singular sempre = primeiro elemento do array (ou NULL).
  IF cardinality(NEW.freebet_reference_ids) > 0 THEN
    NEW.freebet_reference_id := NEW.freebet_reference_ids[1];
  ELSE
    NEW.freebet_reference_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.tg_normalize_freebet_reference_ids IS
  'BEFORE INSERT/UPDATE — normaliza freebet_reference_id ↔ freebet_reference_ids: dedupe, sem self-ref, singular = ids[1]. Espelha singular→array quando só singular mudou.';

DROP TRIGGER IF EXISTS trg_normalize_freebet_reference_ids ON public.procedures;
CREATE TRIGGER trg_normalize_freebet_reference_ids
  BEFORE INSERT OR UPDATE ON public.procedures
  FOR EACH ROW EXECUTE FUNCTION public.tg_normalize_freebet_reference_ids();

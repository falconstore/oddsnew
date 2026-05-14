-- =====================================================
-- Correção: cascade fecha origem em 'Concluído' (não 'Lucro Direto')
--
-- Reverte a decisão da migration 20260514_procedures_cascade_origem_expanded
-- que mantinha 'Lucro Direto'. O usuário pediu explicitamente 'Concluído'.
-- A função reverse passa a aceitar tanto 'Lucro Direto' quanto 'Concluído'
-- pra ressuscitar (compat com procs já migrados).
-- =====================================================

CREATE OR REPLACE FUNCTION public.tg_cascade_origem_queima_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_origem_creditada text;
  v_origem_freebet_valor numeric;
BEGIN
  -- ============== INSERT ==============
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.tipo, '') = 'QUEIMAR_FB'
       AND NEW.freebet_reference_id IS NOT NULL THEN
      UPDATE public.procedures
         SET status = 'Concluído',
             updated_date = now()
       WHERE id = NEW.freebet_reference_id
         AND status IN ('Falta Girar Freebet', 'Freebet Pendente');
    END IF;
    RETURN NEW;
  END IF;

  -- ============== DELETE ==============
  IF TG_OP = 'DELETE' THEN
    IF COALESCE(OLD.tipo, '') = 'QUEIMAR_FB'
       AND OLD.freebet_reference_id IS NOT NULL THEN
      SELECT freebet_creditada, COALESCE(resultado_freebet_ganha, 0)
        INTO v_origem_creditada, v_origem_freebet_valor
        FROM public.procedures
       WHERE id = OLD.freebet_reference_id;

      IF v_origem_freebet_valor > 0
         AND COALESCE(v_origem_creditada, '') IN ('SIM', 'AGUARDANDO') THEN
        UPDATE public.procedures
           SET status = 'Falta Girar Freebet',
               updated_date = now()
         WHERE id = OLD.freebet_reference_id
           AND status IN ('Concluído', 'Lucro Direto');
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  -- ============== UPDATE ==============
  -- Ressuscita OLD se vínculo mudou (UUID-A→NULL, UUID-A→UUID-B, ou tipo deixou de ser QUEIMAR_FB)
  IF OLD.freebet_reference_id IS NOT NULL
     AND (
       NEW.freebet_reference_id IS NULL
       OR NEW.freebet_reference_id <> OLD.freebet_reference_id
       OR (COALESCE(OLD.tipo, '') = 'QUEIMAR_FB' AND COALESCE(NEW.tipo, '') <> 'QUEIMAR_FB')
     )
     AND COALESCE(OLD.tipo, '') = 'QUEIMAR_FB' THEN
    SELECT freebet_creditada, COALESCE(resultado_freebet_ganha, 0)
      INTO v_origem_creditada, v_origem_freebet_valor
      FROM public.procedures
     WHERE id = OLD.freebet_reference_id;

    IF v_origem_freebet_valor > 0
       AND COALESCE(v_origem_creditada, '') IN ('SIM', 'AGUARDANDO') THEN
      UPDATE public.procedures
         SET status = 'Falta Girar Freebet',
             updated_date = now()
       WHERE id = OLD.freebet_reference_id
         AND status IN ('Concluído', 'Lucro Direto');
    END IF;
  END IF;

  -- A partir daqui só interessa NEW = QUEIMAR_FB com vínculo.
  IF COALESCE(NEW.tipo, '') <> 'QUEIMAR_FB' THEN
    RETURN NEW;
  END IF;
  IF NEW.freebet_reference_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Fecha NEW se vínculo é novo (NULL→UUID, UUID-A→UUID-B, ou tipo virou QUEIMAR_FB)
  IF (OLD.freebet_reference_id IS NULL AND NEW.freebet_reference_id IS NOT NULL)
     OR (OLD.freebet_reference_id IS NOT NULL
         AND OLD.freebet_reference_id <> NEW.freebet_reference_id)
     OR (COALESCE(OLD.tipo, '') <> 'QUEIMAR_FB' AND COALESCE(NEW.tipo, '') = 'QUEIMAR_FB') THEN
    UPDATE public.procedures
       SET status = 'Concluído',
           updated_date = now()
     WHERE id = NEW.freebet_reference_id
       AND status IN ('Falta Girar Freebet', 'Freebet Pendente');
    RETURN NEW;
  END IF;

  -- Caminho legado: resultado_lucro preenchido agora.
  IF NEW.resultado_lucro IS NOT NULL AND OLD.resultado_lucro IS NULL THEN
    UPDATE public.procedures
       SET status = 'Concluído',
           updated_date = now()
     WHERE id = NEW.freebet_reference_id
       AND status IN ('Falta Girar Freebet', 'Freebet Pendente');
    RETURN NEW;
  END IF;

  -- Caminho legado: resultado_lucro foi LIMPO. Ressuscita.
  IF NEW.resultado_lucro IS NULL AND OLD.resultado_lucro IS NOT NULL THEN
    SELECT freebet_creditada, COALESCE(resultado_freebet_ganha, 0)
      INTO v_origem_creditada, v_origem_freebet_valor
      FROM public.procedures
     WHERE id = NEW.freebet_reference_id;

    IF v_origem_freebet_valor > 0
       AND COALESCE(v_origem_creditada, '') IN ('SIM', 'AGUARDANDO') THEN
      UPDATE public.procedures
         SET status = 'Falta Girar Freebet',
             updated_date = now()
       WHERE id = NEW.freebet_reference_id
         AND status IN ('Concluído', 'Lucro Direto');
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.tg_cascade_origem_queima_status IS
  'Cascade origem GANHAR_FB ↔ queimador QUEIMAR_FB. Forward: fecha origem em Concluído. Reverse: ressuscita pra Falta Girar Freebet (se FB ainda creditada). Aceita tanto Concluído quanto Lucro Direto no reverse pra compat.';

-- ============== Backfill: corrige os afetados ==============
-- Migra todos os procs em 'Lucro Direto' que têm uma QUEIMAR_FB vinculada
-- (origem do cascade) → 'Concluído'. Cobre tanto os 6 procs do backfill
-- anterior (190, 191, 189, 184, 181, 178) quanto qualquer outro que tenha
-- ido pra 'Lucro Direto' via cascade no passado (172, etc).
UPDATE public.procedures origem
   SET status = 'Concluído',
       updated_date = now()
 WHERE origem.status = 'Lucro Direto'
   AND EXISTS (
     SELECT 1 FROM public.procedures queima
      WHERE queima.tipo = 'QUEIMAR_FB'
        AND queima.freebet_reference_id = origem.id
   );

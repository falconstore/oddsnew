-- =====================================================
-- Fix: relink de freebet_reference_id (UUID-A → UUID-B)
--
-- A migration anterior (`20260514_procedures_cascade_origem_expanded`)
-- cobre os casos NULL→UUID (Caso B) e UUID→NULL (Caso A), mas
-- deixa de fora o relink direto UUID-A → UUID-B (mudar o vínculo
-- de uma QUEIMAR_FB pra outra origem). Nesse caso nem o "ressuscita
-- A" nem o "fecha B" disparam. Esse fix adiciona o caminho.
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
         SET status = 'Lucro Direto',
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
           AND status = 'Lucro Direto';
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  -- ============== UPDATE ==============
  -- Ressuscita OLD se o vínculo mudou (UUID-A → NULL ou UUID-A → UUID-B)
  -- ou se OLD era QUEIMAR_FB e virou outro tipo.
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
         AND status = 'Lucro Direto';
    END IF;
    -- Continua processando NEW abaixo
  END IF;

  -- A partir daqui só interessa NEW = QUEIMAR_FB com vínculo.
  IF COALESCE(NEW.tipo, '') <> 'QUEIMAR_FB' THEN
    RETURN NEW;
  END IF;
  IF NEW.freebet_reference_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Fecha NEW se o vínculo é novo (NULL → UUID, UUID-A → UUID-B,
  -- ou tipo virou QUEIMAR_FB agora).
  IF (OLD.freebet_reference_id IS NULL AND NEW.freebet_reference_id IS NOT NULL)
     OR (OLD.freebet_reference_id IS NOT NULL
         AND OLD.freebet_reference_id <> NEW.freebet_reference_id)
     OR (COALESCE(OLD.tipo, '') <> 'QUEIMAR_FB' AND COALESCE(NEW.tipo, '') = 'QUEIMAR_FB') THEN
    UPDATE public.procedures
       SET status = 'Lucro Direto',
           updated_date = now()
     WHERE id = NEW.freebet_reference_id
       AND status IN ('Falta Girar Freebet', 'Freebet Pendente');
    RETURN NEW;
  END IF;

  -- Caminho legado: resultado_lucro preenchido agora.
  IF NEW.resultado_lucro IS NOT NULL AND OLD.resultado_lucro IS NULL THEN
    UPDATE public.procedures
       SET status = 'Lucro Direto',
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
         AND status = 'Lucro Direto';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.tg_cascade_origem_queima_status IS
  'Cascade origem GANHAR_FB ↔ queimador QUEIMAR_FB. Cobre INSERT, DELETE e UPDATE incluindo relink UUID-A→UUID-B. Forward fecha origem em Lucro Direto, Reverse ressuscita pra Falta Girar Freebet (se FB ainda creditada).';

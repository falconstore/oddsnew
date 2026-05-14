-- =====================================================
-- Cascade origem GANHAR_FB → QUEIMAR_FB AMPLIADO
--
-- Antes (migration 20260503): trigger só disparava quando
-- `resultado_lucro` da QUEIMAR_FB era preenchido. Resultado:
-- enquanto o gerente não fechava o resultado da queima, a
-- origem GANHAR_FB ficava perpetuamente em 'Falta Girar
-- Freebet' — mesmo já existindo o vínculo via
-- `freebet_reference_id`.
--
-- Agora: o trigger fecha a origem assim que o vínculo é
-- estabelecido (INSERT da QUEIMAR_FB ou UPDATE setando
-- `freebet_reference_id` de NULL → UUID), e ressuscita a
-- origem se o vínculo for desfeito (DELETE da QUEIMAR_FB
-- ou clear de `freebet_reference_id`).
--
-- Caminhos cobertos (ordem dos checks no body):
--   FORWARD INSERT: NEW.tipo='QUEIMAR_FB' AND
--     NEW.freebet_reference_id IS NOT NULL → fecha origem
--     em 'Lucro Direto' (se status atual permite).
--   FORWARD UPDATE link: OLD.freebet_reference_id IS NULL
--     AND NEW.freebet_reference_id IS NOT NULL → idem.
--   FORWARD UPDATE resultado (legado): NEW.resultado_lucro
--     preenchido — mantido por compat (no-op se origem já
--     está em 'Lucro Direto').
--   REVERSE UPDATE clear link: OLD.freebet_reference_id
--     IS NOT NULL AND NEW.freebet_reference_id IS NULL →
--     ressuscita OLD.freebet_reference_id.
--   REVERSE UPDATE clear resultado: NEW.resultado_lucro
--     IS NULL AND OLD.resultado_lucro IS NOT NULL →
--     ressuscita (legado).
--   REVERSE DELETE: OLD.tipo='QUEIMAR_FB' AND
--     OLD.freebet_reference_id IS NOT NULL → ressuscita.
--
-- Regra de "ressuscita": só volta pra 'Falta Girar Freebet'
-- se a origem ainda tem FB creditada (resultado_freebet_ganha
-- > 0 AND freebet_creditada IN ('SIM','AGUARDANDO')) — mesma
-- proteção da migration 20260503.
-- =====================================================

CREATE OR REPLACE FUNCTION public.tg_cascade_origem_queima_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_origem_id uuid;
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
  -- Caso A: vínculo foi LIMPO (OLD tinha, NEW não tem). Independente do tipo
  -- atual, precisamos ressuscitar OLD.freebet_reference_id.
  IF OLD.freebet_reference_id IS NOT NULL
     AND NEW.freebet_reference_id IS NULL THEN
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
    -- Continua processando NEW caso ele tenha virado outra coisa
  END IF;

  -- A partir daqui só interessa QUEIMAR_FB com vínculo no NEW.
  IF COALESCE(NEW.tipo, '') <> 'QUEIMAR_FB' THEN
    RETURN NEW;
  END IF;
  IF NEW.freebet_reference_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Caso B: vínculo foi ESTABELECIDO agora (NULL → UUID, ou tipo virou QUEIMAR_FB).
  IF (OLD.freebet_reference_id IS NULL AND NEW.freebet_reference_id IS NOT NULL)
     OR (COALESCE(OLD.tipo, '') <> 'QUEIMAR_FB' AND COALESCE(NEW.tipo, '') = 'QUEIMAR_FB') THEN
    UPDATE public.procedures
       SET status = 'Lucro Direto',
           updated_date = now()
     WHERE id = NEW.freebet_reference_id
       AND status IN ('Falta Girar Freebet', 'Freebet Pendente');
    RETURN NEW;
  END IF;

  -- Caso C (legado): resultado_lucro preenchido agora. No-op se origem
  -- já estiver em 'Lucro Direto' (filtro do WHERE), mas mantido por
  -- compat com fluxos antigos onde a queima foi criada SEM vínculo
  -- e o vínculo + resultado vieram juntos no mesmo update.
  IF NEW.resultado_lucro IS NOT NULL AND OLD.resultado_lucro IS NULL THEN
    UPDATE public.procedures
       SET status = 'Lucro Direto',
           updated_date = now()
     WHERE id = NEW.freebet_reference_id
       AND status IN ('Falta Girar Freebet', 'Freebet Pendente');
    RETURN NEW;
  END IF;

  -- Caso D (legado): resultado_lucro foi LIMPO. Ressuscita origem.
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

-- Recria triggers cobrindo INSERT, UPDATE (sem OF — qualquer update),
-- e DELETE. O OF foi removido pra simplificar e garantir que mudanças
-- de tipo/freebet_reference_id também disparem.
DROP TRIGGER IF EXISTS trg_cascade_origem_queima_status ON public.procedures;
DROP TRIGGER IF EXISTS trg_cascade_origem_queima_status_ins ON public.procedures;
DROP TRIGGER IF EXISTS trg_cascade_origem_queima_status_del ON public.procedures;

CREATE TRIGGER trg_cascade_origem_queima_status_ins
AFTER INSERT ON public.procedures
FOR EACH ROW
EXECUTE FUNCTION public.tg_cascade_origem_queima_status();

CREATE TRIGGER trg_cascade_origem_queima_status
AFTER UPDATE ON public.procedures
FOR EACH ROW
EXECUTE FUNCTION public.tg_cascade_origem_queima_status();

CREATE TRIGGER trg_cascade_origem_queima_status_del
AFTER DELETE ON public.procedures
FOR EACH ROW
EXECUTE FUNCTION public.tg_cascade_origem_queima_status();

COMMENT ON FUNCTION public.tg_cascade_origem_queima_status IS
  'Cascade origem GANHAR_FB ↔ queimador QUEIMAR_FB. Forward (INSERT/UPDATE link/resultado): fecha origem como Lucro Direto. Reverse (DELETE/clear link/clear resultado): ressuscita origem pra Falta Girar (se FB ainda creditada).';

-- ============== Backfill ==============
-- Para procedimentos GANHAR_FB que JÁ estão em 'Falta Girar Freebet' /
-- 'Freebet Pendente' mas que JÁ têm uma QUEIMAR_FB vinculada (caso do
-- proc 190 ↔ 203), forçamos o cascade uma vez.
UPDATE public.procedures origem
   SET status = 'Lucro Direto',
       updated_date = now()
 WHERE origem.status IN ('Falta Girar Freebet', 'Freebet Pendente')
   AND EXISTS (
     SELECT 1 FROM public.procedures queima
      WHERE queima.tipo = 'QUEIMAR_FB'
        AND queima.freebet_reference_id = origem.id
   );

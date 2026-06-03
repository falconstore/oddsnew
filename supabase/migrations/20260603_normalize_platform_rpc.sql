-- Migration: Create persistent normalize_procedure_platforms() RPC
-- Called on-demand from the admin "Normalizar Plataformas" button.
-- Mirrors the normalizePlatformName logic from src/lib/procedureUtils.ts.

CREATE OR REPLACE FUNCTION normalize_procedure_platforms()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  trimmed     TEXT;
  alias_key   TEXT;
  words       TEXT[];
  word        TEXT;
  result_name TEXT;
  i           INT;
  stop_words  TEXT[] := ARRAY['de', 'da', 'do', 'das', 'dos', 'e'];
  updated_count INT := 0;
  rec         RECORD;
BEGIN
  FOR rec IN
    SELECT id, platform FROM procedures
    WHERE platform IS NOT NULL AND platform <> ''
  LOOP
    trimmed := TRIM(REGEXP_REPLACE(rec.platform, '\s+', ' ', 'g'));
    IF trimmed = '' THEN CONTINUE; END IF;

    alias_key := LOWER(REPLACE(trimmed, ' ', ''));
    IF    alias_key = 'mcgames'       THEN result_name := 'Mc Games';
    ELSIF alias_key = 'f12bet'        THEN result_name := 'F12 Bet';
    ELSIF alias_key = 'goldebet'      THEN result_name := 'Gol de Bet';
    ELSIF alias_key = 'jogodeouro'    THEN result_name := 'Jogo de Ouro';
    ELSIF alias_key = 'reidopitaco'   THEN result_name := 'Rei do Pitaco';
    ELSIF alias_key = 'betdasorte'    THEN result_name := 'Bet da Sorte';
    ELSIF alias_key = 'lancedasorte'  THEN result_name := 'Lance da Sorte';
    ELSIF alias_key = 'brasildasorte' THEN result_name := 'Brasil da Sorte';
    ELSIF alias_key = 'pixdasorte'    THEN result_name := 'Pix da Sorte';
    ELSE
      words := STRING_TO_ARRAY(trimmed, ' ');
      result_name := '';
      FOR i IN 1..ARRAY_LENGTH(words, 1) LOOP
        word := words[i];
        IF i > 1 AND LOWER(word) = ANY(stop_words) THEN
          result_name := result_name || ' ' || LOWER(word);
        ELSE
          result_name := result_name
            || CASE WHEN i > 1 THEN ' ' ELSE '' END
            || UPPER(LEFT(word, 1))
            || LOWER(SUBSTRING(word, 2));
        END IF;
      END LOOP;
    END IF;

    IF result_name IS DISTINCT FROM rec.platform THEN
      UPDATE procedures SET platform = result_name WHERE id = rec.id;
      updated_count := updated_count + 1;
    END IF;
  END LOOP;

  RETURN updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION normalize_procedure_platforms() TO service_role;

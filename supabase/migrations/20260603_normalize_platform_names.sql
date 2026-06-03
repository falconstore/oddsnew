-- Migration: Normalize platform names in procedures table to Title Case
-- Mirrors the normalizePlatformName logic from src/lib/procedureUtils.ts

-- Step 1: Create helper function
CREATE OR REPLACE FUNCTION _normalize_platform_name(input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  trimmed TEXT;
  alias_key TEXT;
  words TEXT[];
  word TEXT;
  result TEXT := '';
  i INT;
  stop_words TEXT[] := ARRAY['de', 'da', 'do', 'das', 'dos', 'e'];
BEGIN
  IF input IS NULL THEN RETURN NULL; END IF;

  -- Trim and collapse multiple spaces
  trimmed := TRIM(REGEXP_REPLACE(input, '\s+', ' ', 'g'));
  IF trimmed = '' THEN RETURN trimmed; END IF;

  -- Alias check: key = lowercase with spaces removed
  alias_key := LOWER(REPLACE(trimmed, ' ', ''));
  IF alias_key = 'mcgames'      THEN RETURN 'Mc Games'; END IF;
  IF alias_key = 'f12bet'       THEN RETURN 'F12 Bet'; END IF;
  IF alias_key = 'goldebet'     THEN RETURN 'Gol de Bet'; END IF;
  IF alias_key = 'jogodeouro'   THEN RETURN 'Jogo de Ouro'; END IF;
  IF alias_key = 'reidopitaco'  THEN RETURN 'Rei do Pitaco'; END IF;
  IF alias_key = 'betdasorte'   THEN RETURN 'Bet da Sorte'; END IF;
  IF alias_key = 'lancedasorte' THEN RETURN 'Lance da Sorte'; END IF;
  IF alias_key = 'brasildasorte'THEN RETURN 'Brasil da Sorte'; END IF;
  IF alias_key = 'pixdasorte'   THEN RETURN 'Pix da Sorte'; END IF;

  -- Title Case with stop words
  words := STRING_TO_ARRAY(trimmed, ' ');
  FOR i IN 1..ARRAY_LENGTH(words, 1) LOOP
    word := words[i];
    IF i > 1 AND LOWER(word) = ANY(stop_words) THEN
      result := result || ' ' || LOWER(word);
    ELSE
      result := result
        || CASE WHEN i > 1 THEN ' ' ELSE '' END
        || UPPER(LEFT(word, 1))
        || LOWER(SUBSTRING(word, 2));
    END IF;
  END LOOP;

  RETURN result;
END;
$$;

-- Step 2: Apply normalization to all non-null platform values
UPDATE procedures
SET platform = _normalize_platform_name(platform)
WHERE platform IS NOT NULL
  AND platform <> ''
  AND platform <> _normalize_platform_name(platform);

-- Step 3: Drop helper function (no longer needed after migration)
DROP FUNCTION _normalize_platform_name(TEXT);

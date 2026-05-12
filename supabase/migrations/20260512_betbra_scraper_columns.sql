-- Add scraper columns to betbra_affiliate_data
-- raw_all: raw JSON from "All" earnings endpoint
-- raw_exchange: raw JSON from "Exchange" earnings endpoint
-- updated_at: timestamp of last scraper update

ALTER TABLE betbra_affiliate_data
  ADD COLUMN IF NOT EXISTS raw_all JSONB,
  ADD COLUMN IF NOT EXISTS raw_exchange JSONB,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Dedup existing rows before adding UNIQUE(date): keep the row with the
-- latest created_date (or smallest id as tiebreak) per date.
DO $$
BEGIN
  -- Only run if the unique constraint doesn't exist yet
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'betbra_affiliate_data'::regclass
      AND conname = 'betbra_affiliate_data_date_key'
  ) THEN
    -- Delete duplicate rows, keeping one per date
    DELETE FROM betbra_affiliate_data
    WHERE id IN (
      SELECT id FROM (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY date
            ORDER BY
              COALESCE(updated_date, created_date, '1970-01-01') DESC,
              id DESC
          ) AS rn
        FROM betbra_affiliate_data
      ) ranked
      WHERE rn > 1
    );

    -- Now safe to add the unique constraint
    ALTER TABLE betbra_affiliate_data
      ADD CONSTRAINT betbra_affiliate_data_date_key UNIQUE (date);
  END IF;
END $$;

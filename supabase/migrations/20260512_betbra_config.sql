-- Config table for BetBra integration settings (cookie, user agent, etc.)
-- Used by betbra-scraper edge function to allow in-app cookie updates.

CREATE TABLE IF NOT EXISTS betbra_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: only service role can read/write (edge functions use service role)
ALTER TABLE betbra_config ENABLE ROW LEVEL SECURITY;

-- No public access — all access goes through edge functions with service role
CREATE POLICY "No public access" ON betbra_config
  FOR ALL USING (false);

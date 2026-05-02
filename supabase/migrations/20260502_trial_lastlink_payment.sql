-- Adiciona colunas de pagamento que serão preenchidas pelo webhook da Lastlink.
-- Quando o lead paga (ou cancela/refunda), a Lastlink chama
-- https://wspsuempnswljkphatur.supabase.co/functions/v1/lastlink-webhook?token=...
-- e o handler popula esses campos + força status='converted' para impedir o re-kick.

ALTER TABLE trial_leads
  ADD COLUMN IF NOT EXISTS lastlink_order_id        TEXT,
  ADD COLUMN IF NOT EXISTS lastlink_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS lastlink_product_id      TEXT,
  ADD COLUMN IF NOT EXISTS paid_amount              NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS paid_currency            TEXT DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS paid_at                  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_method           TEXT,
  ADD COLUMN IF NOT EXISTS plan_name                TEXT,
  ADD COLUMN IF NOT EXISTS coupon_code              TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status      TEXT,
  ADD COLUMN IF NOT EXISTS canceled_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refunded_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lastlink_last_event      TEXT,
  ADD COLUMN IF NOT EXISTS lastlink_last_event_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lastlink_raw             JSONB;

CREATE INDEX IF NOT EXISTS idx_trial_leads_lastlink_order_id        ON trial_leads (lastlink_order_id)        WHERE lastlink_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trial_leads_lastlink_subscription_id ON trial_leads (lastlink_subscription_id) WHERE lastlink_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trial_leads_paid_at                  ON trial_leads (paid_at DESC)             WHERE paid_at IS NOT NULL;

-- Tabela bruta de eventos (auditoria + reprocessamento se a gente errar o parse).
CREATE TABLE IF NOT EXISTS lastlink_events (
  id           BIGSERIAL PRIMARY KEY,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type   TEXT,
  order_id     TEXT,
  buyer_email  TEXT,
  matched_lead UUID REFERENCES trial_leads(id) ON DELETE SET NULL,
  payload      JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lastlink_events_received_at ON lastlink_events (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_lastlink_events_order_id    ON lastlink_events (order_id)   WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lastlink_events_buyer_email ON lastlink_events (buyer_email) WHERE buyer_email IS NOT NULL;

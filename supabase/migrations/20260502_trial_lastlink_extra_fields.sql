-- Campos adicionais identificados ao inspecionar o payload REAL da Lastlink
-- (após receber 20 eventos de teste em 02/05/2026).
-- A Lastlink envia muito mais coisa do que o que cobrimos no v1, e dá pra usar
-- bastante disso pra qualificar lead, dashboard de afiliados e análise de churn.

ALTER TABLE trial_leads
  ADD COLUMN IF NOT EXISTS lastlink_event_id        TEXT,                -- Id (root) do evento Lastlink (deduplicação)
  ADD COLUMN IF NOT EXISTS lastlink_payment_id      TEXT,                -- Data.Purchase.PaymentId
  ADD COLUMN IF NOT EXISTS lastlink_offer_id        TEXT,                -- Data.Offer.Id
  ADD COLUMN IF NOT EXISTS lastlink_offer_name      TEXT,                -- Data.Offer.Name
  ADD COLUMN IF NOT EXISTS lastlink_offer_url       TEXT,                -- Data.Offer.Url
  ADD COLUMN IF NOT EXISTS lastlink_affiliate_email TEXT,                -- Data.Purchase.Affiliate.Email
  ADD COLUMN IF NOT EXISTS lastlink_invoice_url     TEXT,                -- Data.Purchase.InvoiceUrl
  ADD COLUMN IF NOT EXISTS lastlink_origin_url      TEXT,                -- Data.Purchase.OriginUrl (tem UTMs do checkout)
  ADD COLUMN IF NOT EXISTS lastlink_utm             JSONB,               -- Data.Utm (objeto cru)
  ADD COLUMN IF NOT EXISTS installments             INT,                 -- Data.Purchase.Payment.NumberOfInstallments
  ADD COLUMN IF NOT EXISTS original_price           NUMERIC(10,2),       -- Data.Purchase.OriginalPrice.Value (preço cheio antes do cupom)
  ADD COLUMN IF NOT EXISTS recurrency_months        INT,                 -- Data.Purchase.Recurrency
  ADD COLUMN IF NOT EXISTS next_billing_at          TIMESTAMPTZ,         -- Data.Purchase.NextBilling
  ADD COLUMN IF NOT EXISTS buyer_name               TEXT,                -- Data.Buyer.Name
  ADD COLUMN IF NOT EXISTS buyer_document           TEXT,                -- Data.Buyer.Document (CPF)
  ADD COLUMN IF NOT EXISTS buyer_phone              TEXT,                -- Data.Buyer.PhoneNumber
  ADD COLUMN IF NOT EXISTS buyer_address            JSONB,               -- Data.Buyer.Address (objeto cru)
  ADD COLUMN IF NOT EXISTS lastlink_is_test         BOOLEAN DEFAULT FALSE; -- IsTest (root) — eventos disparados pelo botão "Testar"

CREATE INDEX IF NOT EXISTS idx_trial_leads_buyer_phone     ON trial_leads (buyer_phone)     WHERE buyer_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trial_leads_buyer_document  ON trial_leads (buyer_document)  WHERE buyer_document IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trial_leads_next_billing_at ON trial_leads (next_billing_at) WHERE next_billing_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trial_leads_offer_id        ON trial_leads (lastlink_offer_id) WHERE lastlink_offer_id IS NOT NULL;

-- Mesma flag na tabela de auditoria (pra esconder eventos de teste do painel sem perder o histórico)
ALTER TABLE lastlink_events
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_lastlink_events_is_test ON lastlink_events (is_test) WHERE is_test = TRUE;

-- Backfill: marca os eventos de teste já recebidos como is_test=true
UPDATE lastlink_events
   SET is_test = TRUE
 WHERE buyer_email = 'test.email@mail.com'
    OR (payload->>'IsTest')::BOOLEAN = TRUE;

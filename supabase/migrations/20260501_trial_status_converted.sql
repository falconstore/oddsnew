-- =====================================================
-- Estende trial_leads.status para aceitar dois novos valores:
--
--  * 'blocked_repeat' — já era usado pelo trial-webhook (anti-repetidor
--    de 2ª inscrição via novo email/WhatsApp), mas nunca tinha sido
--    incluído no CHECK constraint, então cada UPDATE silenciosamente
--    falhava. (Bug latente.)
--
--  * 'converted'     — novo. Marca um lead que estava expirado/removido
--    e voltou ao grupo VIP por um caminho EXTERNO (bot da Lastlink ou
--    admin add). O trial-webhook NÃO re-kicka mais esses casos.
-- =====================================================

ALTER TABLE trial_leads
  DROP CONSTRAINT IF EXISTS trial_leads_status_check;

ALTER TABLE trial_leads
  ADD CONSTRAINT trial_leads_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'active'::text,
    'expired'::text,
    'removed'::text,
    'blocked'::text,
    'blocked_repeat'::text,
    'converted'::text
  ]));

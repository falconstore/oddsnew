-- =====================================================
-- Trial Upgrade — extensão dos tipos de evento
-- Adiciona 'cta_free_group' e 'cta_open_form' usados na nova
-- landing pública Shark 100% Green (LP /).
-- =====================================================

ALTER TABLE public.trial_upgrade_events
  DROP CONSTRAINT IF EXISTS trial_upgrade_events_event_type_check;

ALTER TABLE public.trial_upgrade_events
  ADD CONSTRAINT trial_upgrade_events_event_type_check
  CHECK (event_type IN (
    'view',
    'cta_whatsapp',
    'cta_checkout',
    'cta_telegram',
    'cta_free_group',
    'cta_open_form'
  ));

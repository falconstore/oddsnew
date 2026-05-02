import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { LastlinkEvent, TrialLead } from '@/types/trial';

const PAYMENT_FIELDS = [
  'id', 'name', 'email', 'whatsapp', 'telegram_username', 'telegram_user_id',
  'status', 'cohort', 'created_at', 'entered_at', 'expires_at',
  'lastlink_order_id', 'lastlink_subscription_id', 'lastlink_payment_id',
  'lastlink_offer_id', 'lastlink_offer_name', 'lastlink_offer_url',
  'paid_amount', 'paid_currency', 'original_price', 'paid_at',
  'payment_method', 'installments', 'plan_name', 'coupon_code',
  'lastlink_invoice_url', 'lastlink_origin_url', 'lastlink_affiliate_email',
  'recurrency_months', 'next_billing_at',
  'buyer_name', 'buyer_document', 'buyer_phone', 'buyer_address',
  'lastlink_utm', 'subscription_status', 'canceled_at', 'refunded_at',
  'lastlink_last_event', 'lastlink_last_event_at', 'lastlink_event_id',
  'lastlink_is_test', 'lastlink_raw',
].join(',');

/** Lista TODOS os leads que têm algum dado de pagamento da Lastlink. */
export const useLastlinkPayments = () => {
  return useQuery<TrialLead[]>({
    queryKey: ['lastlink_payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trial_leads')
        .select(PAYMENT_FIELDS)
        // pega quem já pagou OU já teve algum evento (mesmo que cancelado/refund)
        .or('paid_at.not.is.null,lastlink_order_id.not.is.null,subscription_status.not.is.null')
        .order('paid_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as TrialLead[];
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
};

/** Lista TODOS os eventos brutos recebidos no webhook lastlink. */
export const useLastlinkEvents = (limit = 200) => {
  return useQuery<LastlinkEvent[]>({
    queryKey: ['lastlink_events', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lastlink_events')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as LastlinkEvent[];
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
};

/** Eventos brutos casados com um lead específico. */
export const useLastlinkLeadEvents = (leadId: string | null | undefined) => {
  return useQuery<LastlinkEvent[]>({
    queryKey: ['lastlink_events_lead', leadId],
    enabled: !!leadId,
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from('lastlink_events')
        .select('*')
        .eq('matched_lead', leadId)
        .order('received_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as LastlinkEvent[];
    },
    staleTime: 10_000,
  });
};

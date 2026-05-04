export type TrialStatus =
  | 'pending'
  | 'active'
  | 'expired'
  | 'removed'
  | 'blocked'
  | 'blocked_repeat'
  | 'converted';

export interface LastlinkBuyerAddress {
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  country?: string | null;
  [key: string]: unknown;
}

export interface LastlinkUtm {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  content?: string | null;
  term?: string | null;
  [key: string]: unknown;
}

export interface TrialLead {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  telegram_username: string;
  telegram_user_id: number | null;
  invite_link: string | null;
  status: TrialStatus;
  entered_at: string | null;
  expires_at: string | null;
  removed_at: string | null;
  reminder_sent_at: string | null;
  previous_lead_id: string | null;
  cohort: 'v1' | 'v2' | 'direct';
  bonus_invite_link: string | null;
  bonus_entered_at: string | null;
  bonus_removed_at: string | null;
  created_at: string;

  // Lastlink — pagamento
  lastlink_order_id: string | null;
  lastlink_subscription_id: string | null;
  lastlink_payment_id: string | null;
  lastlink_offer_id: string | null;
  lastlink_offer_name: string | null;
  lastlink_offer_url: string | null;
  paid_amount: number | null;
  paid_currency: string | null;
  original_price: number | null;
  paid_at: string | null;
  payment_method: string | null;
  installments: number | null;
  plan_name: string | null;
  coupon_code: string | null;
  lastlink_invoice_url: string | null;
  lastlink_origin_url: string | null;
  lastlink_affiliate_email: string | null;
  recurrency_months: number | null;
  next_billing_at: string | null;

  // Lastlink — comprador
  buyer_name: string | null;
  buyer_document: string | null;
  buyer_phone: string | null;
  buyer_address: LastlinkBuyerAddress | null;

  // Lastlink — tracking & status
  lastlink_utm: LastlinkUtm | null;
  subscription_status: string | null;
  canceled_at: string | null;
  refunded_at: string | null;
  lastlink_last_event: string | null;
  lastlink_last_event_at: string | null;
  lastlink_event_id: string | null;
  lastlink_is_test: boolean | null;
  lastlink_raw: Record<string, unknown> | null;
}

export interface LastlinkEvent {
  id: number;
  received_at: string;
  event_type: string | null;
  order_id: string | null;
  buyer_email: string | null;
  matched_lead: string | null;
  payload: Record<string, unknown>;
  is_test: boolean;
}

export type TrialUpgradeEventType =
  | 'view'
  | 'cta_whatsapp'
  | 'cta_checkout'
  | 'cta_telegram'
  | 'cta_free_group'
  | 'cta_open_form';

export interface TrialUpgradeEvent {
  id: string;
  lead_id: string | null;
  event_type: TrialUpgradeEventType;
  source: string | null;
  user_agent: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

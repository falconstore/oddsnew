export type TrialStatus = 'pending' | 'active' | 'expired' | 'removed' | 'blocked';

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
  created_at: string;
}

export type TrialUpgradeEventType = 'view' | 'cta_whatsapp' | 'cta_checkout' | 'cta_telegram';

export interface TrialUpgradeEvent {
  id: string;
  lead_id: string | null;
  event_type: TrialUpgradeEventType;
  source: string | null;
  user_agent: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

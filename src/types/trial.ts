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
  created_at: string;
}

export interface Subscriber {
  id: string;
  created_date: string | null;
  updated_date: string | null;
  created_by: string | null;
  full_name: string;
  telegram_link: string | null;
  amount_paid: number;
  payment_date: string;
  plan: string;
  situation: string;
}

export interface SubscriberFormData {
  full_name: string;
  telegram_link: string;
  amount_paid: number;
  payment_date: string;
  plan: string;
  situation: string;
}

export type SubscriberPlan = 'Semanal' | 'Mensal' | 'Trimestral' | 'Semestral' | 'Anual';

export type SubscriberSituation = 
  | 'Ativo'
  | 'Cobrado' 
  | 'Lembrete Enviado'
  | 'Removido do Grupo'
  | 'Pago via LastLink'
  | 'Pago via Hotmart'
  | 'Pagamento Pendente'
  | 'Outro';

export interface SubscriptionFilters {
  searchName: string;
  plan: string;
  status: string;
  situation: string;
  daysRemaining: string;
}

export interface SubscriptionStats {
  totalReceived: number;
  pendingCount: number;
  totalSubscribers: number;
  activeCount: number;
  expiredCount: number;
  removedCount: number;
}

export const PLAN_OPTIONS: SubscriberPlan[] = [
  'Semanal',
  'Mensal',
  'Trimestral',
  'Semestral',
  'Anual'
];

export const SITUATION_OPTIONS: SubscriberSituation[] = [
  'Ativo',
  'Cobrado',
  'Lembrete Enviado',
  'Removido do Grupo',
  'Pago via LastLink',
  'Pago via Hotmart',
  'Pagamento Pendente',
  'Outro'
];

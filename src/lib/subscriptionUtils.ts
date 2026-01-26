import { Subscriber, SubscriptionStats, SubscriptionFilters } from '@/types/subscriptions';
import { differenceInDays, parseISO, addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Dias por plano
export const PLAN_DAYS: Record<string, number> = {
  'Semanal': 7,
  'Mensal': 30,
  'Trimestral': 90,
  'Semestral': 180,
  'Anual': 365,
};

// Calcular dias restantes
export function calculateDaysRemaining(paymentDate: string, plan: string): number {
  const planDays = PLAN_DAYS[plan] || 30;
  const startDate = parseISO(paymentDate);
  const expirationDate = addDays(startDate, planDays);
  const today = new Date();
  return differenceInDays(expirationDate, today);
}

// Determinar status baseado nos dias restantes
export function getSubscriberStatus(daysRemaining: number): 'active' | 'expiring' | 'expired' {
  if (daysRemaining > 7) return 'active';
  if (daysRemaining > 0) return 'expiring';
  return 'expired';
}

// Formatar moeda
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Formatar data
export function formatDate(date: string): string {
  return format(parseISO(date), 'dd/MM/yyyy', { locale: ptBR });
}

// Calcular estatísticas
export function calculateStats(subscribers: Subscriber[]): SubscriptionStats {
  const totalReceived = subscribers.reduce((sum, s) => sum + Number(s.amount_paid), 0);
  
  const pendingCount = subscribers.filter(s => 
    s.situation === 'Pagamento Pendente' || s.situation === 'Lembrete Enviado'
  ).length;
  
  const totalSubscribers = subscribers.length;
  
  const removedCount = subscribers.filter(s => 
    s.situation === 'Removido do Grupo'
  ).length;
  
  // Calcular ativos e expirados (apenas para situações que não são "Removido")
  const activeSubscribers = subscribers.filter(s => s.situation !== 'Removido do Grupo');
  
  let activeCount = 0;
  let expiredCount = 0;
  
  activeSubscribers.forEach(s => {
    const days = calculateDaysRemaining(s.payment_date, s.plan);
    if (days > 0) {
      activeCount++;
    } else {
      expiredCount++;
    }
  });
  
  return {
    totalReceived,
    pendingCount,
    totalSubscribers,
    activeCount,
    expiredCount,
    removedCount,
  };
}

// Filtrar assinantes
export function filterSubscribers(
  subscribers: Subscriber[], 
  filters: SubscriptionFilters
): Subscriber[] {
  return subscribers.filter(subscriber => {
    // Filtro por nome
    if (filters.searchName) {
      const searchLower = filters.searchName.toLowerCase();
      if (!subscriber.full_name.toLowerCase().includes(searchLower)) {
        return false;
      }
    }
    
    // Filtro por plano
    if (filters.plan && filters.plan !== 'all') {
      if (subscriber.plan !== filters.plan) {
        return false;
      }
    }
    
    // Filtro por situação
    if (filters.situation && filters.situation !== 'all') {
      if (subscriber.situation !== filters.situation) {
        return false;
      }
    }
    
    // Calcular dias restantes para filtros de status e vencimento
    const daysRemaining = calculateDaysRemaining(subscriber.payment_date, subscriber.plan);
    
    // Filtro por status (ativo/expirado)
    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'active' && daysRemaining <= 0) {
        return false;
      }
      if (filters.status === 'expired' && daysRemaining > 0) {
        return false;
      }
    }
    
    // Filtro por vencimento
    if (filters.daysRemaining && filters.daysRemaining !== 'all') {
      switch (filters.daysRemaining) {
        case 'active':
          if (daysRemaining <= 7) return false;
          break;
        case 'expiring':
          if (daysRemaining <= 0 || daysRemaining > 7) return false;
          break;
        case 'expired':
          if (daysRemaining > 0) return false;
          break;
      }
    }
    
    return true;
  });
}

// Ordenar assinantes
export function sortSubscribers(
  subscribers: Subscriber[],
  sortField: string,
  sortDirection: 'asc' | 'desc'
): Subscriber[] {
  return [...subscribers].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'full_name':
        comparison = a.full_name.localeCompare(b.full_name);
        break;
      case 'amount_paid':
        comparison = Number(a.amount_paid) - Number(b.amount_paid);
        break;
      case 'payment_date':
        comparison = new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime();
        break;
      case 'plan':
        comparison = (PLAN_DAYS[a.plan] || 0) - (PLAN_DAYS[b.plan] || 0);
        break;
      case 'days_remaining':
        const daysA = calculateDaysRemaining(a.payment_date, a.plan);
        const daysB = calculateDaysRemaining(b.payment_date, b.plan);
        comparison = daysA - daysB;
        break;
      default:
        comparison = 0;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });
}

// Obter cor do badge de status
export function getStatusBadgeVariant(daysRemaining: number): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (daysRemaining > 7) return 'default'; // Verde
  if (daysRemaining > 0) return 'secondary'; // Amarelo
  return 'destructive'; // Vermelho
}

// Obter texto do status
export function getStatusText(daysRemaining: number): string {
  if (daysRemaining > 7) return 'Ativo';
  if (daysRemaining > 0) return 'Vencendo';
  return 'Expirado';
}

// Obter cor da situação
export function getSituationColor(situation: string): string {
  switch (situation) {
    case 'Ativo':
      return 'text-success';
    case 'Pagamento Pendente':
    case 'Lembrete Enviado':
    case 'Cobrado':
      return 'text-warning';
    case 'Removido do Grupo':
      return 'text-destructive';
    default:
      return 'text-muted-foreground';
  }
}

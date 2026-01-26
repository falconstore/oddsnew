import { Card, CardContent } from '@/components/ui/card';
import { SubscriptionStats as Stats } from '@/types/subscriptions';
import { formatCurrency } from '@/lib/subscriptionUtils';
import { 
  DollarSign, 
  AlertCircle, 
  Users, 
  UserCheck, 
  UserX,
  UserMinus
} from 'lucide-react';

interface SubscriptionStatsProps {
  stats: Stats;
}

export function SubscriptionStats({ stats }: SubscriptionStatsProps) {
  const cards = [
    {
      title: 'Total Recebido',
      value: formatCurrency(stats.totalReceived),
      icon: DollarSign,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Pendentes',
      value: stats.pendingCount.toString(),
      icon: AlertCircle,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      title: 'Total Assinantes',
      value: stats.totalSubscribers.toString(),
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Ativos',
      value: stats.activeCount.toString(),
      icon: UserCheck,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Expirados',
      value: stats.expiredCount.toString(),
      icon: UserX,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      title: 'Removidos',
      value: stats.removedCount.toString(),
      icon: UserMinus,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card) => (
        <Card key={card.title} className="rounded-xl bg-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground truncate">{card.title}</p>
                <p className={`text-sm font-semibold ${card.color} truncate`}>
                  {card.value}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

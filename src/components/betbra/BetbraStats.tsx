import { Card } from '@/components/ui/card';
import { Users, DollarSign, TrendingUp, Activity, Coins } from 'lucide-react';
import { BetbraStats as BetbraStatsType } from '@/types/betbra';
import { formatCurrency } from '@/lib/betbraUtils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  gradient: string;
  subtitle?: string;
}

function StatCard({ title, value, icon: Icon, gradient, subtitle }: StatCardProps) {
  return (
    <Card className="p-4 flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-muted-foreground font-medium mb-1 truncate">{title}</p>
          <p className="text-lg md:text-xl font-bold truncate">{value}</p>
          {subtitle && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        <div className={`w-10 h-10 ${gradient} rounded-xl flex items-center justify-center backdrop-blur-sm flex-shrink-0`}>
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </div>
    </Card>
  );
}

interface BetbraStatsProps {
  stats: BetbraStatsType;
}

export function BetbraStats({ stats }: BetbraStatsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 md:gap-3">
      <StatCard
        title="CPA Total"
        value={stats.cpaTotal.toString()}
        icon={Users}
        gradient="bg-blue-500/10"
        subtitle="Soma de CPAs"
      />
      <StatCard
        title="CPA R$"
        value={formatCurrency(stats.cpaValue)}
        icon={DollarSign}
        gradient="bg-cyan-500/10"
        subtitle="Valor calculado por nível"
      />
      <StatCard
        title="Revenue Share"
        value={formatCurrency(stats.revenueShare)}
        icon={TrendingUp}
        gradient="bg-success/10"
        subtitle="NGR × 15% (se > 10k)"
      />
      <StatCard
        title="Turnover R$"
        value={formatCurrency(stats.turnoverValue)}
        icon={Activity}
        gradient="bg-purple-500/10"
        subtitle="(Turnover × 0.5%) / 2"
      />
      <StatCard
        title="Total"
        value={formatCurrency(stats.total)}
        icon={Coins}
        gradient="bg-yellow-500/10"
        subtitle="Soma de todos os valores"
      />
    </div>
  );
}

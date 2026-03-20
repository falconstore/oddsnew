import { Users, DollarSign, TrendingUp, Activity, Coins } from 'lucide-react';
import { BetbraStats as BetbraStatsType } from '@/types/betbra';
import { formatCurrency } from '@/lib/betbraUtils';
import { LucideIcon } from 'lucide-react';

type StatColor = 'amber' | 'cyan' | 'green' | 'purple' | 'yellow';

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  color: StatColor;
  subtitle?: string;
}

const colorMap: Record<StatColor, {
  card: string;
  border: string;
  iconBg: string;
  icon: string;
  accent: string;
  bar: string;
}> = {
  amber: {
    card: 'bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent',
    border: 'border-amber-500/20',
    iconBg: 'bg-gradient-to-br from-amber-500/25 to-amber-600/10',
    icon: 'text-amber-400',
    accent: 'text-amber-400',
    bar: 'from-amber-400 to-amber-600',
  },
  cyan: {
    card: 'bg-gradient-to-br from-cyan-500/10 via-cyan-500/5 to-transparent',
    border: 'border-cyan-500/20',
    iconBg: 'bg-gradient-to-br from-cyan-500/25 to-cyan-600/10',
    icon: 'text-cyan-400',
    accent: 'text-cyan-400',
    bar: 'from-cyan-400 to-cyan-600',
  },
  green: {
    card: 'bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent',
    border: 'border-emerald-500/20',
    iconBg: 'bg-gradient-to-br from-emerald-500/25 to-emerald-600/10',
    icon: 'text-emerald-400',
    accent: 'text-emerald-400',
    bar: 'from-emerald-400 to-emerald-600',
  },
  purple: {
    card: 'bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent',
    border: 'border-purple-500/20',
    iconBg: 'bg-gradient-to-br from-purple-500/25 to-purple-600/10',
    icon: 'text-purple-400',
    accent: 'text-purple-400',
    bar: 'from-purple-400 to-purple-600',
  },
  yellow: {
    card: 'bg-gradient-to-br from-yellow-500/10 via-yellow-500/5 to-transparent',
    border: 'border-yellow-500/20',
    iconBg: 'bg-gradient-to-br from-yellow-500/25 to-yellow-600/10',
    icon: 'text-yellow-400',
    accent: 'text-yellow-400',
    bar: 'from-yellow-400 to-yellow-500',
  },
};

function StatCard({ title, value, icon: Icon, color, subtitle }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className={`relative rounded-2xl border p-4 flex flex-col gap-3 card-hover overflow-hidden transition-all duration-300 ${c.card} ${c.border}`}>
      <div className={`absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r ${c.bar} opacity-60`} />
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1.5 truncate">
            {title}
          </p>
          <p className={`text-xl md:text-2xl font-bold truncate ${c.accent}`}>
            {value}
          </p>
          {subtitle && (
            <p className="text-[10px] text-muted-foreground mt-1 truncate">{subtitle}</p>
          )}
        </div>
        <div className={`w-10 h-10 ${c.iconBg} border ${c.border} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
      </div>
    </div>
  );
}

interface BetbraStatsProps {
  stats: BetbraStatsType;
}

export function BetbraStats({ stats }: BetbraStatsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3">
      <StatCard
        title="CPA Total"
        value={stats.cpaTotal.toString()}
        icon={Users}
        color="cyan"
        subtitle="Soma de CPAs"
      />
      <StatCard
        title="CPA R$"
        value={formatCurrency(stats.cpaValue)}
        icon={DollarSign}
        color="amber"
        subtitle="Valor por nível"
      />
      <StatCard
        title="Revenue Share"
        value={formatCurrency(stats.revenueShare)}
        icon={TrendingUp}
        color="green"
        subtitle="NGR × 15% (se > 10k)"
      />
      <StatCard
        title="Turnover R$"
        value={formatCurrency(stats.turnoverValue)}
        icon={Activity}
        color="purple"
        subtitle="(Turnover × 0.5%) / 2"
      />
      <StatCard
        title="Total Estimado"
        value={formatCurrency(stats.total)}
        icon={Coins}
        color="yellow"
        subtitle="Soma de todos"
      />
    </div>
  );
}

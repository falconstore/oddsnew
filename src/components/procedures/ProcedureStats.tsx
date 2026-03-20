import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type ColorVariant = 'green' | 'cyan' | 'purple' | 'amber' | 'pink' | 'indigo' | 'orange' | 'yellow' | 'primary';

const colorMap: Record<ColorVariant, { card: string; icon: string; value: string }> = {
  green:   { card: 'bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 border-emerald-500/25', icon: 'bg-emerald-500/20 text-emerald-400', value: 'text-emerald-300' },
  cyan:    { card: 'bg-gradient-to-br from-cyan-500/15 to-cyan-500/5 border-cyan-500/25', icon: 'bg-cyan-500/20 text-cyan-400', value: 'text-cyan-300' },
  purple:  { card: 'bg-gradient-to-br from-purple-500/15 to-purple-500/5 border-purple-500/25', icon: 'bg-purple-500/20 text-purple-400', value: 'text-purple-300' },
  amber:   { card: 'bg-gradient-to-br from-amber-500/15 to-amber-500/5 border-amber-500/25', icon: 'bg-amber-500/20 text-amber-400', value: 'text-amber-300' },
  pink:    { card: 'bg-gradient-to-br from-pink-500/15 to-pink-500/5 border-pink-500/25', icon: 'bg-pink-500/20 text-pink-400', value: 'text-pink-300' },
  indigo:  { card: 'bg-gradient-to-br from-indigo-500/15 to-indigo-500/5 border-indigo-500/25', icon: 'bg-indigo-500/20 text-indigo-400', value: 'text-indigo-300' },
  orange:  { card: 'bg-gradient-to-br from-orange-500/15 to-orange-500/5 border-orange-500/25', icon: 'bg-orange-500/20 text-orange-400', value: 'text-orange-300' },
  yellow:  { card: 'bg-gradient-to-br from-yellow-500/15 to-yellow-500/5 border-yellow-500/25', icon: 'bg-yellow-500/20 text-yellow-400', value: 'text-yellow-300' },
  primary: { card: 'bg-gradient-to-br from-primary/15 to-primary/5 border-primary/25', icon: 'bg-primary/20 text-primary', value: 'text-primary' },
};

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: ColorVariant;
}

export function StatCard({ title, value, subtitle, icon: Icon, color = 'primary' }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className={cn(
      'relative rounded-2xl border p-4 flex flex-col gap-3 card-hover overflow-hidden transition-all duration-300',
      c.card
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">{title}</p>
          <p className={cn('text-xl font-bold leading-none truncate', c.value)}>{value}</p>
          {subtitle && (
            <p className="text-[10px] text-muted-foreground mt-1.5 truncate">{subtitle}</p>
          )}
        </div>
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', c.icon)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

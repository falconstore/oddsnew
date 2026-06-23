import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// Mantido por compat — todas as páginas passam `color`, mas no padrão console
// o KPI é unificado: painel sólido, label mono de telemetria, número tabular.
// A cor deixou de pintar o card; serve só de dica semântica leve no ícone.
type ColorVariant = 'green' | 'cyan' | 'purple' | 'amber' | 'pink' | 'indigo' | 'orange' | 'yellow' | 'primary';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: ColorVariant;
}

export function StatCard({ title, value, subtitle, icon: Icon }: StatCardProps) {
  return (
    <div className="panel-bracket bg-card p-4 flex flex-col gap-3 card-hover">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="telemetry-label mb-2 truncate">{title}</p>
          <p className="kpi text-2xl font-semibold text-foreground truncate">{value}</p>
          {subtitle && (
            <p className="text-[10px] text-muted-foreground mt-1.5 truncate font-mono uppercase tracking-wide">{subtitle}</p>
          )}
        </div>
        <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 border border-border text-muted-foreground">
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

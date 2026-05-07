import { useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';
import { ShoppingCart } from 'lucide-react';
import { format, eachDayOfInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { TrialLead } from '@/types/trial';

interface ChartPoint {
  label: string;
  count: number;
}

interface DailyPaymentsChartProps {
  payments: TrialLead[];
  rangeFrom: Date | null;
  rangeTo: Date | null;
  rangeLabel: string;
  isLoading?: boolean;
}

const fmtMoney = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

interface TooltipPayloadEntry {
  dataKey?: string;
  value?: number;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadEntry[]; label?: string }) {
  if (!active || !payload || !payload.length) return null;
  const count = payload.find(p => p.dataKey === 'count')?.value ?? 0;
  return (
    <div className="glass border border-white/10 rounded-xl p-3 shadow-xl min-w-[160px]">
      <p className="text-[11px] text-muted-foreground mb-2 font-medium">{label}</p>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          Pagamentos
        </span>
        <span className="text-[12px] font-semibold text-emerald-300">{count}</span>
      </div>
    </div>
  );
}

export function DailyPaymentsChart({ payments, rangeFrom, rangeTo, rangeLabel, isLoading = false }: DailyPaymentsChartProps) {
  const { data, avgCount, avgRevenue, isEmpty } = useMemo(() => {
    const confirmed = payments.filter(p => !!p.paid_at);
    if (!rangeFrom && confirmed.length === 0) {
      return { data: [] as ChartPoint[], avgCount: 0, avgRevenue: 0, isEmpty: true };
    }

    let from: Date;
    let to: Date;

    if (rangeFrom && rangeTo) {
      from = startOfDay(rangeFrom);
      to = endOfDay(rangeTo);
    } else if (rangeFrom) {
      from = startOfDay(rangeFrom);
      to = endOfDay(new Date());
    } else if (confirmed.length > 0) {
      const ts = confirmed.map(p => new Date(p.paid_at!).getTime());
      from = startOfDay(new Date(Math.min(...ts)));
      to = endOfDay(new Date(Math.max(...ts)));
    } else {
      return { data: [] as ChartPoint[], avgCount: 0, avgRevenue: 0, isEmpty: true };
    }

    const days = eachDayOfInterval({ start: from, end: to });
    if (days.length > 90) {
      return { data: [] as ChartPoint[], avgCount: 0, avgRevenue: 0, isEmpty: false };
    }

    const dayCount = new Map<string, number>();
    for (const d of days) {
      dayCount.set(format(d, 'yyyy-MM-dd'), 0);
    }
    let totalRevenue = 0;

    for (const p of confirmed) {
      const key = format(new Date(p.paid_at!), 'yyyy-MM-dd');
      const existing = dayCount.get(key);
      if (existing !== undefined) {
        dayCount.set(key, existing + 1);
        totalRevenue += p.paid_amount ?? 0;
      }
    }

    const arr: ChartPoint[] = [];
    let totalCount = 0;
    for (const [key, count] of dayCount) {
      arr.push({ label: format(parseISO(key), 'dd/MM', { locale: ptBR }), count });
      totalCount += count;
    }

    const numDays = arr.length || 1;
    const ac = totalCount / numDays;
    const ar = totalRevenue / numDays;

    return { data: arr, avgCount: ac, avgRevenue: ar, isEmpty: totalCount === 0 };
  }, [payments, rangeFrom, rangeTo]);

  const tooMany = !isEmpty && data.length === 0;

  return (
    <div className="glass rounded-3xl border border-white/8 overflow-hidden" data-testid="card-daily-payments-chart">
      <div className="flex items-center justify-between gap-2 p-4 md:p-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/25 to-cyan-500/10 border border-emerald-500/30 flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <h3 className="text-sm md:text-base font-semibold">Novos pagamentos por dia</h3>
            <p className="text-[11px] md:text-xs text-muted-foreground">
              {rangeLabel} · média {avgCount.toFixed(1)} pag/dia
              {avgRevenue > 0 && ` · média ${fmtMoney(avgRevenue)}/dia`}
            </p>
          </div>
        </div>
      </div>

      <div className="p-3 md:p-4">
        {isLoading ? (
          <div className="h-48 flex flex-col gap-2 justify-end" data-testid="skeleton-daily-payments">
            {[0.6, 0.9, 0.5, 1, 0.7, 0.8, 0.4].map((h, i) => (
              <div key={i} className="flex items-end gap-1 h-full">
                <div
                  className="flex-1 rounded-t bg-emerald-500/10 animate-pulse"
                  style={{ height: `${h * 100}%` }}
                />
              </div>
            ))}
          </div>
        ) : tooMany ? (
          <div className="h-48 flex items-center justify-center text-xs text-muted-foreground" data-testid="text-daily-payments-period-large">
            Selecione um período menor (até 90 dias) para ver o gráfico diário.
          </div>
        ) : isEmpty ? (
          <div className="h-48 flex items-center justify-center text-xs text-muted-foreground" data-testid="text-daily-payments-empty">
            Nenhum pagamento confirmado no período selecionado.
          </div>
        ) : (
          <div className="h-48 md:h-56" data-testid="container-daily-payments-chart">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="paymentsBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(160 84% 55%)" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="hsl(160 84% 55%)" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.18} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))', opacity: 0.4 }}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={20}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={28}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted-foreground) / 0.06)' }} />
                <Bar
                  dataKey="count"
                  name="Pagamentos"
                  fill="url(#paymentsBarGradient)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                {/* Média de pagamentos/dia — linha de referência tracejada */}
                <ReferenceLine
                  y={avgCount}
                  stroke="hsl(160 84% 70%)"
                  strokeDasharray="6 4"
                  strokeWidth={1.5}
                  strokeOpacity={0.75}
                  label={{
                    value: `~${avgCount.toFixed(1)}/dia`,
                    position: 'insideTopRight',
                    fontSize: 10,
                    fill: 'hsl(160 84% 70%)',
                    dy: -4,
                  }}
                />
                {/* Média de receita/dia — linha tracejada laranja como referência visual de valor */}
                {avgRevenue > 0 && (
                  <ReferenceLine
                    y={avgCount}
                    stroke="hsl(40 90% 60%)"
                    strokeDasharray="3 5"
                    strokeWidth={0}
                    label={{
                      value: `${fmtMoney(avgRevenue)}/dia`,
                      position: 'insideTopLeft',
                      fontSize: 10,
                      fill: 'hsl(40 90% 65%)',
                      dy: -4,
                    }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

export default DailyPaymentsChart;

import { useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import {
  format, startOfDay, startOfWeek, startOfMonth,
  addDays, addWeeks, addMonths, isBefore, isEqual,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { TrialLead } from '@/types/trial';

type Bucket = 'day' | 'week' | 'month';

interface ChartPoint {
  key: string;
  label: string;
  revenue: number;
  refunds: number;
  conversions: number;
  refundCount: number;
}

interface RevenueChartProps {
  payments: TrialLead[];
  rangeFrom: Date | null;
  rangeTo: Date | null;
  rangeLabel: string;
}

const fmtMoney = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

const fmtMoneyDetailed = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(value);

function pickBucket(from: Date, to: Date): Bucket {
  const days = Math.ceil((to.getTime() - from.getTime()) / (24 * 3600 * 1000));
  if (days <= 31) return 'day';
  if (days <= 120) return 'week';
  return 'month';
}

function bucketStart(date: Date, bucket: Bucket): Date {
  if (bucket === 'day') return startOfDay(date);
  if (bucket === 'week') return startOfWeek(date, { weekStartsOn: 1 });
  return startOfMonth(date);
}

function bucketNext(date: Date, bucket: Bucket): Date {
  if (bucket === 'day') return addDays(date, 1);
  if (bucket === 'week') return addWeeks(date, 1);
  return addMonths(date, 1);
}

function bucketLabel(date: Date, bucket: Bucket): string {
  if (bucket === 'day') return format(date, 'dd/MM', { locale: ptBR });
  if (bucket === 'week') return format(date, "dd/MM", { locale: ptBR });
  return format(date, 'MMM/yy', { locale: ptBR });
}

function bucketKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

interface TooltipPayloadEntry {
  name?: string;
  dataKey?: string;
  value?: number;
  payload?: ChartPoint;
  color?: string;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadEntry[] }) {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <div className="glass border border-white/10 rounded-xl p-3 shadow-xl min-w-[180px]">
      <p className="text-[11px] text-muted-foreground mb-2 font-medium">{point.label}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary" />
            Receita
          </span>
          <span className="text-[12px] font-semibold text-primary">{fmtMoneyDetailed(point.revenue)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-destructive" />
            Refunds + chargebacks
          </span>
          <span className="text-[12px] font-semibold text-destructive">{fmtMoneyDetailed(point.refunds)}</span>
        </div>
        <div className="border-t border-white/5 pt-1.5 mt-1.5 grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
          <span>Conversões: <strong className="text-foreground">{point.conversions}</strong></span>
          <span>Refunds: <strong className="text-foreground">{point.refundCount}</strong></span>
        </div>
      </div>
    </div>
  );
}

export function RevenueChart({ payments, rangeFrom, rangeTo, rangeLabel }: RevenueChartProps) {
  const { data, bucket, isEmpty } = useMemo(() => {
    // Determina o intervalo: usa rangeFrom/rangeTo quando há filtro, senão deriva dos pagamentos
    let from: Date | null = rangeFrom;
    let to: Date | null = rangeTo;

    if (!from || !to) {
      const dates = payments
        .map(p => p.paid_at ?? p.lastlink_last_event_at ?? p.created_at)
        .filter(Boolean)
        .map(d => new Date(d as string).getTime());
      if (dates.length === 0) {
        return { data: [] as ChartPoint[], bucket: 'day' as Bucket, isEmpty: true };
      }
      from = from ?? new Date(Math.min(...dates));
      to = to ?? new Date(Math.max(...dates));
    }

    const bkt = pickBucket(from, to);
    const map = new Map<string, ChartPoint>();
    let cursor = bucketStart(from, bkt);
    const end = bucketStart(to, bkt);
    while (isBefore(cursor, end) || isEqual(cursor, end)) {
      const k = bucketKey(cursor);
      map.set(k, {
        key: k,
        label: bucketLabel(cursor, bkt),
        revenue: 0,
        refunds: 0,
        conversions: 0,
        refundCount: 0,
      });
      cursor = bucketNext(cursor, bkt);
    }

    for (const p of payments) {
      // Receita: usa paid_at
      if (p.paid_at && p.paid_amount) {
        const k = bucketKey(bucketStart(new Date(p.paid_at), bkt));
        const point = map.get(k);
        if (point) {
          point.revenue += p.paid_amount;
          point.conversions += 1;
        }
      }
      // Refunds/chargebacks: usa refunded_at quando disponível, senão paid_at
      const isRefund = p.subscription_status === 'refunded'
        || p.subscription_status === 'chargeback'
        || !!p.refunded_at;
      if (isRefund && p.paid_amount) {
        const refDate = p.refunded_at ?? p.paid_at;
        if (refDate) {
          const k = bucketKey(bucketStart(new Date(refDate), bkt));
          const point = map.get(k);
          if (point) {
            point.refunds += p.paid_amount;
            point.refundCount += 1;
          }
        }
      }
    }

    const arr = Array.from(map.values());
    const totalRevenue = arr.reduce((s, p) => s + p.revenue, 0);
    const totalRefunds = arr.reduce((s, p) => s + p.refunds, 0);
    return { data: arr, bucket: bkt, isEmpty: totalRevenue === 0 && totalRefunds === 0 };
  }, [payments, rangeFrom, rangeTo]);

  const bucketLabelText = bucket === 'day' ? 'por dia' : bucket === 'week' ? 'por semana' : 'por mês';

  return (
    <div
      className="glass rounded-3xl border border-white/8 overflow-hidden"
      data-testid="card-revenue-chart"
    >
      <div className="flex items-center justify-between gap-2 p-4 md:p-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm md:text-base font-semibold">Receita ao longo do tempo</h3>
            <p className="text-[11px] md:text-xs text-muted-foreground">
              Receita {bucketLabelText} · refunds + chargebacks em vermelho · {rangeLabel.toLowerCase()}
            </p>
          </div>
        </div>
      </div>

      <div className="p-3 md:p-4">
        {isEmpty ? (
          <div className="h-56 flex items-center justify-center text-xs text-muted-foreground" data-testid="text-revenue-chart-empty">
            Nenhuma receita registrada no período selecionado.
          </div>
        ) : (
          <div className="h-56 md:h-64" data-testid="container-revenue-chart">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="revenueLineGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="hsl(var(--primary))" />
                    <stop offset="100%" stopColor="hsl(var(--primary))" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.18} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))', opacity: 0.4 }}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={16}
                />
                <YAxis
                  yAxisId="revenue"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`}
                  width={48}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted-foreground) / 0.06)' }} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={28}
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11 }}
                  formatter={(value) => <span className="text-muted-foreground">{value}</span>}
                />
                <Bar
                  yAxisId="revenue"
                  dataKey="refunds"
                  name="Refunds + chargebacks"
                  fill="hsl(var(--destructive))"
                  opacity={0.7}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                />
                <Line
                  yAxisId="revenue"
                  type="monotone"
                  dataKey="revenue"
                  name="Receita"
                  stroke="url(#revenueLineGradient)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--primary) / 0.5)', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

export default RevenueChart;

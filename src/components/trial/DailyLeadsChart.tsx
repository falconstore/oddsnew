import { useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';
import { Users } from 'lucide-react';
import { format, eachDayOfInterval, startOfDay, endOfDay, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { TrialLead } from '@/types/trial';

interface ChartPoint {
  label: string;
  count: number;
}

interface DailyLeadsChartProps {
  leads: TrialLead[];
  monthFilter: string;
  isLoading?: boolean;
}

interface TooltipPayloadEntry {
  dataKey?: string;
  value?: number;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadEntry[]; label?: string }) {
  if (!active || !payload || !payload.length) return null;
  const count = payload.find(p => p.dataKey === 'count')?.value ?? 0;
  return (
    <div className="glass border border-white/10 rounded-xl p-3 shadow-xl min-w-[150px]">
      <p className="text-[11px] text-muted-foreground mb-2 font-medium">{label}</p>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-pink-400" />
          Leads
        </span>
        <span className="text-[12px] font-semibold text-pink-300">{count}</span>
      </div>
    </div>
  );
}

export function DailyLeadsChart({ leads, monthFilter, isLoading = false }: DailyLeadsChartProps) {
  const { data, avg, isEmpty, monthLabel } = useMemo(() => {
    let from: Date;
    let to: Date;
    let mLabel: string;

    if (monthFilter === 'all') {
      if (leads.length === 0) return { data: [] as ChartPoint[], avg: 0, isEmpty: true, monthLabel: 'Todo o período' };
      const dates = leads.map(l => new Date(l.created_at).getTime());
      from = startOfDay(new Date(Math.min(...dates)));
      to = endOfDay(new Date(Math.max(...dates)));
      mLabel = 'Todo o período';
    } else {
      const ref = parseISO(`${monthFilter}-01`);
      from = startOfMonth(ref);
      to = endOfMonth(ref);
      mLabel = format(ref, 'MMMM/yyyy', { locale: ptBR });
    }

    const days = eachDayOfInterval({ start: from, end: to });
    const dayMap = new Map<string, number>();
    for (const d of days) {
      dayMap.set(format(d, 'yyyy-MM-dd'), 0);
    }

    for (const lead of leads) {
      const key = format(new Date(lead.created_at), 'yyyy-MM-dd');
      const existing = dayMap.get(key);
      if (existing !== undefined) {
        dayMap.set(key, existing + 1);
      }
    }

    const arr: ChartPoint[] = [];
    let totalCount = 0;
    let daysWithData = 0;
    for (const [key, count] of dayMap) {
      arr.push({ label: format(parseISO(key), 'dd/MM', { locale: ptBR }), count });
      totalCount += count;
      if (count > 0) daysWithData++;
    }

    // Divide só pelos dias que tiveram ao menos 1 lead — ignora zeros e dias futuros
    const avgVal = daysWithData > 0 ? totalCount / daysWithData : 0;
    return { data: arr, avg: avgVal, isEmpty: totalCount === 0, monthLabel: mLabel };
  }, [leads, monthFilter]);

  return (
    <div className="glass rounded-3xl border border-white/8 overflow-hidden" data-testid="card-daily-leads-chart">
      <div className="flex items-center justify-between gap-2 p-4 md:p-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/25 to-fuchsia-500/10 border border-pink-500/30 flex items-center justify-center">
            <Users className="w-5 h-5 text-pink-300" />
          </div>
          <div>
            <h3 className="text-sm md:text-base font-semibold">Novos leads por dia</h3>
            <p className="text-[11px] md:text-xs text-muted-foreground">
              {monthLabel} · média {avg.toFixed(1)} leads/dia
            </p>
          </div>
        </div>
      </div>

      <div className="p-3 md:p-4">
        {isLoading ? (
          <div className="h-48 flex items-end gap-1 px-4 pb-2" data-testid="skeleton-daily-leads">
            {[0.5, 0.8, 0.6, 1, 0.7, 0.9, 0.4, 0.75, 0.55, 0.85].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-pink-500/10 animate-pulse"
                style={{ height: `${h * 100}%` }}
              />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="h-48 flex items-center justify-center text-xs text-muted-foreground" data-testid="text-daily-leads-empty">
            Nenhum lead no período selecionado.
          </div>
        ) : (
          <div className="h-48 md:h-56" data-testid="container-daily-leads-chart">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="leadsBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(330 80% 60%)" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="hsl(330 80% 60%)" stopOpacity={0.3} />
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
                  name="Leads"
                  fill="url(#leadsBarGradient)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                {/* Linha tracejada — média diária de leads */}
                <ReferenceLine
                  y={avg}
                  stroke="hsl(330 80% 70%)"
                  strokeDasharray="6 4"
                  strokeWidth={1.5}
                  strokeOpacity={0.75}
                  label={{
                    value: `~${avg.toFixed(1)}/dia`,
                    position: 'insideTopRight',
                    fontSize: 10,
                    fill: 'hsl(330 80% 70%)',
                    dy: -4,
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

export default DailyLeadsChart;

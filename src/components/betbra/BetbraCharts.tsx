import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Area, AreaChart } from 'recharts';
import { BarChart2, TrendingUp } from 'lucide-react';

interface ChartDataPoint {
  date: string;
  turnover?: number;
  ngr?: number;
}

interface BetbraChartsProps {
  turnoverData: ChartDataPoint[];
  ngrData: ChartDataPoint[];
  accumulatedNgrData: ChartDataPoint[];
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (active && payload && payload.length) {
    return (
      <div className="glass border border-white/10 rounded-xl p-2.5 shadow-xl">
        <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
        <p className="text-sm font-bold text-foreground">
          {payload[0].value.toLocaleString('pt-BR')}
        </p>
      </div>
    );
  }
  return null;
}

interface ChartCardProps {
  title: string;
  subtitle?: string;
  accentColor: string;
  barColor: string;
  children: React.ReactNode;
}

function ChartCard({ title, subtitle, accentColor, children }: ChartCardProps) {
  return (
    <div className="glass rounded-2xl border border-white/5 overflow-hidden">
      <div className="flex items-center gap-2 p-4 border-b border-white/5">
        <div className={`w-1.5 h-5 rounded-full ${accentColor}`} />
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

export function BetbraCharts({ turnoverData, ngrData, accumulatedNgrData }: BetbraChartsProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Turnover Diário */}
        <ChartCard
          title="Turnover Diário"
          subtitle="Movimentação por dia"
          accentColor="bg-border"
          barColor="hsl(var(--muted-foreground))"
        >
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={turnoverData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))', opacity: 0.4 }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--border) / 0.3)' }} />
                <Bar
                  dataKey="turnover"
                  fill="hsl(var(--muted-foreground))"
                  radius={[4, 4, 0, 0]}
                  opacity={0.85}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* NGR Diário */}
        <ChartCard
          title="NGR Diário"
          subtitle="Net Gaming Revenue por dia"
          accentColor="bg-primary/60"
          barColor="hsl(var(--primary))"
        >
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ngrData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))', opacity: 0.4 }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--primary) / 0.08)' }} />
                <Bar
                  dataKey="ngr"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                  opacity={0.85}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* NGR Acumulado */}
      <ChartCard
        title="NGR Acumulado Mensal"
        subtitle="Evolução do NGR ao longo do mês"
        accentColor="bg-primary/60"
        barColor="hsl(var(--primary))"
      >
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={accumulatedNgrData}>
              <defs>
                <linearGradient id="ngrGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))', opacity: 0.4 }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--primary) / 0.3)', strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="ngr"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                fill="url(#ngrGradient)"
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: 'hsl(var(--primary) / 0.5)' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
}

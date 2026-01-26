import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

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
      <div className="bg-card border border-border rounded-lg p-2 shadow-lg">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground">
          R$ {payload[0].value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      </div>
    );
  }
  return null;
}

export function BetbraCharts({ turnoverData, ngrData, accumulatedNgrData }: BetbraChartsProps) {
  return (
    <div className="space-y-4">
      {/* Top row: Turnover and NGR side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Turnover Daily Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Turnover Diário</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={turnoverData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="turnover" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                    opacity={0.8}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* NGR Daily Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">NGR Diário</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ngrData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="ngr" 
                    fill="hsl(var(--success))" 
                    radius={[4, 4, 0, 0]}
                    opacity={0.8}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom: Accumulated NGR */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">NGR Acumulado Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={accumulatedNgrData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="ngr" 
                  stroke="hsl(var(--success))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--success))', strokeWidth: 0, r: 3 }}
                  activeDot={{ r: 5, fill: 'hsl(var(--success))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

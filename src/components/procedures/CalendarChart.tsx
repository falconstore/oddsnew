import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface CalendarChartProps {
  data: { date: string; profit: number; count: number; fbCount?: number; fbTotal?: number; dgCount?: number }[];
  title: string;
  selectedMonth: Date;
}

export function CalendarChart({ data, title, selectedMonth }: CalendarChartProps) {
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const profits = data.map(d => d.profit).filter(p => p > 0);
  const losses = data.map(d => d.profit).filter(p => p < 0);
  const maxProfit = Math.max(...profits, 1);
  const maxLoss = Math.min(...losses, -1);

  const getDayData = (day: Date) => {
    const dateKey = format(day, 'dd/MM', { locale: ptBR });
    return data.find(d => d.date === dateKey) || { date: dateKey, profit: 0, count: 0, fbCount: 0, fbTotal: 0, dgCount: 0 };
  };

  // Tint do heatmap usa tokens (verde=lucro, vermelho=prejuízo) com opacidade
  // proporcional à magnitude. Sem cantos/sombras — só intensidade.
  const getCell = (profit: number) => {
    if (profit > 0) {
      const intensity = Math.min((profit / maxProfit), 1);
      return { token: 'primary', opacity: intensity * 0.55 + 0.15, value: 'text-primary', isData: true };
    }
    if (profit < 0) {
      const intensity = Math.min(Math.abs(profit) / Math.abs(maxLoss), 1);
      return { token: 'destructive', opacity: intensity * 0.55 + 0.15, value: 'text-destructive', isData: true };
    }
    return { token: 'card', opacity: 1, value: 'text-muted-foreground', isData: false };
  };

  const firstDayOfWeek = monthStart.getDay();
  const weekDays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="telemetry-label text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Cabeçalho dos dias da semana */}
        <div className="grid grid-cols-7 gap-px mb-px">
          {weekDays.map(day => (
            <div key={day} className="text-center telemetry-label text-muted-foreground/60 pb-1.5">
              {day}
            </div>
          ))}
        </div>

        {/* Grid do calendário — hairline grid (gap-px sobre bg-border) */}
        <div className="grid grid-cols-7 gap-px bg-border border border-border">
          {[...Array(firstDayOfWeek)].map((_, index) => (
            <div key={`empty-${index}`} className="aspect-[4/3] min-h-[92px] bg-card" />
          ))}

          {daysInMonth.map((day) => {
            const dayData = getDayData(day);
            const cell = getCell(dayData.profit);
            const isToday = isSameDay(day, new Date());
            const fbCount = dayData.fbCount ?? 0;
            const fbTotal = dayData.fbTotal ?? 0;
            const dgCount = dayData.dgCount ?? 0;
            const hasData = dayData.count > 0;

            return (
              <div
                key={day.toString()}
                className={cn(
                  'aspect-[4/3] min-h-[92px] bg-card flex flex-col items-stretch justify-between transition-colors group relative',
                  isToday && 'outline outline-1 outline-primary -outline-offset-1'
                )}
                style={cell.isData ? { backgroundColor: `hsl(var(--${cell.token}) / ${cell.opacity})` } : undefined}
                data-testid={`calendar-day-${dayData.date}`}
              >
                {/* Número do dia */}
                <div className={cn(
                  'px-2 pt-1.5 font-mono text-sm tabular-nums leading-none',
                  hasData ? 'text-foreground' : 'text-muted-foreground/50'
                )}>
                  {format(day, 'd')}
                </div>

                {hasData ? (
                  <div className="px-2 pb-2 flex flex-col gap-1 w-full">
                    {/* LUCRO — número principal mono */}
                    <div className={cn(
                      'kpi font-semibold leading-none text-base sm:text-lg md:text-xl',
                      'text-foreground'
                    )}>
                      {dayData.profit >= 0 ? '+' : ''}R${dayData.profit.toFixed(0)}
                    </div>

                    {dgCount > 0 && (
                      <div className="flex items-center gap-1 leading-tight">
                        <span className="text-[10px] leading-none">🏆</span>
                        <span className="telemetry-label text-foreground/80">{dgCount} DUPLO GREEN</span>
                      </div>
                    )}

                    {fbCount > 0 && (
                      <div className="flex items-center gap-1 leading-tight">
                        <span className="text-[10px] leading-none">🎁</span>
                        <span className="telemetry-label text-foreground/80">{fbCount} FREEBET{fbCount > 1 ? 'S' : ''}</span>
                      </div>
                    )}

                    <div className="telemetry-label text-foreground/60">{dayData.count} PROC</div>
                  </div>
                ) : (
                  <div className="px-2 pb-2 telemetry-label text-muted-foreground/30">—</div>
                )}

                {/* Tooltip */}
                {hasData && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-3 py-2 bg-popover border border-border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 whitespace-nowrap text-left">
                    <p className={cn('kpi text-sm font-semibold tabular-nums', cell.value)}>
                      {dayData.profit >= 0 ? '+' : ''}R$ {dayData.profit.toFixed(2)}
                    </p>
                    <p className="telemetry-label text-muted-foreground mt-0.5">{dayData.count} PROCEDIMENTOS</p>
                    {dgCount > 0 && <p className="telemetry-label text-primary mt-0.5">🏆 {dgCount} DUPLO GREEN</p>}
                    {fbCount > 0 && (
                      <p className="telemetry-label text-primary mt-0.5">
                        🎁 {fbCount} FREEBET{fbCount > 1 ? 'S' : ''} · R$ {fbTotal.toFixed(2)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legenda */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 telemetry-label text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-destructive/60 border border-border" />
            <span>PREJUÍZO</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-card border border-border" />
            <span>SEM MOVIMENTAÇÃO</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-primary/60 border border-border" />
            <span>LUCRO</span>
          </div>
          <div className="flex items-center gap-1.5"><span>🏆</span><span>DUPLO GREEN</span></div>
          <div className="flex items-center gap-1.5"><span>🎁</span><span>FREEBETS</span></div>
        </div>
      </CardContent>
    </Card>
  );
}

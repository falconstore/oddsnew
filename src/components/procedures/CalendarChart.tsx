import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface CalendarChartProps {
  data: { date: string; profit: number; count: number; fbCount?: number; fbTotal?: number }[];
  title: string;
  selectedMonth: Date;
}

export function CalendarChart({ data, title, selectedMonth }: CalendarChartProps) {
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Calcular o maior lucro e maior prejuízo para o degradê dinâmico
  const profits = data.map(d => d.profit).filter(p => p > 0);
  const losses = data.map(d => d.profit).filter(p => p < 0);
  const maxProfit = Math.max(...profits, 1); // Evitar divisão por zero
  const maxLoss = Math.min(...losses, -1); // Evitar divisão por zero

  const getDayData = (day: Date) => {
    const dateKey = format(day, 'dd/MM', { locale: ptBR });
    return data.find(d => d.date === dateKey) || { date: dateKey, profit: 0, count: 0, fbCount: 0, fbTotal: 0 };
  };

  const getColorIntensity = (profit: number) => {
    if (profit > 0) {
      const intensity = Math.min((profit / maxProfit) * 100, 100);
      // Mapear intensidade para opacidade (0.15 a 0.75)
      const opacity = (intensity / 100) * 0.6 + 0.15;
      return {
        colorClass: 'bg-success',
        borderClass: 'border-success',
        opacity,
        textClass: intensity > 40 ? 'text-success-foreground' : 'text-foreground'
      };
    } else if (profit < 0) {
      const intensity = Math.min((Math.abs(profit) / Math.abs(maxLoss)) * 100, 100);
      const opacity = (intensity / 100) * 0.6 + 0.15;
      return {
        colorClass: 'bg-destructive',
        borderClass: 'border-destructive',
        opacity,
        textClass: intensity > 40 ? 'text-destructive-foreground' : 'text-foreground'
      };
    }
    return {
      colorClass: 'bg-muted',
      borderClass: 'border-border',
      opacity: 0.3,
      textClass: 'text-muted-foreground'
    };
  };

  // Calcular o dia da semana do primeiro dia do mês (0 = domingo)
  const firstDayOfWeek = monthStart.getDay();
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Cabeçalho dos dias da semana */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekDays.map(day => (
            <div key={day} className="text-center text-xs sm:text-sm font-semibold text-muted-foreground pb-1">
              {day}
            </div>
          ))}
        </div>

        {/* Grid do calendário */}
        <div className="grid grid-cols-7 gap-1">
          {/* Espaços vazios antes do primeiro dia */}
          {[...Array(firstDayOfWeek)].map((_, index) => (
            <div key={`empty-${index}`} className="aspect-[4/3]" />
          ))}

          {/* Dias do mês */}
          {daysInMonth.map((day) => {
            const dayData = getDayData(day);
            const colors = getColorIntensity(dayData.profit);
            const isToday = isSameDay(day, new Date());

            const fbCount = dayData.fbCount ?? 0;
            const fbTotal = dayData.fbTotal ?? 0;
            return (
              <div
                key={day.toString()}
                className={cn(
                  "aspect-[4/3] min-h-[88px] rounded-md border p-1.5 flex flex-col items-stretch justify-between transition-all hover:scale-105 group relative",
                  colors.borderClass,
                  isToday && 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                )}
                style={{
                  backgroundColor: `hsl(var(--${colors.colorClass.replace('bg-', '')}) / ${colors.opacity})`
                }}
                data-testid={`calendar-day-${dayData.date}`}
              >
                {/* DIA */}
                <div className={cn(
                  "text-base sm:text-lg md:text-xl font-bold leading-none text-left",
                  colors.textClass
                )}>
                  {format(day, 'd')}
                </div>

                {/* LUCRO + FB + PROC */}
                {dayData.count > 0 ? (
                  <div className={cn("text-left w-full space-y-0.5", colors.textClass)}>
                    {/* Lucro do dia */}
                    <div className="text-[10px] sm:text-xs md:text-sm font-bold leading-tight font-mono">
                      R$ {dayData.profit.toFixed(0)}
                    </div>
                    {/* Quantidade + valor total de FB ganhas no dia */}
                    {fbCount > 0 && (
                      <div className="text-[9px] sm:text-[10px] md:text-[11px] leading-tight font-medium opacity-90">
                        🎟️ {fbCount} • R$ {fbTotal.toFixed(0)}
                      </div>
                    )}
                    {/* Quantidade de procedimentos do dia */}
                    <div className="text-[9px] sm:text-[10px] md:text-[11px] font-medium leading-tight opacity-80">
                      {dayData.count} proc.
                    </div>
                  </div>
                ) : (
                  <div className={cn(
                    "text-[8px] sm:text-[9px] md:text-[10px] text-left opacity-60",
                    colors.textClass
                  )}>
                    Sem dados
                  </div>
                )}

                {/* Tooltip */}
                {dayData.count > 0 && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-2 bg-popover border border-border rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                    <p className="text-xs font-bold text-foreground">R$ {dayData.profit.toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">{dayData.count} procedimentos</p>
                    {fbCount > 0 && (
                      <p className="text-[10px] text-purple-400">🎟️ {fbCount} freebet{fbCount > 1 ? 's' : ''} • R$ {fbTotal.toFixed(2)}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legenda */}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded border bg-destructive/70 border-destructive" />
            <span>Prejuízo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-muted/30 border border-border" />
            <span>Sem movimentação</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded border bg-success/70 border-success" />
            <span>Lucro</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

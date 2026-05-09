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

  const getColorIntensity = (profit: number) => {
    if (profit > 0) {
      const intensity = Math.min((profit / maxProfit) * 100, 100);
      const opacity = (intensity / 100) * 0.65 + 0.22;
      return { colorClass: 'bg-success', borderClass: 'border-success', opacity, textClass: 'text-white', isProfit: true, isLoss: false };
    } else if (profit < 0) {
      const intensity = Math.min((Math.abs(profit) / Math.abs(maxLoss)) * 100, 100);
      const opacity = (intensity / 100) * 0.65 + 0.22;
      return { colorClass: 'bg-destructive', borderClass: 'border-destructive', opacity, textClass: 'text-white', isProfit: false, isLoss: true };
    }
    return { colorClass: 'bg-muted', borderClass: 'border-border', opacity: 0.2, textClass: 'text-muted-foreground', isProfit: false, isLoss: false };
  };

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
          {[...Array(firstDayOfWeek)].map((_, index) => (
            <div key={`empty-${index}`} className="aspect-[4/3]" />
          ))}

          {daysInMonth.map((day) => {
            const dayData = getDayData(day);
            const colors = getColorIntensity(dayData.profit);
            const isToday = isSameDay(day, new Date());
            const fbCount = dayData.fbCount ?? 0;
            const fbTotal = dayData.fbTotal ?? 0;
            const dgCount = dayData.dgCount ?? 0;
            const hasData = dayData.count > 0;

            return (
              <div
                key={day.toString()}
                className={cn(
                  "aspect-[4/3] min-h-[90px] rounded-lg border flex flex-col items-stretch justify-between transition-all hover:scale-[1.03] group relative overflow-hidden",
                  colors.borderClass,
                  isToday && 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                )}
                style={{
                  backgroundColor: `hsl(var(--${colors.colorClass.replace('bg-', '')}) / ${colors.opacity})`
                }}
                data-testid={`calendar-day-${dayData.date}`}
              >
                {/* Número do dia */}
                <div className={cn(
                  "px-1.5 pt-1 text-sm sm:text-base md:text-lg font-bold leading-none",
                  hasData ? colors.textClass : 'text-muted-foreground'
                )}>
                  {format(day, 'd')}
                </div>

                {hasData ? (
                  <div className="px-1.5 pb-1.5 flex flex-col gap-0.5 w-full">
                    {/* LUCRO — número principal grande */}
                    <div className={cn(
                      "font-black leading-none tabular-nums",
                      "text-sm sm:text-base md:text-xl lg:text-2xl",
                      colors.isProfit ? 'text-white drop-shadow-sm' : colors.isLoss ? 'text-white drop-shadow-sm' : colors.textClass
                    )}>
                      {colors.isProfit ? '+' : ''}R${dayData.profit >= 0
                        ? dayData.profit.toFixed(0)
                        : dayData.profit.toFixed(0)}
                    </div>

                    {/* 🏆 Duplo Green */}
                    {dgCount > 0 && (
                      <div className="flex items-center gap-0.5 leading-tight">
                        <span className="text-[9px] sm:text-[10px] md:text-[11px] leading-none">🏆</span>
                        <span className={cn(
                          "text-[8px] sm:text-[9px] md:text-[10px] font-bold leading-tight",
                          colors.isProfit || colors.isLoss ? 'text-white/95' : 'text-muted-foreground'
                        )}>
                          {dgCount} DUPLO GREEN
                        </span>
                      </div>
                    )}

                    {/* 🎁 FreeBets GANHAS */}
                    {fbCount > 0 && (
                      <div className="flex items-center gap-0.5 leading-tight">
                        <span className="text-[9px] sm:text-[10px] md:text-[11px] leading-none">🎁</span>
                        <span className={cn(
                          "text-[8px] sm:text-[9px] md:text-[10px] font-bold leading-tight",
                          colors.isProfit || colors.isLoss ? 'text-white/90' : 'text-muted-foreground'
                        )}>
                          {fbCount} FreeBet{fbCount > 1 ? 's' : ''} GANHAS
                        </span>
                      </div>
                    )}

                    {/* Procedimentos */}
                    <div className={cn(
                      "text-[8px] sm:text-[9px] md:text-[10px] font-medium leading-none opacity-75",
                      colors.isProfit || colors.isLoss ? 'text-white' : 'text-muted-foreground'
                    )}>
                      {dayData.count} proc.
                    </div>
                  </div>
                ) : (
                  <div className="px-1.5 pb-1.5 text-[8px] sm:text-[9px] md:text-[10px] text-muted-foreground/50 leading-none">
                    Sem dados
                  </div>
                )}

                {/* Tooltip */}
                {hasData && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2.5 bg-popover border border-border rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 whitespace-nowrap text-left">
                    <p className="text-sm font-black text-foreground tabular-nums">
                      {colors.isProfit ? '+' : ''}R$ {dayData.profit.toFixed(2)}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{dayData.count} procedimentos</p>
                    {dgCount > 0 && (
                      <p className="text-[11px] text-yellow-400 mt-0.5">
                        🏆 {dgCount} Duplo Green
                      </p>
                    )}
                    {fbCount > 0 && (
                      <p className="text-[11px] text-emerald-400 mt-0.5">
                        🎁 {fbCount} FreeBet{fbCount > 1 ? 's' : ''} GANHAS • R$ {fbTotal.toFixed(2)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legenda */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
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
          <div className="flex items-center gap-1.5">
            <span>🏆</span>
            <span>Duplo Green</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>🎁</span>
            <span>FreeBets GANHAS</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

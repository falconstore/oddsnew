import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CalendarChartProps {
  data: { date: string; profit: number; count: number }[];
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
    return data.find(d => d.date === dateKey) || { date: dateKey, profit: 0, count: 0 };
  };

  const getColorIntensity = (profit: number) => {
    if (profit > 0) {
      const intensity = Math.min((profit / maxProfit) * 100, 100);
      return {
        bg: `rgba(34, 197, 94, ${(intensity / 100) * 0.7 + 0.1})`, // success green
        border: `rgba(34, 197, 94, ${Math.min((intensity / 100) + 0.3, 1)})`,
        text: intensity > 40 ? 'text-white' : 'text-foreground'
      };
    } else if (profit < 0) {
      const intensity = Math.min((Math.abs(profit) / Math.abs(maxLoss)) * 100, 100);
      return {
        bg: `rgba(239, 68, 68, ${(intensity / 100) * 0.7 + 0.1})`, // destructive red
        border: `rgba(239, 68, 68, ${Math.min((intensity / 100) + 0.3, 1)})`,
        text: intensity > 40 ? 'text-white' : 'text-foreground'
      };
    }
    return {
      bg: 'hsl(var(--muted) / 0.3)',
      border: 'hsl(var(--border))',
      text: 'text-muted-foreground'
    };
  };

  // Calcular o dia da semana do primeiro dia do mês (0 = domingo)
  const firstDayOfWeek = monthStart.getDay();
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Cabeçalho dos dias da semana */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
          {weekDays.map(day => (
            <div key={day} className="text-center text-[10px] sm:text-xs font-semibold text-muted-foreground pb-2">
              {day}
            </div>
          ))}
        </div>

        {/* Grid do calendário */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {/* Espaços vazios antes do primeiro dia */}
          {[...Array(firstDayOfWeek)].map((_, index) => (
            <div key={`empty-${index}`} className="aspect-square" />
          ))}

          {/* Dias do mês */}
          {daysInMonth.map((day) => {
            const dayData = getDayData(day);
            const colors = getColorIntensity(dayData.profit);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={day.toString()}
                className={`aspect-square rounded-lg border-2 p-1 sm:p-1.5 md:p-2 flex flex-col justify-center items-center transition-all hover:scale-105 group relative ${
                  isToday ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
                }`}
                style={{
                  backgroundColor: colors.bg,
                  borderColor: colors.border
                }}
              >
                {/* Número do dia */}
                <div className={`text-sm sm:text-base md:text-lg lg:text-xl font-bold ${colors.text} leading-none`}>
                  {format(day, 'd')}
                </div>
                
                {/* Informações do dia */}
                {dayData.count > 0 ? (
                  <div className={`text-center ${colors.text} w-full mt-0.5`}>
                    <div className="text-[7px] sm:text-[8px] md:text-[9px] font-medium leading-tight">
                      {dayData.count} proc.
                    </div>
                    <div className="text-[8px] sm:text-[9px] md:text-[10px] font-bold leading-tight">
                      R$ {dayData.profit.toFixed(0)}
                    </div>
                  </div>
                ) : (
                  <div className={`text-[6px] sm:text-[7px] md:text-[8px] ${colors.text} text-center mt-0.5 opacity-60`}>
                    Sem dados
                  </div>
                )}

                {/* Tooltip */}
                {dayData.count > 0 && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 bg-popover border border-border rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                    <p className="text-xs font-bold text-foreground">R$ {dayData.profit.toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">{dayData.count} procedimentos</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legenda */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-[10px] sm:text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 sm:w-4 sm:h-4 rounded border-2" style={{ backgroundColor: 'rgba(239, 68, 68, 0.7)', borderColor: 'rgba(239, 68, 68, 1)' }} />
            <span>Prejuízo</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-muted/30 border-2 border-border" />
            <span>Sem movimentação</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 sm:w-4 sm:h-4 rounded border-2" style={{ backgroundColor: 'rgba(34, 197, 94, 0.7)', borderColor: 'rgba(34, 197, 94, 1)' }} />
            <span>Lucro</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

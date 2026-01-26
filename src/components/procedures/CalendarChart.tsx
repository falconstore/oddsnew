import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getDaysInMonth, startOfMonth } from 'date-fns';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CalendarChartProps {
  data: { date: string; profit: number; count: number }[];
  title: string;
  selectedMonth: Date;
}

interface DayCell {
  day: number | null;
  data?: { date: string; profit: number; count: number };
  key: string | number;
}

export function CalendarChart({ data, title, selectedMonth }: CalendarChartProps) {
  const daysInMonth = getDaysInMonth(selectedMonth);
  const firstDayOfMonth = startOfMonth(selectedMonth).getDay();
  const year = selectedMonth.getFullYear();
  const monthNum = selectedMonth.getMonth();
  
  // Create a map for quick lookup
  const dataMap = new Map(data.map(d => [d.date, d]));
  
  // Generate all days
  const days: DayCell[] = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const dateKey = format(new Date(year, monthNum, day), 'dd/MM', { locale: ptBR });
    return {
      day,
      data: dataMap.get(dateKey),
      key: day
    };
  });
  
  // Add empty cells for alignment
  const emptyCells: DayCell[] = Array.from({ length: firstDayOfMonth }, (_, i) => ({ 
    day: null, 
    key: `empty-${i}` 
  }));
  
  const allCells: DayCell[] = [...emptyCells, ...days];
  
  const getColor = (profit: number | undefined) => {
    if (profit === undefined) return 'bg-muted/30';
    if (profit > 100) return 'bg-success';
    if (profit > 50) return 'bg-success/70';
    if (profit > 0) return 'bg-success/40';
    if (profit === 0) return 'bg-muted';
    if (profit > -50) return 'bg-destructive/40';
    if (profit > -100) return 'bg-destructive/70';
    return 'bg-destructive';
  };
  
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {/* Header */}
          {weekDays.map(day => (
            <div key={day} className="text-center text-xs text-muted-foreground font-medium py-2">
              {day}
            </div>
          ))}
          
          {/* Days */}
          {allCells.map((cell, index) => (
            <div
              key={cell.key ?? index}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs relative group ${
                cell.day !== null ? getColor(cell.data?.profit) : 'bg-transparent'
              } ${cell.day !== null ? 'cursor-default' : ''}`}
            >
              {cell.day !== null && (
                <>
                  <span className="font-medium">{cell.day}</span>
                  {cell.data && (
                    <span className="text-[10px] opacity-80">
                      {cell.data.count}
                    </span>
                  )}
                  
                  {/* Tooltip */}
                  {cell.data && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover border border-border rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                      <p className="text-xs font-medium">R$ {cell.data.profit.toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground">{cell.data.count} proc.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
        
        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-destructive" />
            <span>Prejuízo</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-muted" />
            <span>Zero</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-success" />
            <span>Lucro</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

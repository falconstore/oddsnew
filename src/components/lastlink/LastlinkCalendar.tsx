import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export interface DailyPoint {
  dia: string;          // 'YYYY-MM-DD'
  vendas: number;
  novas: number;
  renovacoes: number;
  receita: number;
}

const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Calendário mensal de vendas/renovações — heatmap por receita do dia.
// onDayClick: abre detalhe do dia (modal). Só dias com vendas são clicáveis.
export function LastlinkCalendar({ data, selectedMonth, onDayClick }: { data: DailyPoint[]; selectedMonth: Date; onDayClick?: (day: Date) => void }) {
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leadBlanks = getDay(monthStart); // domingos à esquerda

  const byDay = (day: Date) =>
    data.find((d) => isSameDay(new Date(d.dia + 'T12:00:00'), day));

  const maxReceita = Math.max(...data.map((d) => d.receita), 1);
  const cellTint = (receita: number) => {
    if (receita <= 0) return 'bg-card';
    const r = receita / maxReceita;
    if (r > 0.66) return 'bg-primary/30';
    if (r > 0.33) return 'bg-primary/20';
    return 'bg-primary/10';
  };

  const weekDays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

  return (
    <div className="panel-bracket p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="telemetry-label text-primary">[ CALENDÁRIO DIÁRIO ]</p>
        <p className="telemetry-label text-muted-foreground">
          {format(selectedMonth, 'MMMM yyyy', { locale: ptBR }).toUpperCase()}
        </p>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border border border-border">
        {weekDays.map((w) => (
          <div key={w} className="bg-card py-1.5 text-center telemetry-label text-muted-foreground/50">
            {w}
          </div>
        ))}
        {Array.from({ length: leadBlanks }).map((_, i) => (
          <div key={`b${i}`} className="bg-card/40 min-h-[68px]" />
        ))}
        {days.map((day) => {
          const d = byDay(day);
          const receita = d?.receita ?? 0;
          const clickable = !!d && d.vendas > 0 && !!onDayClick;
          return (
            <div
              key={day.toISOString()}
              onClick={() => clickable && onDayClick!(day)}
              className={cn('min-h-[68px] p-1.5 flex flex-col transition-colors', cellTint(receita),
                clickable && 'cursor-pointer hover:ring-1 hover:ring-primary/50 hover:ring-inset')}
              title={d ? `${format(day, 'dd/MM')}: ${money(receita)} · ${d.vendas} vendas (${d.novas} novas, ${d.renovacoes} renov.) — clique pra detalhes` : format(day, 'dd/MM')}
            >
              <span className="telemetry-label text-muted-foreground/60">{format(day, 'd')}</span>
              {d && (
                <div className="mt-auto leading-tight">
                  <p className="text-[11px] font-mono font-semibold text-primary tabular-nums">
                    {receita >= 1000 ? `${(receita / 1000).toFixed(1)}k` : receita.toFixed(0)}
                  </p>
                  <p className="text-[9px] text-muted-foreground/70 tabular-nums">
                    {d.novas} + {d.renovacoes}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground/60 flex-wrap">
        <span>Cada dia mostra: <b className="text-primary">valor</b> em cima, e <b>novas + renovações</b> embaixo</span>
        <span className="ml-auto">Clique num dia pra ver os detalhes</span>
      </div>
    </div>
  );
}

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Clock, ExternalLink, X, Bell } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Procedure } from '@/types/procedures';
import { parseDate } from '@/lib/procedureUtils';
import { canCheckResult } from '@/lib/procedureGameTime';

interface UrgentProcedure extends Procedure {
  urgency: 'high' | 'medium';
  message: string;
  icon: typeof AlertCircle | typeof Clock;
  color: 'red' | 'orange' | 'amber' | 'yellow';
}

interface NotificationPanelProps {
  procedures: Procedure[];
  onDismiss?: () => void;
  onProcedureClick?: (proc: Procedure) => void;
}

export function NotificationPanel({ procedures, onDismiss, onProcedureClick }: NotificationPanelProps) {
  const getUrgentProcedures = (): UrgentProcedure[] => {
    const today = new Date();
    const urgent: UrgentProcedure[] = [];

    procedures.forEach(proc => {
      if (proc.category === 'Extra' || proc.category === 'Ganhar Giros Gratis') return;
      const procDate = parseDate(proc.date);
      if (!procDate) return;
      const daysAgo = differenceInDays(today, procDate);
      const cleanStatus = (proc.status || '').trim().toLowerCase();

      // Enviado + partida encerrada + sem resultado → precisa conferir
      if (
        cleanStatus === 'enviado' &&
        (proc.profit_loss === 0 || proc.profit_loss === null) &&
        canCheckResult(proc, today) &&
        !proc.archived
      ) {
        urgent.push({
          ...proc,
          urgency: daysAgo > 1 ? 'high' : 'medium',
          message: daysAgo > 0
            ? `Resultado não definido há ${daysAgo} dia${daysAgo > 1 ? 's' : ''}`
            : 'Partida encerrada — definir resultado',
          icon: daysAgo > 1 ? AlertCircle : Clock,
          color: daysAgo > 1 ? 'red' : 'amber',
        });
      } else if ((cleanStatus === 'falta girar freebet' || cleanStatus === 'falta girar freeebet') && daysAgo > 3) {
        urgent.push({ ...proc, urgency: 'high', message: `Freebet pendente há ${daysAgo} dias`, icon: AlertCircle, color: 'red' });
      } else if ((cleanStatus === 'falta girar freebet' || cleanStatus === 'falta girar freeebet') && daysAgo > 0) {
        urgent.push({ ...proc, urgency: 'medium', message: `Freebet pendente há ${daysAgo} dia${daysAgo > 1 ? 's' : ''}`, icon: Clock, color: 'amber' });
      } else if (cleanStatus === 'aguardando resultado') {
        urgent.push({
          ...proc,
          urgency: daysAgo > 1 ? 'high' : 'medium',
          message: daysAgo > 0
            ? `Aguardando resultado há ${daysAgo} dia${daysAgo > 1 ? 's' : ''}`
            : 'Jogo encerrado — definir resultado',
          icon: daysAgo > 1 ? AlertCircle : Clock,
          color: daysAgo > 1 ? 'orange' : 'amber',
        });
      } else if (cleanStatus === 'enviada partida em aberto' && daysAgo > 2) {
        urgent.push({ ...proc, urgency: 'high', message: `Partida em aberto há ${daysAgo} dias`, icon: AlertCircle, color: 'orange' });
      } else if (cleanStatus === 'freebet pendente' && daysAgo > 5) {
        urgent.push({ ...proc, urgency: 'medium', message: `Freebet pendente há ${daysAgo} dias`, icon: Clock, color: 'yellow' });
      } else if (cleanStatus === 'referência faltando' && daysAgo > 1) {
        urgent.push({ ...proc, urgency: 'high', message: `Referência faltando há ${daysAgo} dias`, icon: AlertCircle, color: 'red' });
      }
    });

    return urgent.sort((a, b) => {
      if (a.urgency === 'high' && b.urgency !== 'high') return -1;
      if (a.urgency !== 'high' && b.urgency === 'high') return 1;
      return 0;
    });
  };

  const urgentProcs = getUrgentProcedures();
  if (urgentProcs.length === 0) return null;

  const highUrgency = urgentProcs.filter(p => p.urgency === 'high').length;
  const mediumUrgency = urgentProcs.filter(p => p.urgency === 'medium').length;

  const colorConfig: Record<string, { border: string; bg: string; text: string; glow: string }> = {
    red:    { border: 'border-destructive/30', bg: 'bg-destructive/15', text: 'text-destructive', glow: 'shadow-destructive/10' },
    orange: { border: 'border-warning/30', bg: 'bg-warning/15', text: 'text-warning', glow: 'shadow-warning/10' },
    amber:  { border: 'border-warning/30', bg: 'bg-warning/15', text: 'text-warning', glow: 'shadow-warning/10' },
    yellow: { border: 'border-warning/30', bg: 'bg-warning/15', text: 'text-warning', glow: 'shadow-warning/10' },
  };

  return (
    <div className="rounded-2xl border border-destructive/25 overflow-hidden">
      <div className="bg-destructive/10 p-4 flex justify-between items-center border-b border-destructive/15">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-destructive/20 rounded-xl flex items-center justify-center shadow-lg shadow-destructive/20">
            <Bell className="w-4.5 h-4.5 text-destructive" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground">Procedimentos que Precisam de Atenção</h3>
            <div className="flex items-center gap-2 mt-0.5">
              {highUrgency > 0 && (
                <span className="text-[10px] font-semibold text-destructive flex items-center gap-1">
                  <AlertCircle className="w-2.5 h-2.5" />
                  {highUrgency} urgente{highUrgency > 1 ? 's' : ''}
                </span>
              )}
              {highUrgency > 0 && mediumUrgency > 0 && <span className="text-muted-foreground/40 text-[10px]">•</span>}
              {mediumUrgency > 0 && (
                <span className="text-[10px] font-semibold text-warning flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {mediumUrgency} média{mediumUrgency > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
        {onDismiss && (
          <Button variant="ghost" size="icon" onClick={onDismiss} className="text-muted-foreground hover:text-foreground h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
        {urgentProcs.slice(0, 10).map((proc) => {
          const Icon = proc.icon;
          const c = colorConfig[proc.color] || colorConfig.amber;
          const procDate = parseDate(proc.date);

          return (
            <div
              key={proc.id}
              className={`rounded-xl p-3 border ${c.border} ${c.bg} hover:brightness-110 transition-all cursor-pointer`}
              onClick={() => onProcedureClick?.(proc)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 flex-1">
                  <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center bg-black/20`}>
                    <Icon className={`w-3.5 h-3.5 ${c.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-bold text-sm text-foreground">#{proc.procedure_number}</span>
                      <Badge variant="outline" className="border-white/15 text-muted-foreground text-[10px] px-1.5 py-0">
                        {proc.platform}
                      </Badge>
                    </div>
                    <p className={`text-xs font-semibold ${c.text}`}>{proc.message}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[10px] text-muted-foreground">{proc.status}</span>
                      <span className="text-muted-foreground/40 text-[10px]">•</span>
                      <span className="text-[10px] text-muted-foreground">
                        {procDate ? format(procDate, 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                      </span>
                      {proc.freebet_value && (
                        <>
                          <span className="text-muted-foreground/40 text-[10px]">•</span>
                          <span className="text-[10px] text-muted-foreground font-semibold">FB: R$ {proc.freebet_value.toFixed(2)}</span>
                        </>
                      )}
                      {proc.profit_loss !== null && proc.profit_loss !== undefined && (
                        <>
                          <span className="text-muted-foreground/40 text-[10px]">•</span>
                          <span className={`text-[10px] font-bold ${proc.profit_loss >= 0 ? 'text-primary' : 'text-destructive'}`}>
                            R$ {proc.profit_loss.toFixed(2)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {proc.telegram_link && (
                  <a
                    href={proc.telegram_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
        {urgentProcs.length > 10 && (
          <p className="text-xs text-muted-foreground text-center py-1">
            + {urgentProcs.length - 10} procedimento{urgentProcs.length - 10 > 1 ? 's' : ''} pendente{urgentProcs.length - 10 > 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}

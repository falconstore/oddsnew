import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Clock, ExternalLink, X } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Procedure } from '@/types/procedures';
import { parseDate } from '@/lib/procedureUtils';

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
      if (proc.category === 'Extra' || proc.category === 'Ganhar Giros Gratis') {
        return;
      }

      const procDate = parseDate(proc.date);
      if (!procDate) return;

      const daysAgo = differenceInDays(today, procDate);
      const cleanStatus = (proc.status || '').trim().toLowerCase();

      // Falta Girar Freebet há mais de 3 dias
      if ((cleanStatus === 'falta girar freebet' || cleanStatus === 'falta girar freeebet') && daysAgo > 3) {
        urgent.push({
          ...proc,
          urgency: 'high',
          message: `Freebet pendente há ${daysAgo} dias`,
          icon: AlertCircle,
          color: 'red'
        });
      }
      // Falta Girar Freebet há 1-3 dias
      else if ((cleanStatus === 'falta girar freebet' || cleanStatus === 'falta girar freeebet') && daysAgo > 0) {
        urgent.push({
          ...proc,
          urgency: 'medium',
          message: `Freebet pendente há ${daysAgo} dia${daysAgo > 1 ? 's' : ''}`,
          icon: Clock,
          color: 'amber'
        });
      }
      // Partida em Aberto há mais de 2 dias
      else if (cleanStatus === 'enviada partida em aberto' && daysAgo > 2) {
        urgent.push({
          ...proc,
          urgency: 'high',
          message: `Partida em aberto há ${daysAgo} dias`,
          icon: AlertCircle,
          color: 'orange'
        });
      }
      // Freebet Pendente há mais de 5 dias
      else if (cleanStatus === 'freebet pendente' && daysAgo > 5) {
        urgent.push({
          ...proc,
          urgency: 'medium',
          message: `Freebet pendente há ${daysAgo} dias`,
          icon: Clock,
          color: 'yellow'
        });
      }
      // Referência Faltando há mais de 1 dia
      else if (cleanStatus === 'referência faltando' && daysAgo > 1) {
        urgent.push({
          ...proc,
          urgency: 'high',
          message: `Referência faltando há ${daysAgo} dias`,
          icon: AlertCircle,
          color: 'red'
        });
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

  const getColorClasses = (color: string) => {
    const colors: Record<string, { border: string; bg: string; text: string }> = {
      red: { border: 'border-destructive/30', bg: 'bg-destructive/20', text: 'text-destructive' },
      orange: { border: 'border-orange-500/30', bg: 'bg-orange-500/20', text: 'text-orange-400' },
      amber: { border: 'border-amber-500/30', bg: 'bg-amber-500/20', text: 'text-amber-400' },
      yellow: { border: 'border-yellow-500/30', bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
    };
    return colors[color] || colors.amber;
  };

  return (
    <Card className="border-destructive/30">
      <CardHeader className="bg-gradient-to-r from-destructive/10 to-orange-500/10">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-destructive/20 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-lg">Procedimentos Precisam de Atenção</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {highUrgency > 0 && <span className="text-destructive font-semibold">{highUrgency} urgente{highUrgency > 1 ? 's' : ''}</span>}
                {highUrgency > 0 && mediumUrgency > 0 && <span className="text-muted-foreground"> • </span>}
                {mediumUrgency > 0 && <span className="text-amber-400">{mediumUrgency} média{mediumUrgency > 1 ? 's' : ''}</span>}
              </p>
            </div>
          </div>
          {onDismiss && (
            <Button variant="ghost" size="icon" onClick={onDismiss}>
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-3">
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {urgentProcs.slice(0, 10).map((proc) => {
            const Icon = proc.icon;
            const colors = getColorClasses(proc.color);
            const procDate = parseDate(proc.date);
            
            return (
              <div
                key={proc.id}
                className={`bg-card rounded-lg p-3 border ${colors.border} hover:bg-accent/50 transition-all cursor-pointer`}
                onClick={() => onProcedureClick?.(proc)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 flex-1">
                    <div className={`mt-0.5 w-6 h-6 rounded-md flex items-center justify-center ${colors.bg}`}>
                      <Icon className={`w-3 h-3 ${colors.text}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-sm">#{proc.procedure_number}</h4>
                        <Badge variant="outline" className="text-xs">
                          {proc.platform}
                        </Badge>
                      </div>
                      <p className={`text-sm font-medium ${colors.text}`}>
                        {proc.message}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        <span>Status: {proc.status}</span>
                        <span>•</span>
                        <span>Data: {procDate ? format(procDate, 'dd/MM/yyyy', { locale: ptBR }) : '-'}</span>
                        {proc.freebet_value && (
                          <>
                            <span>•</span>
                            <span className="text-purple-400">Freebet: R$ {proc.freebet_value.toFixed(2)}</span>
                          </>
                        )}
                        {proc.profit_loss !== null && proc.profit_loss !== undefined && (
                          <>
                            <span>•</span>
                            <span className={proc.profit_loss >= 0 ? 'text-success font-semibold' : 'text-destructive font-semibold'}>
                              L/P: R$ {proc.profit_loss.toFixed(2)}
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
                      className="text-primary hover:text-primary/80 mt-1"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {urgentProcs.length > 10 && (
          <p className="text-xs text-muted-foreground text-center mt-3">
            E mais {urgentProcs.length - 10} procedimento{urgentProcs.length - 10 > 1 ? 's' : ''} pendente{urgentProcs.length - 10 > 1 ? 's' : ''}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

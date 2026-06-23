import { useState } from 'react';
import { differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ClipboardCheck, ChevronDown, ChevronUp,
  ExternalLink, Clock, AlertCircle, Gift, Zap,
} from 'lucide-react';
import { Procedure } from '@/types/procedures';
import { canCheckResult } from '@/lib/procedureGameTime';
import { parseDate } from '@/lib/procedureUtils';
import { cn } from '@/lib/utils';

interface FilaConferenciaProps {
  procedures: Procedure[];
  onCheckResult: (proc: Procedure) => void;
}

type Urgency = 'high' | 'medium' | 'low';
type TipoFila = 'conferir' | 'falta_girar' | 'aberto';

interface FilaItem {
  proc: Procedure;
  urgency: Urgency;
  motivo: string;
  daysAgo: number;
  tipo: TipoFila;
}

function buildFila(procedures: Procedure[]): FilaItem[] {
  const today = new Date();
  const items: FilaItem[] = [];

  for (const proc of procedures) {
    if (proc.archived || proc.tachado) continue;
    const procDate = parseDate(proc.date);
    const daysAgo = procDate ? differenceInDays(today, procDate) : 0;
    const cleanStatus = (proc.status || '').trim().toLowerCase();

    // Caso 1: "Enviado" com partida já encerrada (precisa definir resultado)
    if (
      cleanStatus === 'enviado' &&
      (proc.profit_loss === 0 || proc.profit_loss === null) &&
      canCheckResult(proc, today)
    ) {
      items.push({
        proc,
        urgency: daysAgo > 1 ? 'high' : 'medium',
        motivo: daysAgo > 0
          ? `Resultado não definido há ${daysAgo} dia${daysAgo > 1 ? 's' : ''}`
          : 'Partida encerrada — definir resultado',
        daysAgo,
        tipo: 'conferir',
      });
      continue;
    }

    // Caso 2: Aguardando Resultado (jogo encerrado — transição automática pós-kickoff+150min)
    if (cleanStatus === 'aguardando resultado') {
      items.push({
        proc,
        urgency: daysAgo > 1 ? 'high' : 'medium',
        motivo: daysAgo > 0
          ? `Aguardando resultado há ${daysAgo} dia${daysAgo > 1 ? 's' : ''}`
          : 'Jogo encerrado — definir resultado',
        daysAgo,
        tipo: 'conferir',
      });
      continue;
    }

    // Caso 3: Partida em aberto (status intermediário ou legado)
    if (cleanStatus === 'enviada partida em aberto') {
      items.push({
        proc,
        urgency: daysAgo > 2 ? 'high' : daysAgo > 0 ? 'medium' : 'low',
        motivo: daysAgo > 0
          ? `Partida em aberto há ${daysAgo} dia${daysAgo > 1 ? 's' : ''}`
          : 'Partida em aberto — aguardando resultado',
        daysAgo,
        tipo: 'aberto',
      });
      continue;
    }

    // Caso 4: Falta Girar Freebet
    if (cleanStatus === 'falta girar freebet' || cleanStatus === 'falta girar freeebet') {
      items.push({
        proc,
        urgency: daysAgo > 3 ? 'high' : daysAgo > 0 ? 'medium' : 'low',
        motivo: daysAgo > 0
          ? `Freebet não queimada há ${daysAgo} dia${daysAgo > 1 ? 's' : ''}`
          : 'Freebet creditada — queimar hoje',
        daysAgo,
        tipo: 'falta_girar',
      });
    }
  }

  // Ordenação: high → medium → low; dentro do grupo, mais antigo primeiro
  const order: Record<Urgency, number> = { high: 0, medium: 1, low: 2 };
  return items.sort((a, b) => {
    const ou = order[a.urgency] - order[b.urgency];
    if (ou !== 0) return ou;
    return b.daysAgo - a.daysAgo;
  });
}

const urgencyStyle: Record<Urgency, { border: string; bg: string; iconCls: string; badge: string }> = {
  high:   { border: 'border-destructive/30',   bg: 'bg-destructive/8',   iconCls: 'text-destructive',   badge: 'bg-destructive/20 text-destructive border-destructive/30' },
  medium: { border: 'border-warning/25', bg: 'bg-warning/6', iconCls: 'text-warning', badge: 'bg-warning/20 text-warning border-warning/30' },
  low:    { border: 'border-primary/20',   bg: 'bg-primary/5',   iconCls: 'text-primary',   badge: 'bg-primary/15 text-primary border-primary/25' },
};

const tipoMeta: Record<TipoFila, { Icon: typeof ClipboardCheck; label: string }> = {
  conferir:    { Icon: ClipboardCheck, label: 'Conferir' },
  falta_girar: { Icon: Gift,           label: 'FB Pendente' },
  aberto:      { Icon: Clock,          label: 'Em Aberto' },
};

export function FilaConferencia({ procedures, onCheckResult }: FilaConferenciaProps) {
  const [collapsed, setCollapsed] = useState(false);

  const fila = buildFila(procedures);
  if (fila.length === 0) return null;

  const highCount  = fila.filter(i => i.urgency === 'high').length;
  const totalCount = fila.length;

  return (
    <div className="rounded-2xl border border-warning/20 overflow-hidden">
      {/* ── Header colapsável ── */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full text-left bg-card p-4 flex justify-between items-center border-b border-warning/15 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-warning/20 rounded-xl flex items-center justify-center shadow-lg shadow-warning/15">
            <ClipboardCheck className="w-4.5 h-4.5 text-warning" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-sm text-foreground">Fila de Conferência</h3>
              <Badge className="bg-warning/20 text-warning border border-warning/30 text-[10px] px-1.5 py-0 font-bold">
                {totalCount}
              </Badge>
              {highCount > 0 && (
                <Badge className="bg-destructive/20 text-destructive border border-destructive/30 text-[10px] px-1.5 py-0 font-bold flex items-center gap-1">
                  <AlertCircle className="w-2.5 h-2.5" />
                  {highCount} urgente{highCount > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Procedimentos aguardando resultado ou ação
            </p>
          </div>
        </div>
        {collapsed
          ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          : <ChevronUp   className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        }
      </button>

      {/* ── Lista ── */}
      {!collapsed && (
        <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
          {fila.map(({ proc, urgency, motivo, tipo }) => {
            const s = urgencyStyle[urgency];
            const { Icon } = tipoMeta[tipo];
            const procDate = parseDate(proc.date);

            return (
              <div
                key={proc.id}
                className={cn('flex items-center gap-3 px-4 py-3 transition-all hover:brightness-110', s.bg)}
              >
                {/* Ícone */}
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-black/20">
                  <Icon className={cn('w-3.5 h-3.5', s.iconCls)} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="font-bold text-sm text-foreground">#{proc.procedure_number}</span>
                    <Badge variant="outline" className="border-white/15 text-muted-foreground text-[10px] px-1.5 py-0">
                      {proc.platform}
                    </Badge>
                    {proc.freebet_value != null && Number(proc.freebet_value) > 0 && (
                      <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-0.5">
                        <Gift className="w-2.5 h-2.5" />
                        R${Number(proc.freebet_value).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] flex-wrap">
                    <span className={cn('font-semibold', s.iconCls)}>{motivo}</span>
                    {proc.partida_descricao && (
                      <>
                        <span className="text-muted-foreground/30">·</span>
                        <span className="text-muted-foreground truncate max-w-[160px]">{proc.partida_descricao}</span>
                      </>
                    )}
                    {procDate && (
                      <>
                        <span className="text-muted-foreground/30">·</span>
                        <span className="text-muted-foreground">{format(procDate, 'dd/MM', { locale: ptBR })}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {proc.telegram_link && (
                    <a
                      href={proc.telegram_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      title="Ver post no Telegram"
                      className="text-muted-foreground hover:text-foreground transition-colors p-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {tipo !== 'falta_girar' ? (
                    <Button
                      size="sm"
                      onClick={() => onCheckResult(proc)}
                      className="h-7 px-3 text-[11px] font-semibold bg-warning/20 hover:bg-warning/35 text-warning border border-warning/30 hover:border-warning/50"
                    >
                      <Zap className="w-3 h-3 mr-1" />
                      Conferir
                    </Button>
                  ) : (
                    <Badge className="border border-border text-muted-foreground text-[10px] px-2 py-0.5">
                      Queimar FB
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

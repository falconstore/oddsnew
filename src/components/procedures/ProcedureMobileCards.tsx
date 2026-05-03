import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, Pencil, Trash2, ExternalLink, Tag, Calendar, Building2, Archive, ArchiveRestore, Trophy, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Procedure } from '@/types/procedures';
import { formatProcedureDate, translateCategory } from '@/lib/procedureUtils';
import { canCheckResult } from '@/lib/procedureGameTime';
import { KickoffBadge } from './KickoffBadge';
import { StatusActionToggles } from './StatusActionToggles';

interface ProcedureMobileCardsProps {
  procedures: Procedure[];
  onEdit?: (proc: Procedure) => void;
  onDelete?: (id: string) => void;
  onToggleFavorite: (proc: Procedure) => void;
  onArchive?: (proc: Procedure) => void;
  onCheckResult?: (proc: Procedure) => void;
}

export function ProcedureMobileCards({ procedures, onEdit, onDelete, onToggleFavorite, onArchive, onCheckResult }: ProcedureMobileCardsProps) {
  const getStatusBadge = (status: string) => {
    if (status === 'Concluído' || status === 'Lucro Direto') {
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    }
    if (
      status === 'Enviada partida em Aberto' ||
      status === 'Freebet Pendente' ||
      status === 'Falta Girar Freebet' ||
      status === 'Falta Girar Freeebet'
    ) {
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    }
    return 'bg-primary/20 text-primary border-primary/30';
  };

  return (
    <div className="lg:hidden space-y-3">
      {procedures.map((proc) => {
        const showCheck = onCheckResult && canCheckResult(proc) && !proc.archived;
        return (
        <div
          key={proc.id}
          data-testid={`card-procedure-${proc.id}`}
          className={`glass rounded-2xl border p-4 card-hover overflow-hidden ${proc.archived ? 'border-white/5 opacity-60' : 'border-white/5'} ${proc.tachado ? 'opacity-50 grayscale' : ''}`}
        >
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-start gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleFavorite(proc)}
                className={`p-1 h-auto ${proc.is_favorite ? 'text-yellow-400' : 'text-muted-foreground/40'}`}
              >
                <Star className={`w-4 h-4 ${proc.is_favorite ? 'fill-yellow-400' : ''}`} />
              </Button>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-bold gradient-text">#{proc.procedure_number}</span>
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-[10px] px-1.5 py-0">
                    {translateCategory(proc.category)}
                  </Badge>
                  {proc.archived && (
                    <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground text-[10px] px-1.5 py-0">
                      <Archive className="w-2.5 h-2.5 mr-1" /> Arquivado
                    </Badge>
                  )}
                  {proc.freebetpro_synced_at && !proc.freebetpro_last_error && (
                    <span
                      title={`Sincronizado com FreeBet Pro${proc.freebetpro_numero ? ` (#${proc.freebetpro_numero})` : ''}`}
                      data-testid={`icon-fbp-synced-mobile-${proc.id}`}
                      className="inline-flex"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/70" />
                    </span>
                  )}
                  {proc.freebetpro_last_error && (
                    <span
                      title={`Erro FreeBet Pro: ${proc.freebetpro_last_error}`}
                      data-testid={`icon-fbp-error-mobile-${proc.id}`}
                      className="inline-flex"
                    >
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400/80" />
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> {proc.platform}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {formatProcedureDate(proc.date)}
                  </span>
                  {proc.partida_descricao && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {proc.partida_descricao}
                    </span>
                  )}
                  <KickoffBadge procedure={proc} />
                </div>
              </div>
            </div>
            {proc.telegram_link && (
              <a href={proc.telegram_link} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 transition-colors">
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div className="bg-white/[0.03] rounded-xl p-2.5 border border-white/5">
              <p className="text-muted-foreground mb-1">Status</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge className={`text-[10px] px-1.5 py-0 border font-medium ${getStatusBadge(proc.status)}`}>
                  {proc.status}
                </Badge>
                <StatusActionToggles procedure={proc} />
              </div>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-2.5 border border-white/5">
              <p className="text-muted-foreground mb-1">Lucro/Prejuízo</p>
              <span className={`font-bold text-sm ${proc.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {proc.profit_loss >= 0 ? '+' : ''}R$ {proc.profit_loss?.toFixed(2)}
              </span>
            </div>
            {proc.freebet_value && (
              <div className="bg-white/[0.03] rounded-xl p-2.5 border border-white/5">
                <p className="text-muted-foreground mb-1">Freebet</p>
                <span className="text-purple-400 font-bold text-sm">R$ {proc.freebet_value.toFixed(2)}</span>
              </div>
            )}
            {proc.dp && (
              <div className="bg-white/[0.03] rounded-xl p-2.5 border border-emerald-500/20">
                <p className="text-muted-foreground mb-1">DP</p>
                <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] px-1.5 py-0">✓ Duplo Green</Badge>
              </div>
            )}
            {proc.promotion_name && (
              <div className="bg-white/[0.03] rounded-xl p-2.5 border border-white/5 col-span-2">
                <p className="text-muted-foreground mb-1">Promoção</p>
                <span className="text-foreground truncate">{proc.promotion_name}</span>
              </div>
            )}
          </div>

          {proc.tags && proc.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {proc.tags.map((tag, idx) => (
                <Badge key={idx} variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] px-1.5 py-0">
                  <Tag className="w-3 h-3 mr-1" />{tag}
                </Badge>
              ))}
            </div>
          )}

          {(onEdit || onDelete || onArchive || showCheck) && (
            <div className="flex gap-2 pt-3 border-t border-white/5 flex-wrap">
              {showCheck && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCheckResult!(proc)}
                  data-testid={`button-conferir-mobile-${proc.id}`}
                  className="flex-1 h-8 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                >
                  <Trophy className="w-3.5 h-3.5 mr-1.5" />
                  Conferir
                </Button>
              )}
              {onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(proc)}
                  data-testid={`button-edit-mobile-${proc.id}`}
                  className="flex-1 h-8 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300"
                >
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  Editar
                </Button>
              )}
              {onArchive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onArchive(proc)}
                  data-testid={`button-archive-mobile-${proc.id}`}
                  className="flex-1 h-8 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
                >
                  {proc.archived ? <><ArchiveRestore className="w-3.5 h-3.5 mr-1.5" />Restaurar</> : <><Archive className="w-3.5 h-3.5 mr-1.5" />Arquivar</>}
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(proc.id)}
                  data-testid={`button-delete-mobile-${proc.id}`}
                  className="flex-1 h-8 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Excluir
                </Button>
              )}
            </div>
          )}
        </div>
      );})}
    </div>
  );
}

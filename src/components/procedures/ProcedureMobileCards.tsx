import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Star, Pencil, Trash2, ExternalLink, Tag, Calendar, Building2, Archive, ArchiveRestore, Trophy, Clock, CheckCircle2, AlertCircle, ShieldCheck, AlertTriangle, ShieldAlert, Timer } from 'lucide-react';
import { Procedure } from '@/types/procedures';
import { formatProcedureDate, translateCategory, getDisplayProfitLoss, getCategoryBadgeClass } from '@/lib/procedureUtils';
import { canCheckResult } from '@/lib/procedureGameTime';
import { KickoffBadge } from './KickoffBadge';
import { StatusActionToggles } from './StatusActionToggles';
import { LucroMaximoTooltip } from './LucroMaximoTooltip';

interface ProcedureMobileCardsProps {
  procedures: Procedure[];
  /** Map id→Procedure (lista FULL) usado pra calcular L/P máximo da QUEIMAR_FB com déficit das origens. */
  proceduresById?: Map<string, Procedure>;
  onEdit?: (proc: Procedure) => void;
  onDelete?: (id: string) => void;
  onToggleFavorite: (proc: Procedure) => void;
  onArchive?: (proc: Procedure) => void;
  onCheckResult?: (proc: Procedure) => void;
  onConfirmBot?: (id: string) => void;
}

export function ProcedureMobileCards({ procedures, proceduresById, onEdit, onDelete, onToggleFavorite, onArchive, onCheckResult, onConfirmBot }: ProcedureMobileCardsProps) {
  const getStatusBadge = (status: string) => {
    if (status === 'Concluído' || status === 'Lucro Direto') {
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    }
    if (status === 'Aguardando Resultado') {
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    }
    if (
      status === 'Enviada partida em Aberto' ||
      status === 'Enviada Partida em Aberto' ||
      status === 'Freebet Pendente' ||
      status === 'Falta Girar Freebet' ||
      status === 'Falta Girar Freeebet'
    ) {
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    }
    return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  };

  return (
    <TooltipProvider delayDuration={200}>
    <div className="lg:hidden space-y-3">
      {procedures.map((proc) => {
        const showCheck = onCheckResult && canCheckResult(proc) && !proc.archived;
        const hasIncomplete = proc.bot_needs_review && proc.bot_missing_fields && proc.bot_missing_fields.length > 0;
        const needsReviewOnly = proc.bot_needs_review && (!proc.bot_missing_fields || proc.bot_missing_fields.length === 0);
        return (
        <div
          key={proc.id}
          data-testid={`card-procedure-${proc.id}`}
          className={`glass rounded-2xl border p-4 card-hover overflow-hidden ${proc.archived ? 'border-white/5 opacity-60' : hasIncomplete ? 'border-orange-500/30' : needsReviewOnly ? 'border-yellow-500/20' : 'border-white/5'} ${proc.tachado ? 'opacity-50 grayscale' : ''}`}
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
                  <Badge variant="outline" className={`${getCategoryBadgeClass(proc.category)} text-[10px] px-1.5 py-0`}>
                    {translateCategory(proc.category)}
                  </Badge>
                  {proc.is_extra && (
                    <Badge
                      data-testid={`badge-extra-mobile-${proc.id}`}
                      className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] px-1.5 py-0 font-bold uppercase tracking-wide"
                    >
                      EXTRA
                    </Badge>
                  )}
                  {proc.archived && (
                    <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground text-[10px] px-1.5 py-0">
                      <Archive className="w-2.5 h-2.5 mr-1" /> Arquivado
                    </Badge>
                  )}
                  {hasIncomplete && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          data-testid={`badge-bot-incomplete-${proc.id}`}
                          className="bg-orange-500/15 text-orange-400 border border-orange-500/30 text-[10px] px-1.5 py-0 cursor-help gap-1"
                        >
                          <AlertTriangle className="w-2.5 h-2.5" />
                          INCOMPLETO
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="text-orange-300 font-semibold text-[11px] mb-0.5">Campos em falta:</p>
                        <p className="text-[11px]">{proc.bot_missing_fields!.join(', ')}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {needsReviewOnly && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          data-testid={`badge-bot-review-${proc.id}`}
                          className="bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 text-[10px] px-1.5 py-0 cursor-help gap-1"
                        >
                          <ShieldAlert className="w-2.5 h-2.5" />
                          VERIFICAR
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="text-yellow-300 font-semibold text-[11px] mb-0.5">Registrado pelo bot</p>
                        <p className="text-[11px]">Confirme se os dados (jogo, data, casa) estão corretos.</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {proc.freebetpro_synced_at && !proc.freebetpro_last_error && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span data-testid={`icon-fbp-synced-mobile-${proc.id}`} tabIndex={0} className="inline-flex cursor-help">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/70" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>Sincronizado com FreeBet Pro{proc.freebetpro_numero ? ` (#${proc.freebetpro_numero})` : ''}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {proc.freebetpro_last_error && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span data-testid={`icon-fbp-error-mobile-${proc.id}`} tabIndex={0} className="inline-flex cursor-help">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-400/80" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="text-amber-300">Erro FreeBet Pro: {proc.freebetpro_last_error}</p>
                      </TooltipContent>
                    </Tooltip>
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
                <Badge className={`text-[10px] px-1.5 py-0 border font-medium inline-flex items-center gap-1 ${getStatusBadge(proc.status)}`}>
                  {proc.status === 'Aguardando Resultado' && <Timer className="w-2.5 h-2.5 flex-shrink-0" />}
                  {proc.status}
                </Badge>
                <StatusActionToggles procedure={proc} />
              </div>
            </div>
            {(() => {
              const dpl = getDisplayProfitLoss(proc, proceduresById);
              // Settled vs previsto deve ser decidido pelo LÍQUIDO cru (profit_loss),
              // não pelo effective — pois effective = liquid + déficit das origens,
              // então pode ser != 0 mesmo com jogo ainda em aberto (liquid=0).
              const showEffective = dpl.liquidEffective !== 0;
              const showPrevisto = !showEffective && dpl.previsto !== 0;
              return (
                <div className="bg-white/[0.03] rounded-xl p-2.5 border border-white/5">
                  <p className="text-muted-foreground mb-1">
                    Lucro/Prejuízo
                    {dpl.isGross && <span className="ml-1 text-[9px] text-emerald-400/70">(máx)</span>}
                  </p>
                  {showEffective ? (
                    <LucroMaximoTooltip dpl={dpl} liquid={dpl.liquidEffective} total={dpl.effective}>
                      <span className={`font-bold text-sm ${dpl.effective >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {dpl.effective >= 0 ? '+' : ''}R$ {dpl.effective.toFixed(2)}
                      </span>
                    </LucroMaximoTooltip>
                  ) : showPrevisto ? (
                    <LucroMaximoTooltip dpl={dpl} liquid={dpl.liquidPrevisto} total={dpl.previsto} isPrevisto>
                      <span className="text-sm text-muted-foreground/50 font-medium">
                        ~R$ {dpl.previsto.toFixed(2)}
                      </span>
                    </LucroMaximoTooltip>
                  ) : (
                    <span className="font-bold text-sm text-emerald-400">+R$ 0.00</span>
                  )}
                </div>
              );
            })()}
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

          {(onEdit || onDelete || onArchive || showCheck || (proc.bot_needs_review && onConfirmBot)) && (
            <div className="flex gap-2 pt-3 border-t border-white/5 flex-wrap">
              {proc.bot_needs_review && !proc.archived && onConfirmBot && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onConfirmBot(proc.id)}
                  data-testid={`button-confirm-bot-mobile-${proc.id}`}
                  className={`flex-1 h-8 ${hasIncomplete ? 'border-orange-500/30 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300' : 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 hover:text-yellow-300'}`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                  {hasIncomplete ? 'Confirmar (incompleto)' : 'Confirmar dados'}
                </Button>
              )}
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
    </TooltipProvider>
  );
}

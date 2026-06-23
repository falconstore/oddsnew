import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Star, Pencil, Trash2, ExternalLink, Tag, Archive, ArchiveRestore, Trophy, CheckCircle2, AlertCircle, Timer } from 'lucide-react';
import { Procedure } from '@/types/procedures';
import { formatProcedureDate, translateCategory, getDisplayProfitLoss, getCategoryBadgeClass } from '@/lib/procedureUtils';
import { canCheckResult } from '@/lib/procedureGameTime';
import { KickoffBadge } from './KickoffBadge';
import { StatusActionToggles } from './StatusActionToggles';
import { ActionButton, ActionGroup } from '@/components/ui/action-button';
import { LucroMaximoTooltip } from './LucroMaximoTooltip';

interface ProcedureTableProps {
  procedures: Procedure[];
  /** Map id→Procedure (lista FULL) usado pra calcular L/P máximo da QUEIMAR_FB com déficit das origens. */
  proceduresById?: Map<string, Procedure>;
  visibleColumns: string[];
  onEdit?: (proc: Procedure) => void;
  onDelete?: (id: string) => void;
  onToggleFavorite: (proc: Procedure) => void;
  onArchive?: (proc: Procedure) => void;
  onCheckResult?: (proc: Procedure) => void;
}

export function ProcedureTable({ procedures, proceduresById, visibleColumns, onEdit, onDelete, onToggleFavorite, onArchive, onCheckResult }: ProcedureTableProps) {
  const getStatusBadge = (status: string) => {
    if (status === 'Concluído' || status === 'Lucro Direto') {
      return 'bg-primary/20 text-primary border-primary/30';
    }
    if (status === 'Aguardando Resultado') {
      return 'bg-warning/20 text-warning border-warning/30';
    }
    if (
      status === 'Enviada partida em Aberto' ||
      status === 'Enviada Partida em Aberto' ||
      status === 'Freebet Pendente' ||
      status === 'Falta Girar Freebet' ||
      status === 'Falta Girar Freeebet'
    ) {
      return 'bg-warning/20 text-warning border-warning/30';
    }
    return 'bg-muted text-muted-foreground border-border';
  };

  return (
    <TooltipProvider delayDuration={200}>
    <div className="hidden lg:block overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-white/5 hover:bg-transparent">
            <TableHead className="w-8 px-2"></TableHead>
            {visibleColumns.includes('date') && <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2">Data</TableHead>}
            {visibleColumns.includes('procedure_number') && <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2">Nº</TableHead>}
            {visibleColumns.includes('platform') && <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2">Plataforma</TableHead>}
            {visibleColumns.includes('promotion_name') && <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2">Promoção</TableHead>}
            {visibleColumns.includes('partida_descricao') && <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2">Evento</TableHead>}
            {visibleColumns.includes('category') && <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2">Categoria</TableHead>}
            {visibleColumns.includes('status') && <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2">Status</TableHead>}
            {visibleColumns.includes('freebet_reference') && <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2">Ref. FB</TableHead>}
            {visibleColumns.includes('freebet_value') && <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 text-right">Freebet</TableHead>}
            {visibleColumns.includes('profit_loss') && <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 text-right">L/P</TableHead>}
            {visibleColumns.includes('tags') && <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2">Tags</TableHead>}
            {visibleColumns.includes('telegram_link') && <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2">Link</TableHead>}
            {visibleColumns.includes('dp') && <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2">DP</TableHead>}
            {visibleColumns.includes('actions') && <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2">Ações</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {procedures.flatMap((proc, idx) => {
            const showCheck = onCheckResult && canCheckResult(proc) && !proc.archived;
            const prevDate = idx > 0 ? procedures[idx - 1].date : null;
            const showSeparator = idx === 0 || proc.date !== prevDate;
            const rows = [];
            if (showSeparator) {
              rows.push(
                <TableRow key={`sep-${proc.date}-${idx}`} className="border-0 hover:bg-transparent">
                  <TableCell colSpan={20} className="py-0 px-0">
                    <div className="flex items-center gap-2 px-2 pt-2 pb-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                        {formatProcedureDate(proc.date)}
                      </span>
                      <div className="flex-1 h-px bg-white/5" />
                    </div>
                  </TableCell>
                </TableRow>
              );
            }
            rows.push(
            <TableRow
              key={proc.id}
              data-testid={`row-procedure-${proc.id}`}
              className={`border-white/5 ${idx % 2 === 0 ? 'bg-white/[0.025]' : 'bg-transparent'} hover:bg-white/[0.06] transition-colors group ${proc.archived ? 'opacity-50' : ''} ${proc.tachado ? 'opacity-50 grayscale' : ''}`}
            >
              <TableCell className="w-8 py-2 px-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onToggleFavorite(proc)}
                  data-testid={`button-favorite-${proc.id}`}
                  className={`h-6 w-6 p-0 transition-colors ${proc.is_favorite ? 'text-warning' : 'text-muted-foreground/40 group-hover:text-muted-foreground'}`}
                >
                  <Star className={`w-3.5 h-3.5 ${proc.is_favorite ? 'fill-warning' : ''}`} />
                </Button>
              </TableCell>
              {visibleColumns.includes('date') && (
                <TableCell className="text-xs text-muted-foreground py-2 px-2">{formatProcedureDate(proc.date)}</TableCell>
              )}
              {visibleColumns.includes('procedure_number') && (
                <TableCell className="py-2 px-2">
                  <span className="text-sm font-bold font-mono text-foreground">{proc.procedure_number}</span>
                  {proc.archived && <Archive className="w-3 h-3 inline ml-1 text-muted-foreground/60" />}
                  {proc.freebetpro_synced_at && !proc.freebetpro_last_error && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span data-testid={`icon-fbp-synced-${proc.id}`} tabIndex={0} className="inline-flex ml-1 cursor-help">
                          <CheckCircle2 className="w-3 h-3 text-primary/70" />
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
                        <span data-testid={`icon-fbp-error-${proc.id}`} tabIndex={0} className="inline-flex ml-1 cursor-help">
                          <AlertCircle className="w-3 h-3 text-warning/80" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="text-warning">Erro FreeBet Pro: {proc.freebetpro_last_error}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </TableCell>
              )}
              {visibleColumns.includes('platform') && (
                <TableCell className="text-xs text-muted-foreground py-2 px-2 max-w-[80px] truncate">{proc.platform}</TableCell>
              )}
              {visibleColumns.includes('promotion_name') && (
                <TableCell className="text-xs text-muted-foreground py-2 px-2 max-w-[100px] truncate">{proc.promotion_name || '—'}</TableCell>
              )}
              {visibleColumns.includes('partida_descricao') && (
                <TableCell className="text-xs text-muted-foreground py-2 px-2 max-w-[160px]">
                  {proc.partida_descricao ? (
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="truncate" title={`${proc.data_partida || ''} ${proc.horario_partida || ''}`.trim()}>
                        {proc.partida_descricao}
                      </span>
                      <KickoffBadge procedure={proc} />
                    </div>
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </TableCell>
              )}
              {visibleColumns.includes('category') && (
                <TableCell className="py-2 px-2">
                  <div className="flex items-center gap-1 flex-wrap">
                    <Badge variant="outline" className={`${getCategoryBadgeClass(proc.category)} text-[10px] px-1.5 py-0 font-medium`}>
                      {translateCategory(proc.category)}
                    </Badge>
                    {proc.is_extra && (
                      <span data-testid={`badge-extra-${proc.id}`} className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-bold uppercase tracking-wide bg-warning/15 text-warning border border-warning/30">
                        EXTRA
                      </span>
                    )}
                  </div>
                </TableCell>
              )}
              {visibleColumns.includes('status') && (
                <TableCell className="py-2 px-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge className={`text-[10px] px-1.5 py-0 border font-medium inline-flex items-center gap-1 ${getStatusBadge(proc.status)}`}>
                      {proc.status === 'Aguardando Resultado' && <Timer className="w-2.5 h-2.5 flex-shrink-0" />}
                      {proc.status}
                    </Badge>
                  </div>
                </TableCell>
              )}
              {visibleColumns.includes('freebet_reference') && (
                <TableCell className="text-xs text-muted-foreground py-2 px-2 max-w-[60px] truncate">{proc.freebet_reference || '—'}</TableCell>
              )}
              {visibleColumns.includes('freebet_value') && (
                <TableCell className="py-2 px-2 text-right">
                  {proc.freebet_value ? (
                    <span className="text-foreground font-semibold font-mono tabular-nums text-xs">R$ {proc.freebet_value.toFixed(2)}</span>
                  ) : (
                    <span className="text-muted-foreground/40 text-xs">—</span>
                  )}
                </TableCell>
              )}
              {visibleColumns.includes('profit_loss') && (() => {
                const dpl = getDisplayProfitLoss(proc, proceduresById);
                // Procedimento finalizado (Concluído/Lucro Direto): trata o valor
                // como REALIZADO (verde/vermelho, sem "~"), mesmo que só tenha o
                // previsto — o resultado já está definido pelo status.
                const isFinalized = proc.status === 'Concluído' || proc.status === 'Lucro Direto';
                // Settled vs previsto deve ser decidido pelo LÍQUIDO cru (profit_loss),
                // não pelo effective — pois effective = liquid + déficit das origens,
                // então pode ser != 0 mesmo com jogo ainda em aberto (liquid=0).
                const showEffective = isFinalized || dpl.liquidEffective !== 0;
                const showPrevisto = !showEffective && dpl.previsto !== 0;
                // Quando finalizado sem resultado realizado, effective pode ser 0;
                // usa o previsto como valor exibido (já que o status diz finalizado).
                const valorFinal = (isFinalized && dpl.liquidEffective === 0) ? dpl.previsto : dpl.effective;
                return (
                  <TableCell className="py-2 px-2 text-right">
                    {showEffective ? (
                      <LucroMaximoTooltip dpl={dpl} liquid={dpl.liquidEffective} total={dpl.effective}>
                        <span className={`text-xs font-bold font-mono tabular-nums ${valorFinal >= 0 ? 'text-primary' : 'text-destructive'} ${dpl.isGross ? 'underline decoration-dotted decoration-primary/40 underline-offset-2' : ''}`}>
                          {valorFinal >= 0 ? '+' : ''}R$ {valorFinal.toFixed(2)}
                        </span>
                      </LucroMaximoTooltip>
                    ) : showPrevisto ? (
                      <LucroMaximoTooltip dpl={dpl} liquid={dpl.liquidPrevisto} total={dpl.previsto} isPrevisto>
                        <span
                          className={`text-xs text-muted-foreground/50 font-medium font-mono tabular-nums ${dpl.isGross ? 'underline decoration-dotted underline-offset-2' : ''}`}
                          title={dpl.isGross ? undefined : 'Lucro previsto (resultado ainda não definido)'}
                        >
                          ~R$ {dpl.previsto.toFixed(2)}
                        </span>
                      </LucroMaximoTooltip>
                    ) : (
                      <span className="text-xs font-bold font-mono tabular-nums text-primary">+R$ 0.00</span>
                    )}
                  </TableCell>
                );
              })()}
              {visibleColumns.includes('tags') && (
                <TableCell className="py-2 px-2">
                  <div className="flex flex-wrap gap-0.5">
                    {proc.tags && proc.tags.length > 0 ? (
                      proc.tags.slice(0, 2).map((tag, idx) => (
                        <Badge key={idx} variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] px-1 py-0">
                          <Tag className="w-2.5 h-2.5 mr-0.5" />{tag}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground/40 text-xs">—</span>
                    )}
                    {proc.tags && proc.tags.length > 2 && (
                      <span className="text-[10px] text-muted-foreground">+{proc.tags.length - 2}</span>
                    )}
                  </div>
                </TableCell>
              )}
              {visibleColumns.includes('telegram_link') && (
                <TableCell className="py-2 px-2">
                  {proc.telegram_link ? (
                    <a href={proc.telegram_link} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground/40 text-xs">—</span>
                  )}
                </TableCell>
              )}
              {visibleColumns.includes('dp') && (
                <TableCell className="py-2 px-2">
                  {proc.dp ? (
                    <Badge className="bg-primary/20 text-primary border border-primary/30 text-[10px] px-1.5 py-0">✓ DP</Badge>
                  ) : (
                    <span className="text-muted-foreground/40 text-xs">—</span>
                  )}
                </TableCell>
              )}
              {visibleColumns.includes('actions') && (
                <TableCell className="py-2 px-2">
                  <ActionGroup>
                      {/* Tachar + Reenviar (antes na coluna Status) — agora sempre visíveis aqui */}
                      <StatusActionToggles procedure={proc} />
                      {showCheck && (
                        <ActionButton
                          icon={Trophy}
                          intent="confirm"
                          label="Conferir resultado"
                          onClick={() => onCheckResult!(proc)}
                          data-testid={`button-conferir-${proc.id}`}
                        />
                      )}
                      {onEdit && (
                        <ActionButton
                          icon={Pencil}
                          intent="edit"
                          label="Editar"
                          onClick={() => onEdit(proc)}
                          data-testid={`button-edit-${proc.id}`}
                        />
                      )}
                      {onArchive && (
                        <ActionButton
                          icon={proc.archived ? ArchiveRestore : Archive}
                          intent="archive"
                          label={proc.archived ? 'Restaurar' : 'Arquivar'}
                          onClick={() => onArchive(proc)}
                          data-testid={`button-archive-${proc.id}`}
                        />
                      )}
                      {onDelete && (
                        <ActionButton
                          icon={Trash2}
                          intent="delete"
                          label="Excluir"
                          onClick={() => onDelete(proc.id)}
                          data-testid={`button-delete-${proc.id}`}
                        />
                      )}
                  </ActionGroup>
                </TableCell>
              )}
            </TableRow>
            );
            return rows;
          })}
        </TableBody>
      </Table>
    </div>
    </TooltipProvider>
  );
}

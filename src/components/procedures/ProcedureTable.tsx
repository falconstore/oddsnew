import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, Pencil, Trash2, ExternalLink, Tag, Archive, ArchiveRestore, Trophy } from 'lucide-react';
import { Procedure } from '@/types/procedures';
import { formatProcedureDate, translateCategory } from '@/lib/procedureUtils';
import { canCheckResult } from '@/lib/procedureGameTime';

interface ProcedureTableProps {
  procedures: Procedure[];
  visibleColumns: string[];
  onEdit?: (proc: Procedure) => void;
  onDelete?: (id: string) => void;
  onToggleFavorite: (proc: Procedure) => void;
  onArchive?: (proc: Procedure) => void;
  onCheckResult?: (proc: Procedure) => void;
}

export function ProcedureTable({ procedures, visibleColumns, onEdit, onDelete, onToggleFavorite, onArchive, onCheckResult }: ProcedureTableProps) {
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
            {visibleColumns.includes('freebet_value') && <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2">Freebet</TableHead>}
            {visibleColumns.includes('profit_loss') && <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2">L/P</TableHead>}
            {visibleColumns.includes('tags') && <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2">Tags</TableHead>}
            {visibleColumns.includes('telegram_link') && <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2">Link</TableHead>}
            {visibleColumns.includes('dp') && <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2">DP</TableHead>}
            {visibleColumns.includes('actions') && <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2">Ações</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {procedures.map((proc) => {
            const showCheck = onCheckResult && canCheckResult(proc) && !proc.archived;
            return (
            <TableRow
              key={proc.id}
              data-testid={`row-procedure-${proc.id}`}
              className={`border-white/5 hover:bg-white/[0.03] transition-colors group ${proc.archived ? 'opacity-50' : ''}`}
            >
              <TableCell className="w-8 py-2 px-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onToggleFavorite(proc)}
                  data-testid={`button-favorite-${proc.id}`}
                  className={`h-6 w-6 p-0 transition-colors ${proc.is_favorite ? 'text-yellow-400' : 'text-muted-foreground/40 group-hover:text-muted-foreground'}`}
                >
                  <Star className={`w-3.5 h-3.5 ${proc.is_favorite ? 'fill-yellow-400' : ''}`} />
                </Button>
              </TableCell>
              {visibleColumns.includes('date') && (
                <TableCell className="text-xs text-muted-foreground py-2 px-2">{formatProcedureDate(proc.date)}</TableCell>
              )}
              {visibleColumns.includes('procedure_number') && (
                <TableCell className="py-2 px-2">
                  <span className="text-sm font-bold text-foreground">{proc.procedure_number}</span>
                  {proc.archived && <Archive className="w-3 h-3 inline ml-1 text-muted-foreground/60" />}
                </TableCell>
              )}
              {visibleColumns.includes('platform') && (
                <TableCell className="text-xs text-muted-foreground py-2 px-2 max-w-[80px] truncate">{proc.platform}</TableCell>
              )}
              {visibleColumns.includes('promotion_name') && (
                <TableCell className="text-xs text-muted-foreground py-2 px-2 max-w-[100px] truncate">{proc.promotion_name || '—'}</TableCell>
              )}
              {visibleColumns.includes('partida_descricao') && (
                <TableCell className="text-xs text-muted-foreground py-2 px-2 max-w-[140px] truncate">
                  {proc.partida_descricao ? (
                    <span title={`${proc.data_partida || ''} ${proc.horario_partida || ''}`.trim()}>
                      {proc.partida_descricao}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </TableCell>
              )}
              {visibleColumns.includes('category') && (
                <TableCell className="py-2 px-2">
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-[10px] px-1.5 py-0 font-medium">
                    {translateCategory(proc.category)}
                  </Badge>
                </TableCell>
              )}
              {visibleColumns.includes('status') && (
                <TableCell className="py-2 px-2">
                  <Badge className={`text-[10px] px-1.5 py-0 border font-medium ${getStatusBadge(proc.status)}`}>
                    {proc.status}
                  </Badge>
                </TableCell>
              )}
              {visibleColumns.includes('freebet_reference') && (
                <TableCell className="text-xs text-muted-foreground py-2 px-2 max-w-[60px] truncate">{proc.freebet_reference || '—'}</TableCell>
              )}
              {visibleColumns.includes('freebet_value') && (
                <TableCell className="py-2 px-2">
                  {proc.freebet_value ? (
                    <span className="text-purple-400 font-semibold text-xs">R$ {proc.freebet_value.toFixed(2)}</span>
                  ) : (
                    <span className="text-muted-foreground/40 text-xs">—</span>
                  )}
                </TableCell>
              )}
              {visibleColumns.includes('profit_loss') && (
                <TableCell className="py-2 px-2">
                  <span className={`text-xs font-bold ${proc.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {proc.profit_loss >= 0 ? '+' : ''}R$ {proc.profit_loss?.toFixed(2)}
                  </span>
                </TableCell>
              )}
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
                    <a href={proc.telegram_link} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 transition-colors">
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
                    <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] px-1.5 py-0">✓ DP</Badge>
                  ) : (
                    <span className="text-muted-foreground/40 text-xs">—</span>
                  )}
                </TableCell>
              )}
              {visibleColumns.includes('actions') && (
                <TableCell className="py-2 px-2">
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {showCheck && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onCheckResult!(proc)}
                        title="Conferir resultado"
                        data-testid={`button-conferir-${proc.id}`}
                        className="h-7 w-7 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                      >
                        <Trophy className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {onEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(proc)}
                        title="Editar"
                        data-testid={`button-edit-${proc.id}`}
                        className="h-7 w-7 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {onArchive && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onArchive(proc)}
                        title={proc.archived ? 'Restaurar' : 'Arquivar'}
                        data-testid={`button-archive-${proc.id}`}
                        className="h-7 w-7 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                      >
                        {proc.archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(proc.id)}
                        title="Excluir"
                        data-testid={`button-delete-${proc.id}`}
                        className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          );})}
        </TableBody>
      </Table>
    </div>
  );
}

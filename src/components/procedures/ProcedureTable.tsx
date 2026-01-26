import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, Pencil, Trash2, ExternalLink, Tag } from 'lucide-react';
import { Procedure } from '@/types/procedures';
import { formatProcedureDate, translateCategory } from '@/lib/procedureUtils';

interface ProcedureTableProps {
  procedures: Procedure[];
  visibleColumns: string[];
  onEdit: (proc: Procedure) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (proc: Procedure) => void;
}

export function ProcedureTable({ 
  procedures, 
  visibleColumns, 
  onEdit, 
  onDelete, 
  onToggleFavorite 
}: ProcedureTableProps) {
  const getStatusClasses = (status: string) => {
    if (status === 'Concluído' || status === 'Lucro Direto') {
      return 'bg-success/20 text-success border-success/30';
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
          <TableRow className="h-9">
            <TableHead className="w-8 px-1.5"></TableHead>
            {visibleColumns.includes('date') && <TableHead className="text-xs px-1.5">Data</TableHead>}
            {visibleColumns.includes('procedure_number') && <TableHead className="text-xs px-1.5">Nº Proc.</TableHead>}
            {visibleColumns.includes('platform') && <TableHead className="text-xs px-1.5">Plataforma</TableHead>}
            {visibleColumns.includes('promotion_name') && <TableHead className="text-xs px-1.5">Promoção</TableHead>}
            {visibleColumns.includes('category') && <TableHead className="text-xs px-1.5">Categoria</TableHead>}
            {visibleColumns.includes('status') && <TableHead className="text-xs px-1.5">Status</TableHead>}
            {visibleColumns.includes('freebet_reference') && <TableHead className="text-xs px-1.5">Ref. FB</TableHead>}
            {visibleColumns.includes('freebet_value') && <TableHead className="text-xs px-1.5">Freebet</TableHead>}
            {visibleColumns.includes('profit_loss') && <TableHead className="text-xs px-1.5">L/P</TableHead>}
            {visibleColumns.includes('tags') && <TableHead className="text-xs px-1.5">Tags</TableHead>}
            {visibleColumns.includes('telegram_link') && <TableHead className="text-xs px-1.5">Link</TableHead>}
            {visibleColumns.includes('dp') && <TableHead className="text-xs px-1.5">DP</TableHead>}
            {visibleColumns.includes('actions') && <TableHead className="text-xs px-1.5">Ações</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {procedures.map((proc) => (
            <TableRow key={proc.id} className="h-9">
              <TableCell className="w-8 py-1 px-1.5">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onToggleFavorite(proc)}
                  className={`h-6 w-6 p-0 ${proc.is_favorite ? 'text-yellow-400' : 'text-muted-foreground'}`}
                >
                  <Star className={`w-3.5 h-3.5 ${proc.is_favorite ? 'fill-yellow-400' : ''}`} />
                </Button>
              </TableCell>
              {visibleColumns.includes('date') && <TableCell className="text-xs py-1 px-1.5">{formatProcedureDate(proc.date)}</TableCell>}
              {visibleColumns.includes('procedure_number') && <TableCell className="text-sm font-semibold py-1 px-1.5">{proc.procedure_number}</TableCell>}
              {visibleColumns.includes('platform') && <TableCell className="text-xs py-1 px-1.5 max-w-[80px] truncate">{proc.platform}</TableCell>}
              {visibleColumns.includes('promotion_name') && <TableCell className="text-xs py-1 px-1.5 max-w-[100px] truncate">{proc.promotion_name || '-'}</TableCell>}
              {visibleColumns.includes('category') && (
                <TableCell className="py-1 px-1.5">
                  <Badge variant="outline" className="border-primary/30 text-primary text-[11px] px-1.5 py-0">
                    {translateCategory(proc.category)}
                  </Badge>
                </TableCell>
              )}
              {visibleColumns.includes('status') && (
                <TableCell className="py-1 px-1.5">
                  <Badge className={`text-[11px] px-1.5 py-0 ${getStatusClasses(proc.status)}`}>
                    {proc.status}
                  </Badge>
                </TableCell>
              )}
              {visibleColumns.includes('freebet_reference') && <TableCell className="text-xs py-1 px-1.5 max-w-[60px] truncate">{proc.freebet_reference || '-'}</TableCell>}
              {visibleColumns.includes('freebet_value') && (
                <TableCell className="py-1 px-1.5">
                  {proc.freebet_value ? (
                    <span className="text-purple-400 font-semibold text-xs">
                      R$ {proc.freebet_value.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                  )}
                </TableCell>
              )}
              {visibleColumns.includes('profit_loss') && (
                <TableCell className={`text-xs font-semibold py-1 px-1.5 ${proc.profit_loss >= 0 ? 'text-success' : 'text-destructive'}`}>
                  R$ {proc.profit_loss?.toFixed(2)}
                </TableCell>
              )}
              {visibleColumns.includes('tags') && (
                <TableCell className="py-1 px-1.5">
                  <div className="flex flex-wrap gap-0.5">
                    {proc.tags && proc.tags.length > 0 ? (
                      proc.tags.slice(0, 2).map((tag, idx) => (
                        <Badge key={idx} variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] px-1 py-0">
                          <Tag className="w-2.5 h-2.5 mr-0.5" />
                          {tag}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                    {proc.tags && proc.tags.length > 2 && (
                      <span className="text-[10px] text-muted-foreground">+{proc.tags.length - 2}</span>
                    )}
                  </div>
                </TableCell>
              )}
              {visibleColumns.includes('telegram_link') && (
                <TableCell className="py-1 px-1.5">
                  {proc.telegram_link ? (
                    <a href={proc.telegram_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                  )}
                </TableCell>
              )}
              {visibleColumns.includes('dp') && (
                <TableCell className="py-1 px-1.5">
                  {proc.dp ? (
                    <Badge className="bg-success/20 text-success border-success/30 text-[11px] px-1 py-0">
                      ✓
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                  )}
                </TableCell>
              )}
              {visibleColumns.includes('actions') && (
                <TableCell className="py-1 px-1.5">
                  <div className="flex gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(proc)}
                      className="h-7 w-7 text-primary hover:text-primary/80"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(proc.id)}
                      className="h-7 w-7 text-destructive hover:text-destructive/80"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

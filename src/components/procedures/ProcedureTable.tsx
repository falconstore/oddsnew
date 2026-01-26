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
          <TableRow className="h-10">
            <TableHead className="w-8 px-2"></TableHead>
            {visibleColumns.includes('date') && <TableHead className="text-[10px] px-2">Data</TableHead>}
            {visibleColumns.includes('procedure_number') && <TableHead className="text-[10px] px-2">Nº Proc.</TableHead>}
            {visibleColumns.includes('platform') && <TableHead className="text-[10px] px-2">Plataforma</TableHead>}
            {visibleColumns.includes('promotion_name') && <TableHead className="text-[10px] px-2">Promoção</TableHead>}
            {visibleColumns.includes('category') && <TableHead className="text-[10px] px-2">Categoria</TableHead>}
            {visibleColumns.includes('status') && <TableHead className="text-[10px] px-2">Status</TableHead>}
            {visibleColumns.includes('freebet_reference') && <TableHead className="text-[10px] px-2">Ref. FB</TableHead>}
            {visibleColumns.includes('freebet_value') && <TableHead className="text-[10px] px-2">Freebet</TableHead>}
            {visibleColumns.includes('profit_loss') && <TableHead className="text-[10px] px-2">L/P</TableHead>}
            {visibleColumns.includes('tags') && <TableHead className="text-[10px] px-2">Tags</TableHead>}
            {visibleColumns.includes('telegram_link') && <TableHead className="text-[10px] px-2">Link</TableHead>}
            {visibleColumns.includes('dp') && <TableHead className="text-[10px] px-2">DP</TableHead>}
            {visibleColumns.includes('actions') && <TableHead className="text-[10px] px-2">Ações</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {procedures.map((proc) => (
            <TableRow key={proc.id} className="h-9">
              <TableCell className="w-8 py-1 px-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onToggleFavorite(proc)}
                  className={`h-6 w-6 p-0 ${proc.is_favorite ? 'text-yellow-400' : 'text-muted-foreground'}`}
                >
                  <Star className={`w-3.5 h-3.5 ${proc.is_favorite ? 'fill-yellow-400' : ''}`} />
                </Button>
              </TableCell>
              {visibleColumns.includes('date') && <TableCell className="text-[10px] py-1 px-2">{formatProcedureDate(proc.date)}</TableCell>}
              {visibleColumns.includes('procedure_number') && <TableCell className="text-xs font-medium py-1 px-2">{proc.procedure_number}</TableCell>}
              {visibleColumns.includes('platform') && <TableCell className="text-[10px] py-1 px-2">{proc.platform}</TableCell>}
              {visibleColumns.includes('promotion_name') && <TableCell className="text-[10px] py-1 px-2 max-w-[120px] truncate">{proc.promotion_name || '-'}</TableCell>}
              {visibleColumns.includes('category') && (
                <TableCell className="py-1 px-2">
                  <Badge variant="outline" className="border-primary/30 text-primary text-[10px] px-1.5 py-0">
                    {translateCategory(proc.category)}
                  </Badge>
                </TableCell>
              )}
              {visibleColumns.includes('status') && (
                <TableCell className="py-1 px-2">
                  <Badge className={`text-[10px] px-1.5 py-0 ${getStatusClasses(proc.status)}`}>
                    {proc.status}
                  </Badge>
                </TableCell>
              )}
              {visibleColumns.includes('freebet_reference') && <TableCell className="text-[10px] py-1 px-2">{proc.freebet_reference || '-'}</TableCell>}
              {visibleColumns.includes('freebet_value') && (
                <TableCell className="py-1 px-2">
                  {proc.freebet_value ? (
                    <span className="text-purple-400 font-semibold text-[10px]">
                      R$ {proc.freebet_value.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-[10px]">-</span>
                  )}
                </TableCell>
              )}
              {visibleColumns.includes('profit_loss') && (
                <TableCell className={`text-[10px] font-semibold py-1 px-2 ${proc.profit_loss >= 0 ? 'text-success' : 'text-destructive'}`}>
                  R$ {proc.profit_loss?.toFixed(2)}
                </TableCell>
              )}
              {visibleColumns.includes('tags') && (
                <TableCell className="py-1 px-2">
                  <div className="flex flex-wrap gap-0.5">
                    {proc.tags && proc.tags.length > 0 ? (
                      proc.tags.slice(0, 2).map((tag, idx) => (
                        <Badge key={idx} variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[9px] px-1 py-0">
                          <Tag className="w-2.5 h-2.5 mr-0.5" />
                          {tag}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-[10px]">-</span>
                    )}
                    {proc.tags && proc.tags.length > 2 && (
                      <span className="text-[9px] text-muted-foreground">+{proc.tags.length - 2}</span>
                    )}
                  </div>
                </TableCell>
              )}
              {visibleColumns.includes('telegram_link') && (
                <TableCell className="py-1 px-2">
                  {proc.telegram_link ? (
                    <a href={proc.telegram_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground text-[10px]">-</span>
                  )}
                </TableCell>
              )}
              {visibleColumns.includes('dp') && (
                <TableCell className="py-1 px-2">
                  {proc.dp ? (
                    <Badge className="bg-success/20 text-success border-success/30 text-[10px] px-1 py-0">
                      ✓
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-[10px]">-</span>
                  )}
                </TableCell>
              )}
              {visibleColumns.includes('actions') && (
                <TableCell className="py-1 px-2">
                  <div className="flex gap-1">
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

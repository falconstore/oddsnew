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
          <TableRow>
            <TableHead className="w-10"></TableHead>
            {visibleColumns.includes('date') && <TableHead className="text-xs">Data</TableHead>}
            {visibleColumns.includes('procedure_number') && <TableHead className="text-xs">Nº Procedimento</TableHead>}
            {visibleColumns.includes('platform') && <TableHead className="text-xs">Plataforma</TableHead>}
            {visibleColumns.includes('promotion_name') && <TableHead className="text-xs">Promoção</TableHead>}
            {visibleColumns.includes('category') && <TableHead className="text-xs">Categoria</TableHead>}
            {visibleColumns.includes('status') && <TableHead className="text-xs">Status</TableHead>}
            {visibleColumns.includes('freebet_reference') && <TableHead className="text-xs">Ref. Freebet</TableHead>}
            {visibleColumns.includes('freebet_value') && <TableHead className="text-xs">Freebet</TableHead>}
            {visibleColumns.includes('profit_loss') && <TableHead className="text-xs">Lucro/Prejuízo</TableHead>}
            {visibleColumns.includes('tags') && <TableHead className="text-xs">Tags</TableHead>}
            {visibleColumns.includes('telegram_link') && <TableHead className="text-xs">Link</TableHead>}
            {visibleColumns.includes('dp') && <TableHead className="text-xs">DP</TableHead>}
            {visibleColumns.includes('actions') && <TableHead className="text-xs">Ações</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {procedures.map((proc) => (
            <TableRow key={proc.id}>
              <TableCell className="w-10">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggleFavorite(proc)}
                  className={proc.is_favorite ? 'text-yellow-400' : 'text-muted-foreground'}
                >
                  <Star className={`w-4 h-4 ${proc.is_favorite ? 'fill-yellow-400' : ''}`} />
                </Button>
              </TableCell>
              {visibleColumns.includes('date') && <TableCell className="text-xs">{formatProcedureDate(proc.date)}</TableCell>}
              {visibleColumns.includes('procedure_number') && <TableCell className="text-sm font-medium">{proc.procedure_number}</TableCell>}
              {visibleColumns.includes('platform') && <TableCell className="text-xs">{proc.platform}</TableCell>}
              {visibleColumns.includes('promotion_name') && <TableCell className="text-xs">{proc.promotion_name || '-'}</TableCell>}
              {visibleColumns.includes('category') && (
                <TableCell>
                  <Badge variant="outline" className="border-primary/30 text-primary text-xs">
                    {translateCategory(proc.category)}
                  </Badge>
                </TableCell>
              )}
              {visibleColumns.includes('status') && (
                <TableCell>
                  <Badge className={`text-xs ${getStatusClasses(proc.status)}`}>
                    {proc.status}
                  </Badge>
                </TableCell>
              )}
              {visibleColumns.includes('freebet_reference') && <TableCell className="text-xs">{proc.freebet_reference || '-'}</TableCell>}
              {visibleColumns.includes('freebet_value') && (
                <TableCell>
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
                <TableCell className={`text-xs font-semibold ${proc.profit_loss >= 0 ? 'text-success' : 'text-destructive'}`}>
                  R$ {proc.profit_loss?.toFixed(2)}
                </TableCell>
              )}
              {visibleColumns.includes('tags') && (
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {proc.tags && proc.tags.length > 0 ? (
                      proc.tags.map((tag, idx) => (
                        <Badge key={idx} variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">
                          <Tag className="w-3 h-3 mr-1" />
                          {tag}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </div>
                </TableCell>
              )}
              {visibleColumns.includes('telegram_link') && (
                <TableCell>
                  {proc.telegram_link ? (
                    <a href={proc.telegram_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                  )}
                </TableCell>
              )}
              {visibleColumns.includes('dp') && (
                <TableCell>
                  {proc.dp ? (
                    <Badge className="bg-success/20 text-success border-success/30 text-xs">
                      ✓
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                  )}
                </TableCell>
              )}
              {visibleColumns.includes('actions') && (
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(proc)}
                      className="text-primary hover:text-primary/80"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(proc.id)}
                      className="text-destructive hover:text-destructive/80"
                    >
                      <Trash2 className="w-4 h-4" />
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

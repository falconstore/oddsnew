import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { BetbraEntry } from '@/types/betbra';
import { formatBetbraDate, formatCurrency } from '@/lib/betbraUtils';

interface BetbraTableProps {
  entries: BetbraEntry[];
  onEdit: (entry: BetbraEntry) => void;
  onDelete: (id: string) => void;
}

export function BetbraTable({ entries, onEdit, onDelete }: BetbraTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="h-9">
            <TableHead className="text-xs px-1.5">Data</TableHead>
            <TableHead className="text-xs px-1.5">Registros</TableHead>
            <TableHead className="text-xs px-1.5">Apostas</TableHead>
            <TableHead className="text-xs px-1.5">NGR</TableHead>
            <TableHead className="text-xs px-1.5">Turnover</TableHead>
            <TableHead className="text-xs px-1.5">CPA</TableHead>
            <TableHead className="text-xs px-1.5">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                Nenhum registro encontrado
              </TableCell>
            </TableRow>
          ) : (
            entries.map((entry) => (
              <TableRow key={entry.id} className="h-9">
                <TableCell className="text-xs py-1 px-1.5 font-medium">
                  {formatBetbraDate(entry.date)}
                </TableCell>
                <TableCell className="text-xs py-1 px-1.5">
                  {entry.registros}
                </TableCell>
                <TableCell className="text-xs py-1 px-1.5">
                  {entry.numero_de_apostas}
                </TableCell>
                <TableCell className={`text-xs py-1 px-1.5 font-semibold ${Number(entry.ngr) >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(Number(entry.ngr))}
                </TableCell>
                <TableCell className="text-xs py-1 px-1.5 text-purple-400 font-semibold">
                  {formatCurrency(Number(entry.turnover))}
                </TableCell>
                <TableCell className="text-xs py-1 px-1.5 font-semibold">
                  {entry.cpa}
                </TableCell>
                <TableCell className="py-1 px-1.5">
                  <div className="flex gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(entry)}
                      className="h-7 w-7 text-primary hover:text-primary/80"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(entry.id)}
                      className="h-7 w-7 text-destructive hover:text-destructive/80"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// Mobile cards for responsive view
interface BetbraMobileCardsProps {
  entries: BetbraEntry[];
  onEdit: (entry: BetbraEntry) => void;
  onDelete: (id: string) => void;
}

export function BetbraMobileCards({ entries, onEdit, onDelete }: BetbraMobileCardsProps) {
  return (
    <div className="lg:hidden space-y-3">
      {entries.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Nenhum registro encontrado
        </div>
      ) : (
        entries.map((entry) => (
          <div key={entry.id} className="bg-card border border-border rounded-lg p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold">{formatBetbraDate(entry.date)}</span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(entry)}
                  className="h-7 w-7 text-primary"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(entry.id)}
                  className="h-7 w-7 text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Registros:</span>
                <span className="ml-1 font-medium">{entry.registros}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Apostas:</span>
                <span className="ml-1 font-medium">{entry.numero_de_apostas}</span>
              </div>
              <div>
                <span className="text-muted-foreground">NGR:</span>
                <span className={`ml-1 font-semibold ${Number(entry.ngr) >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(Number(entry.ngr))}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Turnover:</span>
                <span className="ml-1 font-semibold text-purple-400">{formatCurrency(Number(entry.turnover))}</span>
              </div>
              <div>
                <span className="text-muted-foreground">CPA:</span>
                <span className="ml-1 font-semibold">{entry.cpa}</span>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

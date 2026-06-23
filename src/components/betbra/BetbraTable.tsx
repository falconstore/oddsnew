import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ActionButton, ActionGroup } from '@/components/ui/action-button';
import { Pencil, Trash2 } from 'lucide-react';
import { BetbraEntry } from '@/types/betbra';
import { formatBetbraDate, formatCurrency } from '@/lib/betbraUtils';

interface BetbraTableProps {
  entries: BetbraEntry[];
  onEdit?: (entry: BetbraEntry) => void;
  onDelete?: (id: string) => void;
}

export function BetbraTable({ entries, onEdit, onDelete }: BetbraTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="h-9 border-white/5 hover:bg-transparent">
            <TableHead className="text-xs px-3 text-muted-foreground font-semibold uppercase tracking-wider">Data</TableHead>
            <TableHead className="text-xs px-3 text-muted-foreground font-semibold uppercase tracking-wider">Registros</TableHead>
            <TableHead className="text-xs px-3 text-muted-foreground font-semibold uppercase tracking-wider">Apostas</TableHead>
            <TableHead className="text-xs px-3 text-muted-foreground font-semibold uppercase tracking-wider">NGR</TableHead>
            <TableHead className="text-xs px-3 text-muted-foreground font-semibold uppercase tracking-wider">Turnover</TableHead>
            <TableHead className="text-xs px-3 text-muted-foreground font-semibold uppercase tracking-wider">CPA</TableHead>
            {(onEdit || onDelete) && (
              <TableHead className="text-xs px-3 text-muted-foreground font-semibold uppercase tracking-wider">Ações</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.length === 0 ? (
            <TableRow className="border-white/5">
              <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-2xl">📊</span>
                  <span>Nenhum registro encontrado</span>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            entries.map((entry) => (
              <TableRow key={entry.id} className="h-10 border-white/5 hover:bg-white/3 transition-colors group">
                <TableCell className="text-xs py-1 px-3 font-semibold text-foreground">
                  {formatBetbraDate(entry.date)}
                </TableCell>
                <TableCell className="text-xs py-1 px-3 text-muted-foreground font-semibold">
                  {entry.registros}
                </TableCell>
                <TableCell className="text-xs py-1 px-3 text-muted-foreground">
                  {entry.numero_de_apostas}
                </TableCell>
                <TableCell className={`text-xs py-1 px-3 font-bold ${Number(entry.ngr) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {formatCurrency(Number(entry.ngr))}
                </TableCell>
                <TableCell className="text-xs py-1 px-3 text-muted-foreground font-semibold">
                  {formatCurrency(Number(entry.turnover))}
                </TableCell>
                <TableCell className="text-xs py-1 px-3 text-foreground font-bold">
                  {entry.cpa}
                </TableCell>
                {(onEdit || onDelete) && (
                  <TableCell className="py-1 px-3">
                    <ActionGroup>
                      {onEdit && (
                        <ActionButton
                          icon={Pencil}
                          intent="edit"
                          label="Editar"
                          onClick={() => onEdit(entry)}
                          data-testid={`button-edit-${entry.id}`}
                        />
                      )}
                      {onDelete && (
                        <ActionButton
                          icon={Trash2}
                          intent="delete"
                          label="Excluir"
                          onClick={() => onDelete(entry.id)}
                          data-testid={`button-delete-${entry.id}`}
                        />
                      )}
                    </ActionGroup>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

interface BetbraMobileCardsProps {
  entries: BetbraEntry[];
  onEdit?: (entry: BetbraEntry) => void;
  onDelete?: (id: string) => void;
}

export function BetbraMobileCards({ entries, onEdit, onDelete }: BetbraMobileCardsProps) {
  return (
    <div className="lg:hidden space-y-3">
      {entries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <div className="flex flex-col items-center gap-2">
            <span className="text-2xl">📊</span>
            <span>Nenhum registro encontrado</span>
          </div>
        </div>
      ) : (
        entries.map((entry) => (
          <div key={entry.id} className="relative rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm p-4 space-y-3 overflow-hidden card-hover">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-primary/50 via-primary/20 to-transparent" />
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-foreground">{formatBetbraDate(entry.date)}</span>
              <ActionGroup>
                {onEdit && (
                  <ActionButton icon={Pencil} intent="edit" label="Editar" onClick={() => onEdit(entry)}
                    data-testid={`button-edit-mobile-${entry.id}`} />
                )}
                {onDelete && (
                  <ActionButton icon={Trash2} intent="delete" label="Excluir" onClick={() => onDelete(entry.id)}
                    data-testid={`button-delete-mobile-${entry.id}`} />
                )}
              </ActionGroup>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white/3 rounded-xl p-2 border border-white/5">
                <span className="text-muted-foreground block mb-0.5">Registros</span>
                <span className="font-bold text-muted-foreground">{entry.registros}</span>
              </div>
              <div className="bg-white/3 rounded-xl p-2 border border-white/5">
                <span className="text-muted-foreground block mb-0.5">Apostas</span>
                <span className="font-semibold">{entry.numero_de_apostas}</span>
              </div>
              <div className="bg-white/3 rounded-xl p-2 border border-white/5">
                <span className="text-muted-foreground block mb-0.5">NGR</span>
                <span className={`font-bold ${Number(entry.ngr) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {formatCurrency(Number(entry.ngr))}
                </span>
              </div>
              <div className="bg-white/3 rounded-xl p-2 border border-white/5">
                <span className="text-muted-foreground block mb-0.5">Turnover</span>
                <span className="font-semibold text-muted-foreground">{formatCurrency(Number(entry.turnover))}</span>
              </div>
              <div className="bg-white/3 rounded-xl p-2 border border-white/5 col-span-2">
                <span className="text-muted-foreground block mb-0.5">CPA</span>
                <span className="font-bold text-foreground">{entry.cpa}</span>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

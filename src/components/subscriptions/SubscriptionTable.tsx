import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Subscriber } from '@/types/subscriptions';
import { 
  calculateDaysRemaining, 
  formatCurrency, 
  formatDate,
  getStatusBadgeVariant,
  getStatusText,
  getSituationColor,
  sortSubscribers
} from '@/lib/subscriptionUtils';
import { Pencil, Trash2, ExternalLink, ArrowUpDown } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface SubscriptionTableProps {
  subscribers: Subscriber[];
  onEdit: (subscriber: Subscriber) => void;
  onDelete: (id: string) => void;
}

type SortField = 'full_name' | 'amount_paid' | 'payment_date' | 'plan' | 'days_remaining';

export function SubscriptionTable({ subscribers, onEdit, onDelete }: SubscriptionTableProps) {
  const isMobile = useIsMobile();
  const [sortField, setSortField] = useState<SortField>('payment_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedSubscribers = sortSubscribers(subscribers, sortField, sortDirection);
  const totalPages = Math.ceil(sortedSubscribers.length / itemsPerPage);
  const paginatedSubscribers = sortedSubscribers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      className="py-1 px-1.5 text-xs cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      </div>
    </TableHead>
  );

  if (isMobile) {
    return (
      <div className="space-y-3">
        {paginatedSubscribers.map((subscriber) => {
          const daysRemaining = calculateDaysRemaining(subscriber.payment_date, subscriber.plan);
          const statusVariant = getStatusBadgeVariant(daysRemaining);
          const statusText = getStatusText(daysRemaining);

          return (
            <Card key={subscriber.id} className="rounded-xl">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{subscriber.full_name}</p>
                    {subscriber.telegram_link && (
                      <a 
                        href={subscriber.telegram_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        Telegram <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(subscriber)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(subscriber.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Valor:</span>
                    <span className="ml-1 font-medium">{formatCurrency(subscriber.amount_paid)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Data:</span>
                    <span className="ml-1">{formatDate(subscriber.payment_date)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Plano:</span>
                    <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0">
                      {subscriber.plan}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Dias:</span>
                    <span className="ml-1 font-medium">
                      {daysRemaining > 0 ? `${daysRemaining}d` : 'Expirado'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Badge variant={statusVariant}>{statusText}</Badge>
                  <span className={`text-xs ${getSituationColor(subscriber.situation)}`}>
                    {subscriber.situation}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </Button>
            <span className="flex items-center text-xs text-muted-foreground">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Próximo
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <SortHeader field="full_name">Nome</SortHeader>
              <TableHead className="py-1 px-1.5 text-xs">Telegram</TableHead>
              <SortHeader field="amount_paid">Valor</SortHeader>
              <SortHeader field="payment_date">Pagamento</SortHeader>
              <SortHeader field="plan">Plano</SortHeader>
              <SortHeader field="days_remaining">Dias</SortHeader>
              <TableHead className="py-1 px-1.5 text-xs">Status</TableHead>
              <TableHead className="py-1 px-1.5 text-xs">Situação</TableHead>
              <TableHead className="py-1 px-1.5 text-xs w-[80px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedSubscribers.map((subscriber) => {
              const daysRemaining = calculateDaysRemaining(subscriber.payment_date, subscriber.plan);
              const statusVariant = getStatusBadgeVariant(daysRemaining);
              const statusText = getStatusText(daysRemaining);

              return (
                <TableRow key={subscriber.id} className="h-9 hover:bg-muted/20">
                  <TableCell className="py-1 px-1.5 text-xs font-medium max-w-[150px] truncate">
                    {subscriber.full_name}
                  </TableCell>
                  <TableCell className="py-1 px-1.5 text-xs">
                    {subscriber.telegram_link ? (
                      <a 
                        href={subscriber.telegram_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-0.5"
                      >
                        Link <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="py-1 px-1.5 text-xs font-medium">
                    {formatCurrency(subscriber.amount_paid)}
                  </TableCell>
                  <TableCell className="py-1 px-1.5 text-xs">
                    {formatDate(subscriber.payment_date)}
                  </TableCell>
                  <TableCell className="py-1 px-1.5">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {subscriber.plan}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-1 px-1.5 text-xs font-medium">
                    {daysRemaining > 0 ? `${daysRemaining}d` : 'Exp'}
                  </TableCell>
                  <TableCell className="py-1 px-1.5">
                    <Badge variant={statusVariant} className="text-[10px] px-1.5 py-0">
                      {statusText}
                    </Badge>
                  </TableCell>
                  <TableCell className={`py-1 px-1.5 text-xs ${getSituationColor(subscriber.situation)}`}>
                    {subscriber.situation}
                  </TableCell>
                  <TableCell className="py-1 px-1.5">
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(subscriber)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onDelete(subscriber.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">
            Mostrando {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, sortedSubscribers.length)} de {sortedSubscribers.length}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Próximo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

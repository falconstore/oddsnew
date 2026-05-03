import { useMemo, useState } from 'react';
import { Copy, FileText, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type { Procedure } from '@/types/procedures';
import { buildRelatorioDiario, formatRelatorioText } from '@/lib/relatorioDiario';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  procedures: Procedure[];
}

export function GerarRelatorioModal({ open, onOpenChange, procedures }: Props) {
  const { toast } = useToast();
  const [dateStr, setDateStr] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [freebetsPendentes, setFreebetsPendentes] = useState<string>('');

  const targetDate = useMemo(() => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1);
  }, [dateStr]);

  const relatorio = useMemo(
    () => buildRelatorioDiario(procedures, targetDate),
    [procedures, targetDate]
  );

  const previewText = useMemo(
    () => formatRelatorioText(relatorio, freebetsPendentes),
    [relatorio, freebetsPendentes]
  );

  const fmtMoney = (n: number) =>
    n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(previewText);
      toast({
        title: 'Relatório copiado',
        description: 'Texto pronto pra colar nos grupos.',
      });
    } catch {
      toast({
        title: 'Não foi possível copiar',
        description: 'Selecione o texto manualmente e copie.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto"
        data-testid="modal-gerar-relatorio"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Gerar Relatório Diário
          </DialogTitle>
          <DialogDescription>
            Texto pronto no formato padrão pra colar nos grupos do Telegram.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row sm:items-end gap-3 pt-2">
          <div className="flex-1">
            <Label htmlFor="relatorio-date" className="text-xs text-muted-foreground">
              Data do relatório
            </Label>
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                id="relatorio-date"
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="pl-9"
                data-testid="input-relatorio-date"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" data-testid="badge-relatorio-count">
              {relatorio.totalProcedures} procedimento
              {relatorio.totalProcedures === 1 ? '' : 's'} incluído
              {relatorio.totalProcedures === 1 ? '' : 's'}
            </Badge>
            <Badge
              variant={relatorio.totalDia >= 0 ? 'default' : 'destructive'}
              data-testid="badge-relatorio-total"
            >
              Total R$ {fmtMoney(relatorio.totalDia)}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
          {/* Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Preview
              </Label>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopy}
                className="h-7 text-xs"
                data-testid="button-copy-preview"
              >
                <Copy className="w-3 h-3 mr-1.5" />
                Copiar texto
              </Button>
            </div>
            <pre
              className="glass rounded-xl border border-white/5 p-4 text-xs leading-relaxed whitespace-pre-wrap font-mono min-h-[300px] max-h-[420px] overflow-y-auto"
              data-testid="text-relatorio-preview"
            >
              {previewText}
            </pre>
            <p className="text-[10px] text-muted-foreground">
              {format(relatorio.date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </p>
          </div>

          {/* Editable freebets pendentes */}
          <div className="space-y-2">
            <Label
              htmlFor="freebets-pendentes"
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
              ⏳ Freebets pendentes (livre)
            </Label>
            <Textarea
              id="freebets-pendentes"
              value={freebetsPendentes}
              onChange={(e) => setFreebetsPendentes(e.target.value)}
              placeholder={'Ex.:\n50,00 Bet365 (girar até 18/05)\n30,00 Betano'}
              className="min-h-[300px] font-mono text-xs"
              data-testid="textarea-freebets-pendentes"
            />
            <p className="text-[10px] text-muted-foreground">
              Esse campo é editado livremente e entra na seção “FREEBETS PENDENTES DE
              CONVERSÃO”.
            </p>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-fechar-relatorio"
          >
            Fechar
          </Button>
          <Button
            onClick={handleCopy}
            className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-semibold"
            data-testid="button-copy-relatorio-final"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copiar Relatório
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

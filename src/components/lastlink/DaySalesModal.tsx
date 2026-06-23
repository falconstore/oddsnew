import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { X, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabaseProcedures, isProceduresSupabaseConfigured } from '@/lib/supabaseProcedures';
import { cn } from '@/lib/utils';

const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface DaySale {
  id_venda: string;
  email: string | null;
  nome: string | null;
  produto: string | null;
  modalidade: string | null;
  tipo_venda: string | null;
  valor: number | null;
  data_venda: string | null;
}

// Busca as vendas APROVADAS de um dia (intervalo no fuso de Brasília).
// produto != null → filtra por produto (coerente com o filtro do dashboard).
function useDaySales(day: Date | null, produto: string | null) {
  const dayKey = day ? format(day, 'yyyy-MM-dd') : null;
  return useQuery({
    queryKey: ['lastlink_day_sales', dayKey, produto],
    enabled: !!day && isProceduresSupabaseConfigured(),
    queryFn: async (): Promise<DaySale[]> => {
      // Intervalo [00:00, 24:00) do dia em horário de Brasília (UTC-3)
      const start = `${dayKey}T00:00:00-03:00`;
      const end = `${dayKey}T23:59:59.999-03:00`;
      let q = supabaseProcedures
        .from('lastlink_sales')
        .select('id_venda,email,nome,produto,modalidade,tipo_venda,valor,data_venda')
        .eq('status', 'Aprovada')
        .gte('data_venda', new Date(start).toISOString())
        .lte('data_venda', new Date(end).toISOString());
      if (produto) q = q.eq('produto', produto);
      const { data, error } = await q.order('valor', { ascending: false });
      if (error) throw error;
      return (data ?? []) as DaySale[];
    },
    staleTime: 30000,
  });
}

export function DaySalesModal({ day, produto = null, onClose }: { day: Date | null; produto?: string | null; onClose: () => void }) {
  const { data: sales = [], isLoading } = useDaySales(day, produto);

  // Agrega por produto
  const byProduct = (() => {
    const m = new Map<string, { novas: number; renov: number; valor: number }>();
    for (const s of sales) {
      const p = s.produto || '(sem produto)';
      const cur = m.get(p) || { novas: 0, renov: 0, valor: 0 };
      if (s.tipo_venda === 'Renovação') cur.renov++; else cur.novas++;
      cur.valor += Number(s.valor) || 0;
      m.set(p, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].valor - a[1].valor);
  })();

  const totalValor = sales.reduce((s, r) => s + (Number(r.valor) || 0), 0);
  const totalNovas = sales.filter((s) => s.tipo_venda !== 'Renovação').length;
  const totalRenov = sales.filter((s) => s.tipo_venda === 'Renovação').length;

  return (
    <Dialog open={!!day} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="telemetry-label text-primary">[ VENDAS DO DIA ]</span>
            {day && <span className="font-mono">{format(day, "dd 'de' MMMM yyyy", { locale: ptBR })}</span>}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : sales.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma venda aprovada neste dia.</p>
        ) : (
          <div className="space-y-4">
            {/* Totais do dia */}
            <div className="grid grid-cols-3 gap-px bg-border border border-border">
              <div className="bg-card p-3">
                <p className="telemetry-label text-muted-foreground">RECEITA</p>
                <p className="text-lg font-bold font-mono text-primary tabular-nums">{money(totalValor)}</p>
              </div>
              <div className="bg-card p-3">
                <p className="telemetry-label text-muted-foreground">NOVAS</p>
                <p className="text-lg font-bold font-mono tabular-nums">{totalNovas}</p>
              </div>
              <div className="bg-card p-3">
                <p className="telemetry-label text-muted-foreground">RENOVAÇÕES</p>
                <p className="text-lg font-bold font-mono text-primary tabular-nums">{totalRenov}</p>
              </div>
            </div>

            {/* Resumo por produto */}
            <div>
              <p className="telemetry-label text-muted-foreground/60 mb-1.5">POR PRODUTO</p>
              <div className="grid grid-cols-1 gap-px bg-border border border-border">
                {byProduct.map(([prod, v]) => (
                  <div key={prod} className="bg-card px-3 py-2 flex items-center gap-3">
                    <span className="text-sm flex-1 truncate">{prod}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {v.novas} {v.novas === 1 ? 'nova' : 'novas'} · {v.renov} {v.renov === 1 ? 'renovação' : 'renovações'}
                    </span>
                    <span className="text-sm font-mono text-primary tabular-nums w-28 text-right">{money(v.valor)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Lista de vendas individuais */}
            <div>
              <p className="telemetry-label text-muted-foreground/60 mb-1.5">VENDAS ({sales.length})</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="telemetry-label text-muted-foreground py-1.5 px-2">Cliente</th>
                      <th className="telemetry-label text-muted-foreground py-1.5 px-2">Produto</th>
                      <th className="telemetry-label text-muted-foreground py-1.5 px-2">Tipo</th>
                      <th className="telemetry-label text-muted-foreground py-1.5 px-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((s) => (
                      <tr key={s.id_venda} className="border-b border-border/50">
                        <td className="py-1.5 px-2 max-w-[180px]"><span className="truncate block">{s.nome || s.email}</span></td>
                        <td className="py-1.5 px-2 max-w-[160px]"><span className="truncate block text-foreground/90">{s.produto}</span></td>
                        <td className="py-1.5 px-2">
                          <span className={cn('text-xs', s.tipo_venda === 'Renovação' ? 'text-primary' : 'text-muted-foreground')}>
                            {s.tipo_venda === 'Renovação' ? 'Renovação' : 'Nova venda'}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums">{money(Number(s.valor) || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

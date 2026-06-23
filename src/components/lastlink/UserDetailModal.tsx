import { useQuery } from '@tanstack/react-query';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, Mail, Phone, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabaseProcedures, isProceduresSupabaseConfigured } from '@/lib/supabaseProcedures';
import { cn } from '@/lib/utils';

const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dt = (s: string | null) => (s ? format(new Date(s), 'dd/MM/yy HH:mm') : '—');
const dOnly = (s: string | null) => (s ? format(new Date(s), 'dd/MM/yyyy') : '—');

interface Sale {
  id_venda: string;
  status: string | null;
  data_venda: string | null;
  tipo_venda: string | null;
  produto: string | null;
  oferta: string | null;
  modalidade: string | null;
  forma_pagamento: string | null;
  valor: number | null;
  cupom: string | null;
  data_pagamento: string | null;
  data_expiracao: string | null;
  data_cancelamento: string | null;
  motivo_cancelamento: string | null;
  telefone: string | null;
  documento: string | null;
}

const STATUS_TONE: Record<string, string> = {
  Aprovada: 'text-primary',
  Expirada: 'text-muted-foreground',
  Cancelada: 'text-warning',
  Reembolsada: 'text-warning',
  Chargeback: 'text-destructive',
  Pendente: 'text-muted-foreground',
};

function useUserSales(email: string | null) {
  return useQuery({
    queryKey: ['lastlink_user_sales', email],
    enabled: !!email && isProceduresSupabaseConfigured(),
    queryFn: async (): Promise<Sale[]> => {
      const { data, error } = await supabaseProcedures
        .from('lastlink_sales')
        .select('id_venda,status,data_venda,tipo_venda,produto,oferta,modalidade,forma_pagamento,valor,cupom,data_pagamento,data_expiracao,data_cancelamento,motivo_cancelamento,telefone,documento')
        .eq('email', email)
        .order('data_venda', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Sale[];
    },
    staleTime: 30000,
  });
}

export function UserDetailModal({ email, nome, onClose }: { email: string | null; nome?: string | null; onClose: () => void }) {
  const { data: sales = [], isLoading } = useUserSales(email);

  const aprovadas = sales.filter((s) => s.status === 'Aprovada');
  const totalPago = aprovadas.reduce((a, s) => a + (Number(s.valor) || 0), 0);
  const primeira = aprovadas.length ? aprovadas[aprovadas.length - 1].data_venda : null;
  const ltvDias = primeira ? differenceInDays(new Date(), new Date(primeira)) : null;

  // Quebra por status
  const byStatus = (() => {
    const m = new Map<string, number>();
    for (const s of sales) m.set(s.status || '—', (m.get(s.status || '—') || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  })();

  // Status por PRODUTO — cada assinatura tem expiração própria.
  // Para cada produto: maior data_expiracao entre aprovadas decide Ativo/Expirado;
  // soma do que pagou e nº de pagamentos naquele produto.
  const porProduto = (() => {
    const m = new Map<string, { pago: number; pagamentos: number; expira: string | null; ultimaCompra: string | null; modalidade: string | null }>();
    for (const s of aprovadas) {
      const p = s.produto || '(sem produto)';
      const cur = m.get(p) || { pago: 0, pagamentos: 0, expira: null, ultimaCompra: null, modalidade: null };
      cur.pago += Number(s.valor) || 0;
      cur.pagamentos += 1;
      if (s.data_expiracao && (!cur.expira || s.data_expiracao > cur.expira)) cur.expira = s.data_expiracao;
      if (s.data_venda && (!cur.ultimaCompra || s.data_venda > cur.ultimaCompra)) { cur.ultimaCompra = s.data_venda; cur.modalidade = s.modalidade; }
      m.set(p, cur);
    }
    return [...m.entries()]
      .map(([produto, v]) => ({
        produto, ...v,
        ativo: v.expira ? new Date(v.expira).getTime() >= Date.now() : false,
      }))
      .sort((a, b) => Number(b.ativo) - Number(a.ativo) || b.pago - a.pago);
  })();

  // Dados de contato (pega da venda mais recente que tiver)
  const contato = sales.find((s) => s.telefone || s.documento);

  return (
    <Dialog open={!!email} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-col gap-0.5">
            <span className="telemetry-label text-primary">[ HISTÓRICO DO CLIENTE ]</span>
            <span className="text-base font-mono">{nome || email}</span>
            {nome && <span className="text-xs text-muted-foreground font-normal">{email}</span>}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : sales.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma transação encontrada.</p>
        ) : (
          <div className="space-y-4">
            {/* Contato */}
            {contato && (
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                {contato.telefone && <span className="flex items-center gap-1.5"><Phone className="w-3 h-3" />{contato.telefone}</span>}
                {contato.documento && <span className="flex items-center gap-1.5"><FileText className="w-3 h-3" />{contato.documento}</span>}
                {email && <span className="flex items-center gap-1.5"><Mail className="w-3 h-3" />{email}</span>}
              </div>
            )}

            {/* Resumo */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border">
              <Box label="TOTAL PAGO" value={money(totalPago)} sub={`${aprovadas.length} pagamento${aprovadas.length === 1 ? '' : 's'}`} accent />
              <Box label="CLIENTE DESDE" value={primeira ? dOnly(primeira) : '—'} sub={ltvDias != null ? `há ${ltvDias} dias` : '—'} />
              <Box
                label="ASSINATURAS ATIVAS"
                value={`${porProduto.filter((p) => p.ativo).length} de ${porProduto.length}`}
                sub="produtos ativos"
                tone={porProduto.some((p) => p.ativo) ? 'ok' : 'bad'}
              />
              <Box label="TRANSAÇÕES" value={String(sales.length)} sub="todos os status" />
            </div>

            {/* Status por produto — um card por produto que o cliente assina */}
            <div>
              <p className="telemetry-label text-muted-foreground/60 mb-1.5">ASSINATURAS POR PRODUTO</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {porProduto.map((p) => (
                  <div
                    key={p.produto}
                    className={cn(
                      'border p-3 bg-card',
                      p.ativo ? 'border-primary/40' : 'border-border',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-foreground flex-1">{p.produto}</span>
                      <span className={cn('text-[10px] px-2 py-0.5 border whitespace-nowrap',
                        p.ativo ? 'border-primary/40 text-primary' : 'border-border text-muted-foreground')}>
                        {p.ativo ? '● ATIVO' : '○ EXPIRADO'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="text-muted-foreground">
                        {p.expira ? (p.ativo ? `expira ${dOnly(p.expira)}` : `expirou ${dOnly(p.expira)}`) : 'sem expiração'}
                      </span>
                      <span className="font-mono text-primary tabular-nums">{money(p.pago)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                      {(p.modalidade || '').replace('Assinatura ', '')} · {p.pagamentos} pagamento{p.pagamentos === 1 ? '' : 's'}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quebra por status */}
            <div className="flex flex-wrap gap-2">
              {byStatus.map(([st, n]) => (
                <span key={st} className={cn('text-xs px-2 py-1 border border-border bg-card', STATUS_TONE[st] || 'text-muted-foreground')}>
                  {st}: <b className="font-mono">{n}</b>
                </span>
              ))}
            </div>

            {/* Tabela completa de transações */}
            <div>
              <p className="telemetry-label text-muted-foreground/60 mb-1.5">TODAS AS TRANSAÇÕES ({sales.length})</p>
              <table className="w-full text-xs table-fixed">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="telemetry-label text-muted-foreground py-1.5 px-1.5 w-[15%]">Data</th>
                    <th className="telemetry-label text-muted-foreground py-1.5 px-1.5 w-[26%]">Produto</th>
                    <th className="telemetry-label text-muted-foreground py-1.5 px-1.5 w-[12%]">Tipo</th>
                    <th className="telemetry-label text-muted-foreground py-1.5 px-1.5 w-[11%]">Modalid.</th>
                    <th className="telemetry-label text-muted-foreground py-1.5 px-1.5 w-[12%]">Pgto.</th>
                    <th className="telemetry-label text-muted-foreground py-1.5 px-1.5 w-[12%]">Status</th>
                    <th className="telemetry-label text-muted-foreground py-1.5 px-1.5 w-[12%] text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s) => (
                    <tr key={s.id_venda} className="border-b border-border/50 align-top">
                      <td className="py-1.5 px-1.5 font-mono">{dOnly(s.data_venda)}</td>
                      <td className="py-1.5 px-1.5">
                        <span className="block truncate text-foreground/90" title={s.produto || ''}>{s.produto || '—'}</span>
                        {s.cupom && <span className="block text-[10px] text-primary/70 truncate">cupom: {s.cupom}</span>}
                      </td>
                      <td className="py-1.5 px-1.5">{s.tipo_venda === 'Renovação' ? 'Renov.' : 'Nova'}</td>
                      <td className="py-1.5 px-1.5 text-muted-foreground">{(s.modalidade || '').replace('Assinatura ', '') || '—'}</td>
                      <td className="py-1.5 px-1.5 text-muted-foreground truncate" title={s.forma_pagamento || ''}>{s.forma_pagamento === 'Cartão de Crédito' ? 'Cartão' : (s.forma_pagamento || '—')}</td>
                      <td className={cn('py-1.5 px-1.5', STATUS_TONE[s.status || ''] || 'text-muted-foreground')}>
                        {s.status || '—'}
                      </td>
                      <td className="py-1.5 px-1.5 font-mono text-right whitespace-nowrap">{money(Number(s.valor) || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Box({ label, value, sub, accent, tone }: { label: string; value: string; sub: string; accent?: boolean; tone?: 'ok' | 'bad' }) {
  const toneClass = tone === 'ok' ? 'text-primary' : tone === 'bad' ? 'text-destructive' : accent ? 'text-primary' : '';
  return (
    <div className="bg-card p-3">
      <p className="telemetry-label text-muted-foreground">{label}</p>
      <p className={cn('text-lg font-bold font-mono mt-0.5 tabular-nums', toneClass)}>{value}</p>
      <p className="text-[10px] text-muted-foreground/50 mt-0.5">{sub}</p>
    </div>
  );
}

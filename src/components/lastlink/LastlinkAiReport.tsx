import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, subMonths, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Sparkles, Loader2, History, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabaseProcedures } from '@/lib/supabaseProcedures';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

// Estrutura que a IA devolve (via tool use na Edge Function lastlink-report).
interface RelatorioIA {
  resumo?: string;
  diagnostico?: string[];
  achado_principal?: string;
  leitura_mensal?: string;
  recomendacoes?: string[];
  sinal_positivo?: string;
}

interface ReportRow {
  id: string;
  created_at: string;
  created_by: string | null;
  produto: string | null;
  mes_inicio: string;
  mes_fim: string;
  relatorio: RelatorioIA;
}

// Primeiro dia do mês, N meses atrás, como "YYYY-MM-01".
function mesISO(monthsAgo: number): string {
  return format(startOfMonth(subMonths(new Date(), monthsAgo)), 'yyyy-MM-01');
}
// Opções pro seletor: últimos 13 meses (do atual pra trás).
const MES_OPCOES = Array.from({ length: 13 }, (_, i) => {
  const d = startOfMonth(subMonths(new Date(), i));
  return { value: format(d, 'yyyy-MM-01'), label: format(d, 'MMM/yyyy', { locale: ptBR }) };
});

function fmtMesLabel(iso: string): string {
  // iso = YYYY-MM-01
  const [y, m] = iso.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return format(d, 'MMM/yyyy', { locale: ptBR });
}

// Histórico de relatórios (tabela lastlink_ai_reports), filtrado pelo produto atual.
function useHistorico(produto: string | null) {
  return useQuery({
    queryKey: ['lastlink_ai_reports', produto ?? 'todos'],
    queryFn: async (): Promise<ReportRow[]> => {
      let q = supabaseProcedures
        .from('lastlink_ai_reports')
        .select('id, created_at, created_by, produto, mes_inicio, mes_fim, relatorio')
        .order('created_at', { ascending: false })
        .limit(20);
      q = produto ? q.eq('produto', produto) : q.is('produto', null);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ReportRow[];
    },
    staleTime: 10000,
  });
}

export function LastlinkAiReport({ produto }: { produto: string | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  // Intervalo padrão: 4 meses atrás → mês atual (como o exemplo mar→jun).
  const [mesInicio, setMesInicio] = useState(() => mesISO(3));
  const [mesFim, setMesFim] = useState(() => mesISO(0));
  const [gerando, setGerando] = useState(false);
  const [aberto, setAberto] = useState<RelatorioIA | null>(null);
  const [abertoMeta, setAbertoMeta] = useState<{ produto: string | null; de: string; ate: string } | null>(null);

  const { data: historico = [] } = useHistorico(produto);

  async function gerar() {
    if (mesInicio > mesFim) {
      toast({ title: 'Intervalo inválido', description: 'O mês inicial deve ser anterior ou igual ao final.', variant: 'destructive' });
      return;
    }
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke('lastlink-report', {
        body: { produto, mesInicio, mesFim },
      });
      if (error) {
        // motivo real do corpo (403/409/500)
        let motivo = error instanceof Error ? error.message : 'Erro desconhecido';
        const ctx = (error as any)?.context;
        if (ctx && typeof ctx.json === 'function') {
          try { const b = await ctx.json(); if (b?.error) motivo = b.error; } catch { /* noop */ }
        }
        toast({ title: 'Não foi possível gerar', description: motivo, variant: 'destructive' });
        return;
      }
      if (data?.ok === false) {
        toast({ title: 'Sem dados', description: data.error ?? 'Nada no período.', variant: 'destructive' });
        return;
      }
      setAberto(data.relatorio as RelatorioIA);
      setAbertoMeta({ produto, de: mesInicio, ate: mesFim });
      qc.invalidateQueries({ queryKey: ['lastlink_ai_reports'] });
      toast({ title: 'Relatório gerado', description: 'Análise criada com IA e salva no histórico.' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      toast({ title: 'Erro ao gerar', description: msg, variant: 'destructive' });
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="border border-border">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
        <p className="telemetry-label text-muted-foreground/60 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-primary" /> RELATÓRIO DE VENDAS COM IA
        </p>
        <span className="text-[10px] text-muted-foreground/50">
          {produto ? produto : 'Todos os produtos'}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Seletor de intervalo + gerar */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">De</label>
            <select value={mesInicio} onChange={(e) => setMesInicio(e.target.value)}
              className="h-9 px-3 text-sm bg-background border border-border outline-none focus:border-primary block">
              {MES_OPCOES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">Até</label>
            <select value={mesFim} onChange={(e) => setMesFim(e.target.value)}
              className="h-9 px-3 text-sm bg-background border border-border outline-none focus:border-primary block">
              {MES_OPCOES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <Button onClick={gerar} disabled={gerando} className="h-9">
            {gerando ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Gerando análise…</>) : (<><Sparkles className="w-4 h-4 mr-2" />Gerar análise com IA</>)}
          </Button>
        </div>

        {/* Histórico */}
        <div>
          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wide flex items-center gap-1.5 mb-2">
            <History className="w-3 h-3" /> Relatórios anteriores
          </p>
          {historico.length === 0 ? (
            <p className="text-xs text-muted-foreground/50">Nenhum relatório gerado ainda para este produto.</p>
          ) : (
            <div className="divide-y divide-border border border-border">
              {historico.map((r) => (
                <button
                  key={r.id}
                  onClick={() => { setAberto(r.relatorio); setAbertoMeta({ produto: r.produto, de: r.mes_inicio, ate: r.mes_fim }); }}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-accent/40 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0" />
                    <span className="text-sm truncate">
                      {fmtMesLabel(r.mes_inicio)} → {fmtMesLabel(r.mes_fim)}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">
                    {format(new Date(r.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal com a análise */}
      <Dialog open={!!aberto} onOpenChange={(o) => { if (!o) { setAberto(null); setAbertoMeta(null); } }}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto bg-card border border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> Análise de Vendas
            </DialogTitle>
            <DialogDescription>
              {abertoMeta && (<>
                {abertoMeta.produto ?? 'Todos os produtos'} · {fmtMesLabel(abertoMeta.de)} → {fmtMesLabel(abertoMeta.ate)}
              </>)}
            </DialogDescription>
          </DialogHeader>

          {aberto && (
            <div className="space-y-5 text-sm leading-relaxed">
              {aberto.resumo && (
                <Secao titulo="Resumo"><p className="text-muted-foreground">{aberto.resumo}</p></Secao>
              )}
              {aberto.achado_principal && (
                <div className="border-l-2 border-destructive bg-destructive/5 px-4 py-3 rounded-r">
                  <p className="text-xs font-semibold text-destructive mb-1">ACHADO PRINCIPAL</p>
                  <p className="text-foreground/90">{aberto.achado_principal}</p>
                </div>
              )}
              {aberto.diagnostico && aberto.diagnostico.length > 0 && (
                <Secao titulo="Diagnóstico">
                  <ul className="space-y-1.5">
                    {aberto.diagnostico.map((d, i) => (
                      <li key={i} className="text-muted-foreground flex gap-2">
                        <span className="text-primary flex-shrink-0">▸</span><span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </Secao>
              )}
              {aberto.leitura_mensal && (
                <Secao titulo="Leitura mês a mês"><p className="text-muted-foreground">{aberto.leitura_mensal}</p></Secao>
              )}
              {aberto.sinal_positivo && (
                <div className="border-l-2 border-primary bg-primary/5 px-4 py-3 rounded-r">
                  <p className="text-xs font-semibold text-primary mb-1">SINAL POSITIVO</p>
                  <p className="text-foreground/90">{aberto.sinal_positivo}</p>
                </div>
              )}
              {aberto.recomendacoes && aberto.recomendacoes.length > 0 && (
                <Secao titulo="Recomendações">
                  <ul className="space-y-1.5">
                    {aberto.recomendacoes.map((r, i) => (
                      <li key={i} className="text-muted-foreground flex gap-2">
                        <span className="text-primary flex-shrink-0">▸</span><span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </Secao>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/80 mb-2">{titulo}</h3>
      {children}
    </div>
  );
}

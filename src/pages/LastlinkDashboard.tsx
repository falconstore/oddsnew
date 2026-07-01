import { useState, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, subMonths, addMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  UploadCloud, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, BarChart3,
  RefreshCw, ChevronLeft, ChevronRight, TrendingUp, Users, CreditCard,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid,
} from 'recharts';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { supabaseProcedures, isProceduresSupabaseConfigured } from '@/lib/supabaseProcedures';
import { importLastlinkFile, ImportResult } from '@/lib/lastlinkImport';
import { LastlinkCalendar, DailyPoint } from '@/components/lastlink/LastlinkCalendar';
import { UserRenewalsReport } from '@/components/lastlink/UserRenewalsReport';
import { DaySalesModal } from '@/components/lastlink/DaySalesModal';
import { LastlinkAiReport } from '@/components/lastlink/LastlinkAiReport';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const intl = (v: number) => v.toLocaleString('pt-BR');

// ── Queries (consomem as views SQL) ──
// produto = 'todos' → views agregadas gerais; senão → views *_prod filtradas.
const ALL = 'todos';

function useOverview(produto: string) {
  return useQuery({
    queryKey: ['lastlink_overview', produto],
    queryFn: async () => {
      if (!isProceduresSupabaseConfigured()) return null;
      if (produto === ALL) {
        const { data, error } = await supabaseProcedures.from('lastlink_overview').select('*').maybeSingle();
        if (error) throw error;
        return data as any;
      }
      const { data, error } = await supabaseProcedures
        .from('lastlink_overview_prod').select('*').eq('produto', produto).maybeSingle();
      if (error) throw error;
      return data as any;
    },
    staleTime: 15000,
  });
}

function useDaily(produto: string) {
  return useQuery({
    queryKey: ['lastlink_daily', produto],
    queryFn: async (): Promise<DailyPoint[]> => {
      if (!isProceduresSupabaseConfigured()) return [];
      if (produto === ALL) {
        const { data, error } = await supabaseProcedures
          .from('lastlink_daily').select('*').order('dia', { ascending: true });
        if (error) throw error;
        return (data ?? []) as DailyPoint[];
      }
      const { data, error } = await supabaseProcedures
        .from('lastlink_daily_prod').select('dia,vendas,novas,renovacoes,receita')
        .eq('produto', produto).order('dia', { ascending: true });
      if (error) throw error;
      return (data ?? []) as DailyPoint[];
    },
    staleTime: 15000,
  });
}

function useByProduct() {
  return useQuery({
    queryKey: ['lastlink_by_product'],
    queryFn: async () => {
      if (!isProceduresSupabaseConfigured()) return [];
      const { data, error } = await supabaseProcedures.from('lastlink_by_product').select('*');
      if (error) throw error;
      return (data ?? []) as any[];
    },
    staleTime: 15000,
  });
}

export default function LastlinkDashboard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [produtoFiltro, setProdutoFiltro] = useState<string>(ALL);

  const { data: ov, isLoading: loadingOv, isFetching, refetch } = useOverview(produtoFiltro);
  const { data: daily = [] } = useDaily(produtoFiltro);
  const { data: byProduct = [] } = useByProduct();

  function refetchAll() {
    qc.invalidateQueries({ queryKey: ['lastlink_overview'] });
    qc.invalidateQueries({ queryKey: ['lastlink_daily'] });
    qc.invalidateQueries({ queryKey: ['lastlink_by_product'] });
    refetch();
  }

  async function handleFile(file: File) {
    if (!file.name.match(/\.xlsx?$/i)) {
      toast({ title: 'Formato inválido', description: 'Envie o arquivo .xlsx exportado da Lastlink.', variant: 'destructive' });
      return;
    }
    setImporting(true); setResult(null); setProgress({ done: 0, total: 0 });
    try {
      const res = await importLastlinkFile(file, (done, total) => setProgress({ done, total }));
      setResult(res);
      if (res.erro) toast({ title: 'Erro no import', description: res.erro, variant: 'destructive' });
      else { toast({ title: 'Import concluído', description: `${res.enviados} vendas processadas.` }); refetchAll(); }
    } catch (e: any) {
      toast({ title: 'Falha ao ler arquivo', description: e?.message ?? 'Erro inesperado', variant: 'destructive' });
    } finally { setImporting(false); setProgress(null); }
  }

  // Dados do mês selecionado pro calendário + gráfico
  const monthDaily = useMemo(() => {
    const s = startOfMonth(month), e = endOfMonth(month);
    return daily.filter((d) => {
      const dt = new Date(d.dia + 'T12:00:00');
      return dt >= s && dt <= e;
    });
  }, [daily, month]);

  const monthTotals = useMemo(() => {
    return monthDaily.reduce(
      (a, d) => ({ vendas: a.vendas + d.vendas, novas: a.novas + d.novas, renov: a.renov + d.renovacoes, receita: a.receita + Number(d.receita) }),
      { vendas: 0, novas: 0, renov: 0, receita: 0 },
    );
  }, [monthDaily]);

  const chartData = monthDaily.map((d) => ({
    dia: format(new Date(d.dia + 'T12:00:00'), 'dd'),
    Novas: d.novas,
    Renovações: d.renovacoes,
  }));

  const ticket = ov && ov.aprovadas > 0 ? Number(ov.receita) / ov.aprovadas : 0;

  return (
    <Layout>
      <div className="space-y-5 animate-fade-in">
        <PageHeader
          eyebrow="LASTLINK"
          title="Dashboard Lastlink"
          subtitle="SUBA O RELATÓRIO DE VENDAS (.XLSX) — OS DADOS ACUMULAM SEM DUPLICAR"
          icon={BarChart3}
          actions={
            <button type="button" onClick={refetchAll} disabled={isFetching}
              className="inline-flex items-center gap-1.5 h-9 px-3 text-xs border border-border text-muted-foreground hover:bg-accent transition-colors">
              <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
              Atualizar
            </button>
          }
        />

        {/* Upload */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
          onClick={() => !importing && fileRef.current?.click()}
          className={cn('cursor-pointer border border-dashed p-6 text-center transition-colors',
            dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
            importing && 'pointer-events-none opacity-70')}
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
          {importing ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
              <p className="text-sm">Importando… {progress ? `${progress.done}/${progress.total}` : ''}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <UploadCloud className="w-7 h-7 text-muted-foreground/60" />
              <p className="text-sm font-medium">Arraste o <span className="text-primary">sales_list_*.xlsx</span> ou clique pra selecionar</p>
              <p className="telemetry-label text-muted-foreground/50">UPSERT POR IDENTIFICADOR DA VENDA — REENVIAR NÃO DUPLICA</p>
            </div>
          )}
        </div>

        {result && !result.erro && (
          <div className="flex items-center gap-2 border border-primary/30 bg-primary/5 p-3 text-sm">
            <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
            <span><b>{result.enviados}</b> vendas processadas (de {result.totalNoArquivo} no arquivo).</span>
          </div>
        )}
        {result?.erro && (
          <div className="flex items-center gap-2 border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" /><span>{result.erro}</span>
          </div>
        )}

        {/* Filtro por produto — afeta o dashboard inteiro */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="telemetry-label text-muted-foreground/60">FILTRAR POR PRODUTO:</span>
          <select
            value={produtoFiltro}
            onChange={(e) => setProdutoFiltro(e.target.value)}
            className="h-9 px-3 text-sm bg-background border border-border outline-none focus:border-primary w-full sm:w-auto sm:min-w-[260px]"
          >
            <option value={ALL}>Todos os produtos</option>
            {byProduct.map((p: any) => (
              <option key={p.produto} value={p.produto}>{p.produto}</option>
            ))}
          </select>
          {produtoFiltro !== ALL && (
            <button
              onClick={() => setProdutoFiltro(ALL)}
              className="h-9 px-3 text-xs border border-primary/40 text-primary hover:bg-primary/10 transition-colors"
            >
              limpar filtro
            </button>
          )}
        </div>

        {/* Relatório de vendas com IA (respeita o produto filtrado) */}
        <LastlinkAiReport produto={produtoFiltro === ALL ? null : produtoFiltro} />

        {/* KPIs GERAIS (todo o histórico) */}
        <div>
          <p className="telemetry-label text-muted-foreground/50 mb-2">
            {produtoFiltro === ALL ? 'VISÃO GERAL — TODO O HISTÓRICO' : `VISÃO GERAL — ${produtoFiltro.toUpperCase()}`}
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border">
            <Kpi label="RECEITA APROVADA" value={loadingOv ? '—' : money(Number(ov?.receita ?? 0))} sub={`ticket médio ${money(ticket)}`} accent icon={TrendingUp} />
            <Kpi label="VENDAS APROVADAS" value={loadingOv ? '—' : intl(ov?.aprovadas ?? 0)} sub={`${intl(ov?.novas ?? 0)} novas · ${intl(ov?.renovacoes ?? 0)} renov.`} />
            <Kpi label="CLIENTES ÚNICOS" value={loadingOv ? '—' : intl(ov?.clientes_unicos ?? 0)} sub="e-mails distintos" icon={Users} />
            <Kpi label="PAGAMENTO" value={loadingOv ? '—' : `${intl(ov?.pagas_pix ?? 0)} Pix`} sub={`${intl(ov?.pagas_cartao ?? 0)} cartão`} icon={CreditCard} />
          </div>
        </div>

        {/* Status não-aprovados (informativo) */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-px bg-border border border-border">
          <MiniKpi label="EXPIRADAS" value={intl(ov?.expiradas ?? 0)} tone="muted" />
          <MiniKpi label="CANCELADAS" value={intl(ov?.canceladas ?? 0)} tone="warn" />
          <MiniKpi label="REEMBOLSADAS" value={intl(ov?.reembolsadas ?? 0)} tone="warn" />
          <MiniKpi label="CHARGEBACK" value={intl(ov?.chargebacks ?? 0)} tone="bad" />
          <MiniKpi label="PENDENTES" value={intl(ov?.pendentes ?? 0)} tone="muted" />
        </div>

        {/* Seletor de mês */}
        <div className="flex items-center justify-between">
          <p className="telemetry-label text-muted-foreground/50">RECORTE MENSAL</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setMonth((m) => subMonths(m, 1))} className="h-8 w-8 flex items-center justify-center border border-border text-muted-foreground hover:bg-accent">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="telemetry-label text-foreground min-w-[120px] text-center">
              {format(month, 'MMMM yyyy', { locale: ptBR }).toUpperCase()}
            </span>
            <button onClick={() => setMonth((m) => addMonths(m, 1))} className="h-8 w-8 flex items-center justify-center border border-border text-muted-foreground hover:bg-accent">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* KPIs do mês */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border">
          <Kpi label="RECEITA DO MÊS" value={money(monthTotals.receita)} sub="aprovada" accent />
          <Kpi label="VENDAS DO MÊS" value={intl(monthTotals.vendas)} sub="aprovadas" />
          <Kpi label="NOVAS" value={intl(monthTotals.novas)} sub="no mês" />
          <Kpi label="RENOVAÇÕES" value={intl(monthTotals.renov)} sub="no mês" />
        </div>

        {/* Calendário diário — clique no dia abre detalhe por produto */}
        <LastlinkCalendar data={monthDaily} selectedMonth={month} onDayClick={setSelectedDay} />
        <DaySalesModal day={selectedDay} produto={produtoFiltro === ALL ? null : produtoFiltro} onClose={() => setSelectedDay(null)} />

        {/* Gráfico do mês: novas vs renovações por dia */}
        <div className="panel-bracket p-4">
          <p className="telemetry-label text-primary mb-3">[ NOVAS vs RENOVAÇÕES — POR DIA ]</p>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sem vendas neste mês.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="dia" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                <RTooltip
                  contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 0, fontSize: 12 }}
                  cursor={{ fill: 'hsl(var(--accent))' }}
                />
                <Bar dataKey="Novas" stackId="a" fill="hsl(var(--primary))" />
                <Bar dataKey="Renovações" stackId="a" fill="hsl(var(--primary) / 0.45)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Por produto */}
        <div className="panel-bracket p-4">
          <p className="telemetry-label text-primary mb-3">[ RECEITA POR PRODUTO — HISTÓRICO ]</p>
          <div className="grid grid-cols-1 gap-px bg-border border border-border">
            {byProduct.map((p) => (
              <div key={p.produto} className="bg-card px-3 py-2 flex items-center gap-3">
                <span className="text-sm text-foreground flex-1 truncate">{p.produto}</span>
                <span className="telemetry-label text-muted-foreground">{intl(p.novas)}N · {intl(p.renovacoes)}R</span>
                <span className="text-sm font-mono text-primary tabular-nums w-32 text-right">{money(Number(p.receita))}</span>
              </div>
            ))}
            {byProduct.length === 0 && <div className="bg-card px-3 py-6 text-center text-sm text-muted-foreground">Sem dados.</div>}
          </div>
        </div>

        {/* Relatório de renovações por usuário (Fase 3) */}
        <UserRenewalsReport />
      </div>
    </Layout>
  );
}

function Kpi({ label, value, sub, accent, icon: Icon }: { label: string; value: string; sub: string; accent?: boolean; icon?: any }) {
  return (
    <div className="bg-card p-4">
      <p className="telemetry-label text-muted-foreground flex items-center gap-1.5">{Icon && <Icon className="w-3 h-3" />}{label}</p>
      <p className={cn('text-2xl font-bold font-mono mt-1 tabular-nums', accent && 'text-primary')}>{value}</p>
      <p className="text-[10px] text-muted-foreground/50 mt-0.5">{sub}</p>
    </div>
  );
}

function MiniKpi({ label, value, tone }: { label: string; value: string; tone: 'muted' | 'warn' | 'bad' }) {
  const c = { muted: 'text-muted-foreground', warn: 'text-warning', bad: 'text-destructive' }[tone];
  return (
    <div className="bg-card p-3">
      <p className="telemetry-label text-muted-foreground/60">{label}</p>
      <p className={cn('text-lg font-bold font-mono mt-0.5 tabular-nums', c)}>{value}</p>
    </div>
  );
}

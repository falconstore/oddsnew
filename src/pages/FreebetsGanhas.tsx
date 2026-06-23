// Aba "FreeBets Ganhas" — paridade FULL com FreeBet PRO (doc 04).
//
// - 4 KPIs no topo + 1 KPI de lucro líquido total
// - Filtros pills: período (hoje/7d/mês/tudo) × status (todas/falta_girar/concluida)
// - Período persiste em localStorage (chave: shark_freebets_ganhas_periodo)
// - Ordenação: falta_girar > queimando > concluida
// - Lucro líquido = etapa1 (resultado_lucro do GANHAR_FB) + etapa2 (resultado_lucro
//   ou lucro_prejuizo_previsto do QUEIMAR_FB que aponta pra ele)
import { useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { useProcedures } from '@/hooks/useProcedures';
import { Procedure } from '@/types/procedures';
import { usePersistedState } from '@/hooks/usePersistedState';
import { Ticket, Clock, Flame, CheckCircle2, AlertCircle, TrendingUp, Trophy } from 'lucide-react';

type Periodo = 'hoje' | 'semana' | 'mes' | 'todos';
type StatusFilter = 'todas' | 'falta_girar' | 'queimando' | 'concluida';

interface FreebetCiclo {
  origem: Procedure;
  queimador: Procedure | null;
  fb_ganha_valor: number;
  etapa1_lp: number;
  etapa2_lp: number;
  lucro_liquido_ciclo: number;
  ciclo_completo: boolean;
  status_label: 'falta_girar' | 'queimando' | 'concluida';
}

function inPeriodo(iso: string | null | undefined, periodo: Periodo): boolean {
  if (!iso) return false;
  if (periodo === 'todos') return true;
  const d = new Date(iso).getTime();
  const now = Date.now();
  if (periodo === 'hoje') {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return d >= hoje.getTime();
  }
  if (periodo === 'semana') return d >= now - 7 * 86400000;
  if (periodo === 'mes') {
    const mes = new Date();
    mes.setDate(1);
    mes.setHours(0, 0, 0, 0);
    return d >= mes.getTime();
  }
  return true;
}

function buildCiclos(procedures: Procedure[], periodo: Periodo): FreebetCiclo[] {
  const ativos = procedures.filter((p) => !p.archived);
  const queimadoresPorOrigem = new Map<string, Procedure>();
  for (const p of ativos) {
    if (p.tipo !== 'QUEIMAR_FB') continue;
    // Multi-origem: indexa pelo array (fallback singular pra linhas legadas).
    const ids = p.freebet_reference_ids && p.freebet_reference_ids.length > 0
      ? p.freebet_reference_ids
      : (p.freebet_reference_id ? [p.freebet_reference_id] : []);
    for (const id of ids) {
      queimadoresPorOrigem.set(id, p);
    }
  }
  const ciclos: FreebetCiclo[] = [];
  for (const g of ativos) {
    const fbGanhaValor = Number(g.resultado_freebet_ganha ?? 0);
    if (fbGanhaValor <= 0) continue;
    if (!inPeriodo(g.updated_date ?? g.created_date ?? g.date, periodo)) continue;

    const q = queimadoresPorOrigem.get(g.id) ?? null;
    const etapa1 = Number(g.resultado_lucro ?? 0);
    const etapa2 = q
      ? Number(q.resultado_lucro ?? q.lucro_prejuizo_previsto ?? 0)
      : 0;
    const ciclo_completo = !!(q && (q.resultado_lucro != null || q.lucro_prejuizo_previsto != null));
    const status_label: FreebetCiclo['status_label'] = !q
      ? 'falta_girar'
      : ciclo_completo
        ? 'concluida'
        : 'queimando';

    ciclos.push({
      origem: g,
      queimador: q,
      fb_ganha_valor: fbGanhaValor,
      etapa1_lp: etapa1,
      etapa2_lp: etapa2,
      lucro_liquido_ciclo: etapa1 + etapa2,
      ciclo_completo,
      status_label,
    });
  }
  // Ordenação: falta_girar > queimando > concluida; dentro de cada bucket, mais recente primeiro.
  const order = { falta_girar: 0, queimando: 1, concluida: 2 } as const;
  ciclos.sort((a, b) => {
    const oa = order[a.status_label];
    const ob = order[b.status_label];
    if (oa !== ob) return oa - ob;
    return (b.origem.updated_date ?? '').localeCompare(a.origem.updated_date ?? '');
  });
  return ciclos;
}

function brl(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function StatusBadge({ s }: { s: FreebetCiclo['status_label'] }) {
  if (s === 'falta_girar') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-destructive/15 text-destructive border border-destructive/30">
        <AlertCircle className="w-3 h-3" /> Falta Girar
      </span>
    );
  }
  if (s === 'queimando') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-warning/15 text-warning border border-warning/30">
        <Flame className="w-3 h-3" /> Queimando
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-primary/15 text-primary border border-primary/30">
      <CheckCircle2 className="w-3 h-3" /> Concluído
    </span>
  );
}

function KpiCard({ icon: Icon, label, value, accent, sub }: { icon: typeof Ticket; label: string; value: string; accent: string; sub?: string }) {
  return (
    <div className={`p-4 rounded-2xl border bg-gradient-to-br ${accent} relative overflow-hidden`}>
      <Icon className="absolute -right-3 -top-3 w-16 h-16 opacity-10" />
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1 font-mono">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

const PERIODO_LABELS: Record<Periodo, string> = {
  hoje: 'Hoje',
  semana: '7 dias',
  mes: 'Mês atual',
  todos: 'Tudo',
};

export default function FreebetsGanhas() {
  const { data: procedures = [], isLoading } = useProcedures();
  const [periodo, setPeriodo] = usePersistedState<Periodo>('shark_freebets_ganhas_periodo', 'mes');
  const [statusFiltro, setStatusFiltro] = usePersistedState<StatusFilter>('shark_freebets_ganhas_status', 'todas');

  const ciclos = useMemo(() => buildCiclos(procedures, periodo), [procedures, periodo]);

  const itens = useMemo(() => {
    if (statusFiltro === 'todas') return ciclos;
    return ciclos.filter((c) => c.status_label === statusFiltro);
  }, [ciclos, statusFiltro]);

  const kpis = useMemo(() => {
    const total_count = ciclos.length;
    const total_valor = ciclos.reduce((acc, c) => acc + c.fb_ganha_valor, 0);
    const aguardando = ciclos.filter((c) => c.origem.freebet_creditada == null);
    const creditadas = ciclos.filter((c) => c.origem.freebet_creditada === 'SIM');
    const naoCreditadas = ciclos.filter((c) => c.origem.freebet_creditada === 'NAO');
    const ciclosCompletos = ciclos.filter((c) => c.ciclo_completo);
    const lucroLiquidoTotal = ciclosCompletos.reduce((acc, c) => acc + c.lucro_liquido_ciclo, 0);
    return {
      total_count,
      total_valor,
      aguardando_count: aguardando.length,
      aguardando_valor: aguardando.reduce((a, c) => a + c.fb_ganha_valor, 0),
      creditadas_count: creditadas.length,
      creditadas_valor: creditadas.reduce((a, c) => a + c.fb_ganha_valor, 0),
      nao_creditadas_count: naoCreditadas.length,
      ciclos_completos_count: ciclosCompletos.length,
      lucro_liquido_total: lucroLiquidoTotal,
    };
  }, [ciclos]);

  const lucroLiquidoColor = kpis.lucro_liquido_total >= 0 ? 'text-primary' : 'text-destructive';

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-4 lg:p-6 space-y-5">
        {/* Header */}
        <PageHeader
          eyebrow="FB"
          title="FreeBets Ganhas"
          subtitle="CICLO DA FREEBET — QUEM GANHOU, QUEM QUEIMOU, QUANTO SOBROU."
          icon={Trophy}
          actions={
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Lucro líquido total (ciclos completos)</p>
              <p className={`text-2xl lg:text-3xl font-bold font-mono ${lucroLiquidoColor}`} data-testid="text-lucro-liquido-total">
                {brl(kpis.lucro_liquido_total)}
              </p>
            </div>
          }
        />

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon={Ticket}
            label="Total de FBs"
            value={String(kpis.total_count)}
            sub={brl(kpis.total_valor)}
            accent="from-primary/10 to-primary/0 border-primary/20"
          />
          <KpiCard
            icon={Clock}
            label="Aguardando crédito"
            value={String(kpis.aguardando_count)}
            sub={brl(kpis.aguardando_valor)}
            accent="from-warning/10 to-warning/0 border-warning/20"
          />
          <KpiCard
            icon={CheckCircle2}
            label="Creditadas"
            value={String(kpis.creditadas_count)}
            sub={brl(kpis.creditadas_valor)}
            accent="border-border"
          />
          <KpiCard
            icon={AlertCircle}
            label="Não vieram"
            value={String(kpis.nao_creditadas_count)}
            sub={`${kpis.ciclos_completos_count} ciclos completos`}
            accent="from-destructive/10 to-destructive/0 border-destructive/20"
          />
        </div>

        {/* Pills */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
            {(['hoje', 'semana', 'mes', 'todos'] as Periodo[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriodo(p)}
                data-testid={`pill-periodo-${p}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  periodo === p
                    ? 'bg-primary/20 text-primary shadow-inner'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {PERIODO_LABELS[p]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
            {(['todas', 'falta_girar', 'queimando', 'concluida'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFiltro(s)}
                data-testid={`tab-status-${s}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  statusFiltro === s
                    ? 'bg-muted text-foreground shadow-inner'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s === 'todas' ? 'Todas' : s === 'falta_girar' ? 'Falta Girar' : s === 'queimando' ? 'Queimando' : 'Concluídas'}
              </button>
            ))}
          </div>
        </div>

        {/* Lista */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
          {isLoading && (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando ciclos...</div>
          )}
          {!isLoading && itens.length === 0 && (
            <div className="p-12 text-center">
              <Trophy className="w-12 h-12 mx-auto text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground mt-3">Nenhuma freebet ganha no período/filtro selecionado.</p>
            </div>
          )}
          <ul className="divide-y divide-white/5">
            {itens.map((c) => {
              const lpColor = c.lucro_liquido_ciclo > 0 ? 'text-primary' : c.lucro_liquido_ciclo < 0 ? 'text-destructive' : 'text-muted-foreground';
              return (
                <li
                  key={c.origem.id}
                  data-testid={`row-freebet-ganha-${c.origem.id}`}
                  className="p-4 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-start gap-3 flex-wrap">
                    <StatusBadge s={c.status_label} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-mono font-semibold text-foreground">#{c.origem.procedure_number}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="font-medium">{c.origem.platform}</span>
                        {c.origem.partida_descricao && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground truncate">{c.origem.partida_descricao}</span>
                          </>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span>FB: <span className="text-primary font-mono">{brl(c.fb_ganha_valor)}</span></span>
                        <span>Etapa 1: <span className="font-mono">{brl(c.etapa1_lp)}</span></span>
                        {c.queimador && (
                          <span>Etapa 2 (#{c.queimador.procedure_number}): <span className="font-mono">{brl(c.etapa2_lp)}</span></span>
                        )}
                        {!c.queimador && <span className="text-warning">Aguardando ser queimada</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Líquido ciclo</p>
                      <p className={`text-lg font-bold font-mono ${lpColor}`}>
                        <TrendingUp className="w-3 h-3 inline mr-1" />
                        {brl(c.lucro_liquido_ciclo)}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Layout>
  );
}

import { usePersistedState } from '@/hooks/usePersistedState';
import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Activity, FileText, TrendingUp, CreditCard, Bot, ArrowRight,
  Calendar, Clock, Trophy, ChevronDown, Users,
  CheckCircle2, Gift, Layers, Pencil, Check, X, Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { PAGE_KEYS } from '@/types/auth';
import { cn } from '@/lib/utils';
import { useProcedures } from '@/hooks/useProcedures';
import { StatCard } from '@/components/procedures/ProcedureStats';
import { MountainChart } from '@/components/procedures/MountainChart';
import { CalendarChart } from '@/components/procedures/CalendarChart';
import {
  getCurrentMonthProfit,
  getAverageDailyProfit,
  getAverageProceduresPerDay,
  getTotalProceduresForMonth,
  getOpenProcedures,
  getOpenMatches,
  getBestPlatform,
  getDayWithMostProfit,
  getDayWithMostProcedures,
  getMountainChartData,
  getDailyProfitData,
  generateMonthOptions,
  capitalizeMonth,
  getDailyStats,
  getDuploGreenCount,
  getDuploGreenProfit,
} from '@/lib/procedureUtils';

const quickLinks = [
  { name: 'Procedimentos', href: '/procedures', icon: FileText, pageKey: PAGE_KEYS.PROCEDURE_CONTROL, description: 'Controle e acompanhe seus procedimentos' },
  { name: 'Betbra Affiliate', href: '/betbra', icon: TrendingUp, pageKey: PAGE_KEYS.BETBRA_AFFILIATE, description: 'Dados e estatísticas de afiliação' },
  { name: 'Assinaturas', href: '/subscriptions', icon: CreditCard, pageKey: PAGE_KEYS.SUBSCRIPTIONS, description: 'Gerencie assinantes e pagamentos' },
  { name: 'Bot Telegram', href: '/telegram-bot', icon: Bot, pageKey: PAGE_KEYS.TELEGRAM_BOT, description: 'Alertas automáticos de Duplo Green' },
];

// Cor semântica de dinheiro: verde (positivo) / vermelho (negativo). Só significado.
const money = (v: number) => (v >= 0 ? 'text-primary' : 'text-destructive');
const fmt = (v: number) => `${v >= 0 ? '+' : ''}R$ ${v.toFixed(2)}`;

function CpfInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  const confirm = () => {
    const n = parseInt(draft, 10);
    if (!isNaN(n) && n > 0) onChange(n);
    setEditing(false);
  };

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input
          autoFocus
          type="number"
          min={1}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') setEditing(false); }}
          className="w-16 bg-input border border-primary/50 rounded-[2px] px-1.5 py-0.5 text-sm text-center font-mono outline-none focus:border-primary"
        />
        <button onClick={confirm} className="text-primary hover:text-primary/80"><Check className="w-3.5 h-3.5" /></button>
        <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
      </span>
    );
  }
  return (
    <button
      onClick={() => { setDraft(String(value)); setEditing(true); }}
      className="inline-flex items-center gap-1 text-primary font-mono font-semibold hover:text-primary/80 transition-colors group"
    >
      {value}
      <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
    </button>
  );
}

const Dashboard = () => {
  const { canViewPage, user } = useAuth();
  const visibleLinks = quickLinks.filter(link => canViewPage(link.pageKey));
  const displayName = user?.user_metadata?.full_name?.split(' ')[0] || null;

  const { data: procedures = [] } = useProcedures();
  const [selectedMonth, setSelectedMonth] = usePersistedState('proc_month', new Date());
  const [numCpfs, setNumCpfs] = usePersistedState<number>('dashboard_num_cpfs', 10);

  const monthlyProfit = getCurrentMonthProfit(procedures, selectedMonth);
  const bestPlatform = getBestPlatform(procedures, selectedMonth);
  const dayWithMostProfit = getDayWithMostProfit(procedures, selectedMonth);
  const dayWithMostProcedures = getDayWithMostProcedures(procedures, selectedMonth);
  const daily = getDailyStats(procedures);
  const dgCount = getDuploGreenCount(procedures, selectedMonth);
  const dgProfit = getDuploGreenProfit(procedures, selectedMonth);

  const lucroPorCpf = daily.lucroBruto * numCpfs;
  const todayLabel = capitalizeMonth(format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR }));

  return (
    <Layout>
      <div className="animate-fade-in">

        <PageHeader
          eyebrow="OPS"
          title={displayName ? `Bem-vindo, ${displayName}` : 'Painel Administrativo'}
          subtitle="MONITORAMENTO E CONTROLE DE OPERAÇÕES"
          icon={Activity}
        />

        <div className="space-y-5">

          {/* ── SOMATÓRIA DO DIA ── */}
          <div className="panel-bracket bg-card" data-corner="accent">
            <div className="p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="status-dot" data-state="live" />
                    <span className="telemetry-label text-primary">AO VIVO</span>
                  </div>
                  <h2 className="text-base font-semibold text-foreground">Somatória do Dia</h2>
                  <p className="telemetry-label text-muted-foreground mt-0.5">{todayLabel}</p>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 border border-border bg-background">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="telemetry-label">CPFs</span>
                  <CpfInput value={numCpfs} onChange={setNumCpfs} />
                </div>
              </div>

              {/* KPIs grid — divisórias por hairline (grid gap 1px) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border">
                <DayKpi label="Operações" icon={Layers} value={daily.totalOperacoes}>
                  <div className="flex items-center gap-3 telemetry-label">
                    <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-primary" />{daily.operacoesEncerradas} ENC</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-warning" />{daily.operacoesAbertas} ABE</span>
                  </div>
                </DayKpi>

                <DayKpi label="Freebets" icon={Gift} value={daily.totalFreebets}>
                  <div className="flex flex-col gap-0.5">
                    {daily.totalFreebetsValor > 0 && (
                      <p className="telemetry-label text-foreground">R${daily.totalFreebetsValor.toFixed(2)} EM FB</p>
                    )}
                    <p className="telemetry-label text-muted-foreground">{daily.totalSemFb} SEM FREEBET</p>
                  </div>
                </DayKpi>

                <DayKpi label="Lucro Bruto" icon={TrendingUp} value={fmt(daily.lucroBruto)} valueClass={money(daily.lucroBruto)}>
                  <p className="telemetry-label text-muted-foreground">RESULTADO REAL DO DIA</p>
                </DayKpi>

                <DayKpi label="Por CPF" icon={Users} value={fmt(lucroPorCpf)} valueClass={money(lucroPorCpf)}>
                  <p className="telemetry-label text-muted-foreground">
                    COM <CpfInput value={numCpfs} onChange={setNumCpfs} /> CPFs
                  </p>
                </DayKpi>
              </div>
            </div>
          </div>

          {/* ── Seletor de Mês + Lucro ── */}
          <div className="panel p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-9 h-9 flex items-center justify-center border border-border text-primary">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <p className="telemetry-label text-muted-foreground">MÊS SELECIONADO</p>
                <Select value={selectedMonth.toISOString()} onValueChange={(v) => setSelectedMonth(new Date(v))}>
                  <SelectTrigger className="bg-transparent border-none p-0 h-auto text-lg font-semibold hover:text-primary transition-colors w-auto gap-1 focus:ring-0">
                    <SelectValue>
                      {capitalizeMonth(format(selectedMonth, 'MMMM', { locale: ptBR }))} {format(selectedMonth, 'yyyy')}
                    </SelectValue>
                    <ChevronDown className="w-4 h-4 opacity-50" />
                  </SelectTrigger>
                  <SelectContent>
                    {generateMonthOptions().map(option => (
                      <SelectItem key={option.value} value={option.value}>{capitalizeMonth(option.label)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <div className="text-right">
                <p className="telemetry-label text-muted-foreground">LUCRO DO MÊS</p>
                <p className={cn('kpi text-2xl font-semibold mt-1', money(monthlyProfit))}>{fmt(monthlyProfit)}</p>
              </div>
              <div className="text-right">
                <p className="telemetry-label text-muted-foreground">TOTAL PROC.</p>
                <p className="kpi text-2xl font-semibold text-foreground mt-1">{getTotalProceduresForMonth(procedures, selectedMonth)}</p>
              </div>
            </div>
          </div>

          {/* ── KPIs Row 1 ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard title="Lucro Mensal" value={`R$ ${getCurrentMonthProfit(procedures, selectedMonth).toFixed(2)}`} icon={TrendingUp} />
            <StatCard title="Lucro Médio Diário" value={`R$ ${getAverageDailyProfit(procedures, selectedMonth).toFixed(2)}`} icon={Activity} />
            <StatCard title="Média Proc./Dia" value={getAverageProceduresPerDay(procedures, selectedMonth)} icon={FileText} />
            <StatCard title="Proc. Abertos" value={getOpenProcedures(procedures, selectedMonth)} subtitle="Falta Girar Freebet" icon={Clock} />
            <StatCard title="Partidas Abertas" value={getOpenMatches(procedures, selectedMonth)} subtitle="Aguardando resultado" icon={Activity} />
          </div>

          {/* ── KPIs Row 2 ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard title="Melhor Plataforma" value={bestPlatform.name} subtitle={`R$ ${bestPlatform.profit.toFixed(2)} • ${bestPlatform.count} proc.`} icon={Trophy} />
            <StatCard title="Dia com Maior Lucro" value={dayWithMostProfit.date} subtitle={`R$ ${dayWithMostProfit.profit.toFixed(2)}`} icon={TrendingUp} />
            <StatCard title="Dia com Mais Proc." value={dayWithMostProcedures.date} subtitle={`${dayWithMostProcedures.count} procedimentos`} icon={FileText} />
          </div>

          {/* ── Duplo Green ── */}
          <div className="panel">
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-3.5 h-3.5 text-primary" />
                <span className="telemetry-label text-foreground">DUPLO GREEN</span>
                <span className="telemetry-label text-muted-foreground/60">— {capitalizeMonth(format(selectedMonth, 'MMMM/yyyy', { locale: ptBR }))}</span>
              </div>
              <div className="grid grid-cols-2 gap-px bg-border border border-border">
                <div className="bg-card p-4 flex flex-col gap-1.5">
                  <span className="telemetry-label text-muted-foreground">CONFIRMADOS</span>
                  <p className="kpi text-2xl font-semibold text-foreground">{dgCount}</p>
                  <p className="telemetry-label text-muted-foreground">NO MÊS SELECIONADO</p>
                </div>
                <div className="bg-card p-4 flex flex-col gap-1.5">
                  <span className="telemetry-label text-muted-foreground">LUCRO COM DG</span>
                  <p className={cn('kpi text-2xl font-semibold', money(dgProfit))}>{fmt(dgProfit)}</p>
                  <p className="telemetry-label text-muted-foreground">
                    {dgCount > 0 ? `≈ R$ ${(dgProfit / dgCount).toFixed(2)} POR DG` : 'NENHUM CONFIRMADO'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Gráficos ── */}
          <div className="grid grid-cols-1 gap-5">
            <CalendarChart
              data={getDailyProfitData(procedures, selectedMonth)}
              title="Calendário de Lucro/Prejuízo"
              selectedMonth={selectedMonth}
            />
            <MountainChart
              data={getMountainChartData(procedures, selectedMonth)}
              title="Evolução do Lucro (Inicial: R$ 1.000)"
            />
          </div>

          {/* ── Acesso Rápido ── */}
          {visibleLinks.length > 0 && (
            <div>
              <p className="telemetry-label text-muted-foreground mb-3">[ ACESSO RÁPIDO ]</p>
              <div className="grid gap-px bg-border border border-border grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {visibleLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className="group relative bg-card p-5 transition-colors duration-150 hover:bg-accent/40"
                  >
                    <div className="w-9 h-9 flex items-center justify-center mb-4 border border-border text-muted-foreground group-hover:text-primary group-hover:border-primary/40 transition-colors">
                      <link.icon className="h-4 w-4" />
                    </div>
                    <h3 className="font-medium text-sm mb-1">{link.name}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{link.description}</p>
                    <div className="flex items-center gap-1 mt-4 telemetry-label text-primary/70 group-hover:text-primary transition-colors">
                      <span>ACESSAR</span>
                      <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 telemetry-label text-muted-foreground/40 pb-4 pt-2">
            <span>BETSHARK PRO</span>
            <span>·</span>
            <span>CONSOLE DE OPERAÇÃO</span>
          </div>
        </div>
      </div>
    </Layout>
  );
};

// KPI do bloco "Somatória do Dia" — célula de grid com hairline.
function DayKpi({
  label, icon: Icon, value, valueClass, children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string | number;
  valueClass?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-card p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="telemetry-label">{label}</span>
      </div>
      <p className={cn('kpi text-2xl font-semibold leading-none', valueClass || 'text-foreground')}>{value}</p>
      {children}
    </div>
  );
}

export default Dashboard;

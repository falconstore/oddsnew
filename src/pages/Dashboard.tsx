import { usePersistedState } from '@/hooks/usePersistedState';
import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Layout } from '@/components/Layout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Zap, FileText, TrendingUp, CreditCard, Bot, ArrowRight,
  Activity, Calendar, Clock, Trophy, ChevronDown, Users,
  CheckCircle2, Gift, Layers, Pencil, Check, X,
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
} from '@/lib/procedureUtils';

const quickLinks = [
  {
    name: 'Procedimentos',
    href: '/procedures',
    icon: FileText,
    pageKey: PAGE_KEYS.PROCEDURE_CONTROL,
    description: 'Controle e acompanhe seus procedimentos',
    color: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/20',
    iconColor: 'text-cyan-400',
    glow: 'dark:hover:shadow-[0_0_30px_hsl(200_90%_58%/0.2)]',
  },
  {
    name: 'Betbra Affiliate',
    href: '/betbra',
    icon: TrendingUp,
    pageKey: PAGE_KEYS.BETBRA_AFFILIATE,
    description: 'Dados e estatísticas de afiliação',
    color: 'from-amber-500/20 to-amber-500/5 border-amber-500/20',
    iconColor: 'text-amber-400',
    glow: 'dark:hover:shadow-[0_0_30px_hsl(38_95%_58%/0.2)]',
  },
  {
    name: 'Assinaturas',
    href: '/subscriptions',
    icon: CreditCard,
    pageKey: PAGE_KEYS.SUBSCRIPTIONS,
    description: 'Gerencie assinantes e pagamentos',
    color: 'from-purple-500/20 to-purple-500/5 border-purple-500/20',
    iconColor: 'text-purple-400',
    glow: 'dark:hover:shadow-[0_0_30px_hsl(270_75%_65%/0.2)]',
  },
  {
    name: 'Bot Telegram',
    href: '/telegram-bot',
    icon: Bot,
    pageKey: PAGE_KEYS.TELEGRAM_BOT,
    description: 'Alertas automáticos de Duplo Green',
    color: 'from-pink-500/20 to-pink-500/5 border-pink-500/20',
    iconColor: 'text-pink-400',
    glow: 'dark:hover:shadow-[0_0_30px_hsl(340_80%_65%/0.2)]',
  },
];

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
          className="w-16 bg-white/10 border border-primary/40 rounded px-1.5 py-0.5 text-sm text-center font-bold outline-none focus:border-primary"
        />
        <button onClick={confirm} className="text-emerald-400 hover:text-emerald-300"><Check className="w-3.5 h-3.5" /></button>
        <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
      </span>
    );
  }
  return (
    <button
      onClick={() => { setDraft(String(value)); setEditing(true); }}
      className="inline-flex items-center gap-1 text-primary font-bold hover:text-primary/80 transition-colors group"
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

  const lucroPorCpf = numCpfs > 0 ? daily.lucroBruto / numCpfs : 0;
  const todayLabel = capitalizeMonth(format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR }));

  return (
    <Layout>
      <div className="space-y-5 animate-fade-in">

        {/* ── Hero ── */}
        <div className="relative rounded-2xl overflow-hidden border border-border/50 dark:border-primary/10 bg-card">
          <div className="absolute inset-0 hero-grid opacity-50" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-primary/10 rounded-full blur-3xl -translate-y-1/2" />
          <div className="relative z-10 px-8 py-10 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 dark:bg-primary/15 border border-primary/20 text-primary text-xs font-semibold mb-5 animate-fade-in-up">
              <Activity className="h-3.5 w-3.5 animate-pulse" />
              <span>Sistema Online</span>
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2 tracking-tight animate-fade-in-up delay-100">
              {displayName ? (
                <>Bem-vindo, <span className="gradient-text">{displayName}</span></>
              ) : (
                <span className="gradient-text">BetShark Pro</span>
              )}
            </h1>
            <p className="text-muted-foreground text-sm max-w-md mx-auto animate-fade-in-up delay-200">
              Sua plataforma profissional de monitoramento e controle de apostas esportivas
            </p>
          </div>
        </div>

        {/* ── RESUMO DO DIA ── */}
        <div className="relative rounded-2xl overflow-hidden border border-primary/20 bg-gradient-to-br from-[#0a1a0f] via-[#081510] to-[#060d08]">
          {/* glow de fundo */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(145_80%_48%/0.12)_0%,transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(145_80%_48%/0.07)_0%,transparent_60%)]" />

          <div className="relative z-10 p-5 sm:p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Ao Vivo</span>
                </div>
                <h2 className="text-lg font-bold text-foreground">Somatória do Dia</h2>
                <p className="text-xs text-muted-foreground">{todayLabel}</p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">CPFs:</span>
                <CpfInput value={numCpfs} onChange={setNumCpfs} />
              </div>
            </div>

            {/* KPIs grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

              {/* Operações */}
              <div className="rounded-xl bg-white/5 border border-white/8 p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Operações</span>
                </div>
                <p className="text-3xl font-black text-cyan-300 leading-none">{daily.totalOperacoes}</p>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    {daily.operacoesEncerradas} encerradas
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" />
                    {daily.operacoesAbertas} abertas
                  </span>
                </div>
              </div>

              {/* Freebets */}
              <div className="rounded-xl bg-white/5 border border-white/8 p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Gift className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Freebets</span>
                </div>
                <p className="text-3xl font-black text-purple-300 leading-none">{daily.totalFreebets}</p>
                <p className="text-[10px] text-muted-foreground">
                  {daily.totalSemFb} sem freebet
                </p>
              </div>

              {/* Lucro bruto */}
              <div className="rounded-xl bg-white/5 border border-white/8 p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Lucro Bruto</span>
                </div>
                <p className={cn(
                  'text-3xl font-black leading-none',
                  daily.lucroBruto >= 0 ? 'text-emerald-300' : 'text-red-400'
                )}>
                  {daily.lucroBruto >= 0 ? '+' : ''}R${daily.lucroBruto.toFixed(2)}
                </p>
                <p className="text-[10px] text-muted-foreground">resultado real do dia</p>
              </div>

              {/* Por CPF */}
              <div className="rounded-xl border p-4 flex flex-col gap-2 relative overflow-hidden
                bg-gradient-to-br from-primary/15 to-primary/5 border-primary/25">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(145_80%_48%/0.15)_0%,transparent_70%)]" />
                <div className="relative flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/30 flex items-center justify-center">
                    <Users className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Por CPF</span>
                </div>
                <p className={cn(
                  'relative text-3xl font-black leading-none',
                  lucroPorCpf >= 0 ? 'text-primary' : 'text-red-400'
                )}>
                  {lucroPorCpf >= 0 ? '+' : ''}R${lucroPorCpf.toFixed(2)}
                </p>
                <p className="relative text-[10px] text-muted-foreground">
                  com <CpfInput value={numCpfs} onChange={setNumCpfs} /> CPFs
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Seletor de Mês + Lucro Hero ── */}
        <div className="glass rounded-2xl border border-white/5 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Mês selecionado</p>
              <Select
                value={selectedMonth.toISOString()}
                onValueChange={(value) => setSelectedMonth(new Date(value))}
              >
                <SelectTrigger className="bg-transparent border-none p-0 h-auto text-lg font-bold hover:text-primary transition-colors w-auto gap-1 focus:ring-0">
                  <SelectValue>
                    {capitalizeMonth(format(selectedMonth, 'MMMM', { locale: ptBR }))} {format(selectedMonth, 'yyyy')}
                  </SelectValue>
                  <ChevronDown className="w-4 h-4 opacity-50" />
                </SelectTrigger>
                <SelectContent>
                  {generateMonthOptions().map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {capitalizeMonth(option.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Lucro do Mês</p>
              <p className={`text-2xl font-bold ${monthlyProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {monthlyProfit >= 0 ? '+' : ''}R$ {monthlyProfit.toFixed(2)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Total Proc.</p>
              <p className="text-2xl font-bold text-foreground">{getTotalProceduresForMonth(procedures, selectedMonth)}</p>
            </div>
          </div>
        </div>

        {/* ── KPIs Row 1 ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3">
          <StatCard
            title="Lucro Mensal"
            value={`R$ ${getCurrentMonthProfit(procedures, selectedMonth).toFixed(2)}`}
            icon={TrendingUp}
            color="green"
          />
          <StatCard
            title="Lucro Médio Diário"
            value={`R$ ${getAverageDailyProfit(procedures, selectedMonth).toFixed(2)}`}
            icon={Activity}
            color="purple"
          />
          <StatCard
            title="Média Proc./Dia"
            value={getAverageProceduresPerDay(procedures, selectedMonth)}
            icon={FileText}
            color="cyan"
          />
          <StatCard
            title="Proc. Abertos"
            value={getOpenProcedures(procedures, selectedMonth)}
            subtitle="Falta Girar Freebet"
            icon={Clock}
            color="amber"
          />
          <StatCard
            title="Partidas Abertas"
            value={getOpenMatches(procedures, selectedMonth)}
            subtitle="Aguardando resultado"
            icon={Activity}
            color="orange"
          />
        </div>

        {/* ── KPIs Row 2 ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-3">
          <StatCard
            title="Melhor Plataforma"
            value={bestPlatform.name}
            subtitle={`R$ ${bestPlatform.profit.toFixed(2)} • ${bestPlatform.count} proc.`}
            icon={Trophy}
            color="yellow"
          />
          <StatCard
            title="Dia com Maior Lucro"
            value={dayWithMostProfit.date}
            subtitle={`R$ ${dayWithMostProfit.profit.toFixed(2)}`}
            icon={TrendingUp}
            color="green"
          />
          <StatCard
            title="Dia com Mais Proc."
            value={dayWithMostProcedures.date}
            subtitle={`${dayWithMostProcedures.count} procedimentos`}
            icon={FileText}
            color="pink"
          />
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
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-bold">Acesso Rápido</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent" />
            </div>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {visibleLinks.map((link, i) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={cn(
                    'group relative rounded-xl border bg-card overflow-hidden',
                    'transition-all duration-300 hover:-translate-y-1',
                    'animate-fade-in-up',
                    link.color,
                    link.glow
                  )}
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className={cn(
                    'absolute inset-0 bg-gradient-to-br opacity-60 transition-opacity duration-300',
                    link.color.split(' ').slice(0, 2).join(' ')
                  )} />
                  <div className="relative p-5">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center mb-4',
                      'bg-background/50 dark:bg-white/5 border border-white/10',
                      'group-hover:scale-110 transition-transform duration-300'
                    )}>
                      <link.icon className={cn('h-5 w-5', link.iconColor)} />
                    </div>
                    <h3 className="font-semibold text-sm mb-1">{link.name}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{link.description}</p>
                    <div className="flex items-center gap-1 mt-4 text-xs font-medium text-primary/70 group-hover:text-primary transition-colors duration-200">
                      <span>Acessar</span>
                      <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform duration-200" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/50 pb-4">
          <Zap className="h-3 w-3 text-primary/40" />
          <span>BetShark Pro — Plataforma de monitoramento profissional</span>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;

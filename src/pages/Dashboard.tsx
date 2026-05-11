import { usePersistedState } from '@/hooks/usePersistedState';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Layout } from '@/components/Layout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Zap, FileText, TrendingUp, CreditCard, Bot, ArrowRight,
  Activity, Calendar, Clock, Trophy, ChevronDown,
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

const Dashboard = () => {
  const { canViewPage, user } = useAuth();
  const visibleLinks = quickLinks.filter(link => canViewPage(link.pageKey));
  const displayName = user?.user_metadata?.full_name?.split(' ')[0] || null;

  const { data: procedures = [] } = useProcedures();
  const [selectedMonth, setSelectedMonth] = usePersistedState('proc_month', new Date());

  const monthlyProfit = getCurrentMonthProfit(procedures, selectedMonth);
  const bestPlatform = getBestPlatform(procedures, selectedMonth);
  const dayWithMostProfit = getDayWithMostProfit(procedures, selectedMonth);
  const dayWithMostProcedures = getDayWithMostProcedures(procedures, selectedMonth);

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

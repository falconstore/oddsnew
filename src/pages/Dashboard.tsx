import { Layout } from '@/components/Layout';
import { Zap, FileText, TrendingUp, CreditCard, Bot, ArrowRight, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { PAGE_KEYS } from '@/types/auth';
import { cn } from '@/lib/utils';

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
    badge: 'cyan',
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
    badge: 'amber',
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
    badge: 'purple',
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
    badge: 'pink',
  },
];

const Dashboard = () => {
  const { canViewPage, user } = useAuth();
  const visibleLinks = quickLinks.filter(link => canViewPage(link.pageKey));
  const displayName = user?.user_metadata?.full_name?.split(' ')[0] || null;

  return (
    <Layout>
      <div className="space-y-10 animate-fade-in">
        {/* Hero Section */}
        <div className="relative rounded-2xl overflow-hidden border border-border/50 dark:border-primary/10 bg-card dark:bg-card">
          {/* Background pattern */}
          <div className="absolute inset-0 hero-grid opacity-50" />
          {/* Radial glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-primary/10 rounded-full blur-3xl -translate-y-1/2" />

          <div className="relative z-10 px-8 py-12 text-center">
            {/* Status badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 dark:bg-primary/15 border border-primary/20 text-primary text-xs font-semibold mb-6 animate-fade-in-up">
              <Activity className="h-3.5 w-3.5 animate-pulse" />
              <span>Sistema Online</span>
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 tracking-tight animate-fade-in-up delay-100">
              {displayName ? (
                <>Bem-vindo, <span className="gradient-text">{displayName}</span></>
              ) : (
                <span className="gradient-text">BetShark Pro</span>
              )}
            </h1>

            <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto animate-fade-in-up delay-200">
              Sua plataforma profissional de monitoramento e controle de apostas esportivas
            </p>

            <div className="flex items-center justify-center gap-6 mt-8 animate-fade-in-up delay-300">
              <div className="text-center">
                <div className="text-2xl font-bold gradient-text">{visibleLinks.length}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Módulos</div>
              </div>
              <div className="w-px h-10 bg-border/50" />
              <div className="text-center">
                <div className="text-2xl font-bold text-primary flex items-center gap-1">
                  <Zap className="h-5 w-5" />
                  Live
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Tempo real</div>
              </div>
              <div className="w-px h-10 bg-border/50" />
              <div className="text-center">
                <div className="text-2xl font-bold text-cyan-400">24/7</div>
                <div className="text-xs text-muted-foreground mt-0.5">Disponível</div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        {visibleLinks.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-lg font-bold">Acesso Rápido</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent" />
            </div>

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {visibleLinks.map((link, i) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={cn(
                    "group relative rounded-xl border bg-card overflow-hidden",
                    "transition-all duration-300 hover:-translate-y-1",
                    "animate-fade-in-up",
                    link.color,
                    link.glow
                  )}
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  {/* Background gradient */}
                  <div className={cn(
                    "absolute inset-0 bg-gradient-to-br opacity-60 transition-opacity duration-300",
                    link.color.split(' ').slice(0, 2).join(' ')
                  )} />

                  <div className="relative p-5">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center mb-4",
                      "bg-background/50 dark:bg-white/5 border border-white/10",
                      "group-hover:scale-110 transition-transform duration-300"
                    )}>
                      <link.icon className={cn("h-5 w-5", link.iconColor)} />
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

        {/* Footer info */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/50 pb-4">
          <Zap className="h-3 w-3 text-primary/40" />
          <span>BetShark Pro — Plataforma de monitoramento profissional</span>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;

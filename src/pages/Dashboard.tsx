import { Layout } from '@/components/Layout';
import { Zap, FileText, TrendingUp, CreditCard, Bot } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { PAGE_KEYS } from '@/types/auth';

const quickLinks = [
  { name: 'Procedimentos', href: '/procedures', icon: FileText, pageKey: PAGE_KEYS.PROCEDURE_CONTROL },
  { name: 'Betbra Affiliate', href: '/betbra', icon: TrendingUp, pageKey: PAGE_KEYS.BETBRA_AFFILIATE },
  { name: 'Assinaturas', href: '/subscriptions', icon: CreditCard, pageKey: PAGE_KEYS.SUBSCRIPTIONS },
  { name: 'Bot Telegram', href: '/telegram-bot', icon: Bot, pageKey: PAGE_KEYS.TELEGRAM_BOT },
];

const Dashboard = () => {
  const { canViewPage } = useAuth();

  return (
    <Layout>
      <div className="space-y-8">
        {/* Hero Section */}
        <div className="text-center py-6 sm:py-8 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm mb-4">
            <Zap className="h-4 w-4" />
            <span>Painel de controle</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 tracking-tight">
            BetShark Pro
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto">
            Acesse rapidamente as ferramentas do sistema
          </p>
        </div>

        {/* Quick Links */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 max-w-4xl mx-auto">
          {quickLinks.filter(link => canViewPage(link.pageKey)).map((link) => (
            <Link key={link.href} to={link.href} className="group">
              <Card variant="interactive" className="h-full overflow-hidden">
                <CardContent className="p-6 text-center relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative">
                    <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                      <link.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h2 className="text-sm font-semibold">{link.name}</h2>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;

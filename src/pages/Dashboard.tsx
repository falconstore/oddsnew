import { Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { StatsCards } from '@/components/StatsCards';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Zap } from 'lucide-react';

const Dashboard = () => {
  return (
    <Layout>
      <div className="space-y-8">
        {/* Hero Section */}
        <div className="text-center py-6 sm:py-8 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm mb-4">
            <Zap className="h-4 w-4" />
            <span>Monitoramento em tempo real</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 tracking-tight">
            BetShark Pro
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto">
            Escolha o esporte para monitorar odds e encontrar as melhores oportunidades
          </p>
        </div>

        {/* Sport Cards */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto">
          {/* Card Futebol */}
          <Link to="/monitor-futebol" className="group">
            <Card 
              variant="interactive"
              className="h-full overflow-hidden"
            >
              <CardContent className="p-6 sm:p-8 text-center relative">
                {/* Gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <div className="relative">
                  <span className="text-4xl sm:text-6xl mb-3 sm:mb-4 block transform group-hover:scale-110 transition-transform duration-300">
                    ⚽
                  </span>
                  <h2 className="text-lg sm:text-xl font-semibold mb-1">Monitor Futebol</h2>
                  <p className="text-muted-foreground text-xs sm:text-sm">
                    Odds de partidas de futebol
                  </p>
                  
                  {/* Arrow indicator */}
                  <div className="mt-4 flex justify-center">
                    <TrendingUp className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Card Basquete */}
          <Link to="/monitor-basquete" className="group">
            <Card 
              variant="interactive"
              className="h-full overflow-hidden"
            >
              <CardContent className="p-6 sm:p-8 text-center relative">
                {/* Gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <div className="relative">
                  <span className="text-4xl sm:text-6xl mb-3 sm:mb-4 block transform group-hover:scale-110 transition-transform duration-300">
                    🏀
                  </span>
                  <h2 className="text-lg sm:text-xl font-semibold mb-1">Monitor Basquete</h2>
                  <p className="text-muted-foreground text-xs sm:text-sm">
                    Odds de partidas de basquete
                  </p>
                  
                  {/* Arrow indicator */}
                  <div className="mt-4 flex justify-center">
                    <TrendingUp className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Stats */}
        <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <StatsCards />
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;

import { Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { StatsCards } from '@/components/StatsCards';
import { Card, CardContent } from '@/components/ui/card';

const Dashboard = () => {
  return (
    <Layout>
      <div className="space-y-8">
        <div className="text-center py-8">
          <h1 className="text-3xl font-bold mb-2">OddsCompare</h1>
          <p className="text-muted-foreground">
            Escolha o esporte para monitorar odds em tempo real
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 max-w-2xl mx-auto">
          {/* Card Futebol */}
          <Link to="/monitor-futebol">
            <Card className="cursor-pointer hover:border-primary transition-all hover:shadow-lg">
              <CardContent className="p-8 text-center">
                <span className="text-6xl mb-4 block">⚽</span>
                <h2 className="text-xl font-semibold">Monitor Futebol</h2>
                <p className="text-muted-foreground text-sm mt-2">
                  Odds de partidas de futebol
                </p>
              </CardContent>
            </Card>
          </Link>

          {/* Card Basquete */}
          <Link to="/monitor-basquete">
            <Card className="cursor-pointer hover:border-primary transition-all hover:shadow-lg">
              <CardContent className="p-8 text-center">
                <span className="text-6xl mb-4 block">🏀</span>
                <h2 className="text-xl font-semibold">Monitor Basquete</h2>
                <p className="text-muted-foreground text-sm mt-2">
                  Odds de partidas de basquete
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Stats gerais */}
        <StatsCards />
      </div>
    </Layout>
  );
};

export default Dashboard;

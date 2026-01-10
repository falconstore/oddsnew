import { Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { StatsCards } from '@/components/StatsCards';
import { SupabaseConfig } from '@/components/SupabaseConfig';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';

const Dashboard = () => {
  const configured = isSupabaseConfigured();

  if (!configured) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto mt-12">
          <h1 className="text-2xl font-bold mb-6">Bem-vindo ao OddsCompare</h1>
          <p className="text-muted-foreground mb-6">
            Para começar, conecte seu projeto Supabase externo. Certifique-se de executar o script SQL disponível em <code className="bg-muted px-1.5 py-0.5 rounded">docs/database-schema.sql</code> no seu banco de dados.
          </p>
          <SupabaseConfig />
        </div>
      </Layout>
    );
  }

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

import { Layout } from '@/components/Layout';
import { OddsComparisonTable } from '@/components/OddsComparisonTable';
import { AlertsPanel } from '@/components/AlertsPanel';
import { StatsCards } from '@/components/StatsCards';
import { SupabaseConfig } from '@/components/SupabaseConfig';
import { isSupabaseConfigured } from '@/lib/supabase';

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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Comparação de odds em tempo real</p>
        </div>

        <StatsCards />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <OddsComparisonTable />
          </div>
          <div>
            <AlertsPanel />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;

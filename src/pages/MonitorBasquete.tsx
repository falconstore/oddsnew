import { useState, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { OddsMonitor } from '@/components/OddsMonitor';
import { StatsCards } from '@/components/StatsCards';
import { SupabaseConfig } from '@/components/SupabaseConfig';
import { isSupabaseConfigured } from '@/lib/supabase';

interface MonitorStats {
  surebetCount: number;
  totalMatches: number;
}

const MonitorBasquete = () => {
  const configured = isSupabaseConfigured();
  const [stats, setStats] = useState<MonitorStats>({
    surebetCount: 0,
    totalMatches: 0,
  });

  const handleStatsUpdate = useCallback((newStats: MonitorStats) => {
    setStats(newStats);
  }, []);

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
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span>🏀</span> Monitor Basquete
          </h1>
          <p className="text-muted-foreground">Odds de basquete em tempo real</p>
        </div>

        <StatsCards
          surebetCount={stats.surebetCount}
          totalMatches={stats.totalMatches}
        />

        <OddsMonitor sportType="basketball" onStatsUpdate={handleStatsUpdate} />
      </div>
    </Layout>
  );
};

export default MonitorBasquete;

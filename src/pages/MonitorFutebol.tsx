import { useState, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { OddsMonitor } from '@/components/OddsMonitor';
import { StatsCards } from '@/components/StatsCards';

interface MonitorStats {
  surebetCount: number;
  totalMatches: number;
}

const MonitorFutebol = () => {
  const [stats, setStats] = useState<MonitorStats>({
    surebetCount: 0,
    totalMatches: 0,
  });

  const handleStatsUpdate = useCallback((newStats: MonitorStats) => {
    setStats(newStats);
  }, []);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span>⚽</span> Monitor Futebol
          </h1>
          <p className="text-muted-foreground">Odds de futebol em tempo real</p>
        </div>

        <StatsCards
          surebetCount={stats.surebetCount}
          totalMatches={stats.totalMatches}
        />

        <OddsMonitor sportType="football" onStatsUpdate={handleStatsUpdate} />
      </div>
    </Layout>
  );
};

export default MonitorFutebol;

import { useLeagues, useBookmakers, useOddsComparison } from '@/hooks/useOddsData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Building2, TrendingUp, Target, Clock, BarChart3 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMemo } from 'react';

interface StatsCardsProps {
  surebetCount?: number;
  valueBetCount?: number;
  totalMatches?: number;
  lastUpdate?: Date | null;
}

export function StatsCards({ surebetCount = 0, valueBetCount = 0, totalMatches = 0, lastUpdate }: StatsCardsProps) {
  const { data: leagues } = useLeagues();
  const { data: bookmakers } = useBookmakers();

  const activeLeagues = leagues?.filter(l => l.status === 'active').length || 0;
  const activeBookmakers = bookmakers?.filter(b => b.status === 'active').length || 0;

  const lastUpdateText = useMemo(() => {
    if (!lastUpdate) return 'Aguardando dados...';
    return formatDistanceToNow(lastUpdate, { addSuffix: true, locale: ptBR });
  }, [lastUpdate]);

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ligas Ativas</CardTitle>
          <Trophy className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeLeagues}</div>
          <p className="text-xs text-muted-foreground">monitoradas</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Casas</CardTitle>
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeBookmakers}</div>
          <p className="text-xs text-muted-foreground">ativas</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Partidas</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalMatches}</div>
          <p className="text-xs text-muted-foreground">comparadas</p>
        </CardContent>
      </Card>

      <Card className={surebetCount > 0 ? 'border-green-500/50 bg-green-500/5' : ''}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Surebets</CardTitle>
          <Target className={`h-4 w-4 ${surebetCount > 0 ? 'text-green-500' : 'text-muted-foreground'}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${surebetCount > 0 ? 'text-green-500' : ''}`}>{surebetCount}</div>
          <p className="text-xs text-muted-foreground">arbitragens</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Value Bets</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{valueBetCount}</div>
          <p className="text-xs text-muted-foreground">margem {"<"}5%</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Atualização</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-sm font-medium truncate">{lastUpdateText}</div>
          <p className="text-xs text-muted-foreground">última sync</p>
        </CardContent>
      </Card>
    </div>
  );
}

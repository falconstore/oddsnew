import { useLeagues, useBookmakers } from '@/hooks/useOddsData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Building2, TrendingUp } from 'lucide-react';

export function StatsCards() {
  const { data: leagues } = useLeagues();
  const { data: bookmakers } = useBookmakers();

  const activeLeagues = leagues?.filter(l => l.status === 'active').length || 0;
  const activeBookmakers = bookmakers?.filter(b => b.status === 'active').length || 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ligas Ativas</CardTitle>
          <Trophy className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeLeagues}</div>
          <p className="text-xs text-muted-foreground">campeonatos monitorados</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Casas de Apostas</CardTitle>
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeBookmakers}</div>
          <p className="text-xs text-muted-foreground">fontes de dados</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Value Bets</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">0</div>
          <p className="text-xs text-muted-foreground">oportunidades identificadas</p>
        </CardContent>
      </Card>
    </div>
  );
}

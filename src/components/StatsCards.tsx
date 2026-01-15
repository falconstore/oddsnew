import { useLeagues, useBookmakers } from '@/hooks/useOddsData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Building2, Target, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardsProps {
  surebetCount?: number;
  totalMatches?: number;
}

export function StatsCards({ surebetCount = 0, totalMatches = 0 }: StatsCardsProps) {
  const { data: leagues } = useLeagues();
  const { data: bookmakers } = useBookmakers();

  const activeLeagues = leagues?.filter(l => l.status === 'active').length || 0;
  const activeBookmakers = bookmakers?.filter(b => b.status === 'active').length || 0;

  const stats = [
    {
      title: 'Ligas Ativas',
      value: activeLeagues,
      subtitle: 'monitoradas',
      icon: Trophy,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Casas',
      value: activeBookmakers,
      subtitle: 'ativas',
      icon: Building2,
      color: 'text-info',
      bgColor: 'bg-info/10',
    },
    {
      title: 'Partidas',
      value: totalMatches,
      subtitle: 'comparadas',
      icon: BarChart3,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      title: 'Surebets',
      value: surebetCount,
      subtitle: 'arbitragens',
      icon: Target,
      color: surebetCount > 0 ? 'text-success' : 'text-muted-foreground',
      bgColor: surebetCount > 0 ? 'bg-success/10' : 'bg-muted/10',
      highlight: surebetCount > 0,
    },
  ];

  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <Card 
          key={stat.title}
          className={cn(
            "transition-all duration-300 hover:shadow-md",
            stat.highlight && "border-success/50 shadow-success/10"
          )}
          style={{ animationDelay: `${index * 0.05}s` }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium">{stat.title}</CardTitle>
            <div className={cn("p-1.5 rounded-md", stat.bgColor)}>
              <stat.icon className={cn("h-3 w-3 sm:h-4 sm:w-4", stat.color)} />
            </div>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className={cn("text-xl sm:text-2xl font-bold tabular-nums", stat.highlight && stat.color)}>
              {stat.value}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{stat.subtitle}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

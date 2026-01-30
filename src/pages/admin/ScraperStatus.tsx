import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useScraperStatusStats } from '@/hooks/useScraperStatus';
import { Activity, AlertTriangle, CheckCircle2, XCircle, RefreshCw, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function formatTimeAgo(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s atrás`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min atrás`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h atrás`;
  return `${Math.floor(seconds / 86400)}d atrás`;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return '-';
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function StatusBadge({ status }: { status: 'ok' | 'warning' | 'error' }) {
  const config = {
    ok: { label: 'OK', variant: 'default' as const, className: 'bg-green-500/10 text-green-500 border-green-500/20' },
    warning: { label: 'Alerta', variant: 'secondary' as const, className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
    error: { label: 'Erro', variant: 'destructive' as const, className: 'bg-destructive/10 text-destructive border-destructive/20' },
  };
  
  const { label, className } = config[status];
  
  return (
    <Badge variant="outline" className={cn('font-medium', className)}>
      {status === 'ok' && <CheckCircle2 className="h-3 w-3 mr-1" />}
      {status === 'warning' && <AlertTriangle className="h-3 w-3 mr-1" />}
      {status === 'error' && <XCircle className="h-3 w-3 mr-1" />}
      {label}
    </Badge>
  );
}

function StatsCards({ stats }: { stats: { total: number; ok: number; warning: number; error: number; totalOddsCollected: number; totalOddsInserted: number } }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Scrapers Ativos</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
          <p className="text-xs text-muted-foreground">
            {stats.ok} funcionando normalmente
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Status OK</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-500">{stats.ok}</div>
          <p className="text-xs text-muted-foreground">
            Heartbeat &lt; 60s
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Com Alertas</CardTitle>
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-500">{stats.warning}</div>
          <p className="text-xs text-muted-foreground">
            Heartbeat 60s - 180s
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Com Erro</CardTitle>
          <XCircle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">{stats.error}</div>
          <p className="text-xs text-muted-foreground">
            Heartbeat &gt; 180s
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ScraperTable() {
  const { scrapers, isLoading, refetch, isFetching } = useScraperStatusStats();
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Status dos Scrapers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Status dos Scrapers
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn('h-4 w-4 mr-2', isFetching && 'animate-spin')} />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent>
        {!scrapers || scrapers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum scraper registrado ainda.</p>
            <p className="text-sm">Os scrapers aparecerão aqui após enviarem o primeiro heartbeat.</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scraper</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Último Heartbeat</TableHead>
                  <TableHead className="text-right">Odds Coletadas</TableHead>
                  <TableHead className="text-right">Odds Inseridas</TableHead>
                  <TableHead className="text-right">Ciclos</TableHead>
                  <TableHead className="text-right">Tempo Médio</TableHead>
                  <TableHead>Último Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scrapers.map((scraper) => (
                  <TableRow key={scraper.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {scraper.bookmaker_logo && (
                          <img 
                            src={scraper.bookmaker_logo} 
                            alt={scraper.bookmaker_display_name || scraper.scraper_name}
                            className="h-5 w-5 rounded"
                          />
                        )}
                        <span>{scraper.bookmaker_display_name || scraper.scraper_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={scraper.computed_status} />
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        scraper.computed_status === 'ok' && 'text-green-500',
                        scraper.computed_status === 'warning' && 'text-yellow-500',
                        scraper.computed_status === 'error' && 'text-destructive',
                      )}>
                        {formatTimeAgo(scraper.seconds_since_heartbeat)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {scraper.odds_collected}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {scraper.odds_inserted}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {scraper.cycle_count}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDuration(scraper.avg_cycle_seconds)}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      {scraper.last_error ? (
                        <span className="text-xs text-destructive truncate block" title={scraper.last_error}>
                          {scraper.last_error.substring(0, 50)}...
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ScraperStatus() {
  const { stats } = useScraperStatusStats();
  
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Status dos Scrapers</h1>
          <p className="text-muted-foreground">
            Monitoramento em tempo real dos scrapers de odds. Atualiza automaticamente a cada 30 segundos.
          </p>
        </div>
        
        <StatsCards stats={stats} />
        
        <ScraperTable />
      </div>
    </Layout>
  );
}

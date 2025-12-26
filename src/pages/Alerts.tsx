import { Layout } from '@/components/Layout';
import { useAlerts, useMarkAllAlertsRead } from '@/hooks/useOddsData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCheck, TrendingUp, ArrowLeftRight, Scale } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const alertIcons = { value_bet: TrendingUp, line_movement: ArrowLeftRight, arbitrage: Scale };

const Alerts = () => {
  const { data: alerts, isLoading } = useAlerts();
  const markAllRead = useMarkAllAlertsRead();
  const unreadCount = alerts?.filter(a => !a.is_read).length || 0;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Alertas</h1>
            <p className="text-muted-foreground">{unreadCount} não lidos</p>
          </div>
          {unreadCount > 0 && (
            <Button onClick={() => markAllRead.mutate()}>
              <CheckCheck className="h-4 w-4 mr-2" /> Marcar todas como lidas
            </Button>
          )}
        </div>

        <div className="space-y-2">
          {isLoading && <Card><CardContent className="pt-6 text-center">Carregando...</CardContent></Card>}
          {alerts?.map((alert) => {
            const Icon = alertIcons[alert.alert_type];
            return (
              <Card key={alert.id} className={cn(!alert.is_read && "border-primary/30")}>
                <CardContent className="pt-4 flex items-start gap-4">
                  <div className="p-2 rounded-full bg-primary/10"><Icon className="h-4 w-4 text-primary" /></div>
                  <div className="flex-1">
                    <div className="font-medium">{alert.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: ptBR })}
                    </div>
                  </div>
                  <Badge variant={alert.is_read ? "secondary" : "default"}>{alert.is_read ? "Lido" : "Novo"}</Badge>
                </CardContent>
              </Card>
            );
          })}
          {!isLoading && (!alerts || alerts.length === 0) && (
            <Card><CardContent className="pt-6 text-center text-muted-foreground">Nenhum alerta</CardContent></Card>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Alerts;

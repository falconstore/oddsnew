import { useAlerts, useMarkAlertRead, useMarkAllAlertsRead } from '@/hooks/useOddsData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, CheckCheck, TrendingUp, ArrowLeftRight, Scale } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Alert } from '@/types/database';

const alertIcons = {
  value_bet: TrendingUp,
  line_movement: ArrowLeftRight,
  arbitrage: Scale,
};

const alertColors = {
  value_bet: 'bg-primary/10 text-primary',
  line_movement: 'bg-accent text-accent-foreground',
  arbitrage: 'bg-secondary text-secondary-foreground',
};

export function AlertsPanel() {
  const { data: alerts, isLoading } = useAlerts(true);
  const markRead = useMarkAlertRead();
  const markAllRead = useMarkAllAlertsRead();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4" />
          Alertas
          {alerts && alerts.length > 0 && (
            <Badge variant="secondary">{alerts.length}</Badge>
          )}
        </CardTitle>
        {alerts && alerts.length > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            <CheckCheck className="h-4 w-4 mr-1" />
            Marcar todas
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          {isLoading && (
            <div className="text-center text-muted-foreground py-4">Carregando...</div>
          )}
          {!isLoading && (!alerts || alerts.length === 0) && (
            <div className="text-center text-muted-foreground py-4">
              Nenhum alerta não lido
            </div>
          )}
          <div className="space-y-2">
            {alerts?.map((alert) => (
              <AlertItem 
                key={alert.id} 
                alert={alert} 
                onMarkRead={() => markRead.mutate(alert.id)}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function AlertItem({ alert, onMarkRead }: { alert: Alert; onMarkRead: () => void }) {
  const Icon = alertIcons[alert.alert_type];
  
  return (
    <div 
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors",
        !alert.is_read && "border-primary/30 bg-primary/5"
      )}
      onClick={onMarkRead}
    >
      <div className={cn("p-2 rounded-full", alertColors[alert.alert_type])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{alert.title}</div>
        {alert.details && (
          <div className="text-xs text-muted-foreground mt-1">
            {JSON.stringify(alert.details)}
          </div>
        )}
        <div className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: ptBR })}
        </div>
      </div>
    </div>
  );
}

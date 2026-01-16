import { Bell, BellOff, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/useNotifications';

export function NotificationSettings() {
  const { permission, isSupported, requestPermission } = useNotifications();

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Notificações Push
          </CardTitle>
          <CardDescription>
            Receba alertas quando novas surebets forem detectadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <XCircle className="h-5 w-5" />
            <span>Seu navegador não suporta notificações push.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notificações Push
        </CardTitle>
        <CardDescription>
          Receba alertas quando novas surebets forem detectadas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {permission === 'granted' ? (
          <div className="flex items-center gap-2 text-success">
            <CheckCircle className="h-5 w-5" />
            <span>Notificações ativadas! Você será alertado sobre novas surebets.</span>
          </div>
        ) : permission === 'denied' ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              <span>Notificações bloqueadas pelo navegador.</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Para ativar, clique no ícone de cadeado na barra de endereços e permita notificações.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ative as notificações para receber alertas em tempo real quando uma nova oportunidade de surebet for detectada.
            </p>
            <Button onClick={requestPermission} variant="gradient" className="gap-2">
              <Bell className="h-4 w-4" />
              Ativar Notificações de Surebet
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

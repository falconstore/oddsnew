import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Shield, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { NotificationSettings } from '@/components/NotificationSettings';

const Settings = () => {
  const { user, signOut, isAdmin } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <Layout>
      <div className="space-y-8 animate-fade-in">
        {/* Page Header */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-500/20 to-slate-500/5 border border-slate-500/20 flex items-center justify-center">
            <SettingsIcon className="h-5 w-5 text-slate-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
            <p className="text-sm text-muted-foreground">Gerencie sua conta e preferências</p>
          </div>
        </div>

        <div className="max-w-xl space-y-4">
          {/* Notificações */}
          <NotificationSettings />

          {/* Perfil */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                Minha Conta
              </CardTitle>
              <CardDescription>Informações da sua conta</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1 p-3 rounded-lg bg-muted/30 dark:bg-white/[0.02] border border-border/40">
                <p className="text-xs text-muted-foreground font-medium">Email</p>
                <p className="font-semibold text-sm">{user?.email}</p>
              </div>

              <div className="space-y-1 p-3 rounded-lg bg-muted/30 dark:bg-white/[0.02] border border-border/40">
                <p className="text-xs text-muted-foreground font-medium">Tipo de Conta</p>
                <Badge
                  variant={isAdmin ? 'default' : 'secondary'}
                  className={`flex items-center gap-1 w-fit ${isAdmin ? 'bg-primary/20 text-primary border-primary/30 hover:bg-primary/30' : ''}`}
                >
                  {isAdmin && <Shield className="h-3 w-3" />}
                  {isAdmin ? 'Administrador' : 'Usuário'}
                </Badge>
              </div>

              <div className="space-y-1 p-3 rounded-lg bg-muted/30 dark:bg-white/[0.02] border border-border/40">
                <p className="text-xs text-muted-foreground font-medium">ID do Usuário</p>
                <p className="font-mono text-xs text-muted-foreground break-all">{user?.id}</p>
              </div>
            </CardContent>
          </Card>

          {/* Sessão */}
          <Card className="border-destructive/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Sessão</CardTitle>
              <CardDescription>Gerenciar sua sessão atual</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                onClick={handleSignOut}
                className="flex items-center gap-2 bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-destructive-foreground"
              >
                <LogOut className="h-4 w-4" />
                Sair da Conta
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;

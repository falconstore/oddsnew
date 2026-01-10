import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Shield, LogOut } from 'lucide-react';

const Settings = () => {
  const { user, signOut, isAdmin } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">Gerencie sua conta</p>
        </div>

        <div className="max-w-xl space-y-6">
          {/* Card de Perfil */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Minha Conta
              </CardTitle>
              <CardDescription>
                Informações da sua conta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{user?.email}</p>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Tipo de Conta</p>
                <Badge variant={isAdmin ? 'default' : 'secondary'} className="flex items-center gap-1 w-fit">
                  {isAdmin && <Shield className="h-3 w-3" />}
                  {isAdmin ? 'Administrador' : 'Usuário'}
                </Badge>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">ID do Usuário</p>
                <p className="font-mono text-xs text-muted-foreground">{user?.id}</p>
              </div>
            </CardContent>
          </Card>

          {/* Card de Ações */}
          <Card>
            <CardHeader>
              <CardTitle>Sessão</CardTitle>
              <CardDescription>
                Gerenciar sua sessão atual
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={handleSignOut} className="flex items-center gap-2">
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

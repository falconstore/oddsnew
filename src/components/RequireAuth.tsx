import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { PageKey } from '@/types/auth';

interface RequireAuthProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  pageKey?: PageKey;
}

export const RequireAuth = ({ children, requireAdmin = false, pageKey }: RequireAuthProps) => {
  const { user, loading, isAdmin, isApproved, userStatus, canAccessPage } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Verificar se usuário está aprovado
  if (!isApproved) {
    return <Navigate to="/login" replace />;
  }

  // Verificar se requer admin
  if (requireAdmin && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-destructive font-medium">Acesso negado</p>
          <p className="text-muted-foreground text-sm">
            Você precisa ser administrador para acessar esta página.
          </p>
        </div>
      </div>
    );
  }

  // Verificar permissão granular da página
  if (pageKey && !canAccessPage(pageKey)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-destructive font-medium">Acesso negado</p>
          <p className="text-muted-foreground text-sm">
            Você não tem permissão para acessar esta página.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

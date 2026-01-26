import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { PageKey } from '@/types/auth';

interface RequireAuthProps {
  children: React.ReactNode;
  pageKey?: PageKey;
}

export const RequireAuth = ({ children, pageKey }: RequireAuthProps) => {
  const { user, loading, isApproved, canViewPage } = useAuth();
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

  // Verificar permissão de visualização da página
  if (pageKey && !canViewPage(pageKey)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-destructive font-medium">Acesso negado</p>
          <p className="text-muted-foreground text-sm">
            Você não tem permissão para visualizar esta página.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

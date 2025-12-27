import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabase';

interface RequireAuthProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export const RequireAuth = ({ children, requireAdmin = false }: RequireAuthProps) => {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();

  // If Supabase is not configured, allow access (for initial setup)
  if (!isSupabaseConfigured()) {
    return <>{children}</>;
  }

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

  if (requireAdmin && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-destructive font-medium">Acesso negado</p>
          <p className="text-muted-foreground text-sm">Você precisa ser admin para acessar esta página.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

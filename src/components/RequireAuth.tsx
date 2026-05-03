import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { PageKey, PAGE_KEY_TO_COLUMN, UserPermissionRow } from '@/types/auth';

interface RequireAuthProps {
  children: React.ReactNode;
  pageKey?: PageKey;
}

const REDIRECT_ORDER: { pageKey: PageKey; path: string }[] = [
  { pageKey: 'dashboard', path: '/' },
  { pageKey: 'procedure_control', path: '/procedure-control' },
  { pageKey: 'subscriptions', path: '/subscriptions' },
  { pageKey: 'betbra_affiliate', path: '/betbra-affiliate' },
  { pageKey: 'sharkodds', path: '/match' },
  { pageKey: 'freebet_calculator', path: '/surebet-calculator' },
  { pageKey: 'admin', path: '/admin/users' },
];

const getFirstPermittedPath = (
  permissions: UserPermissionRow | null,
  isAdmin: boolean
): string => {
  if (isAdmin) return '/';
  if (!permissions) return '/login';
  for (const { pageKey, path } of REDIRECT_ORDER) {
    const col = PAGE_KEY_TO_COLUMN[pageKey];
    if (col && (permissions as any)[col] === true) return path;
  }
  return '/login';
};

export const RequireAuth = ({ children, pageKey }: RequireAuthProps) => {
  const { user, loading, hasBooted, permissionsReady, isApproved, isAdmin, userPermissions, canViewPage } = useAuth();
  const location = useLocation();

  // Boot inicial: ainda não temos resposta do Supabase pra saber se há sessão.
  if (!hasBooted && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  // Gate de permissões: se já temos um user mas o fetch de user_permissions
  // pra esse id ainda não voltou (boot ou troca real de usuário), aguarda
  // antes de avaliar isApproved/canViewPage. Sem isso poderíamos redirecionar
  // pra /login na fração de segundo entre "user chegou" e "permissões chegaram".
  if (!permissionsReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!isApproved) {
    return <Navigate to="/login" replace />;
  }

  if (pageKey && !canViewPage(pageKey)) {
    const fallback = getFirstPermittedPath(userPermissions, isAdmin);
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
};

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { PageKey, UserPermissionRow } from '@/types/auth';
import { PAGES } from '@/config/pages';

interface RequireAuthProps {
  children: React.ReactNode;
  pageKey?: PageKey;
}

// Primeira rota que o usuário pode acessar — usado como fallback quando ele
// cai numa página sem permissão. Deriva do registro de páginas: percorre as
// páginas liberadas (allowed_pages) na ordem do menu e devolve o href da
// primeira utilizável.
const getFirstPermittedPath = (
  permissions: UserPermissionRow | null,
  isAdmin: boolean
): string => {
  if (isAdmin) return '/';
  if (!permissions) return '/login';
  const allowed = Array.isArray(permissions.allowed_pages) ? permissions.allowed_pages : [];
  for (const page of PAGES) {
    if (page.alwaysVisible) continue; // não é destino "próprio" do usuário
    if (page.adminOnly) continue;
    if (allowed.includes(page.key)) return page.href;
  }
  // Sem nenhuma aba liberada: não há destino. Cai numa página utilitária se
  // houver (alwaysVisible), senão volta pro login.
  const util = PAGES.find((p) => p.alwaysVisible);
  return util ? util.href : '/login';
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

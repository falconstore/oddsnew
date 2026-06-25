import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { UserPermissionRow, PageKey, PAGE_KEY_TO_PAGE } from '@/types/auth';
import { PAGE_BY_KEY } from '@/config/pages';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** True após o boot inicial. Permanece true mesmo durante token refresh — usado pelo RequireAuth pra não desmontar a página. */
  hasBooted: boolean;
  /** True quando já temos uma resposta de user_permissions pro user.id atual.
   *  Usado pelo RequireAuth pra evitar redirect prematuro pra /login enquanto
   *  o fetch de permissões ainda está em voo (boot e troca real de usuário). */
  permissionsReady: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isApproved: boolean;
  userPermissions: UserPermissionRow | null;
  canViewPage: (pageKey: PageKey) => boolean;
  canEditPage: (pageKey: PageKey) => boolean;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasBooted, setHasBooted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [userPermissions, setUserPermissions] = useState<UserPermissionRow | null>(null);
  /** user.id pra qual já completamos um fetch de user_permissions (sucesso ou
   *  falha). Quando bate com o user atual, RequireAuth pode avaliar isApproved
   *  com confiança — antes disso, ainda estamos esperando o backend. */
  const [permissionsLoadedForUserId, setPermissionsLoadedForUserId] = useState<string | null>(null);

  // Refs pra comparar id sem disparar re-render e pra não tratar
  // TOKEN_REFRESHED como troca de usuário.
  const currentUserIdRef = useRef<string | null>(null);
  // Refs espelham state pra serem lidos dentro do callback `onAuthStateChange`,
  // que é registrado uma única vez (escopo do useEffect com deps estáveis).
  const permissionsLoadedForUserIdRef = useRef<string | null>(null);
  const hasBootedRef = useRef(false);

  const loadUserData = useCallback(async (currentUser: User) => {
    try {
      const userEmail = currentUser.email;
      if (!userEmail) return;

      const { data: permData } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_email', userEmail)
        .maybeSingle();

      // Guard contra race em troca rápida de usuário: se o user.id atual
      // já não é mais este, descarta o resultado pra não sobrescrever
      // permissões do novo user com as do antigo.
      if (currentUserIdRef.current !== currentUser.id) {
        return;
      }

      const permTyped = permData as UserPermissionRow | null;
      // Só atualiza se mudou — evita re-render em cascata em cima de
      // refresh que devolve o mesmo registro.
      setUserPermissions((prev) => {
        if (prev === permTyped) return prev;
        try {
          if (prev && permTyped && JSON.stringify(prev) === JSON.stringify(permTyped)) {
            return prev;
          }
        } catch {
          /* ignore */
        }
        return permTyped;
      });

      // Admin = super admin OU tem a aba admin_users liberada em allowed_pages.
      // NÃO consideramos mais can_view_admin (flag legada do sistema antigo):
      // ela ligava acesso total silenciosamente e ignorava o allowed_pages,
      // fazendo abas ocultadas continuarem visíveis pra usuários antigos.
      const nextIsAdmin = !!permTyped?.is_super_admin
        || !!permTyped?.allowed_pages?.includes('admin_users');
      const nextIsApproved = !!permData;
      setIsAdmin((prev) => (prev === nextIsAdmin ? prev : nextIsAdmin));
      setIsApproved((prev) => (prev === nextIsApproved ? prev : nextIsApproved));
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      // Marca permissões como resolvidas pra esse user, mesmo em caso de
      // erro — caso contrário RequireAuth ficaria preso no "Carregando…"
      // pra sempre se o backend de permissões estivesse fora do ar.
      // Ignora se houve troca de usuário no meio da request (race guard).
      if (currentUserIdRef.current === currentUser.id) {
        permissionsLoadedForUserIdRef.current = currentUser.id;
        setPermissionsLoadedForUserId(currentUser.id);
      }
    }
  }, []);

  const refreshUserData = useCallback(async () => {
    if (user) {
      await loadUserData(user);
    }
  }, [user, loadUserData]);

  useEffect(() => {
    let mounted = true;

    const handleSession = (nextSession: Session | null, event?: string) => {
      if (!mounted) return;
      const nextUser = nextSession?.user ?? null;
      const prevId = currentUserIdRef.current;
      const nextId = nextUser?.id ?? null;
      const userChanged = prevId !== nextId;

      // Sempre atualiza session pra manter o token novo em mãos.
      setSession(nextSession);

      if (userChanged) {
        currentUserIdRef.current = nextId;
        setUser(nextUser);
        if (nextUser) {
          // Troca real de usuário: zera authz pra evitar carryover do user
          // anterior (segurança) e marca permissões como pendentes pro id
          // novo. RequireAuth vai esperar o fetch sem redirect prematuro.
          setIsAdmin(false);
          setIsApproved(false);
          setUserPermissions(null);
          permissionsLoadedForUserIdRef.current = null;
          setPermissionsLoadedForUserId(null);
          // Carrega permissões em background. hasBooted continua true (se
          // já tinha boot), então a página atual NÃO é desmontada — o
          // RequireAuth segura o redirect com o gate de permissionsReady.
          setTimeout(() => loadUserData(nextUser), 0);
        } else {
          setIsAdmin(false);
          setIsApproved(false);
          setUserPermissions(null);
          permissionsLoadedForUserIdRef.current = null;
          setPermissionsLoadedForUserId(null);
        }
      } else if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || event === 'SIGNED_IN') {
        // Mesmo usuário: NÃO mexer em user/permissões/loading.
        // Atualizar `user` só se a referência precisa refletir metadata
        // nova (USER_UPDATED). Mas mesmo assim mantemos o id estável.
        if (event === 'USER_UPDATED' && nextUser) {
          setUser(nextUser);
        }
        // Se ainda não carregamos permissões pra esse user (rara janela
        // entre boot e primeiro fetch falhar), tenta de novo silenciosamente.
        if (nextUser && permissionsLoadedForUserIdRef.current !== nextUser.id) {
          setTimeout(() => loadUserData(nextUser), 0);
        }
      }

      // Boot inicial sempre fecha o gate global de loading.
      if (!hasBootedRef.current) {
        hasBootedRef.current = true;
        setLoading(false);
        setHasBooted(true);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => handleSession(nextSession, event),
    );

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      handleSession(initialSession, 'INITIAL_SESSION');
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadUserData]);

  const canViewPage = useCallback((pageKey: PageKey): boolean => {
    if (!userPermissions) return false;

    // Super admin vê tudo.
    if (userPermissions.is_super_admin === true) return true;

    // Traduz a PageKey legada -> key do registro de páginas.
    const pageId = PAGE_KEY_TO_PAGE[pageKey] ?? pageKey;
    const page = PAGE_BY_KEY[pageId];

    // Páginas utilitárias (alwaysVisible) liberadas pra qualquer logado.
    if (page?.alwaysVisible) return true;

    // Páginas adminOnly: só admin/super-admin.
    if (page?.adminOnly) return isAdmin;

    // Demais páginas: precisa estar em allowed_pages. Admin também vê tudo.
    if (isAdmin) return true;
    return Array.isArray(userPermissions.allowed_pages)
      && userPermissions.allowed_pages.includes(pageId);
  }, [userPermissions, isAdmin]);

  const canEditPage = useCallback((pageKey: PageKey): boolean => {
    if (isAdmin) return true;
    return canViewPage(pageKey);
  }, [isAdmin, canViewPage]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string, phone: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: fullName,
          phone: phone,
        },
      },
    });

    if (error) return { error: error as Error | null };

    try {
      // Novo usuário nasce sem acesso a nenhuma aba — admin libera depois em
      // Usuários. allowed_pages vazio = pendente.
      await supabase
        .from('user_permissions')
        .upsert({
          user_email: email,
          allowed_pages: [],
          is_super_admin: false,
        } as any, { onConflict: 'user_email' });
    } catch (e) {
      console.error('Error creating user_permissions entry:', e);
    }

    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    setIsApproved(false);
    setUserPermissions(null);
    currentUserIdRef.current = null;
    permissionsLoadedForUserIdRef.current = null;
    setPermissionsLoadedForUserId(null);
  }, []);

  const permissionsReady = !!user && permissionsLoadedForUserId === user.id;

  const value = useMemo<AuthContextType>(() => ({
    user,
    session,
    loading,
    hasBooted,
    permissionsReady,
    signIn,
    signUp,
    signOut,
    isAdmin,
    isApproved,
    userPermissions,
    canViewPage,
    canEditPage,
    refreshUserData,
  }), [
    user,
    session,
    loading,
    hasBooted,
    permissionsReady,
    signIn,
    signUp,
    signOut,
    isAdmin,
    isApproved,
    userPermissions,
    canViewPage,
    canEditPage,
    refreshUserData,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

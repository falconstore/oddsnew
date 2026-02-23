import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { UserPermissionRow, PageKey, PAGE_KEY_TO_COLUMN } from '@/types/auth';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
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
  const [userDataLoading, setUserDataLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [userPermissions, setUserPermissions] = useState<UserPermissionRow | null>(null);

  const loadUserData = async (currentUser: User) => {
    setUserDataLoading(true);
    try {
      const userEmail = currentUser.email;
      if (!userEmail) return;

      // Buscar apenas user_permissions (única tabela que existe no banco externo)
      const { data: permData } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_email', userEmail)
        .maybeSingle();

      const permTyped = permData as UserPermissionRow | null;
      setUserPermissions(permTyped);

      // Admin = can_view_admin ou is_super_admin
      setIsAdmin(!!permTyped?.can_view_admin || !!permTyped?.is_super_admin);

      // Aprovado = tem registro em user_permissions
      setIsApproved(!!permData);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setUserDataLoading(false);
    }
  };

  const refreshUserData = async () => {
    if (user) {
      await loadUserData(user);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (session?.user) {
          setTimeout(() => {
            loadUserData(session.user);
          }, 0);
        } else {
          setIsAdmin(false);
          setIsApproved(false);
          setUserPermissions(null);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        loadUserData(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const canViewPage = (pageKey: PageKey): boolean => {
    if (isAdmin) return true;
    if (!userPermissions) return false;

    const column = PAGE_KEY_TO_COLUMN[pageKey];
    if (!column) return false;

    return (userPermissions as any)[column] === true;
  };

  const canEditPage = (pageKey: PageKey): boolean => {
    // No banco externo só tem can_view, então editar = visualizar para admins
    if (isAdmin) return true;
    return canViewPage(pageKey);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string, phone: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { 
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: fullName,
          phone: phone
        }
      }
    });

    if (error) {
      return { error: error as Error | null };
    }

    // Auto-criar registro em user_permissions com tudo false para o admin aprovar
    try {
      await supabase
        .from('user_permissions')
        .upsert({
          user_email: email,
          can_view_dashboard: false,
          can_view_payment_control: false,
          can_view_procedure_control: false,
          can_view_freebet_calculator: false,
          can_view_admin: false,
          can_view_sharkodds: false,
          can_view_conta_corrente: false,
          can_view_plataformas: false,
          can_view_betbra: false,
          is_super_admin: false,
        } as any, { onConflict: 'user_email' });
    } catch (e) {
      console.error('Error creating user_permissions entry:', e);
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    setIsApproved(false);
    setUserPermissions(null);
  };

  const isLoading = loading || (!!user && userDataLoading);

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading: isLoading, 
      signIn, 
      signUp, 
      signOut, 
      isAdmin,
      isApproved,
      userPermissions,
      canViewPage,
      canEditPage,
      refreshUserData
    }}>
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

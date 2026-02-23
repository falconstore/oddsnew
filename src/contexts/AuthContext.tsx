import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { UserProfile, UserPermissionRow, UserStatus, PageKey, PAGE_KEY_TO_COLUMN } from '@/types/auth';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isApproved: boolean;
  userStatus: UserStatus | null;
  userProfile: UserProfile | null;
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
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissionRow | null>(null);

  const loadUserData = async (currentUser: User) => {
    setUserDataLoading(true);
    try {
      const userEmail = currentUser.email;
      if (!userEmail) return;

      // Carregar permissões da tabela user_permissions por email (esta existe no externo)
      const { data: permData } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_email', userEmail)
        .maybeSingle();

      setUserPermissions(permData as UserPermissionRow | null);

      // Tentar verificar role admin (pode não existir no externo)
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', currentUser.id)
        .eq('role', 'admin')
        .maybeSingle();

      // Fallback: se user_roles não existe, usar can_view_admin ou is_super_admin de user_permissions
      const hasAdminRole = !!roleData;
      const permTyped = permData as UserPermissionRow | null;
      const hasAdminPermission = !!permTyped?.can_view_admin;
      const isSuperAdmin = !!permTyped?.is_super_admin;
      setIsAdmin(hasAdminRole || hasAdminPermission || isSuperAdmin);

      // Tentar carregar perfil (pode não existir no externo)
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      setUserProfile(profileData);
      setUserStatus(profileData?.status || null);

      // Fallback: se user_profiles não existe, considerar aprovado se tem registro em user_permissions
      const approvedByProfile = profileData?.status === 'approved';
      const approvedByPermissions = !!permData;
      setIsApproved(approvedByProfile || approvedByPermissions);
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
          setUserStatus(null);
          setUserProfile(null);
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

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    setIsApproved(false);
    setUserStatus(null);
    setUserProfile(null);
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
      userStatus,
      userProfile,
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

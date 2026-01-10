import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { UserProfile, UserPermission, UserStatus, PageKey } from '@/types/auth';

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
  userPermissions: UserPermission[];
  canAccessPage: (pageKey: PageKey) => boolean;
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
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);

  const loadUserData = async (userId: string) => {
    setUserDataLoading(true);
    try {
      // Verificar role admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();

      setIsAdmin(!!roleData);

      // Carregar perfil
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      setUserProfile(profileData);
      setUserStatus(profileData?.status || null);
      setIsApproved(profileData?.status === 'approved');

      // Carregar permissões
      const { data: permissionsData } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId);

      setUserPermissions(permissionsData || []);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setUserDataLoading(false);
    }
  };

  const refreshUserData = async () => {
    if (user) {
      await loadUserData(user.id);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (session?.user) {
          setTimeout(() => {
            loadUserData(session.user.id);
          }, 0);
        } else {
          setIsAdmin(false);
          setIsApproved(false);
          setUserStatus(null);
          setUserProfile(null);
          setUserPermissions([]);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        loadUserData(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const canAccessPage = (pageKey: PageKey): boolean => {
    // Admins têm acesso a tudo
    if (isAdmin) return true;
    
    // Verificar permissão específica
    const permission = userPermissions.find(p => p.page_key === pageKey);
    return permission?.can_access ?? false;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string, phone: string) => {
    // Criar conta no Supabase Auth com metadata
    // O perfil será criado automaticamente pelo trigger do banco
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

    // Perfil será criado automaticamente pelo trigger handle_new_user()
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
    setUserPermissions([]);
  };

  // Combinar loading states - considerar carregando enquanto auth OU dados do usuário estão carregando
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
      canAccessPage,
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

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { UserProfile, UserPermission, UserRole, UserStatus, AppRole, PAGE_KEYS } from '@/types/auth';
import { useToast } from '@/hooks/use-toast';

export interface UserWithDetails {
  id: string;
  email: string;
  profile: UserProfile | null;
  roles: UserRole[];
  permissions: UserPermission[];
}

export function useUserManagement() {
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Buscar todos os perfis
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Buscar todas as roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Buscar todas as permissões
      const { data: permissions, error: permissionsError } = await supabase
        .from('user_permissions')
        .select('*');

      if (permissionsError) throw permissionsError;

      // Combinar dados
      const usersWithDetails: UserWithDetails[] = (profiles || []).map((profile) => ({
        id: profile.user_id,
        email: '', // Será preenchido se necessário via auth.users (apenas admin)
        profile,
        roles: (roles || []).filter((r) => r.user_id === profile.user_id),
        permissions: (permissions || []).filter((p) => p.user_id === profile.user_id),
      }));

      setUsers(usersWithDetails);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os usuários.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUserStatus = async (userId: string, status: UserStatus) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ status })
        .eq('user_id', userId);

      if (error) throw error;

      // Se aprovando, criar permissões padrão
      if (status === 'approved') {
        await createDefaultPermissions(userId);
      }

      toast({
        title: 'Sucesso',
        description: status === 'approved' 
          ? 'Usuário aprovado com sucesso!' 
          : status === 'rejected' 
            ? 'Usuário rejeitado.' 
            : 'Status atualizado.',
      });

      await fetchUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o status.',
        variant: 'destructive',
      });
    }
  };

  const createDefaultPermissions = async (userId: string) => {
    const defaultPages = [
      PAGE_KEYS.DASHBOARD,
      PAGE_KEYS.MONITOR_FUTEBOL,
      PAGE_KEYS.MONITOR_BASQUETE,
      PAGE_KEYS.SETTINGS,
    ];

    for (const pageKey of defaultPages) {
      await supabase
        .from('user_permissions')
        .upsert({
          user_id: userId,
          page_key: pageKey,
          can_access: true,
        }, { onConflict: 'user_id,page_key' });
    }
  };

  const setUserRole = async (userId: string, role: AppRole, hasRole: boolean) => {
    try {
      if (hasRole) {
        // Adicionar role
        const { error } = await supabase
          .from('user_roles')
          .upsert({
            user_id: userId,
            role,
          }, { onConflict: 'user_id,role' });

        if (error) throw error;

        // Se for admin, dar acesso a todas as páginas
        if (role === 'admin') {
          await grantAllPermissions(userId);
        }
      } else {
        // Remover role
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', role);

        if (error) throw error;
      }

      toast({
        title: 'Sucesso',
        description: hasRole ? 'Role adicionada.' : 'Role removida.',
      });

      await fetchUsers();
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a role.',
        variant: 'destructive',
      });
    }
  };

  const grantAllPermissions = async (userId: string) => {
    const allPages = Object.values(PAGE_KEYS);
    
    for (const pageKey of allPages) {
      await supabase
        .from('user_permissions')
        .upsert({
          user_id: userId,
          page_key: pageKey,
          can_access: true,
        }, { onConflict: 'user_id,page_key' });
    }
  };

  const updatePermission = async (userId: string, pageKey: string, canAccess: boolean) => {
    try {
      const { error } = await supabase
        .from('user_permissions')
        .upsert({
          user_id: userId,
          page_key: pageKey,
          can_access: canAccess,
        }, { onConflict: 'user_id,page_key' });

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Permissão atualizada.',
      });

      await fetchUsers();
    } catch (error) {
      console.error('Error updating permission:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a permissão.',
        variant: 'destructive',
      });
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      // Deletar perfil (cascade vai deletar roles e permissions)
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Usuário removido.',
      });

      await fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o usuário.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return {
    users,
    loading,
    fetchUsers,
    updateUserStatus,
    setUserRole,
    updatePermission,
    deleteUser,
  };
}

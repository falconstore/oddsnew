import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { UserProfile, UserPermissionRow, UserRole, UserStatus, AppRole, PERMISSION_COLUMNS } from '@/types/auth';
import { useToast } from '@/hooks/use-toast';

export interface UserWithDetails {
  id: string;
  email: string;
  profile: UserProfile | null;
  roles: UserRole[];
  permissions: UserPermissionRow | null;
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

      // Buscar todas as permissões da tabela user_permissions
      const { data: permissions, error: permissionsError } = await supabase
        .from('user_permissions')
        .select('*');

      if (permissionsError) throw permissionsError;

      // Combinar dados - precisamos do email do auth para cruzar com user_permissions
      const usersWithDetails: UserWithDetails[] = (profiles || []).map((profile) => {
        const userRoles = (roles || []).filter((r) => r.user_id === profile.user_id);
        
        // Tentar encontrar permissão pelo email (precisamos buscar do auth)
        // Por enquanto usamos o que temos
        const userPerm = (permissions || []).find((p: any) => {
          // Tentamos cruzar - mas sem o email, cruzamos por posição
          return false;
        });

        return {
          id: profile.user_id,
          email: '', // será preenchido depois se possível
          profile,
          roles: userRoles,
          permissions: null,
        };
      });

      // Agora vamos tentar mapear as permissões com os emails dos perfis
      // Se user_permissions tem user_email, precisamos de outro jeito de mapear
      // Vamos buscar os dados de auth via listUsers (só funciona com service_role)
      // Como alternativa, guardamos todas as permissões e deixamos o admin gerenciar por email
      
      // Armazenar permissões como lista separada para o admin gerenciar
      const permList = (permissions || []) as UserPermissionRow[];
      
      // Tentar cruzar por email - se o profile tiver algum campo de email
      const finalUsers = usersWithDetails.map(u => {
        // Sem acesso ao email do auth, não conseguimos cruzar automaticamente
        return u;
      });

      setUsers(finalUsers);
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

  const setUserRole = async (userId: string, role: AppRole, hasRole: boolean) => {
    try {
      if (hasRole) {
        const { error } = await supabase
          .from('user_roles')
          .upsert({ user_id: userId, role }, { onConflict: 'user_id,role' });

        if (error) throw error;
      } else {
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

  const updatePermissionsByEmail = async (
    userEmail: string, 
    permUpdates: Partial<UserPermissionRow>
  ) => {
    try {
      const { error } = await supabase
        .from('user_permissions')
        .update(permUpdates)
        .eq('user_email', userEmail);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Permissões atualizadas.',
      });

      await fetchUsers();
    } catch (error) {
      console.error('Error updating permissions:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar as permissões.',
        variant: 'destructive',
      });
    }
  };

  // Mantém compatibilidade com a interface antiga
  const updateAllPermissions = async (
    userId: string, 
    permissions: { pageKey: string; canView: boolean; canEdit: boolean }[]
  ) => {
    // Esta função agora é um no-op - use updatePermissionsByEmail
    console.warn('updateAllPermissions is deprecated, use updatePermissionsByEmail');
  };

  const deleteUser = async (userId: string) => {
    try {
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

  const grantAllPermissions = async (userId: string) => {
    // No-op sem email - admin deve usar a interface de permissões por email
    console.warn('grantAllPermissions requires email-based approach now');
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
    updateAllPermissions,
    updatePermissionsByEmail,
    deleteUser,
    grantAllPermissions,
  };
}

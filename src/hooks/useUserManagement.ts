import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { UserPermissionRow } from '@/types/auth';
import { useToast } from '@/hooks/use-toast';

export interface UserWithPermissions {
  email: string;
  permissions: UserPermissionRow;
}

export function useUserManagement() {
  const [users, setUsers] = useState<UserWithPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: permissions, error } = await supabase
        .from('user_permissions')
        .select('*')
        .order('created_date', { ascending: false });

      if (error) throw error;

      const usersFromPerms: UserWithPermissions[] = (permissions || []).map((p: any) => ({
        email: p.user_email,
        permissions: p as UserPermissionRow,
      }));

      setUsers(usersFromPerms);
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

  const updateAllowedPages = async (userEmail: string, allowedPages: string[]) => {
    try {
      const { error } = await supabase
        .from('user_permissions')
        // Ao salvar permissões também zeramos can_view_admin (flag legada do
        // sistema antigo): ela dava acesso total e ignorava o allowed_pages.
        // Assim, salvar as abas de um usuário antigo já o "limpa".
        .update({ allowed_pages: allowedPages, can_view_admin: false } as any)
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

  const toggleSuperAdmin = async (userEmail: string, isSuperAdmin: boolean) => {
    try {
      const { error } = await supabase
        .from('user_permissions')
        .update({ is_super_admin: isSuperAdmin } as any)
        .eq('user_email', userEmail);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: isSuperAdmin ? 'Super Admin ativado.' : 'Super Admin desativado.',
      });

      await fetchUsers();
    } catch (error) {
      console.error('Error toggling super admin:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível alterar o Super Admin.',
        variant: 'destructive',
      });
    }
  };

  // Revoga o "admin legado" (can_view_admin) de um usuário antigo. A partir
  // daí só o allowed_pages controla o que ele vê — abas ocultadas somem.
  const revokeLegacyAdmin = async (userEmail: string) => {
    try {
      const { error } = await supabase
        .from('user_permissions')
        .update({ can_view_admin: false } as any)
        .eq('user_email', userEmail);

      if (error) throw error;

      toast({
        title: 'Acesso revogado',
        description: 'Admin legado removido. As permissões agora seguem as abas marcadas.',
      });

      await fetchUsers();
    } catch (error) {
      console.error('Error revoking legacy admin:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível revogar o acesso.',
        variant: 'destructive',
      });
    }
  };

  // Reseta a senha de um usuário DA EQUIPE definindo uma senha temporária.
  // A Edge Function recusa qualquer email que não esteja em user_permissions
  // (trava anti-PWA). O admin repassa a senha ao usuário.
  const resetPassword = async (userEmail: string, tempPassword: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'reset-password', email: userEmail, tempPassword },
      });
      // Erros de negócio (ex.: usuário sem conta) vêm no corpo com ok:false.
      if (error) throw error;
      if (data && data.ok === false) {
        toast({
          title: 'Não foi possível resetar',
          description: data.error ?? 'Erro desconhecido.',
          variant: 'destructive',
        });
        return { ok: false as const };
      }
      toast({
        title: 'Senha redefinida',
        description: 'Senha temporária definida. Repasse ao usuário.',
      });
      return { ok: true as const };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('Error resetting password:', error);
      toast({ title: 'Erro ao resetar senha', description: msg, variant: 'destructive' });
      return { ok: false as const };
    }
  };

  const deleteUserByEmail = async (userEmail: string) => {
    try {
      const { error } = await supabase
        .from('user_permissions')
        .delete()
        .eq('user_email', userEmail);

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
    updateAllowedPages,
    toggleSuperAdmin,
    revokeLegacyAdmin,
    deleteUserByEmail,
    resetPassword,
  };
}

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { UserPermissionRow } from '@/types/auth';
import { useToast } from '@/hooks/use-toast';

export interface UserWithPermissions {
  email: string;
  permissions: UserPermissionRow;
}

// Status de acesso de cada usuário da equipe (vindo do Auth, só p/ a equipe).
export interface UserStatus {
  in_auth: boolean;
  banned: boolean;
  last_sign_in_at: string | null;
}

export function useUserManagement() {
  const [users, setUsers] = useState<UserWithPermissions[]>([]);
  const [statuses, setStatuses] = useState<Record<string, UserStatus>>({});
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
      // Enriquece com status de acesso (banido/em-auth) — só da equipe.
      void fetchStatuses();
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

  // Busca o status de acesso (in_auth/banned/último login) só da equipe.
  const fetchStatuses = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'list-status' },
      });
      if (error) return; // status é opcional; falha não quebra a lista
      setStatuses((data?.statuses ?? {}) as Record<string, UserStatus>);
    } catch {
      /* status é opcional */
    }
  };

  // Ativa/desativa (bane/libera login) um usuário da equipe.
  const setActive = async (userEmail: string, active: boolean) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'set-active', email: userEmail, active },
      });
      if (error) {
        let motivo = error instanceof Error ? error.message : 'Erro desconhecido';
        const ctx = (error as any)?.context;
        if (ctx && typeof ctx.json === 'function') {
          try { const b = await ctx.json(); if (b?.error) motivo = b.error; } catch { /* noop */ }
        }
        toast({ title: 'Não foi possível alterar', description: motivo, variant: 'destructive' });
        return { ok: false as const };
      }
      if (data && data.ok === false) {
        toast({ title: 'Atenção', description: data.error ?? 'Erro.', variant: 'destructive' });
        return { ok: false as const };
      }
      toast({ title: active ? 'Usuário ativado' : 'Usuário desativado', description: active ? 'O login foi liberado.' : 'O login foi bloqueado.' });
      await fetchStatuses();
      return { ok: true as const };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('Error set-active:', error);
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
      return { ok: false as const };
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

      // Quando a função responde com status >= 400 (403 anti-PWA, 409 sem
      // conta, etc.), o supabase-js joga em `error` (FunctionsHttpError) e o
      // corpo real fica em error.context (um Response). Extraímos a mensagem
      // de lá pra mostrar o motivo certo em vez de "non-2xx status code".
      if (error) {
        let motivo = error instanceof Error ? error.message : 'Erro desconhecido';
        const ctx = (error as any)?.context;
        if (ctx && typeof ctx.json === 'function') {
          try {
            const body = await ctx.json();
            if (body?.error) motivo = body.error;
          } catch { /* corpo não-JSON — mantém motivo */ }
        }
        toast({ title: 'Não foi possível resetar', description: motivo, variant: 'destructive' });
        return { ok: false as const };
      }

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

  // Cria um novo usuário da equipe (conta no Auth + permissões). Recusa se o
  // email já existe no Auth. Lê o motivo real do corpo em caso de erro >=400.
  const createUser = async (email: string, tempPassword: string, allowedPages: string[]) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'create', email, tempPassword, allowedPages },
      });
      if (error) {
        let motivo = error instanceof Error ? error.message : 'Erro desconhecido';
        const ctx = (error as any)?.context;
        if (ctx && typeof ctx.json === 'function') {
          try { const b = await ctx.json(); if (b?.error) motivo = b.error; } catch { /* noop */ }
        }
        toast({ title: 'Não foi possível criar', description: motivo, variant: 'destructive' });
        return { ok: false as const };
      }
      if (data && data.ok === false) {
        toast({ title: 'Atenção', description: data.error ?? 'Erro.', variant: 'destructive' });
        await fetchUsers();
        return { ok: false as const };
      }
      toast({ title: 'Usuário criado', description: `${email} criado. Repasse a senha temporária.` });
      await fetchUsers();
      return { ok: true as const };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('Error creating user:', error);
      toast({ title: 'Erro ao criar usuário', description: msg, variant: 'destructive' });
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
    statuses,
    loading,
    fetchUsers,
    updateAllowedPages,
    toggleSuperAdmin,
    revokeLegacyAdmin,
    deleteUserByEmail,
    resetPassword,
    createUser,
    setActive,
  };
}

import { useState, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { useUserManagement, UserWithPermissions } from '@/hooks/useUserManagement';
import { UserPermissionRow } from '@/types/auth';
import { PERMISSION_PAGES, PERMISSION_PAGES_BY_SECTION } from '@/config/pages';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ActionButton, ActionGroup } from '@/components/ui/action-button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Shield, ShieldAlert, ShieldOff, Settings, Trash2, Loader2, Save, Users, Clock, UserCog, KeyRound } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/PageHeader';

// Total de páginas liberáveis (não-admin, não-utilitárias).
const TOTAL_PERMISSION_PAGES = PERMISSION_PAGES.length;

const AdminUsers = () => {
  const {
    users, loading, updateAllowedPages, toggleSuperAdmin, revokeLegacyAdmin, deleteUserByEmail, resetPassword,
  } = useUserManagement();

  const [selectedUser, setSelectedUser] = useState<UserWithPermissions | null>(null);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  // Conjunto de keys de páginas liberadas pro usuário em edição.
  const [allowed, setAllowed] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Reset de senha (senha temporária) — só p/ usuário da equipe.
  const [resetUser, setResetUser] = useState<UserWithPermissions | null>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const handleConfirmReset = async () => {
    if (!resetUser || tempPassword.trim().length < 6) return;
    setResetting(true);
    const res = await resetPassword(resetUser.email, tempPassword.trim());
    setResetting(false);
    if (res.ok) { setResetUser(null); setTempPassword(''); }
  };

  const openPermissions = (user: UserWithPermissions) => {
    setSelectedUser(user);
    const current = Array.isArray(user.permissions.allowed_pages) ? user.permissions.allowed_pages : [];
    setAllowed(new Set(current));
    setPermissionsOpen(true);
  };

  const togglePage = (key: string, value: boolean) => {
    setAllowed(prev => {
      const next = new Set(prev);
      if (value) next.add(key); else next.delete(key);
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    setAllowed(checked ? new Set(PERMISSION_PAGES.map(p => p.key)) : new Set());
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;
    setSaving(true);
    await updateAllowedPages(selectedUser.email, Array.from(allowed));
    setSaving(false);
    setPermissionsOpen(false);
  };

  const allChecked = useMemo(
    () => PERMISSION_PAGES.every(p => allowed.has(p.key)),
    [allowed]
  );

  const superAdminCount = users.filter(u => u.permissions.is_super_admin).length;
  const activePermCount = (perms: UserPermissionRow) =>
    Array.isArray(perms.allowed_pages)
      ? perms.allowed_pages.filter(k => PERMISSION_PAGES.some(p => p.key === k)).length
      : 0;
  const isPending = (perms: UserPermissionRow) => activePermCount(perms) === 0 && !perms.is_super_admin;
  const pendingCount = users.filter(u => isPending(u.permissions)).length;
  // Admin legado: flag can_view_admin do sistema antigo ligada. Enquanto ela
  // existir, o usuário vê TUDO e o allowed_pages é ignorado. Sinalizamos pra
  // o admin revogar com um clique.
  const hasLegacyAdmin = (perms: UserPermissionRow) =>
    !!perms.can_view_admin && !perms.is_super_admin;
  const legacyAdminCount = users.filter(u => hasLegacyAdmin(u.permissions)).length;

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        <PageHeader
          eyebrow="USERS"
          title="Usuários"
          subtitle="GERENCIE PERMISSÕES E SUPER ADMINS DO SISTEMA"
          icon={UserCog}
        />

        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Usuários</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                {users.length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Pendentes</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                <Clock className="h-5 w-5 text-warning" />
                <span className={pendingCount > 0 ? 'text-warning' : ''}>{pendingCount}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Super Admins</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                {superAdminCount}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Usuários Cadastrados</CardTitle>
            <CardDescription>Lista de todos os usuários com permissões no sistema.</CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
              <div className="min-w-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Permissões</TableHead>
                      <TableHead>Super Admin</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.email}>
                        <TableCell>
                          <p className="font-medium">{user.email}</p>
                          <p className="text-xs text-muted-foreground">
                            Desde {new Date(user.permissions.created_date).toLocaleDateString('pt-BR')}
                          </p>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {isPending(user.permissions) ? (
                              <Badge variant="outline" className="border-warning text-warning">
                                Pendente
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                {activePermCount(user.permissions)}/{TOTAL_PERMISSION_PAGES}
                              </Badge>
                            )}
                            {hasLegacyAdmin(user.permissions) && (
                              <Badge
                                variant="outline"
                                className="border-destructive text-destructive gap-1"
                                title="Acesso de admin legado: vê TODAS as abas e ignora as permissões marcadas. Revogue para aplicar as abas."
                              >
                                <ShieldAlert className="h-3 w-3" />
                                Admin legado
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={!!user.permissions.is_super_admin}
                            onCheckedChange={(checked) => toggleSuperAdmin(user.email, checked)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <ActionGroup className="justify-end">
                            {hasLegacyAdmin(user.permissions) && (
                              <ActionButton
                                showLabel
                                icon={ShieldOff}
                                intent="delete"
                                label="Revogar admin"
                                onClick={() => revokeLegacyAdmin(user.email)}
                              />
                            )}
                            <ActionButton
                              showLabel
                              icon={Settings}
                              intent="neutral"
                              label="Permissões"
                              onClick={() => openPermissions(user)}
                            />
                            <ActionButton
                              icon={KeyRound}
                              intent="neutral"
                              label="Resetar senha"
                              onClick={() => { setResetUser(user); setTempPassword(''); }}
                            />
                            <ActionButton
                              icon={Trash2}
                              intent="delete"
                              label="Excluir"
                              onClick={() => deleteUserByEmail(user.email)}
                            />
                          </ActionGroup>
                        </TableCell>
                      </TableRow>
                    ))}
                    {users.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Nenhum usuário encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Permissões */}
      <Dialog open={permissionsOpen} onOpenChange={setPermissionsOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-card border border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Permissões de {selectedUser?.email}
            </DialogTitle>
            <DialogDescription>
              Configure quais páginas o usuário pode visualizar.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Selecionar todos */}
            <label className="flex items-center justify-between gap-3 border bg-primary/5 px-3 py-2 rounded-lg cursor-pointer">
              <span className="font-medium text-sm">Selecionar todas as abas</span>
              <Checkbox checked={allChecked} onCheckedChange={(checked) => handleSelectAll(!!checked)} />
            </label>

            {/* Abas agrupadas por seção (igual ao menu lateral) */}
            {PERMISSION_PAGES_BY_SECTION.map((group) => (
              <div key={group.section} className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-3 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground">
                  {group.section}
                </div>
                <div className="divide-y">
                  {group.pages.map((page) => (
                    <label
                      key={page.key}
                      className="flex items-center justify-between gap-3 px-3 py-2 cursor-pointer hover:bg-accent/40 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <page.icon className="h-4 w-4 text-muted-foreground/60 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{page.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{page.description}</p>
                        </div>
                      </div>
                      <Checkbox
                        checked={allowed.has(page.key)}
                        onCheckedChange={(checked) => togglePage(page.key, !!checked)}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setPermissionsOpen(false)}>Cancelar</Button>
            <Button onClick={handleSavePermissions} disabled={saving}>
              {saving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
              ) : (
                <><Save className="h-4 w-4 mr-2" />Salvar Permissões</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: resetar senha (senha temporária) — só usuário da equipe */}
      <Dialog open={!!resetUser} onOpenChange={(o) => { if (!o) { setResetUser(null); setTempPassword(''); } }}>
        <DialogContent className="max-w-md bg-card border border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Resetar senha
            </DialogTitle>
            <DialogDescription>
              Defina uma senha temporária para <span className="font-medium text-foreground">{resetUser?.email}</span>. Repasse ao usuário — ele pode trocá-la depois em "Esqueci a senha".
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Senha temporária (mín. 6 caracteres)</label>
            <Input
              type="text"
              value={tempPassword}
              onChange={(e) => setTempPassword(e.target.value)}
              placeholder="Ex: Shark@2026"
              autoFocus
            />
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { setResetUser(null); setTempPassword(''); }}>Cancelar</Button>
            <Button onClick={handleConfirmReset} disabled={resetting || tempPassword.trim().length < 6}>
              {resetting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Definindo...</>
              ) : (
                <><KeyRound className="h-4 w-4 mr-2" />Definir senha</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default AdminUsers;

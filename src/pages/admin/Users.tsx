import { useState, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { useUserManagement, UserWithPermissions } from '@/hooks/useUserManagement';
import { PERMISSION_COLUMNS, UserPermissionRow } from '@/types/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Shield, Settings, Trash2, Loader2, Eye, Save, Users } from 'lucide-react';

type PermissionState = Record<string, boolean>;

const AdminUsers = () => {
  const { 
    users, loading, updatePermissionsByEmail, toggleSuperAdmin, deleteUserByEmail,
  } = useUserManagement();
  
  const [selectedUser, setSelectedUser] = useState<UserWithPermissions | null>(null);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [permissionState, setPermissionState] = useState<PermissionState>({});
  const [saving, setSaving] = useState(false);

  const openPermissions = (user: UserWithPermissions) => {
    setSelectedUser(user);
    const initialState: PermissionState = {};
    PERMISSION_COLUMNS.forEach(({ column }) => {
      initialState[column] = (user.permissions as any)[column] === true;
    });
    setPermissionState(initialState);
    setPermissionsOpen(true);
  };

  const handlePermissionChange = (column: string, value: boolean) => {
    setPermissionState(prev => ({ ...prev, [column]: value }));
  };

  const handleSelectAll = (checked: boolean) => {
    const updated: PermissionState = {};
    PERMISSION_COLUMNS.forEach(({ column }) => { updated[column] = checked; });
    setPermissionState(updated);
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;
    setSaving(true);
    await updatePermissionsByEmail(selectedUser.email, permissionState as any);
    setSaving(false);
    setPermissionsOpen(false);
  };

  const allChecked = useMemo(() => 
    PERMISSION_COLUMNS.every(({ column }) => permissionState[column]),
    [permissionState]
  );

  const superAdminCount = users.filter(u => u.permissions.is_super_admin).length;
  const activePermCount = (perms: UserPermissionRow) => 
    PERMISSION_COLUMNS.filter(({ column }) => (perms as any)[column] === true).length;

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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Gerenciar Usuários</h1>
          <p className="text-muted-foreground">Gerencie permissões e Super Admins do sistema.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
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
                          <Badge variant="secondary">
                            {activePermCount(user.permissions)}/{PERMISSION_COLUMNS.length}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={!!user.permissions.is_super_admin}
                            onCheckedChange={(checked) => toggleSuperAdmin(user.email, checked)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1 sm:gap-2">
                            <Button size="sm" variant="outline" onClick={() => openPermissions(user)}>
                              <Settings className="h-4 w-4 mr-1" />
                              Permissões
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => deleteUserByEmail(user.email)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Permissões de {selectedUser?.email}
            </DialogTitle>
            <DialogDescription>
              Configure quais páginas o usuário pode visualizar.
            </DialogDescription>
          </DialogHeader>
          
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[70%]">Página</TableHead>
                  <TableHead className="w-[30%] text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Eye className="h-4 w-4" />
                      <span>Acesso</span>
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-primary/5 font-medium">
                  <TableCell>Selecionar Todos</TableCell>
                  <TableCell className="text-center">
                    <Checkbox checked={allChecked} onCheckedChange={(checked) => handleSelectAll(!!checked)} />
                  </TableCell>
                </TableRow>
                {PERMISSION_COLUMNS.map(({ column, label, description }) => (
                  <TableRow key={column}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{label}</p>
                        <p className="text-xs text-muted-foreground">{description}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={permissionState[column] ?? false}
                        onCheckedChange={(checked) => handlePermissionChange(column, !!checked)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
    </Layout>
  );
};

export default AdminUsers;

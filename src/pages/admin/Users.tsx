import { useState, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { useUserManagement, UserWithDetails } from '@/hooks/useUserManagement';
import { PAGE_KEYS, PAGE_CONFIG, PageKey, UserStatus } from '@/types/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Shield, 
  User, 
  Settings,
  Trash2,
  Loader2,
  Eye,
  Pencil,
  Save
} from 'lucide-react';

interface PermissionState {
  [pageKey: string]: { canView: boolean; canEdit: boolean };
}

const AdminUsers = () => {
  const { 
    users, 
    loading, 
    updateUserStatus, 
    setUserRole, 
    updateAllPermissions, 
    deleteUser,
    grantAllPermissions 
  } = useUserManagement();
  
  const [selectedUser, setSelectedUser] = useState<UserWithDetails | null>(null);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [permissionState, setPermissionState] = useState<PermissionState>({});
  const [saving, setSaving] = useState(false);

  const getStatusBadge = (status: UserStatus | undefined) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" /> Aprovado</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Rejeitado</Badge>;
      case 'pending':
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pendente</Badge>;
    }
  };

  const hasAdminRole = (user: UserWithDetails) => {
    return user.roles.some(r => r.role === 'admin');
  };

  const getUserPermission = (user: UserWithDetails, pageKey: string) => {
    const perm = user.permissions.find(p => p.page_key === pageKey);
    return {
      canView: perm?.can_view ?? perm?.can_access ?? false,
      canEdit: perm?.can_edit ?? perm?.can_access ?? false,
    };
  };

  const filterUsersByStatus = (status: UserStatus | 'all') => {
    if (status === 'all') return users;
    return users.filter(u => u.profile?.status === status);
  };

  const openPermissions = (user: UserWithDetails) => {
    setSelectedUser(user);
    
    // Inicializar estado de permissões
    const initialState: PermissionState = {};
    Object.values(PAGE_KEYS).forEach(pageKey => {
      const perm = getUserPermission(user, pageKey);
      initialState[pageKey] = perm;
    });
    setPermissionState(initialState);
    setPermissionsOpen(true);
  };

  const handlePermissionChange = (pageKey: string, field: 'canView' | 'canEdit', value: boolean) => {
    setPermissionState(prev => {
      const updated = { ...prev };
      if (field === 'canView') {
        updated[pageKey] = { 
          canView: value, 
          // Se desmarcar visualizar, desmarcar editar também
          canEdit: value ? prev[pageKey]?.canEdit ?? false : false 
        };
      } else {
        updated[pageKey] = { 
          ...prev[pageKey], 
          canEdit: value 
        };
      }
      return updated;
    });
  };

  const handleSelectAllView = (checked: boolean) => {
    setPermissionState(prev => {
      const updated: PermissionState = {};
      Object.values(PAGE_KEYS).forEach(pageKey => {
        updated[pageKey] = { 
          canView: checked, 
          canEdit: checked ? prev[pageKey]?.canEdit ?? false : false 
        };
      });
      return updated;
    });
  };

  const handleSelectAllEdit = (checked: boolean) => {
    setPermissionState(prev => {
      const updated: PermissionState = {};
      Object.values(PAGE_KEYS).forEach(pageKey => {
        updated[pageKey] = { 
          canView: prev[pageKey]?.canView ?? false, 
          canEdit: prev[pageKey]?.canView ? checked : false 
        };
      });
      return updated;
    });
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;
    
    setSaving(true);
    const permissions = Object.entries(permissionState).map(([pageKey, perm]) => ({
      pageKey,
      canView: perm.canView,
      canEdit: perm.canEdit,
    }));
    
    await updateAllPermissions(selectedUser.id, permissions);
    setSaving(false);
    setPermissionsOpen(false);
  };

  const handleMakeAdmin = async (user: UserWithDetails) => {
    await setUserRole(user.id, 'admin', true);
  };

  const handleRemoveAdmin = async (user: UserWithDetails) => {
    await setUserRole(user.id, 'admin', false);
  };

  // Calcular totais de seleção
  const allViewChecked = useMemo(() => 
    Object.values(permissionState).every(p => p.canView),
    [permissionState]
  );
  
  const allEditChecked = useMemo(() => 
    Object.values(permissionState).every(p => p.canEdit),
    [permissionState]
  );

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
          <p className="text-muted-foreground">Aprove, rejeite e configure permissões de usuários.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Total</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-xl sm:text-2xl font-bold">{users.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-yellow-600">Pendentes</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-xl sm:text-2xl font-bold">{filterUsersByStatus('pending').length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-green-600">Aprovados</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-xl sm:text-2xl font-bold">{filterUsersByStatus('approved').length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-red-600">Rejeitados</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-xl sm:text-2xl font-bold">{filterUsersByStatus('rejected').length}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Usuários Cadastrados</CardTitle>
            <CardDescription>Lista de todos os usuários do sistema.</CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <Tabs defaultValue="pending">
              <TabsList className="w-full flex flex-wrap h-auto gap-1 sm:gap-0">
                <TabsTrigger value="pending" className="flex-1 sm:flex-none text-xs sm:text-sm py-1.5 sm:py-2">
                  Pendentes ({filterUsersByStatus('pending').length})
                </TabsTrigger>
                <TabsTrigger value="approved" className="flex-1 sm:flex-none text-xs sm:text-sm py-1.5 sm:py-2">
                  Aprovados ({filterUsersByStatus('approved').length})
                </TabsTrigger>
                <TabsTrigger value="rejected" className="flex-1 sm:flex-none text-xs sm:text-sm py-1.5 sm:py-2">
                  Rejeitados ({filterUsersByStatus('rejected').length})
                </TabsTrigger>
                <TabsTrigger value="all" className="flex-1 sm:flex-none text-xs sm:text-sm py-1.5 sm:py-2">
                  Todos ({users.length})
                </TabsTrigger>
              </TabsList>

              {['pending', 'approved', 'rejected', 'all'].map((tab) => (
                <TabsContent key={tab} value={tab} className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
                  <div className="min-w-[700px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Admin</TableHead>
                        <TableHead>Data Cadastro</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filterUsersByStatus(tab as UserStatus | 'all').map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{user.profile?.full_name || 'N/A'}</p>
                            </div>
                          </TableCell>
                          <TableCell>{user.profile?.phone || 'N/A'}</TableCell>
                          <TableCell>{getStatusBadge(user.profile?.status)}</TableCell>
                          <TableCell>
                            {hasAdminRole(user) ? (
                              <Shield className="h-4 w-4 text-primary" />
                            ) : (
                              <User className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell>
                            {user.profile?.created_at 
                              ? new Date(user.profile.created_at).toLocaleDateString('pt-BR')
                              : 'N/A'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-1 sm:gap-2">
                              {user.profile?.status === 'pending' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => updateUserStatus(user.id, 'approved')}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Aprovar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => updateUserStatus(user.id, 'rejected')}
                                  >
                                    <XCircle className="h-4 w-4 mr-1" />
                                    Rejeitar
                                  </Button>
                                </>
                              )}
                              {user.profile?.status === 'approved' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openPermissions(user)}
                                  >
                                    <Settings className="h-4 w-4 mr-1" />
                                    Permissões
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={hasAdminRole(user) ? "secondary" : "outline"}
                                    onClick={() => hasAdminRole(user) 
                                      ? handleRemoveAdmin(user) 
                                      : handleMakeAdmin(user)
                                    }
                                  >
                                    <Shield className="h-4 w-4 mr-1" />
                                    {hasAdminRole(user) ? 'Remover Admin' : 'Tornar Admin'}
                                  </Button>
                                </>
                              )}
                              {user.profile?.status === 'rejected' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateUserStatus(user.id, 'approved')}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Aprovar
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => deleteUser(user.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filterUsersByStatus(tab as UserStatus | 'all').length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Nenhum usuário encontrado.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Permissões Redesenhado */}
      <Dialog open={permissionsOpen} onOpenChange={setPermissionsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Permissões de {selectedUser?.profile?.full_name}
            </DialogTitle>
            <DialogDescription>
              Configure quais páginas o usuário pode visualizar e editar.
            </DialogDescription>
          </DialogHeader>
          
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[50%]">Página</TableHead>
                  <TableHead className="w-[25%] text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Eye className="h-4 w-4" />
                      <span>Visualizar</span>
                    </div>
                  </TableHead>
                  <TableHead className="w-[25%] text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Pencil className="h-4 w-4" />
                      <span>Editar</span>
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Linha de seleção total */}
                <TableRow className="bg-primary/5 font-medium">
                  <TableCell>Selecionar Todos</TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={allViewChecked}
                      onCheckedChange={(checked) => handleSelectAllView(!!checked)}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={allEditChecked}
                      onCheckedChange={(checked) => handleSelectAllEdit(!!checked)}
                    />
                  </TableCell>
                </TableRow>
                
                {Object.entries(PAGE_CONFIG).map(([key, config]) => {
                  const perm = permissionState[key] || { canView: false, canEdit: false };
                  return (
                    <TableRow key={key}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{config.label}</p>
                          <p className="text-xs text-muted-foreground">{config.description}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={perm.canView}
                          onCheckedChange={(checked) => 
                            handlePermissionChange(key, 'canView', !!checked)
                          }
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={perm.canEdit}
                          disabled={!perm.canView}
                          onCheckedChange={(checked) => 
                            handlePermissionChange(key, 'canEdit', !!checked)
                          }
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setPermissionsOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSavePermissions} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Permissões
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default AdminUsers;

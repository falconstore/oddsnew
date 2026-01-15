import { useState } from 'react';
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
} from '@/components/ui/dialog';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Shield, 
  User, 
  Settings,
  Trash2,
  Loader2
} from 'lucide-react';

const AdminUsers = () => {
  const { users, loading, updateUserStatus, setUserRole, updatePermission, deleteUser } = useUserManagement();
  const [selectedUser, setSelectedUser] = useState<UserWithDetails | null>(null);
  const [permissionsOpen, setPermissionsOpen] = useState(false);

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

  const hasPermission = (user: UserWithDetails, pageKey: string) => {
    return user.permissions.some(p => p.page_key === pageKey && p.can_access);
  };

  const filterUsersByStatus = (status: UserStatus | 'all') => {
    if (status === 'all') return users;
    return users.filter(u => u.profile?.status === status);
  };

  const openPermissions = (user: UserWithDetails) => {
    setSelectedUser(user);
    setPermissionsOpen(true);
  };

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
                                    onClick={() => setUserRole(user.id, 'admin', !hasAdminRole(user))}
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

      {/* Modal de Permissões */}
      <Dialog open={permissionsOpen} onOpenChange={setPermissionsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Permissões de Acesso</DialogTitle>
            <DialogDescription>
              Configure quais páginas {selectedUser?.profile?.full_name} pode acessar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {Object.entries(PAGE_CONFIG).map(([key, config]) => (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={key}
                    checked={selectedUser ? hasPermission(selectedUser, key) : false}
                    onCheckedChange={(checked) => {
                      if (selectedUser) {
                        updatePermission(selectedUser.id, key, !!checked);
                      }
                    }}
                  />
                  <label htmlFor={key} className="text-sm font-medium cursor-pointer">
                    {config.label}
                  </label>
                </div>
                {config.adminOnly && (
                  <Badge variant="outline" className="text-xs">Admin</Badge>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default AdminUsers;

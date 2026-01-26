import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { useLeagues, useCreateLeague, useUpdateLeague, useDeleteLeague } from '@/hooks/useOddsData';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { League, EntityStatus } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { PAGE_KEYS } from '@/types/auth';

const Leagues = () => {
  const { canEditPage } = useAuth();
  const canEdit = canEditPage(PAGE_KEYS.LEAGUES);
  
  const { data: leagues, isLoading } = useLeagues();
  const createLeague = useCreateLeague();
  const updateLeague = useUpdateLeague();
  const deleteLeague = useDeleteLeague();
  
  const [editingLeague, setEditingLeague] = useState<League | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', country: '', status: 'active' as EntityStatus });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLeague) {
      updateLeague.mutate({ id: editingLeague.id, ...formData });
    } else {
      createLeague.mutate(formData);
    }
    setIsDialogOpen(false);
    setEditingLeague(null);
    setFormData({ name: '', country: '', status: 'active' });
  };

  const handleEdit = (league: League) => {
    setEditingLeague(league);
    setFormData({ name: league.name, country: league.country || '', status: league.status });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta liga?')) {
      deleteLeague.mutate(id);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Ligas</h1>
            <p className="text-muted-foreground">Gerencie os campeonatos monitorados</p>
          </div>
          {canEdit && (
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setEditingLeague(null);
                setFormData({ name: '', country: '', status: 'active' });
              }
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Liga
                </Button>
              </DialogTrigger>
              <DialogContent aria-describedby="league-dialog-description">
                <DialogHeader>
                  <DialogTitle>{editingLeague ? 'Editar Liga' : 'Nova Liga'}</DialogTitle>
                  <p id="league-dialog-description" className="text-sm text-muted-foreground">
                    {editingLeague ? 'Altere os dados da liga abaixo.' : 'Preencha os dados para criar uma nova liga.'}
                  </p>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Premier League"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">País</Label>
                    <Input
                      id="country"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      placeholder="Ex: Inglaterra"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as EntityStatus })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="inactive">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">
                      {editingLeague ? 'Salvar' : 'Criar'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>País</TableHead>
                  <TableHead>Status</TableHead>
                  {canEdit && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 4 : 3} className="text-center">Carregando...</TableCell>
                  </TableRow>
                )}
                {leagues?.map((league) => (
                  <TableRow key={league.id}>
                    <TableCell className="font-medium">{league.name}</TableCell>
                    <TableCell>{league.country || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={league.status === 'active' ? 'default' : 'secondary'}>
                        {league.status === 'active' ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(league)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(league.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {!isLoading && (!leagues || leagues.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 4 : 3} className="text-center text-muted-foreground">
                      Nenhuma liga cadastrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Leagues;

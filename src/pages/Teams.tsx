import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { useTeams, useLeagues, useCreateTeam, useUpdateTeam, useDeleteTeam, useTeamAliases, useCreateTeamAlias, useDeleteTeamAlias } from '@/hooks/useOddsData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, Pencil, Trash2, Tag, X } from 'lucide-react';
import type { Team, EntityStatus } from '@/types/database';

const Teams = () => {
  const { data: teams, isLoading } = useTeams();
  const { data: leagues } = useLeagues();
  const { data: aliases } = useTeamAliases();
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();
  const createAlias = useCreateTeamAlias();
  const deleteAlias = useDeleteTeamAlias();
  
  const [selectedLeague, setSelectedLeague] = useState<string>('all');
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAliasDialogOpen, setIsAliasDialogOpen] = useState(false);
  const [selectedTeamForAlias, setSelectedTeamForAlias] = useState<Team | null>(null);
  const [newAlias, setNewAlias] = useState({ alias_name: '', bookmaker_source: '' });
  const [formData, setFormData] = useState({ standard_name: '', league_id: '', status: 'active' as EntityStatus, logo_url: '' });

  const filteredTeams = selectedLeague === 'all' 
    ? teams 
    : teams?.filter(t => t.league_id === selectedLeague);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSubmit = {
      ...formData,
      logo_url: formData.logo_url || null
    };
    if (editingTeam) {
      updateTeam.mutate({ id: editingTeam.id, ...dataToSubmit });
    } else {
      createTeam.mutate(dataToSubmit);
    }
    setIsDialogOpen(false);
    setEditingTeam(null);
    setFormData({ standard_name: '', league_id: '', status: 'active', logo_url: '' });
  };

  const handleEdit = (team: Team) => {
    setEditingTeam(team);
    setFormData({ 
      standard_name: team.standard_name, 
      league_id: team.league_id, 
      status: team.status,
      logo_url: team.logo_url || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza?')) {
      deleteTeam.mutate(id);
    }
  };

  const handleAddAlias = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTeamForAlias) {
      createAlias.mutate({ team_id: selectedTeamForAlias.id, ...newAlias });
      setNewAlias({ alias_name: '', bookmaker_source: '' });
    }
  };

  const getTeamAliases = (teamId: string) => aliases?.filter(a => a.team_id === teamId) || [];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Times</h1>
            <p className="text-muted-foreground">Gerencie times e seus aliases para normalização</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingTeam(null);
              setFormData({ standard_name: '', league_id: '', status: 'active', logo_url: '' });
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Time
              </Button>
            </DialogTrigger>
            <DialogContent aria-describedby="team-dialog-description">
              <DialogHeader>
                <DialogTitle>{editingTeam ? 'Editar Time' : 'Novo Time'}</DialogTitle>
                <p id="team-dialog-description" className="text-sm text-muted-foreground">
                  {editingTeam ? 'Altere os dados do time abaixo.' : 'Preencha os dados para criar um novo time.'}
                </p>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Padrão</Label>
                  <Input
                    id="name"
                    value={formData.standard_name}
                    onChange={(e) => setFormData({ ...formData, standard_name: e.target.value })}
                    placeholder="Ex: Manchester United"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="league">Liga</Label>
                  <Select value={formData.league_id} onValueChange={(v) => setFormData({ ...formData, league_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma liga" />
                    </SelectTrigger>
                    <SelectContent>
                      {leagues?.map((league) => (
                        <SelectItem key={league.id} value={league.id}>{league.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <div className="space-y-2">
                  <Label htmlFor="logo">URL do Logo</Label>
                  <Input
                    id="logo"
                    value={formData.logo_url}
                    onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                    placeholder="https://exemplo.com/logo.png"
                  />
                  {formData.logo_url && (
                    <div className="flex items-center gap-2 mt-2 p-2 border rounded">
                      <img 
                        src={formData.logo_url} 
                        alt="Preview" 
                        className="h-8 w-8 object-contain"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                      <span className="text-sm text-muted-foreground">Preview do logo</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit">{editingTeam ? 'Salvar' : 'Criar'}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filter */}
        <div className="flex gap-4">
          <Select value={selectedLeague} onValueChange={setSelectedLeague}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por liga" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ligas</SelectItem>
              {leagues?.map((league) => (
                <SelectItem key={league.id} value={league.id}>{league.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Accordion type="single" collapsible className="w-full">
              {isLoading && <div className="text-center py-4">Carregando...</div>}
              {filteredTeams?.map((team) => (
                <AccordionItem key={team.id} value={team.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-4">
                      {team.logo_url && (
                        <img 
                          src={team.logo_url} 
                          alt={team.standard_name}
                          className="h-6 w-6 object-contain"
                        />
                      )}
                      <span className="font-medium">{team.standard_name}</span>
                      <Badge variant="outline">{(team.league as any)?.name || 'Sem liga'}</Badge>
                      <Badge variant={team.status === 'active' ? 'default' : 'secondary'}>
                        {team.status === 'active' ? 'Ativo' : 'Inativo'}
                      </Badge>
                      <Badge variant="outline">
                        <Tag className="h-3 w-3 mr-1" />
                        {getTeamAliases(team.id).length} aliases
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-4">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(team)}>
                          <Pencil className="h-4 w-4 mr-1" /> Editar
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => {
                          setSelectedTeamForAlias(team);
                          setIsAliasDialogOpen(true);
                        }}>
                          <Tag className="h-4 w-4 mr-1" /> Adicionar Alias
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(team.id)}>
                          <Trash2 className="h-4 w-4 mr-1" /> Excluir
                        </Button>
                      </div>
                      
                      <div>
                        <Label className="text-sm text-muted-foreground">Aliases (nomes alternativos)</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {getTeamAliases(team.id).map((alias) => (
                            <Badge key={alias.id} variant="secondary" className="gap-1">
                              {alias.alias_name}
                              {alias.bookmaker_source && <span className="text-xs opacity-60">({alias.bookmaker_source})</span>}
                              <button onClick={() => deleteAlias.mutate(alias.id)} className="ml-1 hover:text-destructive">
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                          {getTeamAliases(team.id).length === 0 && (
                            <span className="text-sm text-muted-foreground">Nenhum alias cadastrado</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
              {!isLoading && (!filteredTeams || filteredTeams.length === 0) && (
                <div className="text-center py-4 text-muted-foreground">Nenhum time encontrado</div>
              )}
            </Accordion>
          </CardContent>
        </Card>

        {/* Alias Dialog */}
        <Dialog open={isAliasDialogOpen} onOpenChange={setIsAliasDialogOpen}>
          <DialogContent aria-describedby="alias-dialog-description">
            <DialogHeader>
              <DialogTitle>Adicionar Alias para {selectedTeamForAlias?.standard_name}</DialogTitle>
              <p id="alias-dialog-description" className="text-sm text-muted-foreground">
                Adicione um nome alternativo usado por casas de apostas.
              </p>
            </DialogHeader>
            <form onSubmit={handleAddAlias} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="alias">Nome do Alias</Label>
                <Input
                  id="alias"
                  value={newAlias.alias_name}
                  onChange={(e) => setNewAlias({ ...newAlias, alias_name: e.target.value })}
                  placeholder="Ex: Man Utd"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source">Casa de Apostas (opcional)</Label>
                <Input
                  id="source"
                  value={newAlias.bookmaker_source}
                  onChange={(e) => setNewAlias({ ...newAlias, bookmaker_source: e.target.value })}
                  placeholder="Ex: Bet365"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsAliasDialogOpen(false)}>Cancelar</Button>
                <Button type="submit">Adicionar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Teams;

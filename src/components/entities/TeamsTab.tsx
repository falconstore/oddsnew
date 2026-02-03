import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTeams, useLeagues, useCreateTeam, useUpdateTeam, useDeleteTeam, useTeamAliases, useCreateTeamAliases, useDeleteTeamAlias, useBookmakers } from '@/hooks/useOddsData';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { MultiSelectPopover } from '@/components/ui/multi-select-popover';
import { Plus, Pencil, Trash2, Tag, X, Search, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Team, EntityStatus } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { PAGE_KEYS } from '@/types/auth';

export const TeamsTab = () => {
  const { canEditPage } = useAuth();
  const canEdit = canEditPage(PAGE_KEYS.TEAMS);
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: teams, isLoading } = useTeams();
  const { data: leagues } = useLeagues();
  const { data: aliases } = useTeamAliases();
  const { data: bookmakers } = useBookmakers();
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();
  const createAliases = useCreateTeamAliases();
  const deleteAlias = useDeleteTeamAlias();
  
  const [selectedLeague, setSelectedLeague] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>(searchParams.get('search') || '');
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAliasDialogOpen, setIsAliasDialogOpen] = useState(false);
  const [selectedTeamForAlias, setSelectedTeamForAlias] = useState<Team | null>(null);
  const [newAlias, setNewAlias] = useState({ alias_name: '', bookmaker_sources: [] as string[] });
  const [formData, setFormData] = useState({ standard_name: '', league_id: '', status: 'active' as EntityStatus, logo_url: '' });

  // Casas de apostas ativas para o select
  const activeBookmakers = useMemo(() => 
    bookmakers?.filter(b => b.status === 'active').sort((a, b) => a.name.localeCompare(b.name)) || [],
    [bookmakers]
  );

  // Filtrar times por liga E por termo de busca (nome ou alias)
  const filteredTeams = useMemo(() => {
    let result = selectedLeague === 'all' 
      ? teams 
      : teams?.filter(t => t.league_id === selectedLeague);
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result?.filter(team => {
        // Busca no nome padrão
        if (team.standard_name.toLowerCase().includes(term)) return true;
        // Busca nos aliases
        const teamAliases = aliases?.filter(a => a.team_id === team.id);
        return teamAliases?.some(a => a.alias_name.toLowerCase().includes(term));
      });
    }
    
    return result;
  }, [teams, selectedLeague, searchTerm, aliases]);

  // Atualizar URL quando busca muda
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (value) {
      setSearchParams({ search: value });
    } else {
      setSearchParams({});
    }
  };

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
    if (selectedTeamForAlias && newAlias.bookmaker_sources.length > 0) {
      createAliases.mutate({ 
        team_id: selectedTeamForAlias.id, 
        alias_name: newAlias.alias_name,
        bookmaker_sources: newAlias.bookmaker_sources
      });
      setNewAlias({ alias_name: '', bookmaker_sources: [] });
      setIsAliasDialogOpen(false);
    }
  };

  const getTeamAliases = (teamId: string) => aliases?.filter(a => a.team_id === teamId) || [];

  // Bookmakers options for multi-select
  const bookmakerOptions = useMemo(() => 
    activeBookmakers.map(b => ({ 
      value: b.name.toLowerCase(), 
      label: b.name 
    })),
    [activeBookmakers]
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm">Gerencie times e seus aliases para normalização</p>
        </div>
        {canEdit && (
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
        )}
      </div>

      {/* Filters with Search */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar time ou alias..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-8 h-10"
          />
        </div>
        <Select value={selectedLeague} onValueChange={setSelectedLeague}>
          <SelectTrigger className="w-full sm:w-[200px] h-10">
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

      {/* Search results info */}
      {searchTerm && (
        <div className="text-sm text-muted-foreground">
          {filteredTeams?.length || 0} resultado(s) para "{searchTerm}"
          <Button variant="link" className="px-2 h-auto text-sm" onClick={() => handleSearchChange('')}>
            Limpar
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="pt-4 sm:pt-6">
          <Accordion type="single" collapsible className="w-full">
            {isLoading && <div className="text-center py-4">Carregando...</div>}
            {filteredTeams?.map((team) => (
              <AccordionItem key={team.id} value={team.id}>
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-left">
                    {team.logo_url && (
                      <img 
                        src={team.logo_url} 
                        alt={team.standard_name}
                        className="h-5 w-5 sm:h-6 sm:w-6 object-contain"
                      />
                    )}
                    <span className="font-medium text-sm sm:text-base">{team.standard_name}</span>
                    <div className="flex flex-wrap gap-1 sm:gap-2">
                      <Badge variant="outline" className="text-xs">{(team.league as any)?.name || 'Sem liga'}</Badge>
                      <Badge variant={team.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                        {team.status === 'active' ? 'Ativo' : 'Inativo'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        <Tag className="h-3 w-3 mr-1" />
                        {getTeamAliases(team.id).length}
                      </Badge>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-4">
                    {canEdit && (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(team)}>
                          <Pencil className="h-4 w-4 sm:mr-1" /> 
                          <span className="hidden sm:inline">Editar</span>
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => {
                          setSelectedTeamForAlias(team);
                          setIsAliasDialogOpen(true);
                        }}>
                          <Tag className="h-4 w-4 sm:mr-1" /> 
                          <span className="hidden sm:inline">Add Alias</span>
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(team.id)}>
                          <Trash2 className="h-4 w-4 sm:mr-1" /> 
                          <span className="hidden sm:inline">Excluir</span>
                        </Button>
                      </div>
                    )}
                    
                    <div>
                      <Label className="text-sm text-muted-foreground">Aliases (nomes alternativos)</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {getTeamAliases(team.id).map((alias) => (
                          <Badge key={alias.id} variant="secondary" className="gap-1">
                            {alias.alias_name}
                            {alias.bookmaker_source && (
                              <span className="text-xs opacity-60 bg-background/50 px-1 rounded">
                                {alias.bookmaker_source}
                              </span>
                            )}
                            {canEdit && (
                              <button onClick={() => deleteAlias.mutate(alias.id)} className="ml-1 hover:text-destructive">
                                <X className="h-3 w-3" />
                              </button>
                            )}
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

      {/* Alias Dialog - Multi-bookmaker selection */}
      <Dialog open={isAliasDialogOpen} onOpenChange={(open) => {
        setIsAliasDialogOpen(open);
        if (!open) {
          setNewAlias({ alias_name: '', bookmaker_sources: [] });
        }
      }}>
        <DialogContent aria-describedby="alias-dialog-description">
          <DialogHeader>
            <DialogTitle>Adicionar Alias para {selectedTeamForAlias?.standard_name}</DialogTitle>
            <p id="alias-dialog-description" className="text-sm text-muted-foreground">
              Adicione um nome alternativo usado por casas de apostas.
            </p>
          </DialogHeader>
          
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              O alias e as casas serão <strong>normalizados automaticamente</strong> para minúsculas.
              Você pode selecionar <strong>múltiplas casas</strong> se usarem o mesmo nome.
            </AlertDescription>
          </Alert>

          <form onSubmit={handleAddAlias} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="alias">Nome do Alias *</Label>
              <Input
                id="alias"
                value={newAlias.alias_name}
                onChange={(e) => setNewAlias({ ...newAlias, alias_name: e.target.value })}
                placeholder="Ex: Man Utd, Manchester Utd"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Casas de Apostas *</Label>
              <MultiSelectPopover
                options={bookmakerOptions}
                selected={newAlias.bookmaker_sources}
                onChange={(selected) => setNewAlias({ ...newAlias, bookmaker_sources: selected })}
                placeholder="Selecione as casas"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Selecione uma ou mais casas que usam este nome alternativo.
              </p>
            </div>

            {/* Preview of all aliases to be created */}
            {newAlias.alias_name && newAlias.bookmaker_sources.length > 0 && (
              <div className="p-3 bg-muted rounded-md space-y-2">
                <span className="text-xs text-muted-foreground">
                  Serão criados {newAlias.bookmaker_sources.length} alias(es):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {newAlias.bookmaker_sources.map(bookmaker => (
                    <Badge key={bookmaker} variant="secondary" className="text-xs font-mono">
                      "{newAlias.alias_name.toLowerCase()}" ({bookmaker})
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsAliasDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!newAlias.alias_name || newAlias.bookmaker_sources.length === 0}>
                Adicionar {newAlias.bookmaker_sources.length > 1 ? `(${newAlias.bookmaker_sources.length})` : ''}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeamsTab;

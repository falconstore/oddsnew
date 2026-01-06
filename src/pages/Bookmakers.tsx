import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { useBookmakers, useCreateBookmaker, useUpdateBookmaker, useDeleteBookmaker } from '@/hooks/useOddsData';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Pencil, Trash2, ExternalLink, ChevronDown, Trophy } from 'lucide-react';
import type { Bookmaker, EntityStatus } from '@/types/database';

// Dados das ligas por bookmaker (baseado nos scrapers)
const BOOKMAKER_LEAGUES: Record<string, string[]> = {
  'superbet': ['Premier League', 'Serie A', 'La Liga'],
  'sportingbet': ['Premier League', 'La Liga', 'Serie A'],
  'novibet': ['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1', 'Brasileirão A'],
  'kto': ['Serie A', 'Premier League', 'La Liga'],
  'betbra': ['Premier League', 'Serie A', 'La Liga'],
  'betano': ['Premier League', 'La Liga', 'Serie A'],
  'estrelabet': ['Serie A'],
  'br4bet': ['Serie A', 'La Liga', 'Premier League', 'Bundesliga'],
  'betnacional': ['Premier League', 'Serie A', 'La Liga'],
  'stake': ['Premier League', 'Serie A', 'La Liga'],
  'mcgames': ['Premier League', 'Serie A', 'La Liga'],
  'aposta1': ['Premier League', 'Serie A', 'La Liga'],
  'esportivabet': ['Premier League', 'Serie A', 'La Liga'],
};

const Bookmakers = () => {
  const { data: bookmakers, isLoading } = useBookmakers();
  const createBookmaker = useCreateBookmaker();
  const updateBookmaker = useUpdateBookmaker();
  const deleteBookmaker = useDeleteBookmaker();
  
  const [editing, setEditing] = useState<Bookmaker | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', website_url: '', priority: 0, status: 'active' as EntityStatus });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      updateBookmaker.mutate({ id: editing.id, ...formData });
    } else {
      createBookmaker.mutate(formData);
    }
    setIsDialogOpen(false);
    setEditing(null);
    setFormData({ name: '', website_url: '', priority: 0, status: 'active' });
  };

  const handleEdit = (bookmaker: Bookmaker) => {
    setEditing(bookmaker);
    setFormData({ 
      name: bookmaker.name, 
      website_url: bookmaker.website_url || '', 
      priority: bookmaker.priority,
      status: bookmaker.status 
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza?')) {
      deleteBookmaker.mutate(id);
    }
  };

  const getLeaguesForBookmaker = (name: string): string[] => {
    const normalizedName = name.toLowerCase().trim();
    return BOOKMAKER_LEAGUES[normalizedName] || [];
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Casas de Apostas</h1>
            <p className="text-muted-foreground">Gerencie as fontes de dados de odds</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditing(null);
              setFormData({ name: '', website_url: '', priority: 0, status: 'active' });
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Casa
              </Button>
            </DialogTrigger>
            <DialogContent aria-describedby="bookmaker-dialog-description">
              <DialogHeader>
                <DialogTitle>{editing ? 'Editar Casa de Apostas' : 'Nova Casa de Apostas'}</DialogTitle>
                <p id="bookmaker-dialog-description" className="text-sm text-muted-foreground">
                  {editing ? 'Altere os dados da casa de apostas.' : 'Preencha os dados para cadastrar uma nova casa.'}
                </p>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Bet365"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={formData.website_url}
                    onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                    placeholder="https://bet365.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Prioridade (ordenação)</Label>
                  <Input
                    id="priority"
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
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
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit">{editing ? 'Salvar' : 'Criar'}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ligas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">Carregando...</TableCell>
                  </TableRow>
                )}
                {bookmakers?.map((bookmaker) => {
                  const leagues = getLeaguesForBookmaker(bookmaker.name);
                  const hasLeagues = leagues.length > 0;
                  const isExpanded = expandedRows.has(bookmaker.id);
                  
                  return (
                    <Collapsible key={bookmaker.id} open={isExpanded} onOpenChange={() => toggleRow(bookmaker.id)} asChild>
                      <>
                        <TableRow>
                          <TableCell className="font-medium">{bookmaker.name}</TableCell>
                          <TableCell>
                            {bookmaker.website_url ? (
                              <a href={bookmaker.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                                {new URL(bookmaker.website_url).hostname}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : '-'}
                          </TableCell>
                          <TableCell>{bookmaker.priority}</TableCell>
                          <TableCell>
                            <Badge variant={bookmaker.status === 'active' ? 'default' : 'secondary'}>
                              {bookmaker.status === 'active' ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {hasLeagues ? (
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="gap-1 h-7 px-2">
                                  <Trophy className="h-3 w-3" />
                                  <span>{leagues.length} {leagues.length === 1 ? 'liga' : 'ligas'}</span>
                                  <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </Button>
                              </CollapsibleTrigger>
                            ) : (
                              <span className="text-muted-foreground text-sm">Não configurado</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(bookmaker)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(bookmaker.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        <CollapsibleContent asChild>
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={6} className="py-3">
                              <div className="flex flex-wrap gap-2 pl-4">
                                {leagues.map((league) => (
                                  <Badge key={league} variant="outline" className="text-xs">
                                    {league}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  );
                })}
                {!isLoading && (!bookmakers || bookmakers.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Nenhuma casa de apostas cadastrada
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

export default Bookmakers;

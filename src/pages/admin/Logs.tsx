import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileWarning, ChevronRight, ExternalLink, AlertTriangle, BarChart3, Filter } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { useOddsComparison, useBookmakers } from '@/hooks/useOddsData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MultiSelectPopover } from '@/components/ui/multi-select-popover';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

interface MatchWithMissing {
  match_id: string;
  home_team: string;
  away_team: string;
  league_name: string;
  match_date: string;
  odds: Array<{ bookmaker_name: string }>;
  missingBookmakers: Array<{ id: string; name: string; priority: number }>;
  missingCount: number;
}

export default function AdminLogs() {
  const { data: matches, isLoading: matchesLoading } = useOddsComparison();
  const { data: allBookmakers, isLoading: bookmakersLoading } = useBookmakers();
  
  const [selectedLeagues, setSelectedLeagues] = useState<string[]>([]);
  const [onlyWithErrors, setOnlyWithErrors] = useState(true);
  const [expandedLeagues, setExpandedLeagues] = useState<Set<string>>(new Set());

  // Calcular partidas com casas faltando
  const matchesWithMissing = useMemo<MatchWithMissing[]>(() => {
    if (!matches || !allBookmakers) return [];
    
    const activeBookmakers = allBookmakers.filter(b => b.status === 'active');
    
    return matches.map(match => {
      const presentBookmakers = new Set(
        match.odds.map(o => o.bookmaker_name.toLowerCase())
      );
      
      const missing = activeBookmakers.filter(
        b => !presentBookmakers.has(b.name.toLowerCase())
      );
      
      return {
        ...match,
        missingBookmakers: missing.sort((a, b) => a.priority - b.priority),
        missingCount: missing.length
      };
    });
  }, [matches, allBookmakers]);

  // Filtrar por liga e status de erro
  const filteredMatches = useMemo(() => {
    let result = matchesWithMissing;
    
    if (onlyWithErrors) {
      result = result.filter(m => m.missingCount > 0);
    }
    
    if (selectedLeagues.length > 0) {
      result = result.filter(m => selectedLeagues.includes(m.league_name));
    }
    
    return result;
  }, [matchesWithMissing, selectedLeagues, onlyWithErrors]);

  // Agrupar por liga
  const groupedByLeague = useMemo(() => {
    const groups: Record<string, MatchWithMissing[]> = {};
    
    filteredMatches.forEach(match => {
      if (!groups[match.league_name]) {
        groups[match.league_name] = [];
      }
      groups[match.league_name].push(match);
    });
    
    // Ordenar por quantidade de partidas (mais problemáticas primeiro)
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [filteredMatches]);

  // Ligas disponíveis para filtro
  const availableLeagues = useMemo(() => {
    if (!matches) return [];
    const leagues = [...new Set(matches.map(m => m.league_name))];
    return leagues.sort().map(l => ({ value: l, label: l }));
  }, [matches]);

  // Estatísticas
  const stats = useMemo(() => {
    const totalMatches = matchesWithMissing.length;
    const matchesWithErrors = matchesWithMissing.filter(m => m.missingCount > 0).length;
    
    // Contar ocorrências por bookmaker
    const bookmakerCounts: Record<string, number> = {};
    matchesWithMissing.forEach(match => {
      match.missingBookmakers.forEach(b => {
        bookmakerCounts[b.name] = (bookmakerCounts[b.name] || 0) + 1;
      });
    });
    
    // Casa mais problemática
    const mostProblematic = Object.entries(bookmakerCounts)
      .sort((a, b) => b[1] - a[1])[0];
    
    return {
      totalMatches,
      matchesWithErrors,
      errorPercentage: totalMatches > 0 ? Math.round((matchesWithErrors / totalMatches) * 100) : 0,
      mostProblematic: mostProblematic ? { name: mostProblematic[0], count: mostProblematic[1] } : null
    };
  }, [matchesWithMissing]);

  const toggleLeague = (league: string) => {
    setExpandedLeagues(prev => {
      const next = new Set(prev);
      if (next.has(league)) {
        next.delete(league);
      } else {
        next.add(league);
      }
      return next;
    });
  };

  const isLoading = matchesLoading || bookmakersLoading;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileWarning className="h-6 w-6 text-amber-500" />
            Logs / Diagnóstico
          </h1>
          <p className="text-muted-foreground mt-1">
            Identifique partidas com casas de apostas faltando para diagnosticar problemas de scraping
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <MultiSelectPopover
                  options={availableLeagues}
                  selected={selectedLeagues}
                  onChange={setSelectedLeagues}
                  placeholder="Filtrar por liga"
                  className="min-w-[200px]"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Switch
                  id="only-errors"
                  checked={onlyWithErrors}
                  onCheckedChange={setOnlyWithErrors}
                />
                <Label htmlFor="only-errors" className="text-sm">
                  Apenas com casas faltando
                </Label>
              </div>

              {selectedLeagues.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedLeagues([])}
                >
                  Limpar filtros
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Partidas Analisadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stats.totalMatches}</div>
              )}
            </CardContent>
          </Card>

          <Card className="border-amber-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Com Casas Faltando
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-amber-600">{stats.matchesWithErrors}</span>
                  <span className="text-sm text-muted-foreground">({stats.errorPercentage}%)</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <BarChart3 className="h-4 w-4" />
                Casa Mais Problemática
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : stats.mostProblematic ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold">{stats.mostProblematic.name}</span>
                  <span className="text-sm text-muted-foreground">({stats.mostProblematic.count}x)</span>
                </div>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Grouped Tables */}
        <div className="space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </>
          ) : groupedByLeague.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {onlyWithErrors 
                  ? 'Nenhuma partida com casas faltando encontrada 🎉'
                  : 'Nenhuma partida encontrada'}
              </CardContent>
            </Card>
          ) : (
            groupedByLeague.map(([league, leagueMatches]) => (
              <Collapsible
                key={league}
                open={expandedLeagues.has(league)}
                onOpenChange={() => toggleLeague(league)}
              >
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <ChevronRight 
                            className={`h-4 w-4 transition-transform ${
                              expandedLeagues.has(league) ? 'rotate-90' : ''
                            }`} 
                          />
                          {league}
                          <Badge variant="secondary" className="ml-2">
                            {leagueMatches.length} partida{leagueMatches.length !== 1 ? 's' : ''}
                          </Badge>
                        </CardTitle>
                        <Badge variant="outline" className="text-amber-600 border-amber-500/50">
                          {leagueMatches.reduce((acc, m) => acc + m.missingCount, 0)} casas faltando
                        </Badge>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[140px]">Data/Hora</TableHead>
                            <TableHead>Times</TableHead>
                            <TableHead>Casas Faltando</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {leagueMatches.map(match => (
                            <TableRow key={match.match_id}>
                              <TableCell className="text-sm">
                                {format(new Date(match.match_date), "dd/MM HH:mm", { locale: ptBR })}
                              </TableCell>
                              <TableCell>
                                <span className="font-medium">{match.home_team}</span>
                                <span className="text-muted-foreground mx-2">vs</span>
                                <span className="font-medium">{match.away_team}</span>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {match.missingBookmakers.slice(0, 5).map(b => (
                                    <Badge 
                                      key={b.id} 
                                      variant="outline" 
                                      className="text-xs text-amber-600 border-amber-500/50"
                                    >
                                      {b.name}
                                    </Badge>
                                  ))}
                                  {match.missingBookmakers.length > 5 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{match.missingBookmakers.length - 5}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  asChild
                                  className="h-8 w-8"
                                >
                                  <Link to={`/match/${match.match_id}`}>
                                    <ExternalLink className="h-4 w-4" />
                                  </Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useOddsComparison } from '@/hooks/useOddsData';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle } from 'lucide-react';
import { useState, useMemo } from 'react';
import { OddsFilters } from './OddsFilters';
import { ViewToggle, ViewMode } from './ViewToggle';
import { useFiltersFromUrl, defaultFilters } from '@/hooks/useFiltersFromUrl';
import { getBestOddsByType, calculateROI, getBestPAOdds } from '@/lib/oddsTypeUtils';
import type { MatchOddsGroup } from '@/types/database';

interface OddsComparisonTableProps {
  onStatsUpdate?: (stats: { surebetCount: number; totalMatches: number }) => void;
}

export function OddsComparisonTable({ onStatsUpdate }: OddsComparisonTableProps) {
  const { filters, setFilters, hasActiveFilters } = useFiltersFromUrl();
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [activeTab, setActiveTab] = useState<'football' | 'basketball'>('football');
  
  // Get first league for API query (or undefined for all)
  const leagueForQuery = filters.leagues.length === 1 ? filters.leagues[0] : undefined;
  
  const { data: matches, isLoading, error } = useOddsComparison(
    leagueForQuery ? { leagueName: leagueForQuery } : undefined
  );

  // Filter and sort matches
  const filteredMatches = useMemo(() => {
    if (!matches) return [];
    
    let result = [...matches];
    
    // Sport filter based on active tab
    result = result.filter(m => (m.sport_type || 'football') === activeTab);
    
    // League filter (multiple)
    if (filters.leagues.length > 0) {
      result = result.filter(m => filters.leagues.includes(m.league_name));
    }
    
    // Date filter (multiple specific dates)
    if (filters.dates.length > 0) {
      result = result.filter(m => {
        const matchDateStr = format(new Date(m.match_date), 'yyyy-MM-dd');
        return filters.dates.includes(matchDateStr);
      });
    }
    
    // Bookmaker filter (multiple)
    if (filters.bookmakers.length > 0) {
      result = result.filter(m => 
        m.odds.some(o => filters.bookmakers.includes(o.bookmaker_name))
      );
    }
    
    // Opportunity type filter (surebet)
    if (filters.opportunityType === 'surebet') {
      result = result.filter(m => {
        const isBasketball = (m.sport_type || 'football') === 'basketball';
        const arbitrageValue = isBasketball || m.best_draw === null || m.best_draw === 0
          ? 1/m.best_home + 1/m.best_away
          : 1/m.best_home + 1/m.best_draw + 1/m.best_away;
        return arbitrageValue < 1;
      });
    }
    
    // Sorting
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (filters.sortBy) {
        case 'date':
          comparison = new Date(a.match_date).getTime() - new Date(b.match_date).getTime();
          break;
        case 'margin': {
          const isBasketballA = (a.sport_type || 'football') === 'basketball';
          const isBasketballB = (b.sport_type || 'football') === 'basketball';
          const marginA = isBasketballA || a.best_draw === null || a.best_draw === 0
            ? 1/a.best_home + 1/a.best_away
            : 1/a.best_home + 1/a.best_draw + 1/a.best_away;
          const marginB = isBasketballB || b.best_draw === null || b.best_draw === 0
            ? 1/b.best_home + 1/b.best_away
            : 1/b.best_home + 1/b.best_draw + 1/b.best_away;
          comparison = marginA - marginB;
          break;
        }
        case 'team':
          comparison = a.home_team.localeCompare(b.home_team);
          break;
        case 'bookmakers':
          comparison = b.odds.length - a.odds.length;
          break;
      }
      
      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [matches, filters, activeTab]);

  // Calculate counts per sport
  const sportCounts = useMemo(() => {
    if (!matches) return { football: 0, basketball: 0 };
    return {
      football: matches.filter(m => (m.sport_type || 'football') === 'football').length,
      basketball: matches.filter(m => (m.sport_type || 'football') === 'basketball').length
    };
  }, [matches]);

  // Calculate stats
  useMemo(() => {
    if (!matches || !onStatsUpdate) return;
    
    let surebetCount = 0;
    
    matches.forEach(m => {
      const isBasketball = (m.sport_type || 'football') === 'basketball';
      const arbitrageValue = isBasketball || m.best_draw === null || m.best_draw === 0
        ? 1/m.best_home + 1/m.best_away
        : 1/m.best_home + 1/m.best_draw + 1/m.best_away;
      if (arbitrageValue < 1) surebetCount++;
    });
    
    onStatsUpdate({ surebetCount, totalMatches: matches.length });
  }, [matches, onStatsUpdate]);

  // For surebet-only view
  const displayMatches = viewMode === 'surebets' 
    ? filteredMatches.filter(m => {
        const isBasketball = (m.sport_type || 'football') === 'basketball';
        const arbitrageValue = isBasketball || m.best_draw === null || m.best_draw === 0
          ? 1/m.best_home + 1/m.best_away
          : 1/m.best_home + 1/m.best_draw + 1/m.best_away;
        return arbitrageValue < 1;
      })
    : filteredMatches;

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <span>Erro ao carregar dados: {error.message}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sport Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'football' | 'basketball')}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="football" className="gap-2">
            ⚽ Odds Futebol
            {sportCounts.football > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{sportCounts.football}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="basketball" className="gap-2">
            🏀 Odds Basquete
            {sportCounts.basketball > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{sportCounts.basketball}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4 space-y-4">
          {/* Filters */}
          <OddsFilters 
            filters={filters} 
            onFiltersChange={setFilters} 
            hasActiveFilters={hasActiveFilters}
          />

          {/* View Toggle */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {displayMatches.length} partida{displayMatches.length !== 1 ? 's' : ''} encontrada{displayMatches.length !== 1 ? 's' : ''}
            </div>
            <ViewToggle value={viewMode} onChange={setViewMode} />
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && displayMatches.length === 0 && (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                {viewMode === 'surebets' 
                  ? 'Nenhuma surebet encontrada no momento.'
                  : `Nenhuma partida de ${activeTab === 'football' ? 'futebol' : 'basquete'} encontrada com os filtros atuais.`}
              </CardContent>
            </Card>
          )}

          {/* Compact Table View */}
          {viewMode === 'compact' && displayMatches.length > 0 && (
            <CompactTableView matches={displayMatches} />
          )}

          {/* Card View */}
          {(viewMode === 'cards' || viewMode === 'surebets') && displayMatches.map((match) => (
            <MatchCard key={match.match_id} match={match} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CompactTableView({ matches }: { matches: MatchOddsGroup[] }) {
  const navigate = useNavigate();
  const hasBasketball = matches.some(m => (m.sport_type || 'football') === 'basketball');
  const hasFootball = matches.some(m => (m.sport_type || 'football') === 'football');
  const showDrawColumn = hasFootball && !hasBasketball;
  
  return (
    <Card>
      <CardContent className="pt-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Partida</TableHead>
              <TableHead>Liga</TableHead>
              <TableHead className="text-center">Casa</TableHead>
              {showDrawColumn && <TableHead className="text-center">Empate</TableHead>}
              <TableHead className="text-center">Fora</TableHead>
              <TableHead className="text-center">ROI</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {matches.map((match) => {
              const isBasketball = (match.sport_type || 'football') === 'basketball';
              const arbitrageValue = isBasketball || match.best_draw === null || match.best_draw === 0
                ? 1/match.best_home + 1/match.best_away
                : 1/match.best_home + 1/match.best_draw + 1/match.best_away;
              const hasArbitrage = arbitrageValue < 1;
              const roi = ((1 - arbitrageValue) * 100).toFixed(2);
              const sportIcon = isBasketball ? '🏀' : '⚽';
              
              return (
                <TableRow 
                  key={match.match_id} 
                  className={cn(
                    "cursor-pointer hover:bg-muted/50",
                    hasArbitrage && 'bg-green-500/10'
                  )}
                  onClick={() => navigate(`/match/${match.match_id}`)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{match.home_team}</span>
                      {match.home_team_logo ? (
                        <img src={match.home_team_logo} alt={match.home_team} className="h-5 w-5 object-contain" />
                      ) : (
                        <span>{sportIcon}</span>
                      )}
                      <span className="text-muted-foreground">x</span>
                      {match.away_team_logo ? (
                        <img src={match.away_team_logo} alt={match.away_team} className="h-5 w-5 object-contain" />
                      ) : (
                        <span>{sportIcon}</span>
                      )}
                      <span>{match.away_team}</span>
                    </div>
                    {hasArbitrage && (
                      <Badge className="ml-2 bg-green-500 text-white text-xs">SUREBET</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{match.league_name}</Badge>
                  </TableCell>
                  <TableCell className="text-center font-mono font-bold text-primary">
                    {match.best_home.toFixed(2)}
                  </TableCell>
                  {showDrawColumn && (
                    <TableCell className="text-center font-mono font-bold text-primary">
                      {isBasketball || match.best_draw === null ? '-' : match.best_draw.toFixed(2)}
                    </TableCell>
                  )}
                  <TableCell className="text-center font-mono font-bold text-primary">
                    {match.best_away.toFixed(2)}
                  </TableCell>
                  <TableCell className={cn(
                    "text-center font-mono",
                    hasArbitrage ? "text-green-500 font-bold" : "text-muted-foreground"
                  )}>
                    {Number(roi) > 0 ? `+${roi}%` : `${roi}%`}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(match.match_date), "dd/MM HH:mm")}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function MatchCard({ match }: { match: MatchOddsGroup }) {
  const navigate = useNavigate();
  const matchDate = new Date(match.match_date);
  const isLive = match.match_status === 'live';
  const isBasketball = (match.sport_type || 'football') === 'basketball';
  const sportIcon = isBasketball ? '🏀' : '⚽';
  
  // Separate odds by type (SO vs PA)
  const { bestSO, topPAHome, topPADraw, topPAAway, hasSOData, hasPAData, paOdds } = getBestOddsByType(match.odds, isBasketball);
  
  // Calculate ROI for SO
  const roiSO = hasSOData ? calculateROI(bestSO.home, bestSO.draw, bestSO.away, isBasketball) : -100;
  
  // Calculate ROI for PA (using best PA odds)
  const bestPA = getBestPAOdds(paOdds, isBasketball);
  const roiPA = hasPAData ? calculateROI(bestPA.home, bestPA.draw, bestPA.away, isBasketball) : -100;
  
  // Overall surebet detection (using any combination)
  const arbitrageValue = isBasketball || match.best_draw === null || match.best_draw === 0
    ? (1/match.best_home + 1/match.best_away)
    : (1/match.best_home + 1/match.best_draw + 1/match.best_away);
  const hasArbitrage = arbitrageValue < 1 && match.odds.length > 0;
  const roiPercentage = ((1 - arbitrageValue) * 100).toFixed(2);
  
  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all hover:bg-muted/50",
        isLive && "border-primary",
        hasArbitrage && "border-2 border-success shadow-lg shadow-success/20"
      )}
      onClick={() => navigate(`/match/${match.match_id}`)}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Title: Teams with Logos */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-lg">{match.home_team}</span>
              {match.home_team_logo ? (
                <img src={match.home_team_logo} alt={match.home_team} className="h-6 w-6 object-contain" />
              ) : (
                <span>{sportIcon}</span>
              )}
              <span className="text-muted-foreground">x</span>
              {match.away_team_logo ? (
                <img src={match.away_team_logo} alt={match.away_team} className="h-6 w-6 object-contain" />
              ) : (
                <span>{sportIcon}</span>
              )}
              <span className="font-semibold text-lg">{match.away_team}</span>
            </div>
            {hasArbitrage && (
              <Badge variant="success" className="text-sm px-3 py-1 shrink-0">
                🎯 SUREBET +{roiPercentage}%
              </Badge>
            )}
          </div>
          
          {/* League */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{match.league_name}</Badge>
            {isLive && <Badge variant="destructive">AO VIVO</Badge>}
          </div>
          
          {/* Date/Time */}
          <div className="text-sm text-muted-foreground">
            {format(matchDate, "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </div>
          
          {/* SO / Betbra Section - Laranja/Amber */}
          {hasSOData && (
            <div className="space-y-1 pt-2 border-t">
              <div className="text-xs font-medium text-amber-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                SO / Betbra
              </div>
              <div className={cn(
                "grid gap-4 bg-amber-500/5 rounded-lg p-2 border border-amber-500/20",
                isBasketball ? "grid-cols-3" : "grid-cols-4"
              )}>
                {/* Casa */}
                <div className="text-center">
                  <div className="text-xs text-muted-foreground truncate">{bestSO.homeBookmaker || '-'}</div>
                  <div className="font-bold text-xl font-mono text-amber-500">
                    {bestSO.home > 0 ? bestSO.home.toFixed(2) : '-'}
                  </div>
                  <div className="text-xs text-muted-foreground">{isBasketball ? 'Time 1' : 'Casa'}</div>
                </div>
                
                {/* Empate (futebol only) */}
                {!isBasketball && (
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground truncate">{bestSO.drawBookmaker || '-'}</div>
                    <div className="font-bold text-xl font-mono text-amber-500">
                      {bestSO.draw && bestSO.draw > 0 ? bestSO.draw.toFixed(2) : '-'}
                    </div>
                    <div className="text-xs text-muted-foreground">Empate</div>
                  </div>
                )}
                
                {/* Fora */}
                <div className="text-center">
                  <div className="text-xs text-muted-foreground truncate">{bestSO.awayBookmaker || '-'}</div>
                  <div className="font-bold text-xl font-mono text-amber-500">
                    {bestSO.away > 0 ? bestSO.away.toFixed(2) : '-'}
                  </div>
                  <div className="text-xs text-muted-foreground">{isBasketball ? 'Time 2' : 'Fora'}</div>
                </div>
                
                {/* ROI SO */}
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">ROI</div>
                  <div className={cn(
                    "font-bold text-xl font-mono",
                    roiSO > 0 ? "text-amber-500" : "text-muted-foreground"
                  )}>
                    {roiSO > 0 ? `+${roiSO.toFixed(2)}%` : `${roiSO.toFixed(2)}%`}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* PA Section - Verde/Emerald - Top 3 */}
          {hasPAData && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-emerald-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                PA - Top 3
              </div>
              <div className={cn(
                "grid gap-4 bg-emerald-500/5 rounded-lg p-2 border border-emerald-500/20",
                isBasketball ? "grid-cols-3" : "grid-cols-4"
              )}>
                {/* Casa - Top 3 */}
                <div className="text-center">
                  <div className="space-y-0.5">
                    {topPAHome.length > 0 ? topPAHome.map((o, i) => (
                      <div key={i} className="text-xs flex items-center justify-center gap-1">
                        <span className="font-mono font-bold text-emerald-500">{o.home_odd.toFixed(2)}</span>
                        <span className="text-muted-foreground text-[10px] truncate max-w-[50px]">{o.bookmaker_name.slice(0, 8)}</span>
                      </div>
                    )) : (
                      <div className="text-xs text-muted-foreground">-</div>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">{isBasketball ? 'Time 1' : 'Casa'}</div>
                </div>
                
                {/* Empate - Top 3 (futebol only) */}
                {!isBasketball && (
                  <div className="text-center">
                    <div className="space-y-0.5">
                      {topPADraw.length > 0 ? topPADraw.map((o, i) => (
                        <div key={i} className="text-xs flex items-center justify-center gap-1">
                          <span className="font-mono font-bold text-emerald-500">{o.draw_odd?.toFixed(2)}</span>
                          <span className="text-muted-foreground text-[10px] truncate max-w-[50px]">{o.bookmaker_name.slice(0, 8)}</span>
                        </div>
                      )) : (
                        <div className="text-xs text-muted-foreground">-</div>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">Empate</div>
                  </div>
                )}
                
                {/* Fora - Top 3 */}
                <div className="text-center">
                  <div className="space-y-0.5">
                    {topPAAway.length > 0 ? topPAAway.map((o, i) => (
                      <div key={i} className="text-xs flex items-center justify-center gap-1">
                        <span className="font-mono font-bold text-emerald-500">{o.away_odd.toFixed(2)}</span>
                        <span className="text-muted-foreground text-[10px] truncate max-w-[50px]">{o.bookmaker_name.slice(0, 8)}</span>
                      </div>
                    )) : (
                      <div className="text-xs text-muted-foreground">-</div>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">{isBasketball ? 'Time 2' : 'Fora'}</div>
                </div>
                
                {/* ROI PA */}
                <div className="text-center flex flex-col justify-center">
                  <div className="text-xs text-muted-foreground">ROI</div>
                  <div className={cn(
                    "font-bold text-xl font-mono",
                    roiPA > 0 ? "text-emerald-500" : "text-muted-foreground"
                  )}>
                    {roiPA > 0 ? `+${roiPA.toFixed(2)}%` : `${roiPA.toFixed(2)}%`}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Fallback if no odds available */}
          {!hasSOData && !hasPAData && (
            <div className="pt-2 border-t text-center text-sm text-muted-foreground">
              Sem odds disponíveis
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useOddsComparison } from '@/hooks/useOddsData';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle } from 'lucide-react';
import { useState, useMemo } from 'react';
import { OddsFilters } from './OddsFilters';
import { ViewToggle, ViewMode } from './ViewToggle';
import { useFiltersFromUrl } from '@/hooks/useFiltersFromUrl';
import { useSurebetDetection } from '@/hooks/useSurebetDetection';
import { listContainer, listItem } from '@/lib/animations';
import { MatchCardSkeleton } from './MatchCardSkeleton';
import { getBestOddsByType, calculateROI, getBestPAOdds } from '@/lib/oddsTypeUtils';
import type { MatchOddsGroup } from '@/types/database';

interface OddsMonitorProps {
  sportType: 'football' | 'basketball';
  onStatsUpdate?: (stats: { surebetCount: number; totalMatches: number }) => void;
}

export function OddsMonitor({ sportType, onStatsUpdate }: OddsMonitorProps) {
  const { filters, setFilters, hasActiveFilters } = useFiltersFromUrl();
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  
  // Get first league for API query (or undefined for all)
  const leagueForQuery = filters.leagues.length === 1 ? filters.leagues[0] : undefined;
  
  const { data: matches, isLoading, error } = useOddsComparison(
    leagueForQuery ? { leagueName: leagueForQuery } : undefined
  );

  // Detect and notify new surebets
  useSurebetDetection(matches);

  const isBasketball = sportType === 'basketball';

  // Filter and sort matches
  const filteredMatches = useMemo(() => {
    if (!matches) return [];
    
    let result = [...matches];
    
    // Sport filter - fixed by sportType prop
    result = result.filter(m => (m.sport_type || 'football') === sportType);
    
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
    
    // Search filter - busca no nome do time (home ou away)
    if (filters.searchTerm.trim()) {
      const searchLower = filters.searchTerm.toLowerCase().trim();
      result = result.filter(m => 
        m.home_team.toLowerCase().includes(searchLower) ||
        m.away_team.toLowerCase().includes(searchLower)
      );
    }
    
    // Opportunity type filter (surebet)
    if (filters.opportunityType === 'surebet') {
      result = result.filter(m => {
        const isBball = (m.sport_type || 'football') === 'basketball';
        const arbitrageValue = isBball || m.best_draw === null || m.best_draw === 0
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
          const isBballA = (a.sport_type || 'football') === 'basketball';
          const isBballB = (b.sport_type || 'football') === 'basketball';
          const marginA = isBballA || a.best_draw === null || a.best_draw === 0
            ? 1/a.best_home + 1/a.best_away
            : 1/a.best_home + 1/a.best_draw + 1/a.best_away;
          const marginB = isBballB || b.best_draw === null || b.best_draw === 0
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
  }, [matches, filters, sportType]);

  // Calculate stats
  useMemo(() => {
    if (!matches || !onStatsUpdate) return;
    
    // Filter by sport first
    const sportMatches = matches.filter(m => (m.sport_type || 'football') === sportType);
    
    let surebetCount = 0;
    
    sportMatches.forEach(m => {
      const isBball = (m.sport_type || 'football') === 'basketball';
      const arbitrageValue = isBball || m.best_draw === null || m.best_draw === 0
        ? 1/m.best_home + 1/m.best_away
        : 1/m.best_home + 1/m.best_draw + 1/m.best_away;
      if (arbitrageValue < 1) surebetCount++;
    });
    
    onStatsUpdate({ surebetCount, totalMatches: sportMatches.length });
  }, [matches, onStatsUpdate, sportType]);

  // For surebet-only view
  const displayMatches = viewMode === 'surebets' 
    ? filteredMatches.filter(m => {
        const isBball = (m.sport_type || 'football') === 'basketball';
        const arbitrageValue = isBball || m.best_draw === null || m.best_draw === 0
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
      {/* Filters */}
      <OddsFilters 
        filters={filters} 
        onFiltersChange={setFilters} 
        hasActiveFilters={hasActiveFilters}
        hideSportFilter
      />

      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {displayMatches.length} partida{displayMatches.length !== 1 ? 's' : ''} encontrada{displayMatches.length !== 1 ? 's' : ''}
        </div>
        <ViewToggle value={viewMode} onChange={setViewMode} />
      </div>

      {/* Loading state with shimmer skeletons */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <MatchCardSkeleton key={i} isBasketball={isBasketball} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && displayMatches.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            {viewMode === 'surebets' 
              ? 'Nenhuma surebet encontrada no momento.'
              : `Nenhuma partida de ${isBasketball ? 'basquete' : 'futebol'} encontrada com os filtros atuais.`}
          </CardContent>
        </Card>
      )}

      {/* Compact Table View */}
      {viewMode === 'compact' && displayMatches.length > 0 && (
        <CompactTableView matches={displayMatches} isBasketball={isBasketball} />
      )}

      {/* Card View with stagger animation */}
      {(viewMode === 'cards' || viewMode === 'surebets') && (
        <motion.div
          variants={listContainer}
          initial="hidden"
          animate="show"
          className="space-y-4"
        >
          {displayMatches.map((match) => (
            <motion.div key={match.match_id} variants={listItem}>
              <MatchCard match={match} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

function CompactTableView({ matches, isBasketball }: { matches: MatchOddsGroup[]; isBasketball: boolean }) {
  const navigate = useNavigate();
  const showDrawColumn = !isBasketball;
  
  return (
    <Card>
      <CardContent className="pt-4 overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-6">
        <div className="min-w-[600px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Partida</TableHead>
              <TableHead>Liga</TableHead>
              <TableHead className="text-center">{isBasketball ? 'Time 1' : 'Casa'}</TableHead>
              {showDrawColumn && <TableHead className="text-center">Empate</TableHead>}
              <TableHead className="text-center">{isBasketball ? 'Time 2' : 'Fora'}</TableHead>
              <TableHead className="text-center">ROI</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {matches.map((match) => {
              const isBball = (match.sport_type || 'football') === 'basketball';
              const arbitrageValue = isBball || match.best_draw === null || match.best_draw === 0
                ? 1/match.best_home + 1/match.best_away
                : 1/match.best_home + 1/match.best_draw + 1/match.best_away;
              const hasArbitrage = arbitrageValue < 1;
              const roi = ((1 - arbitrageValue) * 100).toFixed(2);
              const sportIcon = isBball ? '🏀' : '⚽';
              
              return (
                <TableRow 
                  key={match.match_id} 
                  className={cn(
                    "cursor-pointer transition-colors duration-200 hover:bg-muted/50",
                    hasArbitrage && 'bg-success/10'
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
                      <Badge variant="success" className="ml-2 text-xs">SUREBET</Badge>
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
                      {isBball || match.best_draw === null ? '-' : match.best_draw.toFixed(2)}
                    </TableCell>
                  )}
                  <TableCell className="text-center font-mono font-bold text-primary">
                    {match.best_away.toFixed(2)}
                  </TableCell>
                  <TableCell className={cn(
                    "text-center font-mono",
                    hasArbitrage ? "text-success font-bold" : "text-muted-foreground"
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
        </div>
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
      variant="interactive"
      className={cn(
        "overflow-hidden animate-fade-in-up",
        isLive && "border-destructive",
        hasArbitrage && "border-2 border-success shadow-lg shadow-success/20"
      )}
      onClick={() => navigate(`/match/${match.match_id}`)}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="space-y-2 sm:space-y-3">
          {/* Title: Teams with Logos */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
              <span className="font-semibold text-base sm:text-lg">{match.home_team}</span>
              {match.home_team_logo ? (
                <img src={match.home_team_logo} alt={match.home_team} className="h-5 w-5 sm:h-6 sm:w-6 object-contain" />
              ) : (
                <span className="text-sm sm:text-base">{sportIcon}</span>
              )}
              <span className="text-muted-foreground text-sm">x</span>
              {match.away_team_logo ? (
                <img src={match.away_team_logo} alt={match.away_team} className="h-5 w-5 sm:h-6 sm:w-6 object-contain" />
              ) : (
                <span className="text-sm sm:text-base">{sportIcon}</span>
              )}
              <span className="font-semibold text-base sm:text-lg">{match.away_team}</span>
            </div>
            {hasArbitrage && (
              <Badge variant="success" className="text-xs sm:text-sm px-2 sm:px-3 py-0.5 sm:py-1 shrink-0 self-start sm:self-auto animate-pulse-subtle">
                🎯 SUREBET +{roiPercentage}%
              </Badge>
            )}
          </div>
          
          {/* League */}
          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
            <Badge variant="outline" className="text-xs">{match.league_name}</Badge>
            {isLive && <Badge variant="destructive" className="text-xs animate-pulse">AO VIVO</Badge>}
          </div>
          
          {/* Date/Time */}
          <div className="text-xs sm:text-sm text-muted-foreground">
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
                "grid gap-2 sm:gap-4 bg-amber-500/5 rounded-lg p-2 border border-amber-500/20",
                isBasketball ? "grid-cols-3" : "grid-cols-4"
              )}>
                {/* Casa */}
                <div className="text-center group">
                  <div className="text-[10px] sm:text-xs text-muted-foreground truncate">{bestSO.homeBookmaker || '-'}</div>
                  <div className="font-bold text-lg sm:text-xl font-mono text-amber-500 transition-transform duration-200 group-hover:scale-110">
                    {bestSO.home > 0 ? bestSO.home.toFixed(2) : '-'}
                  </div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">{isBasketball ? 'Time 1' : 'Casa'}</div>
                </div>
                
                {/* Empate (futebol only) */}
                {!isBasketball && (
                  <div className="text-center group">
                    <div className="text-[10px] sm:text-xs text-muted-foreground truncate">{bestSO.drawBookmaker || '-'}</div>
                    <div className="font-bold text-lg sm:text-xl font-mono text-amber-500 transition-transform duration-200 group-hover:scale-110">
                      {bestSO.draw && bestSO.draw > 0 ? bestSO.draw.toFixed(2) : '-'}
                    </div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground">Empate</div>
                  </div>
                )}
                
                {/* Fora */}
                <div className="text-center group">
                  <div className="text-[10px] sm:text-xs text-muted-foreground truncate">{bestSO.awayBookmaker || '-'}</div>
                  <div className="font-bold text-lg sm:text-xl font-mono text-amber-500 transition-transform duration-200 group-hover:scale-110">
                    {bestSO.away > 0 ? bestSO.away.toFixed(2) : '-'}
                  </div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">{isBasketball ? 'Time 2' : 'Fora'}</div>
                </div>
                
                {/* ROI SO */}
                <div className="text-center">
                  <div className="text-[10px] sm:text-xs text-muted-foreground">ROI</div>
                  <div className={cn(
                    "font-bold text-lg sm:text-xl font-mono",
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
                "grid gap-2 sm:gap-4 bg-emerald-500/5 rounded-lg p-2 border border-emerald-500/20",
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
                  <div className="text-[10px] text-muted-foreground">ROI</div>
                  <div className={cn(
                    "font-bold text-lg sm:text-xl font-mono",
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

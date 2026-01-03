import { format, formatDistanceToNow, isToday, isTomorrow, addDays, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useOddsComparison } from '@/hooks/useOddsData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, AlertTriangle, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useMemo, useCallback } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SurebetCalculator } from './SurebetCalculator';
import { OddsFilters, OddsFiltersState, defaultFilters } from './OddsFilters';
import { ViewToggle, ViewMode } from './ViewToggle';
import type { MatchOddsGroup, BookmakerOdds } from '@/types/database';

interface OddsComparisonTableProps {
  onStatsUpdate?: (stats: { surebetCount: number; valueBetCount: number; totalMatches: number; lastUpdate: Date | null }) => void;
}

export function OddsComparisonTable({ onStatsUpdate }: OddsComparisonTableProps) {
  const [filters, setFilters] = useState<OddsFiltersState>(defaultFilters);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  
  const { data: matches, isLoading, error } = useOddsComparison(
    filters.league !== 'all' ? { leagueName: filters.league } : undefined
  );

  // Filter and sort matches
  const filteredMatches = useMemo(() => {
    if (!matches) return [];
    
    let result = [...matches];
    
    // Date filter
    if (filters.dateFilter !== 'all') {
      const now = new Date();
      result = result.filter(m => {
        const matchDate = new Date(m.match_date);
        if (filters.dateFilter === 'today') return isToday(matchDate);
        if (filters.dateFilter === 'tomorrow') return isTomorrow(matchDate);
        if (filters.dateFilter === 'week') {
          return isWithinInterval(matchDate, { start: now, end: addDays(now, 7) });
        }
        return true;
      });
    }
    
    // Bookmaker filter
    if (filters.bookmaker !== 'all') {
      result = result.filter(m => 
        m.odds.some(o => o.bookmaker_name.toLowerCase() === filters.bookmaker.toLowerCase())
      );
    }
    
    // Opportunity type filter
    if (filters.opportunityType !== 'all') {
      result = result.filter(m => {
        const arbitrageValue = 1/m.best_home + 1/m.best_draw + 1/m.best_away;
        if (filters.opportunityType === 'surebet') return arbitrageValue < 1;
        if (filters.opportunityType === 'value') return arbitrageValue >= 1 && arbitrageValue < 1.05;
        return true;
      });
    }
    
    // Margin filter
    result = result.filter(m => {
      const arbitrageValue = 1/m.best_home + 1/m.best_draw + 1/m.best_away;
      const margin = (arbitrageValue - 1) * 100;
      return margin <= filters.maxMargin;
    });
    
    // Sorting
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (filters.sortBy) {
        case 'date':
          comparison = new Date(a.match_date).getTime() - new Date(b.match_date).getTime();
          break;
        case 'margin':
          const marginA = 1/a.best_home + 1/a.best_draw + 1/a.best_away;
          const marginB = 1/b.best_home + 1/b.best_draw + 1/b.best_away;
          comparison = marginA - marginB;
          break;
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
  }, [matches, filters]);

  // Calculate stats
  useMemo(() => {
    if (!matches || !onStatsUpdate) return;
    
    let surebetCount = 0;
    let valueBetCount = 0;
    let lastUpdate: Date | null = null;
    
    matches.forEach(m => {
      const arbitrageValue = 1/m.best_home + 1/m.best_draw + 1/m.best_away;
      if (arbitrageValue < 1) surebetCount++;
      else if (arbitrageValue < 1.05) valueBetCount++;
      
      m.odds.forEach(o => {
        const oddsDate = new Date(o.scraped_at);
        if (!lastUpdate || oddsDate > lastUpdate) lastUpdate = oddsDate;
      });
    });
    
    onStatsUpdate({ surebetCount, valueBetCount, totalMatches: matches.length, lastUpdate });
  }, [matches, onStatsUpdate]);

  // For surebet-only view
  const displayMatches = viewMode === 'surebets' 
    ? filteredMatches.filter(m => (1/m.best_home + 1/m.best_draw + 1/m.best_away) < 1)
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
      <OddsFilters filters={filters} onFiltersChange={setFilters} />

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
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && displayMatches.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            {viewMode === 'surebets' 
              ? 'Nenhuma surebet encontrada no momento.'
              : 'Nenhuma partida encontrada com os filtros atuais.'}
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
    </div>
  );
}

function CompactTableView({ matches }: { matches: MatchOddsGroup[] }) {
  return (
    <Card>
      <CardContent className="pt-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Partida</TableHead>
              <TableHead>Liga</TableHead>
              <TableHead className="text-center">Casa</TableHead>
              <TableHead className="text-center">Empate</TableHead>
              <TableHead className="text-center">Fora</TableHead>
              <TableHead className="text-center">ROI</TableHead>
              <TableHead className="text-center">Casas</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {matches.map((match) => {
              const arbitrageValue = 1/match.best_home + 1/match.best_draw + 1/match.best_away;
              const hasArbitrage = arbitrageValue < 1;
              const roi = ((1 - arbitrageValue) * 100).toFixed(2);
              
              return (
                <TableRow 
                  key={match.match_id} 
                  className={hasArbitrage ? 'bg-green-500/10' : ''}
                >
                  <TableCell className="font-medium">
                    {match.home_team} vs {match.away_team}
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
                  <TableCell className="text-center font-mono font-bold text-primary">
                    {match.best_draw.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-center font-mono font-bold text-primary">
                    {match.best_away.toFixed(2)}
                  </TableCell>
                  <TableCell className={cn(
                    "text-center font-mono",
                    hasArbitrage ? "text-green-500 font-bold" : "text-muted-foreground"
                  )}>
                    {Number(roi) > 0 ? `+${roi}%` : `${roi}%`}
                  </TableCell>
                  <TableCell className="text-center">{match.odds.length}</TableCell>
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
  const [isExpanded, setIsExpanded] = useState(false);
  const matchDate = new Date(match.match_date);
  const isLive = match.match_status === 'live';
  
  // Calculate arbitrage value
  const arbitrageValue = (1/match.best_home + 1/match.best_draw + 1/match.best_away);
  const hasArbitrage = arbitrageValue < 1 && match.odds.length > 0;
  const profitPercentage = hasArbitrage ? ((1 - arbitrageValue) * 100).toFixed(2) : null;

  // Find which bookmaker has the best odds for each outcome
  const bestHomeBookmaker = match.odds.find(o => o.home_odd === match.best_home)?.bookmaker_name;
  const bestDrawBookmaker = match.odds.find(o => o.draw_odd === match.best_draw)?.bookmaker_name;
  const bestAwayBookmaker = match.odds.find(o => o.away_odd === match.best_away)?.bookmaker_name;
  
  return (
    <Card className={cn(
      "transition-shadow",
      isLive && "border-primary",
      hasArbitrage && "border-2 border-green-500 shadow-lg shadow-green-500/20"
    )}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-lg">
              {match.home_team} vs {match.away_team}
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">{match.league_name}</Badge>
              <span>{format(matchDate, "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
              {isLive && <Badge className="bg-destructive">AO VIVO</Badge>}
            </div>
          </div>
          {hasArbitrage && (
            <Badge className="bg-green-500 text-white text-sm px-3 py-1">
              🎯 SUREBET +{profitPercentage}%
            </Badge>
          )}
          <BestOddsSummary match={match} hasArbitrage={hasArbitrage} arbitrageValue={arbitrageValue} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Surebet Calculator (collapsible) */}
        {hasArbitrage && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between">
                <span>Calculadora de Surebet</span>
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <SurebetCalculator
                homeOdd={match.best_home}
                drawOdd={match.best_draw}
                awayOdd={match.best_away}
                homeBookmaker={bestHomeBookmaker}
                drawBookmaker={bestDrawBookmaker}
                awayBookmaker={bestAwayBookmaker}
              />
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Odds Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">Casa</TableHead>
              <TableHead className="text-center">Casa (1)</TableHead>
              <TableHead className="text-center">Empate (X)</TableHead>
              <TableHead className="text-center">Fora (2)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {match.odds.map((odds) => (
              <OddsRow 
                key={odds.bookmaker_id} 
                odds={odds} 
                bestHome={match.best_home}
                bestDraw={match.best_draw}
                bestAway={match.best_away}
                worstHome={match.worst_home}
                worstDraw={match.worst_draw}
                worstAway={match.worst_away}
                homeTeam={match.home_team}
                awayTeam={match.away_team}
              />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function BestOddsSummary({ match, hasArbitrage, arbitrageValue }: { match: MatchOddsGroup; hasArbitrage: boolean; arbitrageValue: number }) {
  if (match.odds.length === 0) return null;
  
  const roiPercentage = ((1 - arbitrageValue) * 100).toFixed(2);
  
  return (
    <div className="flex gap-4 text-sm items-center">
      <div className="text-center">
        <div className="text-muted-foreground">Melhor Casa</div>
        <div className={cn("font-bold text-lg", hasArbitrage ? "text-green-500" : "text-primary")}>{match.best_home.toFixed(2)}</div>
      </div>
      <div className="text-center">
        <div className="text-muted-foreground">Melhor Empate</div>
        <div className={cn("font-bold text-lg", hasArbitrage ? "text-green-500" : "text-primary")}>{match.best_draw.toFixed(2)}</div>
      </div>
      <div className="text-center">
        <div className="text-muted-foreground">Melhor Fora</div>
        <div className={cn("font-bold text-lg", hasArbitrage ? "text-green-500" : "text-primary")}>{match.best_away.toFixed(2)}</div>
      </div>
      {!hasArbitrage && (
        <div className="text-center border-l pl-4">
          <div className="text-muted-foreground">ROI</div>
          <div className="font-bold text-lg text-muted-foreground">{roiPercentage}%</div>
        </div>
      )}
    </div>
  );
}

// Função para gerar link da casa de apostas baseado no extra_data
function generateBookmakerLink(
  bookmakerName: string, 
  extraData?: Record<string, unknown>,
  homeTeam?: string,
  awayTeam?: string
): string | null {
  if (!extraData) return null;
  
  const name = bookmakerName.toLowerCase();
  
  // Betbra
  if (name.includes('betbra')) {
    const eventId = extraData.betbra_event_id;
    const marketId = extraData.betbra_market_id;
    if (eventId && marketId) {
      return `https://betbra.bet.br/b/exchange/sport/soccer/event/${eventId}/market/${marketId}`;
    }
  }
  
  // Betano
  if (name.includes('betano')) {
    const eventId = extraData.betano_event_id;
    if (eventId && homeTeam && awayTeam) {
      // Gerar slug: "Chelsea" + "Aston Villa" -> "chelsea-aston-villa"
      const slug = `${homeTeam}-${awayTeam}`
        .toLowerCase()
        .replace(/\s+/g, '-')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      
      return `https://www.betano.bet.br/odds/${slug}/${eventId}/`;
    }
  }
  
  // Superbet
  if (name.includes('superbet')) {
    const eventId = extraData.superbet_event_id;
    const leagueId = extraData.superbet_league_id;
    if (eventId && homeTeam && awayTeam) {
      // Gerar slug: "Chelsea" + "Aston Villa" -> "chelsea-x-aston-villa"
      const homeSlug = homeTeam
        .toLowerCase()
        .replace(/\s+/g, '-')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      
      const awaySlug = awayTeam
        .toLowerCase()
        .replace(/\s+/g, '-')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      
      let url = `https://superbet.bet.br/odds/futebol/${homeSlug}-x-${awaySlug}-${eventId}/`;
      
      if (leagueId) {
        url += `?t=offer-prematch-${leagueId}&mdt=o`;
      }
      
      return url;
    }
  }
  
  // Br4bet
  if (name.includes('br4bet')) {
    const eventId = extraData.br4bet_event_id;
    const country = extraData.br4bet_country || 'italia';
    if (eventId && homeTeam && awayTeam) {
      const homeSlug = homeTeam
        .toLowerCase()
        .replace(/\s+/g, '-')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      
      const awaySlug = awayTeam
        .toLowerCase()
        .replace(/\s+/g, '-')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      
      // Format: /sports/futebol/italia/bologna-fc-vs-sassuolo-calcio/e-13781468
      return `https://br4.bet.br/sports/futebol/${country}/${homeSlug}-vs-${awaySlug}/e-${eventId}`;
    }
  }
  
  // Estrelabet
  if (name.includes('estrelabet')) {
    const eventId = extraData.event_id;
    if (eventId) {
      return `https://www.estrelabet.bet.br/aposta-esportiva?page=event&eventId=${eventId}&sportId=66`;
    }
  }
  
  // KTO
  if (name.includes('kto')) {
    const eventId = extraData.event_id;
    const leaguePath = extraData.league_path as string;
    
    // Usar nomes originais da API KTO se disponíveis
    const homeOriginal = extraData.home_team_slug as string;
    const awayOriginal = extraData.away_team_slug as string;
    
    const homeName = homeOriginal || homeTeam;
    const awayName = awayOriginal || awayTeam;
    
    if (eventId && leaguePath && homeName && awayName) {
      // Converter "football/italy/serie_a" para "futebol/italia/serie-a"
      const pathParts = leaguePath.split('/');
      const sport = pathParts[0] === 'football' ? 'futebol' : pathParts[0];
      
      const countryMap: Record<string, string> = {
        'italy': 'italia',
        'england': 'inglaterra',
        'spain': 'espanha',
        'brazil': 'brasil',
        'germany': 'alemanha',
        'france': 'franca',
        'portugal': 'portugal'
      };
      const country = countryMap[pathParts[1]] || pathParts[1];
      
      const leagueSlug = pathParts[2]?.replace(/_/g, '-') || '';
      
      // Slug dos times usando nomes originais da API
      const homeSlug = homeName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      
      const awaySlug = awayName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      
      return `https://www.kto.bet.br/esportes/${sport}/${country}/${leagueSlug}/${homeSlug}---${awaySlug}/${eventId}`;
    }
  }
  
  // Sportingbet
  if (name.includes('sportingbet')) {
    const fixtureId = extraData.fixture_id;
    const homeOriginal = extraData.home_team_raw as string;
    const awayOriginal = extraData.away_team_raw as string;
    
    const homeName = homeOriginal || homeTeam;
    const awayName = awayOriginal || awayTeam;
    
    if (fixtureId && homeName && awayName) {
      const homeSlug = homeName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      
      const awaySlug = awayName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      
      return `https://www.sportingbet.bet.br/pt-br/sports/eventos/${homeSlug}-${awaySlug}-2:${fixtureId}?tab=score`;
    }
  }
  
  // Novibet
  if (name.includes('novibet')) {
    const eventId = extraData.event_id;
    const path = extraData.path as string;
    
    if (eventId && path) {
      // Formato: /apostas-esportivas/{path}/e{eventId}
      return `https://www.novibet.bet.br/apostas-esportivas/${path}/e${eventId}`;
    }
  }
  
  return null;
}

function OddsRow({
  odds, 
  bestHome, 
  bestDraw, 
  bestAway,
  worstHome,
  worstDraw,
  worstAway,
  homeTeam,
  awayTeam
}: { 
  odds: BookmakerOdds;
  bestHome: number;
  bestDraw: number;
  bestAway: number;
  worstHome: number;
  worstDraw: number;
  worstAway: number;
  homeTeam: string;
  awayTeam: string;
}) {
  const isStale = odds.data_age_seconds > 30; // More than 30 seconds old
  const isVeryStale = odds.data_age_seconds > 120; // More than 2 minutes old
  
  // Gerar link da casa de apostas
  const bookmakerLink = generateBookmakerLink(odds.bookmaker_name, odds.extra_data, homeTeam, awayTeam);

  // Determinar tipo de odds baseado no nome da casa
  const getOddsType = (bookmakerName: string): 'SO' | 'PA' => {
    const name = bookmakerName.toLowerCase();
    if (name.includes('novibet') || name.includes('betbra')) {
      return 'SO';
    }
    return 'PA';
  };
  
  const oddsType = odds.odds_type || getOddsType(odds.bookmaker_name);

  return (
    <TableRow className={cn(isStale && "opacity-60", isVeryStale && "opacity-40")}>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {odds.bookmaker_name}
          <Badge 
            variant="outline" 
            className={cn(
              "text-[10px] px-1.5 py-0",
              oddsType === 'SO' ? "border-amber-500 text-amber-500" : "border-emerald-500 text-emerald-500"
            )}
          >
            {oddsType}
          </Badge>
          {bookmakerLink && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={() => window.open(bookmakerLink, '_blank')}
            >
              <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary" />
            </Button>
          )}
          {isVeryStale && <Badge variant="destructive" className="text-xs">DESATUALIZADO</Badge>}
          {isStale && !isVeryStale && <Clock className="h-3 w-3 text-muted-foreground" />}
        </div>
      </TableCell>
      <TableCell className="text-center">
        <OddCell value={odds.home_odd} isBest={odds.home_odd === bestHome} isWorst={odds.home_odd === worstHome} />
      </TableCell>
      <TableCell className="text-center">
        <OddCell value={odds.draw_odd} isBest={odds.draw_odd === bestDraw} isWorst={odds.draw_odd === worstDraw} />
      </TableCell>
      <TableCell className="text-center">
        <OddCell value={odds.away_odd} isBest={odds.away_odd === bestAway} isWorst={odds.away_odd === worstAway} />
      </TableCell>
    </TableRow>
  );
}

function OddCell({ value, isBest, isWorst }: { value: number; isBest: boolean; isWorst: boolean }) {
  return (
    <div className={cn(
      "inline-flex items-center gap-1 px-2 py-1 rounded font-mono",
      isBest && "bg-primary/10 text-primary font-bold",
      isWorst && "bg-destructive/10 text-destructive"
    )}>
      {value.toFixed(2)}
    </div>
  );
}

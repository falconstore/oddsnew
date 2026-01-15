import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, ExternalLink, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { useOddsComparison, useBookmakers } from '@/hooks/useOddsData';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SurebetCalculator } from '@/components/SurebetCalculator';
import { cn } from '@/lib/utils';
import type { MatchOddsGroup, BookmakerOdds } from '@/types/database';

// Sort bookmakers: Betbra first, then PA alphabetically, then SO alphabetically
function sortBookmakerOdds(odds: BookmakerOdds[]): { sorted: BookmakerOdds[]; betbraEnd: number; paEnd: number } {
  const betbra: BookmakerOdds[] = [];
  const paOdds: BookmakerOdds[] = [];
  const soOdds: BookmakerOdds[] = [];
  
  const knownSOBookmakers = ['novibet', 'betbra', 'betnacional'];
  
  odds.forEach((odd) => {
    const name = odd.bookmaker_name.toLowerCase();
    const oddsType = odd.odds_type || (knownSOBookmakers.some(b => name.includes(b)) ? 'SO' : 'PA');
    
    if (name.includes('betbra')) {
      betbra.push(odd);
    } else if (oddsType === 'PA') {
      paOdds.push(odd);
    } else {
      soOdds.push(odd);
    }
  });
  
  paOdds.sort((a, b) => a.bookmaker_name.localeCompare(b.bookmaker_name));
  soOdds.sort((a, b) => a.bookmaker_name.localeCompare(b.bookmaker_name));
  
  const sorted = [...betbra, ...paOdds, ...soOdds];
  const betbraEnd = betbra.length - 1;
  const paEnd = betbra.length + paOdds.length - 1;
  
  return { sorted, betbraEnd, paEnd };
}

// Discrete separator row component
function OddsSeparatorRow({ label, colSpan }: { label: string; colSpan: number }) {
  return (
    <TableRow className="border-t border-border/30 hover:bg-transparent">
      <TableCell 
        colSpan={colSpan} 
        className="py-1.5 text-[10px] text-muted-foreground/50 font-medium uppercase tracking-wider"
      >
        {label}
      </TableCell>
    </TableRow>
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
  
  if (name.includes('betbra')) {
    const eventId = extraData.betbra_event_id;
    const marketId = extraData.betbra_market_id;
    if (eventId && marketId) {
      return `https://betbra.bet.br/b/exchange/sport/soccer/event/${eventId}/market/${marketId}`;
    }
  }
  
  if (name.includes('betano')) {
    const eventId = extraData.betano_event_id;
    if (eventId && homeTeam && awayTeam) {
      const slug = `${homeTeam}-${awayTeam}`
        .toLowerCase()
        .replace(/\s+/g, '-')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return `https://www.betano.bet.br/odds/${slug}/${eventId}/`;
    }
  }
  
  if (name.includes('superbet')) {
    const eventId = extraData.superbet_event_id;
    const leagueId = extraData.superbet_league_id;
    const sportType = extraData.sport_type as string;
    
    if (eventId && homeTeam && awayTeam) {
      const homeSlug = homeTeam.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const awaySlug = awayTeam.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const sportPath = sportType === 'basketball' ? 'basquete' : 'futebol';
      let url = `https://superbet.bet.br/odds/${sportPath}/${homeSlug}-x-${awaySlug}-${eventId}/`;
      if (leagueId) {
        url += `?t=offer-prematch-${leagueId}&mdt=o`;
      }
      return url;
    }
  }
  
  if (name.includes('br4bet')) {
    const eventId = extraData.br4bet_event_id;
    const country = extraData.br4bet_country || 'italia';
    if (eventId && homeTeam && awayTeam) {
      const homeSlug = homeTeam.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const awaySlug = awayTeam.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return `https://br4.bet.br/sports/futebol/${country}/${homeSlug}-vs-${awaySlug}/e-${eventId}`;
    }
  }
  
  if (name.includes('mcgames')) {
    const eventId = extraData.event_id;
    const country = extraData.country || 'italia';
    if (eventId && homeTeam && awayTeam) {
      const homeSlug = homeTeam.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const awaySlug = awayTeam.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return `https://mcgames.bet.br/sports/futebol/${country}/${homeSlug}-vs-${awaySlug}/e-${eventId}`;
    }
  }
  
  if (name.includes('estrelabet')) {
    const eventId = extraData.event_id || extraData.estrelabet_event_id;
    if (eventId) {
      return `https://www.estrelabet.bet.br/aposta-esportiva?page=event&eventId=${eventId}&sportId=66`;
    }
  }
  
  if (name.includes('kto')) {
    const eventId = extraData.event_id;
    const sportType = extraData.sport_type as string;
    const leaguePath = extraData.league_path as string;
    const homeOriginal = extraData.home_team_slug as string;
    const awayOriginal = extraData.away_team_slug as string;
    const homeName = homeOriginal || homeTeam;
    const awayName = awayOriginal || awayTeam;
    
    if (eventId && homeName && awayName) {
      const homeSlug = homeName.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const awaySlug = awayName.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      
      // NBA uses fixed path: basquete/nba
      if (sportType === 'basketball') {
        return `https://www.kto.bet.br/esportes/basquete/nba/${homeSlug}---${awaySlug}/${eventId}`;
      }
      
      // Football uses league_path
      if (leaguePath) {
        const pathParts = leaguePath.split('/');
        const sport = pathParts[0] === 'football' ? 'futebol' : pathParts[0];
        const countryMap: Record<string, string> = {
          'italy': 'italia', 'england': 'inglaterra', 'spain': 'espanha',
          'brazil': 'brasil', 'germany': 'alemanha', 'france': 'franca', 'portugal': 'portugal'
        };
        const country = countryMap[pathParts[1]] || pathParts[1];
        const leagueSlug = pathParts[2]?.replace(/_/g, '-') || '';
        return `https://www.kto.bet.br/esportes/${sport}/${country}/${leagueSlug}/${homeSlug}---${awaySlug}/${eventId}`;
      }
    }
  }
  
  if (name.includes('sportingbet')) {
    const fixtureId = extraData.fixture_id;
    const sportType = extraData.sport_type as string;
    const homeOriginal = extraData.home_team_raw as string;
    const awayOriginal = extraData.away_team_raw as string;
    const homeName = homeOriginal || homeTeam;
    const awayName = awayOriginal || awayTeam;
    
    if (fixtureId && homeName && awayName) {
      const homeSlug = homeName.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const awaySlug = awayName.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      
      // NBA uses format: away-at-home-fixtureId
      if (sportType === 'basketball') {
        return `https://www.sportingbet.bet.br/pt-br/sports/eventos/${awaySlug}-at-${homeSlug}-${fixtureId}?tab=score`;
      }
      
      // Football maintains original format
      return `https://www.sportingbet.bet.br/pt-br/sports/eventos/${homeSlug}-${awaySlug}-2:${fixtureId}?tab=score`;
    }
  }
  
  if (name.includes('novibet')) {
    const eventId = extraData.event_id;
    if (eventId && homeTeam && awayTeam) {
      const homeSlug = homeTeam.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const awaySlug = awayTeam.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return `https://www.novibet.bet.br/apostas-esportivas/matches/${homeSlug}-${awaySlug}/e${eventId}`;
    }
  }
  
  if (name.includes('betnacional')) {
    const eventId = extraData.event_id;
    const sportType = extraData.sport_type as string;
    if (eventId) {
      // NBA usa sport=2, Futebol usa sport=1
      const sportId = sportType === 'basketball' ? '2' : '1';
      return `https://betnacional.bet.br/event/${sportId}/0/${eventId}`;
    }
  }
  
  if (name.includes('stake')) {
    const eventId = extraData.event_id;
    if (eventId) {
      return `https://stake.bet.br/esportes/${eventId}`;
    }
  }
  
  if (name.includes('aposta1')) {
    const eventId = extraData.aposta1_event_id;
    const champId = extraData.aposta1_champ_id;
    const categoryId = extraData.aposta1_category_id;
    if (eventId && champId && categoryId) {
      return `https://www.aposta1.bet.br/esportes#/sport/66/category/${categoryId}/championship/${champId}/event/${eventId}`;
    }
  }
  
  if (name.includes('esportivabet')) {
    const eventId = extraData.esportivabet_event_id;
    const country = extraData.country || 'italia';
    const leagueSlug = extraData.league_slug || 'serie-a';
    if (eventId && homeTeam && awayTeam) {
      const homeSlug = homeTeam.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const awaySlug = awayTeam.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return `https://esportiva.bet.br/sports/futebol/${country}/${leagueSlug}/${homeSlug}-vs-${awaySlug}/ev-${eventId}`;
    }
  }
  
  // Jogo de Ouro - query params format
  if (name.includes('jogodeouro')) {
    const eventId = extraData.jogodeouro_event_id;
    if (eventId) {
      return `https://jogodeouro.bet.br/pt/sports?page=event&eventId=${eventId}&sportId=66`;
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
  awayTeam,
  isBasketball = false
}: { 
  odds: BookmakerOdds;
  bestHome: number;
  bestDraw: number | null;
  bestAway: number;
  worstHome: number;
  worstDraw: number | null;
  worstAway: number;
  homeTeam: string;
  awayTeam: string;
  isBasketball?: boolean;
}) {
  const bookmakerLink = generateBookmakerLink(odds.bookmaker_name, odds.extra_data, homeTeam, awayTeam);

  const getOddsType = (bookmakerName: string): 'SO' | 'PA' => {
    const name = bookmakerName.toLowerCase();
    if (name.includes('novibet') || name.includes('betbra')) {
      return 'SO';
    }
    return 'PA';
  };
  
  const oddsType = odds.odds_type || getOddsType(odds.bookmaker_name);

  return (
    <TableRow>
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
        </div>
      </TableCell>
      <TableCell className="text-center">
        <OddCell value={odds.home_odd} isBest={odds.home_odd === bestHome} isWorst={odds.home_odd === worstHome} />
      </TableCell>
      {!isBasketball && (
        <TableCell className="text-center">
          <OddCell value={odds.draw_odd} isBest={odds.draw_odd === bestDraw} isWorst={odds.draw_odd === worstDraw} />
        </TableCell>
      )}
      <TableCell className="text-center">
        <OddCell value={odds.away_odd} isBest={odds.away_odd === bestAway} isWorst={odds.away_odd === worstAway} />
      </TableCell>
    </TableRow>
  );
}

function OddCell({ value, isBest, isWorst }: { value: number | null; isBest: boolean; isWorst: boolean }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">-</span>;
  }
  
  return (
    <div className={cn(
      "inline-flex items-center gap-1 px-2 py-1 rounded font-mono",
      isBest && "bg-emerald-500/10 text-emerald-500 font-bold"
    )}>
      {value.toFixed(2)}
    </div>
  );
}

const MatchDetails = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  
  const { isAdmin } = useAuth();
  const { data: matches, isLoading } = useOddsComparison();
  const { data: allBookmakers } = useBookmakers();
  
  const match = matches?.find(m => m.match_id === matchId);
  
  // Calcular casas faltantes (apenas se admin)
  const missingBookmakers = useMemo(() => {
    if (!isAdmin || !allBookmakers || !match) return [];
    
    // Pegar nomes das casas que têm odds nesta partida
    const presentBookmakers = new Set(
      match.odds.map(o => o.bookmaker_name.toLowerCase())
    );
    
    // Filtrar casas ativas que não estão presentes
    return allBookmakers
      .filter(b => b.status === 'active')
      .filter(b => !presentBookmakers.has(b.name.toLowerCase()))
      .sort((a, b) => a.priority - b.priority);
  }, [isAdmin, allBookmakers, match]);
  
  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }
  
  if (!match) {
    return (
      <Layout>
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              Partida não encontrada.
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }
  
  const matchDate = new Date(match.match_date);
  const isBasketball = (match.sport_type || 'football') === 'basketball';
  const sportIcon = isBasketball ? '🏀' : '⚽';
  
  const arbitrageValue = isBasketball || match.best_draw === null || match.best_draw === 0
    ? (1/match.best_home + 1/match.best_away)
    : (1/match.best_home + 1/match.best_draw + 1/match.best_away);
  const hasArbitrage = arbitrageValue < 1 && match.odds.length > 0;
  const roiPercentage = ((1 - arbitrageValue) * 100).toFixed(2);
  
  const bestHomeBookmaker = match.odds.find(o => o.home_odd === match.best_home)?.bookmaker_name;
  const bestDrawBookmaker = !isBasketball ? match.odds.find(o => o.draw_odd === match.best_draw)?.bookmaker_name : undefined;
  const bestAwayBookmaker = match.odds.find(o => o.away_odd === match.best_away)?.bookmaker_name;
  
  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="self-start shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold flex flex-wrap items-center gap-2">
              {match.home_team_logo ? (
                <img src={match.home_team_logo} alt={match.home_team} className="h-6 w-6 sm:h-8 sm:w-8 object-contain" />
              ) : (
                <span>{sportIcon}</span>
              )}
              <span className="break-words">{match.home_team}</span>
              <span className="text-muted-foreground">vs</span>
              <span className="break-words">{match.away_team}</span>
              {match.away_team_logo && (
                <img src={match.away_team_logo} alt={match.away_team} className="h-6 w-6 sm:h-8 sm:w-8 object-contain" />
              )}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm mt-1">
              <Badge variant="outline">{match.league_name}</Badge>
              <span>{format(matchDate, "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
            </div>
          </div>
          {hasArbitrage && (
            <Badge className="bg-green-500 text-white text-xs sm:text-sm px-2 sm:px-3 py-1 self-start sm:self-auto shrink-0">
              🎯 SUREBET +{roiPercentage}%
            </Badge>
          )}
        </div>
        
        {/* Best Odds Summary */}
        <Card>
          <CardHeader className="pb-2 px-3 sm:px-6">
            <CardTitle className="text-sm sm:text-base">Melhores Odds</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="text-center">
                <div className="text-[10px] sm:text-xs text-muted-foreground mb-1 truncate">{bestHomeBookmaker}</div>
                <div className={cn("font-bold text-xl sm:text-2xl", hasArbitrage ? "text-green-500" : "text-primary")}>
                  {match.best_home.toFixed(2)}
                </div>
                <div className="text-[10px] sm:text-xs text-muted-foreground">{isBasketball ? 'Time 1' : 'Casa'}</div>
              </div>
              {!isBasketball && match.best_draw !== null && match.best_draw > 0 && (
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">{bestDrawBookmaker}</div>
                  <div className={cn("font-bold text-2xl", hasArbitrage ? "text-green-500" : "text-primary")}>
                    {match.best_draw.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">Empate</div>
                </div>
              )}
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">{bestAwayBookmaker}</div>
                <div className={cn("font-bold text-2xl", hasArbitrage ? "text-green-500" : "text-primary")}>
                  {match.best_away.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">{isBasketball ? 'Time 2' : 'Fora'}</div>
              </div>
              <div className="text-center border-l">
                <div className="text-xs text-muted-foreground mb-1">ROI</div>
                <div className={cn(
                  "font-bold text-2xl",
                  hasArbitrage ? "text-green-500" : "text-muted-foreground"
                )}>
                  {Number(roiPercentage) > 0 ? `+${roiPercentage}%` : `${roiPercentage}%`}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Admin Diagnostic - Missing Bookmakers */}
        {isAdmin && missingBookmakers.length > 0 && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                Casas Faltando ({missingBookmakers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                Estas casas ativas não possuem odds para esta partida. 
                Verificar se a liga está configurada no scraper ou se faltam aliases de times.
              </p>
              <div className="flex flex-wrap gap-2">
                {missingBookmakers.map((b) => (
                  <Badge 
                    key={b.id} 
                    variant="outline" 
                    className="text-amber-600 border-amber-500/50"
                  >
                    {b.name}
                  </Badge>
                ))}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                <strong>Liga:</strong> {match.league_name} | 
                <strong> Times:</strong> {match.home_team} vs {match.away_team}
              </div>
              
              {/* Ação rápida para criar aliases */}
              <div className="mt-4 pt-4 border-t border-amber-500/20">
                <p className="text-xs text-muted-foreground mb-2">
                  Ação rápida: Buscar times para criar aliases
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-xs"
                    onClick={() => navigate(`/teams?search=${encodeURIComponent(match.home_team)}`)}
                  >
                    Buscar "{match.home_team}"
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-xs"
                    onClick={() => navigate(`/teams?search=${encodeURIComponent(match.away_team)}`)}
                  >
                    Buscar "{match.away_team}"
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Surebet Calculator */}
        {hasArbitrage && (
          <Collapsible open={isCalculatorOpen} onOpenChange={setIsCalculatorOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span>Calculadora de Surebet</span>
                {isCalculatorOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <Card>
                <CardContent className="pt-4">
                  <SurebetCalculator
                    homeOdd={match.best_home}
                    drawOdd={isBasketball ? null : match.best_draw}
                    awayOdd={match.best_away}
                    homeBookmaker={bestHomeBookmaker}
                    drawBookmaker={bestDrawBookmaker}
                    awayBookmaker={bestAwayBookmaker}
                    isBasketball={isBasketball}
                  />
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        )}
        
        {/* Full Odds Table */}
        <Card>
          <CardHeader className="pb-2 px-3 sm:px-6">
            <CardTitle className="text-sm sm:text-base">Todas as Casas de Apostas ({match.odds.length})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-6">
            <div className="min-w-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px] sm:w-[200px]">Casa</TableHead>
                  <TableHead className="text-center">{isBasketball ? 'Time 1' : 'Casa (1)'}</TableHead>
                  {!isBasketball && <TableHead className="text-center">Empate (X)</TableHead>}
                  <TableHead className="text-center">{isBasketball ? 'Time 2' : 'Fora (2)'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const { sorted, betbraEnd, paEnd } = sortBookmakerOdds(match.odds);
                  const colSpan = isBasketball ? 3 : 4;
                  const hasPAOdds = paEnd > betbraEnd;
                  const hasSOOdds = sorted.length > paEnd + 1;
                  
                  return sorted.map((odds, index) => {
                    const elements: React.ReactNode[] = [];
                    
                    if (index === betbraEnd + 1 && betbraEnd >= 0 && hasPAOdds) {
                      elements.push(
                        <OddsSeparatorRow key="sep-pa" label="Pagamento Antecipado" colSpan={colSpan} />
                      );
                    }
                    
                    if (index === paEnd + 1 && hasSOOdds) {
                      elements.push(
                        <OddsSeparatorRow key="sep-so" label="Super Odds" colSpan={colSpan} />
                      );
                    }
                    
                    elements.push(
                      <OddsRow 
                        key={`${odds.bookmaker_id}-${odds.odds_type ?? 'PA'}`}
                        odds={odds} 
                        bestHome={match.best_home}
                        bestDraw={match.best_draw}
                        bestAway={match.best_away}
                        worstHome={match.worst_home}
                        worstDraw={match.worst_draw}
                        worstAway={match.worst_away}
                        homeTeam={match.home_team}
                        awayTeam={match.away_team}
                        isBasketball={isBasketball}
                      />
                    );
                    
                    return elements;
                  }).flat();
                })()}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default MatchDetails;

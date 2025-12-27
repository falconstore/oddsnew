import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useOddsComparison, useLeagues } from '@/hooks/useOddsData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Clock, AlertTriangle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import type { MatchOddsGroup, BookmakerOdds } from '@/types/database';

export function OddsComparisonTable() {
  const [selectedLeague, setSelectedLeague] = useState<string>('all');
  const { data: leagues } = useLeagues();
  const { data: matches, isLoading, error } = useOddsComparison(
    selectedLeague !== 'all' ? { leagueName: selectedLeague } : undefined
  );

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
      <div className="flex flex-wrap gap-4">
        <Select value={selectedLeague} onValueChange={setSelectedLeague}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por liga" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ligas</SelectItem>
            {leagues?.map((league) => (
              <SelectItem key={league.id} value={league.name}>
                {league.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
      {!isLoading && (!matches || matches.length === 0) && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Nenhuma partida encontrada. Configure seu scraper para popular o banco de dados.
          </CardContent>
        </Card>
      )}

      {/* Matches */}
      {matches?.map((match) => (
        <MatchCard key={match.match_id} match={match} />
      ))}
    </div>
  );
}

function MatchCard({ match }: { match: MatchOddsGroup }) {
  const matchDate = new Date(match.match_date);
  const isLive = match.match_status === 'live';
  
  // Calculate arbitrage value
  const arbitrageValue = (1/match.best_home + 1/match.best_draw + 1/match.best_away);
  const hasArbitrage = arbitrageValue < 1 && match.odds.length > 0;
  const profitPercentage = hasArbitrage ? ((1 - arbitrageValue) * 100).toFixed(2) : null;
  
  return (
    <Card className={cn(
      isLive && "border-primary",
      hasArbitrage && "border-2 border-green-500 shadow-lg shadow-green-500/20 animate-pulse"
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
            <Badge className="bg-green-500 text-white animate-pulse text-sm px-3 py-1">
              🎯 SUREBET +{profitPercentage}%
            </Badge>
          )}
          <BestOddsSummary match={match} hasArbitrage={hasArbitrage} arbitrageValue={arbitrageValue} />
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">Casa</TableHead>
              <TableHead className="text-center">Casa (1)</TableHead>
              <TableHead className="text-center">Empate (X)</TableHead>
              <TableHead className="text-center">Fora (2)</TableHead>
              <TableHead className="text-right">Atualizado</TableHead>
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
  
  const marginPercentage = ((arbitrageValue - 1) * 100).toFixed(2);
  
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
          <div className="text-muted-foreground">Margem</div>
          <div className="font-bold text-lg text-muted-foreground">{marginPercentage}%</div>
        </div>
      )}
    </div>
  );
}

// Função para gerar link da casa de apostas baseado no extra_data
function generateBookmakerLink(bookmakerName: string, extraData?: Record<string, unknown>): string | null {
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
  
  // Superbet (adicionar quando tivermos os dados)
  // if (name.includes('superbet')) { ... }
  
  return null;
}

function OddsRow({
  odds, 
  bestHome, 
  bestDraw, 
  bestAway,
  worstHome,
  worstDraw,
  worstAway
}: { 
  odds: BookmakerOdds;
  bestHome: number;
  bestDraw: number;
  bestAway: number;
  worstHome: number;
  worstDraw: number;
  worstAway: number;
}) {
  const isStale = odds.data_age_seconds > 30; // More than 30 seconds old
  const isVeryStale = odds.data_age_seconds > 120; // More than 2 minutes old
  
  // Gerar link da casa de apostas
  const bookmakerLink = generateBookmakerLink(odds.bookmaker_name, odds.extra_data);

  return (
    <TableRow className={cn(isStale && "opacity-60", isVeryStale && "opacity-40")}>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {odds.bookmaker_name}
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
      <TableCell className="text-right text-sm text-muted-foreground">
        {formatDistanceToNow(new Date(odds.scraped_at), { addSuffix: true, locale: ptBR })}
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
      {isBest && <TrendingUp className="h-3 w-3" />}
      {isWorst && <TrendingDown className="h-3 w-3" />}
      {value.toFixed(2)}
    </div>
  );
}

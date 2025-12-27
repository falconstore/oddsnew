import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useOddsComparison, useLeagues } from '@/hooks/useOddsData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Clock, AlertTriangle } from 'lucide-react';
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
  
  return (
    <Card className={cn(isLive && "border-primary")}>
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
          <BestOddsSummary match={match} />
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

function BestOddsSummary({ match }: { match: MatchOddsGroup }) {
  if (match.odds.length === 0) return null;
  
  return (
    <div className="flex gap-4 text-sm">
      <div className="text-center">
        <div className="text-muted-foreground">Melhor Casa</div>
        <div className="font-bold text-lg text-primary">{match.best_home.toFixed(2)}</div>
      </div>
      <div className="text-center">
        <div className="text-muted-foreground">Melhor Empate</div>
        <div className="font-bold text-lg text-primary">{match.best_draw.toFixed(2)}</div>
      </div>
      <div className="text-center">
        <div className="text-muted-foreground">Melhor Fora</div>
        <div className="font-bold text-lg text-primary">{match.best_away.toFixed(2)}</div>
      </div>
    </div>
  );
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
  const isStale = odds.data_age_seconds > 60; // More than 1 minute old
  
  return (
    <TableRow className={cn(isStale && "opacity-50")}>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {odds.bookmaker_name}
          {isStale && <Clock className="h-3 w-3 text-muted-foreground" />}
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

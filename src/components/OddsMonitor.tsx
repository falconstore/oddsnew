import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useOddsComparison } from "@/hooks/useOddsData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle } from "lucide-react";
import { useState, useMemo } from "react";
import { OddsFilters } from "./OddsFilters";
import { ViewToggle, ViewMode } from "./ViewToggle";
import { useFiltersFromUrl } from "@/hooks/useFiltersFromUrl";
import { useSurebetDetection } from "@/hooks/useSurebetDetection";
import { listContainer, listItem } from "@/lib/animations";
import { MatchCardSkeleton } from "./MatchCardSkeleton";
import type { MatchOddsGroup } from "@/types/database";

interface OddsMonitorProps {
  sportType: "football" | "basketball";
  onStatsUpdate?: (stats: { surebetCount: number; totalMatches: number }) => void;
}

export function OddsMonitor({ sportType, onStatsUpdate }: OddsMonitorProps) {
  const { filters, setFilters, hasActiveFilters } = useFiltersFromUrl();
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  // Get first league for API query (or undefined for all)
  const leagueForQuery = filters.leagues.length === 1 ? filters.leagues[0] : undefined;

  const {
    data: matches,
    isLoading,
    error,
  } = useOddsComparison(leagueForQuery ? { leagueName: leagueForQuery } : undefined);

  // Detect and notify new surebets
  useSurebetDetection(matches);

  const isBasketball = sportType === "basketball";

  // Filter and sort matches
  const filteredMatches = useMemo(() => {
    if (!matches) return [];

    let result = [...matches];

    // Sport filter - fixed by sportType prop
    result = result.filter((m) => (m.sport_type || "football") === sportType);

    // League filter (multiple)
    if (filters.leagues.length > 0) {
      result = result.filter((m) => filters.leagues.includes(m.league_name));
    }

    // Date filter (multiple specific dates)
    if (filters.dates.length > 0) {
      result = result.filter((m) => {
        const matchDateStr = format(new Date(m.match_date), "yyyy-MM-dd");
        return filters.dates.includes(matchDateStr);
      });
    }

    // Bookmaker filter (multiple)
    if (filters.bookmakers.length > 0) {
      result = result.filter((m) => m.odds.some((o) => filters.bookmakers.includes(o.bookmaker_name)));
    }

    // Search filter - busca no nome do time (home ou away)
    if (filters.searchTerm.trim()) {
      const searchLower = filters.searchTerm.toLowerCase().trim();
      result = result.filter(
        (m) => m.home_team.toLowerCase().includes(searchLower) || m.away_team.toLowerCase().includes(searchLower),
      );
    }

    // Opportunity type filter (surebet)
    if (filters.opportunityType === "surebet") {
      result = result.filter((m) => {
        const isBball = (m.sport_type || "football") === "basketball";
        const arbitrageValue =
          isBball || m.best_draw === null || m.best_draw === 0
            ? 1 / m.best_home + 1 / m.best_away
            : 1 / m.best_home + 1 / m.best_draw + 1 / m.best_away;
        return arbitrageValue < 1;
      });
    }

    // Sorting
    result.sort((a, b) => {
      let comparison = 0;

      switch (filters.sortBy) {
        case "date":
          comparison = new Date(a.match_date).getTime() - new Date(b.match_date).getTime();
          break;
        case "margin": {
          const isBballA = (a.sport_type || "football") === "basketball";
          const isBballB = (b.sport_type || "football") === "basketball";
          const marginA =
            isBballA || a.best_draw === null || a.best_draw === 0
              ? 1 / a.best_home + 1 / a.best_away
              : 1 / a.best_home + 1 / a.best_draw + 1 / a.best_away;
          const marginB =
            isBballB || b.best_draw === null || b.best_draw === 0
              ? 1 / b.best_home + 1 / b.best_away
              : 1 / b.best_home + 1 / b.best_draw + 1 / b.best_away;
          comparison = marginA - marginB;
          break;
        }
        case "team":
          comparison = a.home_team.localeCompare(b.home_team);
          break;
        case "bookmakers":
          comparison = b.odds.length - a.odds.length;
          break;
      }

      return filters.sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [matches, filters, sportType]);

  // Calculate stats
  useMemo(() => {
    if (!matches || !onStatsUpdate) return;

    // Filter by sport first
    const sportMatches = matches.filter((m) => (m.sport_type || "football") === sportType);

    let surebetCount = 0;

    sportMatches.forEach((m) => {
      const isBball = (m.sport_type || "football") === "basketball";
      const arbitrageValue =
        isBball || m.best_draw === null || m.best_draw === 0
          ? 1 / m.best_home + 1 / m.best_away
          : 1 / m.best_home + 1 / m.best_draw + 1 / m.best_away;
      if (arbitrageValue < 1) surebetCount++;
    });

    onStatsUpdate({ surebetCount, totalMatches: sportMatches.length });
  }, [matches, onStatsUpdate, sportType]);

  // For surebet-only view
  const displayMatches =
    viewMode === "surebets"
      ? filteredMatches.filter((m) => {
          const isBball = (m.sport_type || "football") === "basketball";
          const arbitrageValue =
            isBball || m.best_draw === null || m.best_draw === 0
              ? 1 / m.best_home + 1 / m.best_away
              : 1 / m.best_home + 1 / m.best_draw + 1 / m.best_away;
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
      <OddsFilters filters={filters} onFiltersChange={setFilters} hasActiveFilters={hasActiveFilters} hideSportFilter />

      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {displayMatches.length} partida{displayMatches.length !== 1 ? "s" : ""} encontrada
          {displayMatches.length !== 1 ? "s" : ""}
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
            {viewMode === "surebets"
              ? "Nenhuma surebet encontrada no momento."
              : `Nenhuma partida de ${isBasketball ? "basquete" : "futebol"} encontrada com os filtros atuais.`}
          </CardContent>
        </Card>
      )}

      {/* Compact Table View */}
      {viewMode === "compact" && displayMatches.length > 0 && (
        <CompactTableView matches={displayMatches} isBasketball={isBasketball} />
      )}

      {/* Card View with stagger animation */}
      {(viewMode === "cards" || viewMode === "surebets") && (
        <motion.div variants={listContainer} initial="hidden" animate="show" className="space-y-4">
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
                <TableHead className="text-center">{isBasketball ? "Time 1" : "Casa"}</TableHead>
                {showDrawColumn && <TableHead className="text-center">Empate</TableHead>}
                <TableHead className="text-center">{isBasketball ? "Time 2" : "Fora"}</TableHead>
                <TableHead className="text-center">ROI</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matches.map((match) => {
                const isBball = (match.sport_type || "football") === "basketball";
                const arbitrageValue =
                  isBball || match.best_draw === null || match.best_draw === 0
                    ? 1 / match.best_home + 1 / match.best_away
                    : 1 / match.best_home + 1 / match.best_draw + 1 / match.best_away;
                const hasArbitrage = arbitrageValue < 1;
                const roi = ((1 - arbitrageValue) * 100).toFixed(2);
                const sportIcon = isBball ? "🏀" : "⚽";

                return (
                  <TableRow
                    key={match.match_id}
                    className={cn(
                      "cursor-pointer transition-colors duration-200 hover:bg-muted/50",
                      hasArbitrage && "bg-success/10",
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
                        <Badge variant="success" className="ml-2 text-xs">
                          SUREBET
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {match.league_name}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-mono font-bold text-primary">{match.best_home.toFixed(2)}</span>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                          {match.odds.length > 0
                            ? match.odds.reduce(
                                (best, o) => (o.home_odd > (best?.home_odd || 0) ? o : best),
                                match.odds[0],
                              )?.bookmaker_name
                            : "-"}
                        </span>
                      </div>
                    </TableCell>
                    {showDrawColumn && (
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center">
                          <span className="font-mono font-bold text-primary">
                            {isBball || match.best_draw === null ? "-" : match.best_draw.toFixed(2)}
                          </span>
                          {!isBball && match.best_draw !== null && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                              {match.odds.length > 0
                                ? match.odds.reduce(
                                    (best, o) => ((o.draw_odd || 0) > (best?.draw_odd || 0) ? o : best),
                                    match.odds[0],
                                  )?.bookmaker_name
                                : "-"}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-mono font-bold text-primary">{match.best_away.toFixed(2)}</span>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                          {match.odds.length > 0
                            ? match.odds.reduce(
                                (best, o) => (o.away_odd > (best?.away_odd || 0) ? o : best),
                                match.odds[0],
                              )?.bookmaker_name
                            : "-"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-center font-mono",
                        hasArbitrage ? "text-success font-bold" : "text-muted-foreground",
                      )}
                    >
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
  const isLive = match.match_status === "live";
  const isBasketball = (match.sport_type || "football") === "basketball";
  const sportIcon = isBasketball ? "🏀" : "⚽";

  // Calculate best bookmakers for each outcome
  const bestHomeBookmaker = match.odds.reduce(
    (best, o) => (o.home_odd > (best?.home_odd || 0) ? o : best),
    match.odds[0],
  )?.bookmaker_name;
  const bestDrawBookmaker = match.odds.reduce(
    (best, o) => ((o.draw_odd || 0) > (best?.draw_odd || 0) ? o : best),
    match.odds[0],
  )?.bookmaker_name;
  const bestAwayBookmaker = match.odds.reduce(
    (best, o) => (o.away_odd > (best?.away_odd || 0) ? o : best),
    match.odds[0],
  )?.bookmaker_name;

  // Calculate arbitrage (overall)
  const arbitrageValue =
    isBasketball || match.best_draw === null || match.best_draw === 0
      ? 1 / match.best_home + 1 / match.best_away
      : 1 / match.best_home + 1 / match.best_draw + 1 / match.best_away;
  const hasArbitrage = arbitrageValue < 1 && match.odds.length > 0;
  const roiPercentage = ((1 - arbitrageValue) * 100).toFixed(2);

  return (
    <Card
      variant="interactive"
      className={cn(
        "overflow-hidden animate-fade-in-up",
        isLive && "border-destructive",
        hasArbitrage && "border-2 border-success shadow-lg shadow-success/20",
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
                <img
                  src={match.home_team_logo}
                  alt={match.home_team}
                  className="h-5 w-5 sm:h-6 sm:w-6 object-contain"
                />
              ) : (
                <span className="text-sm sm:text-base">{sportIcon}</span>
              )}
              <span className="text-muted-foreground text-sm">x</span>
              {match.away_team_logo ? (
                <img
                  src={match.away_team_logo}
                  alt={match.away_team}
                  className="h-5 w-5 sm:h-6 sm:w-6 object-contain"
                />
              ) : (
                <span className="text-sm sm:text-base">{sportIcon}</span>
              )}
              <span className="font-semibold text-base sm:text-lg">{match.away_team}</span>
            </div>
            {hasArbitrage && (
              <Badge
                variant="success"
                className="text-xs sm:text-sm px-2 sm:px-3 py-0.5 sm:py-1 shrink-0 self-start sm:self-auto animate-pulse-subtle"
              >
                🎯 SUREBET +{roiPercentage}%
              </Badge>
            )}
          </div>

          {/* League */}
          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
            <Badge variant="outline" className="text-xs">
              {match.league_name}
            </Badge>
            {isLive && (
              <Badge variant="destructive" className="text-xs animate-pulse">
                AO VIVO
              </Badge>
            )}
          </div>

          {/* Date/Time */}
          <div className="text-xs sm:text-sm text-muted-foreground">
            {format(matchDate, "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </div>

          {/* Best Odds Grid - Single unified view */}
          <div className="pt-2 sm:pt-3 border-t">
            <div className={cn("grid gap-2 sm:gap-4", isBasketball ? "grid-cols-3" : "grid-cols-4")}>
              {/* Casa */}
              <div className="text-center group">
                <div className="text-[10px] sm:text-xs text-muted-foreground truncate">{bestHomeBookmaker}</div>
                <div
                  className={cn(
                    "font-bold text-lg sm:text-xl font-mono transition-transform duration-200 group-hover:scale-110",
                    hasArbitrage ? "text-success" : "text-primary",
                  )}
                >
                  {match.best_home.toFixed(2)}
                </div>
                <div className="text-[10px] sm:text-xs text-muted-foreground">{isBasketball ? "Time 1" : "Casa"}</div>
              </div>

              {/* Empate (futebol only) */}
              {!isBasketball && (
                <div className="text-center group">
                  <div className="text-[10px] sm:text-xs text-muted-foreground truncate">{bestDrawBookmaker}</div>
                  <div
                    className={cn(
                      "font-bold text-lg sm:text-xl font-mono transition-transform duration-200 group-hover:scale-110",
                      hasArbitrage ? "text-success" : "text-primary",
                    )}
                  >
                    {match.best_draw !== null ? match.best_draw.toFixed(2) : "-"}
                  </div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">Empate</div>
                </div>
              )}

              {/* Fora */}
              <div className="text-center group">
                <div className="text-[10px] sm:text-xs text-muted-foreground truncate">{bestAwayBookmaker}</div>
                <div
                  className={cn(
                    "font-bold text-lg sm:text-xl font-mono transition-transform duration-200 group-hover:scale-110",
                    hasArbitrage ? "text-success" : "text-primary",
                  )}
                >
                  {match.best_away.toFixed(2)}
                </div>
                <div className="text-[10px] sm:text-xs text-muted-foreground">{isBasketball ? "Time 2" : "Fora"}</div>
              </div>

              {/* ROI */}
              <div className="text-center">
                <div className="text-[10px] sm:text-xs text-muted-foreground">ROI</div>
                <div
                  className={cn(
                    "font-bold text-lg sm:text-xl font-mono",
                    hasArbitrage ? "text-success" : "text-muted-foreground",
                  )}
                >
                  {Number(roiPercentage) > 0 ? `+${roiPercentage}%` : `${roiPercentage}%`}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

import type { MatchOddsGroup, BookmakerOdds } from '@/types/database';
import type { FreebetOpportunity, FreebetFiltersState } from '@/types/freebet';
import { calculateFreebetExtraction } from '@/types/freebet';

// Casas que são EXCLUSIVAMENTE SO (nunca têm PA)
const KNOWN_SO_BOOKMAKERS = ['betbra', 'betnacional', 'tradeball'];

/**
 * Check if a bookmaker is SO type
 */
export function isSOBookmaker(bookmakerName: string, oddsType?: string): boolean {
  const name = bookmakerName.toLowerCase();
  return oddsType === 'SO' || KNOWN_SO_BOOKMAKERS.some(b => name.includes(b));
}

/**
 * Get best SO odd for draw (prioritizing Betbra)
 */
export function getBestSODrawOdd(odds: BookmakerOdds[]): BookmakerOdds | null {
  const soOdds = odds.filter(o => isSOBookmaker(o.bookmaker_name, o.odds_type));
  
  if (soOdds.length === 0) return null;
  
  // Filter only those with valid draw odds
  const withDraw = soOdds.filter(o => o.draw_odd !== null && o.draw_odd > 0);
  if (withDraw.length === 0) return null;
  
  // Sort: Betbra first, then by highest draw odd
  withDraw.sort((a, b) => {
    const aIsBetbra = a.bookmaker_name.toLowerCase().includes('betbra');
    const bIsBetbra = b.bookmaker_name.toLowerCase().includes('betbra');
    
    if (aIsBetbra && !bIsBetbra) return -1;
    if (!aIsBetbra && bIsBetbra) return 1;
    
    return (b.draw_odd || 0) - (a.draw_odd || 0);
  });
  
  return withDraw[0];
}

/**
 * Get best PA odd for home
 */
export function getBestPAHomeOdd(odds: BookmakerOdds[]): BookmakerOdds | null {
  const paOdds = odds.filter(o => !isSOBookmaker(o.bookmaker_name, o.odds_type));
  
  if (paOdds.length === 0) return null;
  
  const sorted = [...paOdds].sort((a, b) => b.home_odd - a.home_odd);
  return sorted[0];
}

/**
 * Get best PA odd for away
 */
export function getBestPAAwayOdd(odds: BookmakerOdds[]): BookmakerOdds | null {
  const paOdds = odds.filter(o => !isSOBookmaker(o.bookmaker_name, o.odds_type));
  
  if (paOdds.length === 0) return null;
  
  const sorted = [...paOdds].sort((a, b) => b.away_odd - a.away_odd);
  return sorted[0];
}

/**
 * Get best PA odd from a specific bookmaker
 */
export function getBestOddFromBookmaker(
  odds: BookmakerOdds[],
  bookmakerName: string
): { odd: BookmakerOdds; position: 'home' | 'away'; value: number } | null {
  const bookmakerOdds = odds.filter(o => 
    o.bookmaker_name.toLowerCase().includes(bookmakerName.toLowerCase()) &&
    !isSOBookmaker(o.bookmaker_name, o.odds_type)
  );
  
  if (bookmakerOdds.length === 0) return null;
  
  // Find the best odd (home or away) from this bookmaker
  let bestOdd: BookmakerOdds | null = null;
  let position: 'home' | 'away' = 'away';
  let bestValue = 0;
  
  for (const o of bookmakerOdds) {
    if (o.home_odd > bestValue) {
      bestValue = o.home_odd;
      bestOdd = o;
      position = 'home';
    }
    if (o.away_odd > bestValue) {
      bestValue = o.away_odd;
      bestOdd = o;
      position = 'away';
    }
  }
  
  if (!bestOdd) return null;
  
  return { odd: bestOdd, position, value: bestValue };
}

/**
 * Generate freebet opportunities from matches with filters
 */
export function generateFreebetOpportunitiesWithFilters(
  matches: MatchOddsGroup[],
  freebetValue: number,
  generateLink: (bookmakerName: string, extraData?: Record<string, unknown>, homeTeam?: string, awayTeam?: string) => string | null,
  filters?: FreebetFiltersState
): FreebetOpportunity[] {
  const opportunities: FreebetOpportunity[] = [];
  const freebetBookmaker = filters?.freebetBookmaker || null;
  
  // Apply league and date filters
  let filteredMatches = matches;
  
  if (filters?.leagues?.length) {
    filteredMatches = filteredMatches.filter(m => filters.leagues.includes(m.league_name));
  }
  
  if (filters?.dates?.length) {
    filteredMatches = filteredMatches.filter(m => {
      const matchDate = m.match_date.slice(0, 10);
      return filters.dates.includes(matchDate);
    });
  }
  
  for (const match of filteredMatches) {
    // Skip basketball (no draw)
    if (match.sport_type === 'basketball') continue;
    
    // Get SO draw odd
    const bestSODraw = getBestSODrawOdd(match.odds);
    if (!bestSODraw || !bestSODraw.draw_odd) continue;
    
    let freebetPosition: 'home' | 'away';
    let freebetOddData: BookmakerOdds;
    let freebetOddValue: number;
    let oppositeOddData: BookmakerOdds | null;
    let oppositePosition: 'home' | 'away';
    
    if (freebetBookmaker) {
      // SPECIFIC BOOKMAKER: Freebet must be in the selected bookmaker
      const bookmakerBestOdd = getBestOddFromBookmaker(match.odds, freebetBookmaker);
      
      if (!bookmakerBestOdd) continue; // Bookmaker doesn't have odds for this match
      
      freebetPosition = bookmakerBestOdd.position;
      freebetOddData = bookmakerBestOdd.odd;
      freebetOddValue = bookmakerBestOdd.value;
      oppositePosition = freebetPosition === 'home' ? 'away' : 'home';
      
      // Get best PA for the opposite result from ANY bookmaker
      oppositeOddData = oppositePosition === 'home' 
        ? getBestPAHomeOdd(match.odds)
        : getBestPAAwayOdd(match.odds);
    } else {
      // ANY BOOKMAKER: Find best PA odds from any bookmaker
      const bestPAHome = getBestPAHomeOdd(match.odds);
      const bestPAAway = getBestPAAwayOdd(match.odds);
      
      if (!bestPAHome || !bestPAAway) continue;
      
      // Determine freebet position (highest odd)
      if (bestPAAway.away_odd >= bestPAHome.home_odd) {
        freebetPosition = 'away';
        freebetOddData = bestPAAway;
        freebetOddValue = bestPAAway.away_odd;
        oppositeOddData = bestPAHome;
        oppositePosition = 'home';
      } else {
        freebetPosition = 'home';
        freebetOddData = bestPAHome;
        freebetOddValue = bestPAHome.home_odd;
        oppositeOddData = bestPAAway;
        oppositePosition = 'away';
      }
    }
    
    if (!oppositeOddData) continue;
    
    const homeOdd = freebetPosition === 'home' ? freebetOddValue : oppositeOddData.home_odd;
    const awayOdd = freebetPosition === 'away' ? freebetOddValue : oppositeOddData.away_odd;
    
    const calc = calculateFreebetExtraction(
      homeOdd,
      bestSODraw.draw_odd,
      awayOdd,
      freebetValue,
      freebetPosition
    );
    
    // Only include positive extraction opportunities
    if (calc.guaranteedProfit <= 0) continue;
    
    // Apply minimum extraction filter
    if (filters?.minExtraction && calc.extraction < filters.minExtraction) continue;
    
    const homeBookmaker = freebetPosition === 'home' ? freebetOddData.bookmaker_name : oppositeOddData.bookmaker_name;
    const awayBookmaker = freebetPosition === 'away' ? freebetOddData.bookmaker_name : oppositeOddData.bookmaker_name;
    const homeExtraData = freebetPosition === 'home' ? freebetOddData.extra_data : oppositeOddData.extra_data;
    const awayExtraData = freebetPosition === 'away' ? freebetOddData.extra_data : oppositeOddData.extra_data;
    
    opportunities.push({
      match,
      freebetPosition,
      homeBookmaker,
      homeOdd,
      homeStake: calc.homeStake,
      homeLink: generateLink(homeBookmaker, homeExtraData, match.home_team, match.away_team),
      homeExtraData,
      drawBookmaker: bestSODraw.bookmaker_name,
      drawOdd: bestSODraw.draw_odd,
      drawStake: calc.drawStake,
      drawLink: generateLink(bestSODraw.bookmaker_name, bestSODraw.extra_data, match.home_team, match.away_team),
      drawExtraData: bestSODraw.extra_data,
      awayBookmaker,
      awayOdd,
      awayStake: calc.awayStake,
      awayLink: generateLink(awayBookmaker, awayExtraData, match.home_team, match.away_team),
      awayExtraData,
      totalToInvest: calc.totalToInvest,
      guaranteedProfit: calc.guaranteedProfit,
      extraction: calc.extraction,
    });
  }
  
  // Sort by extraction descending
  opportunities.sort((a, b) => b.extraction - a.extraction);
  
  // Limit to 30 results
  return opportunities.slice(0, 30);
}

/**
 * Generate freebet opportunities from matches (legacy - without filters)
 */
export function generateFreebetOpportunities(
  matches: MatchOddsGroup[],
  freebetValue: number,
  generateLink: (bookmakerName: string, extraData?: Record<string, unknown>, homeTeam?: string, awayTeam?: string) => string | null
): FreebetOpportunity[] {
  return generateFreebetOpportunitiesWithFilters(matches, freebetValue, generateLink);
}

/**
 * Format currency in BRL
 */
export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

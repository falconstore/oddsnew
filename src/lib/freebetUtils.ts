import type { MatchOddsGroup, BookmakerOdds } from '@/types/database';
import type { FreebetOpportunity } from '@/types/freebet';
import { calculateFreebetExtraction } from '@/types/freebet';

// Known SO bookmakers
const KNOWN_SO_BOOKMAKERS = ['novibet', 'betbra', 'betnacional'];

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
 * Generate freebet opportunities from matches
 */
export function generateFreebetOpportunities(
  matches: MatchOddsGroup[],
  freebetValue: number,
  generateLink: (bookmakerName: string, extraData?: Record<string, unknown>, homeTeam?: string, awayTeam?: string) => string | null
): FreebetOpportunity[] {
  const opportunities: FreebetOpportunity[] = [];
  
  for (const match of matches) {
    // Skip basketball (no draw)
    if (match.sport_type === 'basketball') continue;
    
    const bestSODraw = getBestSODrawOdd(match.odds);
    const bestPAHome = getBestPAHomeOdd(match.odds);
    const bestPAAway = getBestPAAwayOdd(match.odds);
    
    // Need all three to create an opportunity
    if (!bestSODraw || !bestPAHome || !bestPAAway) continue;
    if (!bestSODraw.draw_odd) continue;
    
    // NOVO: Determinar qual odd PA é maior → essa é a FREEBET
    const homeOdd = bestPAHome.home_odd;
    const awayOdd = bestPAAway.away_odd;
    const freebetPosition: 'home' | 'away' = awayOdd >= homeOdd ? 'away' : 'home';
    
    const calc = calculateFreebetExtraction(
      homeOdd,
      bestSODraw.draw_odd,
      awayOdd,
      freebetValue,
      freebetPosition  // Passar onde a freebet está
    );
    
    // Only include positive ROI opportunities
    if (calc.guaranteedProfit <= 0) continue;
    
    opportunities.push({
      match,
      freebetPosition,
      homeBookmaker: bestPAHome.bookmaker_name,
      homeOdd: bestPAHome.home_odd,
      homeStake: calc.homeStake,
      homeLink: generateLink(bestPAHome.bookmaker_name, bestPAHome.extra_data, match.home_team, match.away_team),
      homeExtraData: bestPAHome.extra_data,
      drawBookmaker: bestSODraw.bookmaker_name,
      drawOdd: bestSODraw.draw_odd,
      drawStake: calc.drawStake,
      drawLink: generateLink(bestSODraw.bookmaker_name, bestSODraw.extra_data, match.home_team, match.away_team),
      drawExtraData: bestSODraw.extra_data,
      awayBookmaker: bestPAAway.bookmaker_name,
      awayOdd: bestPAAway.away_odd,
      awayStake: calc.awayStake,
      awayLink: generateLink(bestPAAway.bookmaker_name, bestPAAway.extra_data, match.home_team, match.away_team),
      awayExtraData: bestPAAway.extra_data,
      totalToInvest: calc.totalToInvest,
      guaranteedProfit: calc.guaranteedProfit,
      roi: calc.roi,
    });
  }
  
  // Sort by ROI descending
  opportunities.sort((a, b) => b.roi - a.roi);
  
  return opportunities;
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

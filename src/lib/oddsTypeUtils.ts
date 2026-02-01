import type { BookmakerOdds } from '@/types/database';

// Known SO bookmakers (Super Odds / sem pagamento antecipado)
const KNOWN_SO_BOOKMAKERS = ['novibet', 'betbra', 'betnacional'];

interface BestSOResult {
  home: number;
  draw: number | null;
  away: number;
  homeBookmaker: string | undefined;
  drawBookmaker: string | undefined;
  awayBookmaker: string | undefined;
}

interface OddsByTypeResult {
  bestSO: BestSOResult;
  topPAHome: BookmakerOdds[];
  topPADraw: BookmakerOdds[];
  topPAAway: BookmakerOdds[];
  hasSOData: boolean;
  hasPAData: boolean;
  soOdds: BookmakerOdds[];
  paOdds: BookmakerOdds[];
}

/**
 * Separates odds by type (SO vs PA) and returns best values for each
 */
export function getBestOddsByType(odds: BookmakerOdds[], isBasketball: boolean): OddsByTypeResult {
  // Separate SO and PA odds
  const soOdds = odds.filter(o => {
    const name = o.bookmaker_name.toLowerCase();
    return o.odds_type === 'SO' || KNOWN_SO_BOOKMAKERS.some(b => name.includes(b));
  });
  
  const paOdds = odds.filter(o => {
    const name = o.bookmaker_name.toLowerCase();
    // PA = not SO type AND not a known SO bookmaker
    return o.odds_type !== 'SO' && !KNOWN_SO_BOOKMAKERS.some(b => name.includes(b));
  });
  
  // Best SO odds
  const soHomeOdds = soOdds.map(o => o.home_odd);
  const soDrawOdds = soOdds.map(o => o.draw_odd || 0);
  const soAwayOdds = soOdds.map(o => o.away_odd);
  
  const bestSOHome = soHomeOdds.length > 0 ? Math.max(...soHomeOdds) : 0;
  const bestSODraw = isBasketball ? null : (soDrawOdds.length > 0 ? Math.max(...soDrawOdds) : 0);
  const bestSOAway = soAwayOdds.length > 0 ? Math.max(...soAwayOdds) : 0;
  
  const bestSO: BestSOResult = {
    home: bestSOHome,
    draw: bestSODraw,
    away: bestSOAway,
    homeBookmaker: soOdds.find(o => o.home_odd === bestSOHome)?.bookmaker_name,
    drawBookmaker: isBasketball ? undefined : soOdds.find(o => o.draw_odd === bestSODraw)?.bookmaker_name,
    awayBookmaker: soOdds.find(o => o.away_odd === bestSOAway)?.bookmaker_name,
  };
  
  // Top N PA odds helper
  const getTopN = (arr: BookmakerOdds[], key: 'home_odd' | 'draw_odd' | 'away_odd', n: number): BookmakerOdds[] => {
    return [...arr]
      .filter(o => key === 'draw_odd' ? o[key] !== null && o[key] !== undefined : true)
      .sort((a, b) => (b[key] || 0) - (a[key] || 0))
      .slice(0, n);
  };
  
  const topPAHome = getTopN(paOdds, 'home_odd', 3);
  const topPADraw = isBasketball ? [] : getTopN(paOdds, 'draw_odd', 3);
  const topPAAway = getTopN(paOdds, 'away_odd', 3);
  
  return {
    bestSO,
    topPAHome,
    topPADraw,
    topPAAway,
    hasSOData: soOdds.length > 0,
    hasPAData: paOdds.length > 0,
    soOdds,
    paOdds,
  };
}

/**
 * Calculate ROI for a set of best odds
 */
export function calculateROI(home: number, draw: number | null, away: number, isBasketball: boolean): number {
  if (home <= 0 || away <= 0) return -100;
  
  const arbitrageValue = isBasketball || draw === null || draw === 0
    ? (1/home + 1/away)
    : (1/home + 1/draw + 1/away);
  
  return (1 - arbitrageValue) * 100;
}

/**
 * Get best PA odds values (for ROI calculation)
 */
export function getBestPAOdds(paOdds: BookmakerOdds[], isBasketball: boolean): { home: number; draw: number | null; away: number } {
  if (paOdds.length === 0) {
    return { home: 0, draw: isBasketball ? null : 0, away: 0 };
  }
  
  const home = Math.max(...paOdds.map(o => o.home_odd));
  const draw = isBasketball ? null : Math.max(...paOdds.map(o => o.draw_odd || 0));
  const away = Math.max(...paOdds.map(o => o.away_odd));
  
  return { home, draw, away };
}

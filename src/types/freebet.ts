import type { MatchOddsGroup, BookmakerOdds } from './database';

export interface FreebetOpportunity {
  match: MatchOddsGroup;
  freebetPosition: 'home' | 'away';  // Onde a freebet está (maior odd PA)
  homeBookmaker: string;
  homeOdd: number;
  homeStake: number;
  homeLink: string | null;
  homeExtraData?: Record<string, unknown>;
  drawBookmaker: string;
  drawOdd: number;
  drawStake: number;
  drawLink: string | null;
  drawExtraData?: Record<string, unknown>;
  awayBookmaker: string;
  awayOdd: number;
  awayStake: number;
  awayLink: string | null;
  awayExtraData?: Record<string, unknown>;
  totalToInvest: number;
  guaranteedProfit: number;
  extraction: number;
}

export interface FreebetConfigState {
  freebetBookmaker: string;
  freebetValue: number;
  freebetOutcome: 'draw' | 'home' | 'away';
}

export interface FreebetFiltersState {
  freebetBookmaker: string | null;  // Casa onde a freebet está
  leagues: string[];                // Ligas selecionadas
  dates: string[];                  // Datas selecionadas (yyyy-MM-dd)
  minExtraction: number;            // Extração mínima (0-100)
}

export const defaultFreebetFilters: FreebetFiltersState = {
  freebetBookmaker: null,
  leagues: [],
  dates: [],
  minExtraction: 0,
};

export interface FreebetCalculationResult {
  extraction: number;
  totalToInvest: number;
  guaranteedProfit: number;
  homeStake: number;
  drawStake: number;
  awayStake: number;
}

// Cálculo de extração de freebet
// A freebet é usada no empate (SO), as outras apostas (Casa/Fora) são com dinheiro real (PA)
export function calculateFreebetExtraction(
  homeOdd: number,
  drawOdd: number,
  awayOdd: number,
  freebetValue: number,
  freebetOutcome: 'draw' | 'home' | 'away' = 'draw'
): FreebetCalculationResult {
  // Valor base é o da freebet
  let freebetOdd: number;
  let otherOdds: { odd: number; key: 'home' | 'draw' | 'away' }[];
  
  if (freebetOutcome === 'draw') {
    freebetOdd = drawOdd;
    otherOdds = [
      { odd: homeOdd, key: 'home' },
      { odd: awayOdd, key: 'away' }
    ];
  } else if (freebetOutcome === 'home') {
    freebetOdd = homeOdd;
    otherOdds = [
      { odd: drawOdd, key: 'draw' },
      { odd: awayOdd, key: 'away' }
    ];
  } else {
    freebetOdd = awayOdd;
    otherOdds = [
      { odd: homeOdd, key: 'home' },
      { odd: drawOdd, key: 'draw' }
    ];
  }
  
  // Retorno potencial da freebet (só lucro, sem stake de volta)
  const freebetReturn = freebetValue * (freebetOdd - 1);
  
  // Para garantir lucro: precisamos cobrir os outros resultados
  // Stake necessário para cada outro resultado = freebetReturn / odd
  const otherStakes = otherOdds.map(o => freebetReturn / o.odd);
  const totalOtherStakes = otherStakes.reduce((a, b) => a + b, 0);
  
  // Lucro garantido = freebetReturn - totalOtherStakes
  const guaranteedProfit = freebetReturn - totalOtherStakes;
  
  // Extração = (lucro / valor freebet) * 100
  // Representa quanto % do valor da freebet estamos extraindo como lucro real
  const extraction = freebetValue > 0 ? (guaranteedProfit / freebetValue) * 100 : 0;
  
  // Calcular stakes individuais
  const stakes = { home: 0, draw: 0, away: 0 };
  stakes[freebetOutcome] = freebetValue;
  
  otherOdds.forEach((o, i) => {
    stakes[o.key] = otherStakes[i];
  });
  
  return {
    extraction,
    totalToInvest: totalOtherStakes,
    guaranteedProfit,
    homeStake: stakes.home,
    drawStake: stakes.draw,
    awayStake: stakes.away,
  };
}

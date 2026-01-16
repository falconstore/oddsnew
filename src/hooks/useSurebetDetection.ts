import { useRef, useEffect } from 'react';
import { useNotifications } from './useNotifications';
import type { MatchOddsGroup } from '@/types/database';

interface SurebetInfo {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  roi: string;
  sportType: string;
}

export const useSurebetDetection = (matches: MatchOddsGroup[] | undefined) => {
  const { sendNotification, permission } = useNotifications();
  const previousSurebetsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    if (!matches || permission !== 'granted') return;

    // Identify current surebets
    const currentSurebets = new Map<string, SurebetInfo>();
    
    matches.forEach(match => {
      const isBasketball = (match.sport_type || 'football') === 'basketball';
      const arbitrageValue = isBasketball || match.best_draw === null || match.best_draw === 0
        ? 1/match.best_home + 1/match.best_away
        : 1/match.best_home + 1/match.best_draw + 1/match.best_away;
      
      if (arbitrageValue < 1) {
        const roi = ((1 - arbitrageValue) * 100).toFixed(2);
        currentSurebets.set(match.match_id, {
          matchId: match.match_id,
          homeTeam: match.home_team,
          awayTeam: match.away_team,
          roi,
          sportType: match.sport_type || 'football'
        });
      }
    });

    // Don't notify on first load - just store current surebets
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      previousSurebetsRef.current = new Set(currentSurebets.keys());
      return;
    }

    // Detect NEW surebets that weren't there before
    currentSurebets.forEach((surebet, matchId) => {
      if (!previousSurebetsRef.current.has(matchId)) {
        const sportIcon = surebet.sportType === 'basketball' ? '🏀' : '⚽';
        
        sendNotification(`${sportIcon} Nova Surebet Detectada!`, {
          body: `${surebet.homeTeam} vs ${surebet.awayTeam}\nROI: +${surebet.roi}%`,
          tag: matchId, // Prevents duplicate notifications
          requireInteraction: true, // Keeps visible until user interacts
        });
      }
    });

    // Update reference for next comparison
    previousSurebetsRef.current = new Set(currentSurebets.keys());
  }, [matches, sendNotification, permission]);

  return {
    surebetCount: previousSurebetsRef.current.size
  };
};

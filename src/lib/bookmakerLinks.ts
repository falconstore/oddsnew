import type { BookmakerOdds } from '@/types/database';

// Função para gerar link da casa de apostas
export function generateBookmakerLink(
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
    const eventId = extraData.superbet_event_id || extraData.event_id;
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
    const leaguePath = extraData.league_path as string;
    const homeOriginal = extraData.home_team_slug as string;
    const awayOriginal = extraData.away_team_slug as string;
    const homeName = homeOriginal || homeTeam;
    const awayName = awayOriginal || awayTeam;
    
    if (eventId && homeName && awayName) {
      const homeSlug = homeName.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const awaySlug = awayName.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      
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
    const homeOriginal = extraData.home_team_raw as string;
    const awayOriginal = extraData.away_team_raw as string;
    const homeName = homeOriginal || homeTeam;
    const awayName = awayOriginal || awayTeam;
    
    if (fixtureId && homeName && awayName) {
      const homeSlug = homeName.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const awaySlug = awayName.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
    if (eventId) {
      return `https://betnacional.bet.br/event/1/0/${eventId}`;
    }
  }
  
  if (name.includes('stake')) {
    const eventId = extraData.event_id;
    if (eventId) {
      return `https://stake.bet.br/esportes/${eventId}`;
    }
  }
  
  if (name.includes('bet365')) {
    const bet365Url = extraData.bet365_url as string;
    if (bet365Url) {
      return bet365Url;
    }
    const eventId = extraData.event_id;
    if (eventId) {
      return `https://www.bet365.com/#/AC/B1/C1/D8/E${eventId}/F3/`;
    }
    return 'https://www.bet365.com/';
  }
  
  if (name.includes('aposta1')) {
    const eventId = extraData.aposta1_event_id;
    const champId = extraData.aposta1_champ_id;
    const categoryId = extraData.aposta1_category_id;
    
    if (eventId && champId && categoryId) {
      return `https://www.aposta1.bet.br/esportes#/sport/66/category/${categoryId}/championship/${champId}/event/${eventId}`;
    }
    if (eventId) {
      return `https://www.aposta1.bet.br/esportes#/sport/66/event/${eventId}`;
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
  
  if (name.includes('jogodeouro') || name.includes('jogo de ouro')) {
    const eventId = extraData.jogodeouro_event_id || extraData.event_id;
    if (eventId) {
      return `https://jogodeouro.bet.br/pt/sports?page=event&eventId=${eventId}&sportId=66`;
    }
  }
  
  if (name.includes('tradeball')) {
    return 'https://betbra.bet.br/tradeball/dballTradingFeed';
  }
  
  return null;
}

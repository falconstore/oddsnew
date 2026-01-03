// Types for the odds comparison database

export type EntityStatus = 'active' | 'inactive';
export type AlertType = 'value_bet' | 'line_movement' | 'arbitrage';
export type MarketType = '1x2' | 'over_under' | 'both_teams_score' | 'handicap';
export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed';
export type OddsType = 'SO' | 'PA'; // SO = Super Odds (sem pagamento antecipado), PA = Pagamento Antecipado

export interface League {
  id: string;
  name: string;
  country: string | null;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  standard_name: string;
  league_id: string;
  logo_url: string | null;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
  league?: League;
}

export interface TeamAlias {
  id: string;
  team_id: string;
  alias_name: string;
  bookmaker_source: string | null;
  created_at: string;
  team?: Team;
}

export interface Bookmaker {
  id: string;
  name: string;
  website_url: string | null;
  logo_url: string | null;
  status: EntityStatus;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface Match {
  id: string;
  league_id: string;
  home_team_id: string;
  away_team_id: string;
  match_date: string;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  created_at: string;
  updated_at: string;
  league?: League;
  home_team?: Team;
  away_team?: Team;
}

export interface OddsHistory {
  id: string;
  match_id: string;
  bookmaker_id: string;
  market_type: MarketType;
  home_odd: number | null;
  draw_odd: number | null;
  away_odd: number | null;
  over_line: number | null;
  over_odd: number | null;
  under_odd: number | null;
  scraped_at: string;
  is_latest: boolean;
  bookmaker?: Bookmaker;
}

export interface Alert {
  id: string;
  match_id: string;
  bookmaker_id: string | null;
  alert_type: AlertType;
  title: string;
  details: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
  match?: Match;
  bookmaker?: Bookmaker;
}

// View type for odds comparison
export interface OddsComparison {
  match_id: string;
  match_date: string;
  match_status: string;
  league_name: string;
  league_country: string | null;
  home_team: string;
  away_team: string;
  bookmaker_name: string;
  bookmaker_id: string;
  home_odd: number;
  draw_odd: number;
  away_odd: number;
  scraped_at: string;
  margin_percentage: number | null;
  data_age_seconds: number;
  extra_data?: Record<string, unknown>;
}

// Grouped odds by match for dashboard display
export interface MatchOddsGroup {
  match_id: string;
  match_date: string;
  match_status: string;
  league_name: string;
  league_country: string | null;
  home_team: string;
  away_team: string;
  odds: BookmakerOdds[];
  best_home: number;
  best_draw: number;
  best_away: number;
  worst_home: number;
  worst_draw: number;
  worst_away: number;
}

export interface BookmakerOdds {
  bookmaker_id: string;
  bookmaker_name: string;
  home_odd: number;
  draw_odd: number;
  away_odd: number;
  margin_percentage: number | null;
  data_age_seconds: number;
  scraped_at: string;
  extra_data?: Record<string, unknown>;
  odds_type?: OddsType; // SO = Super Odds, PA = Pagamento Antecipado
}

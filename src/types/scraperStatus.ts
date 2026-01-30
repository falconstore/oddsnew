export interface ScraperStatus {
  id: string;
  scraper_name: string;
  bookmaker_id: string | null;
  last_heartbeat: string;
  last_success: string | null;
  odds_collected: number;
  odds_inserted: number;
  cycle_count: number;
  last_error: string | null;
  status: 'ok' | 'warning' | 'error' | 'offline' | 'unknown';
  extra_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // View computed fields
  bookmaker_display_name: string | null;
  bookmaker_logo: string | null;
  seconds_since_heartbeat: number;
  computed_status: 'ok' | 'warning' | 'error';
  avg_cycle_seconds: number | null;
}

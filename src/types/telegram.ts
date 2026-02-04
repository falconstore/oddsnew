export interface TelegramBotConfig {
  id: string;
  enabled: boolean;
  roi_minimo: number;
  stake_base: number;
  intervalo_segundos: number;
  horario_inicio: string;
  horario_fim: string;
  url_site: string;
  bookmakers_links: Record<string, string>;
  updated_at: string;
}

export interface TelegramDGEnviado {
  id: string;
  match_id: string;
  team1: string;
  team2: string;
  competition: string;
  match_date: string;
  roi: number;
  stake_casa: number;
  stake_empate: number;
  stake_fora: number;
  retorno_green: number;
  casa_bookmaker: string;
  casa_odd: number;
  empate_bookmaker: string;
  empate_odd: number;
  fora_bookmaker: string;
  fora_odd: number;
  telegram_message_id: number | null;
  created_at: string;
}

export interface TelegramBotStats {
  totalEnviados: number;
  enviadosHoje: number;
  roiMedio: number;
  lucroTotalPotencial: number;
}

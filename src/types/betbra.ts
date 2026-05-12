export interface BetbraEntry {
  id: string;
  created_date: string | null;
  updated_date: string | null;
  created_by: string | null;
  date: string;
  registros: number;
  numero_de_apostas: number;
  ngr: number;
  turnover: number;
  cpa: number;
  raw_all?: Record<string, unknown> | null;
  raw_exchange?: Record<string, unknown> | null;
  updated_at?: string | null;
}

export interface BetbraFormData {
  date: string;
  registros: string;
  numero_de_apostas: string;
  ngr: string;
  turnover: string;
  cpa: string;
}

export interface BetbraStats {
  cpaTotal: number;
  cpaValue: number;
  revenueShare: number;
  turnoverValue: number;
  total: number;
}

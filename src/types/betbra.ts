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

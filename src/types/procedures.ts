export type ProcedureCategory = 
  | 'Promoção' 
  | 'Cashback' 
  | 'Freebet' 
  | 'Superodd' 
  | 'Extra' 
  | 'Ganhar Giros Gratis';

export type ProcedureStatus = 
  | 'Enviado'
  | 'Enviada partida em Aberto'
  | 'Concluído'
  | 'Lucro Direto'
  | 'Freebet Pendente'
  | 'Aposta Sem Risco'
  | 'Referência Faltando'
  | 'Falta Girar Freebet';

// Tipo de freebet (paridade com FreeBet Pro §8.1)
export type ProcedureType = 'SEM_FB' | 'GANHAR_FB' | 'QUEIMAR_FB';

// Crédito de freebet pós-jogo (paridade com FreeBet Pro §8.4)
export type FreebetCreditada = 'SIM' | 'NAO';

export interface Procedure {
  id: string;
  created_date: string | null;
  updated_date: string | null;
  created_by: string | null;
  date: string;
  procedure_number: string;
  platform: string;
  promotion_name: string | null;
  category: string;
  status: string;
  freebet_reference: string | null;
  freebet_value: number | null;
  profit_loss: number;
  telegram_link: string | null;
  dp: boolean;
  tags: string[];
  is_favorite: boolean;
  // Paridade FreeBet Pro
  data_partida: string | null;
  horario_partida: string | null;
  partida_descricao: string | null;
  tipo: ProcedureType;
  archived: boolean;
  archived_at: string | null;
  lucro_prejuizo_previsto: number | null;
  freebet_valor_previsto: number | null;
  resultado_lucro: number | null;
  resultado_freebet_ganha: number | null;
  freebet_creditada: FreebetCreditada | null;
  resultado_observacao: string | null;
  freebetpro_external_id: string | null;
  freebetpro_synced_at: string | null;
  freebetpro_last_error: string | null;
  editado_por: string | null;
}

export interface ProcedureFilters {
  searchNumber: string;
  searchPromotion: string;
  searchTags: string;
  platform: string;
  category: string;
  status: string;
  profitLoss: string;
  urgent: string;
  hasFreebetValue: string;
  onlyFavorites: boolean;
  // Paridade FreeBet Pro
  showArchived: boolean;
  gameTime: string; // 'all' | 'live' | 'upcoming' | 'ended' | 'none'
}

export interface ProcedureFormData {
  date: string;
  procedure_number: string;
  platform: string;
  promotion_name: string;
  category: string;
  status: string;
  freebet_reference: string;
  freebet_value: string;
  profit_loss: string;
  telegram_link: string;
  dp: boolean;
  tags: string[];
  is_favorite: boolean;
  // Paridade FreeBet Pro
  data_partida: string;
  horario_partida: string;
  partida_descricao: string;
  tipo: ProcedureType;
}

export interface ProcedureResultFormData {
  resultado_lucro: string;
  resultado_freebet_ganha: string;
  freebet_creditada: '' | FreebetCreditada;
  resultado_observacao: string;
}

export const PROCEDURE_CATEGORIES: ProcedureCategory[] = [
  'Promoção',
  'Cashback',
  'Freebet',
  'Superodd',
  'Extra',
  'Ganhar Giros Gratis'
];

export const PROCEDURE_STATUSES: ProcedureStatus[] = [
  'Enviado',
  'Enviada partida em Aberto',
  'Concluído',
  'Lucro Direto',
  'Freebet Pendente',
  'Aposta Sem Risco',
  'Referência Faltando',
  'Falta Girar Freebet'
];

export const PROCEDURE_TYPES: { value: ProcedureType; label: string; description: string }[] = [
  { value: 'SEM_FB',     label: 'Sem Freebet',     description: 'Operação sem freebet envolvida' },
  { value: 'GANHAR_FB',  label: 'Ganhar Freebet',  description: 'Operação que pode gerar uma freebet' },
  { value: 'QUEIMAR_FB', label: 'Queimar Freebet', description: 'Operação para girar uma freebet existente' },
];

export const AVAILABLE_COLUMNS = [
  { key: 'date', label: 'Data', default: true },
  { key: 'procedure_number', label: 'Nº Procedimento', default: true },
  { key: 'platform', label: 'Plataforma', default: true },
  { key: 'promotion_name', label: 'Promoção', default: true },
  { key: 'partida_descricao', label: 'Evento', default: false },
  { key: 'category', label: 'Categoria', default: true },
  { key: 'status', label: 'Status', default: true },
  { key: 'freebet_reference', label: 'Ref. Freebet', default: true },
  { key: 'freebet_value', label: 'Valor Freebet', default: true },
  { key: 'profit_loss', label: 'Lucro/Prejuízo', default: true },
  { key: 'tags', label: 'Tags', default: true },
  { key: 'telegram_link', label: 'Telegram', default: true },
  { key: 'dp', label: 'DP', default: true },
  { key: 'actions', label: 'Ações', default: true }
] as const;

export type ColumnKey = typeof AVAILABLE_COLUMNS[number]['key'];

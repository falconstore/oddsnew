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

export const AVAILABLE_COLUMNS = [
  { key: 'date', label: 'Data', default: true },
  { key: 'procedure_number', label: 'Nº Procedimento', default: true },
  { key: 'platform', label: 'Plataforma', default: true },
  { key: 'promotion_name', label: 'Promoção', default: true },
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

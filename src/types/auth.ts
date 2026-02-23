export type UserStatus = 'pending' | 'approved' | 'rejected';

export type AppRole = 'admin' | 'moderator' | 'scraper' | 'user';

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

// Estrutura da tabela user_permissions no banco externo
export interface UserPermissionRow {
  id: string;
  user_email: string;
  can_view_dashboard: boolean;
  can_view_payment_control: boolean;
  can_view_procedure_control: boolean;
  can_view_freebet_calculator: boolean;
  can_view_admin: boolean;
  can_view_sharkodds: boolean;
  can_view_conta_corrente: boolean;
  can_view_plataformas: boolean;
  can_view_betbra: boolean;
  is_super_admin?: boolean;
  created_date: string;
  updated_date: string;
}

// Mantemos compatibilidade com UserPermission legado
export interface UserPermission {
  id: string;
  user_id: string;
  page_key: string;
  can_view: boolean;
  can_edit: boolean;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

// Chaves de páginas disponíveis no sistema
export const PAGE_KEYS = {
  DASHBOARD: 'dashboard',
  SHARKODDS: 'sharkodds',
  SUBSCRIPTIONS: 'subscriptions',
  PROCEDURE_CONTROL: 'procedure_control',
  FREEBET_CALCULATOR: 'freebet_calculator',
  ADMIN: 'admin',
  CONTA_CORRENTE: 'conta_corrente',
  PLATAFORMAS: 'plataformas',
  BETBRA_AFFILIATE: 'betbra_affiliate',
  // Aliases para compatibilidade com código existente
  SETTINGS: 'settings',
  ADMIN_USERS: 'admin_users',
  ADMIN_LOGS: 'admin_logs',
  SCRAPER_STATUS: 'scraper_status',
  TELEGRAM_BOT: 'telegram_bot',
  // Manter keys legadas para não quebrar referências existentes
  LEAGUES: 'sharkodds',
  TEAMS: 'sharkodds',
  BOOKMAKERS: 'sharkodds',
} as const;

export type PageKey = typeof PAGE_KEYS[keyof typeof PAGE_KEYS];

// Mapeamento de PageKey -> coluna na tabela user_permissions
export const PAGE_KEY_TO_COLUMN: Record<string, keyof UserPermissionRow> = {
  dashboard: 'can_view_dashboard',
  sharkodds: 'can_view_sharkodds',
  subscriptions: 'can_view_payment_control',
  procedure_control: 'can_view_procedure_control',
  freebet_calculator: 'can_view_freebet_calculator',
  admin: 'can_view_admin',
  admin_users: 'can_view_admin',
  admin_logs: 'can_view_admin',
  conta_corrente: 'can_view_conta_corrente',
  betbra_affiliate: 'can_view_betbra',
  settings: 'can_view_dashboard', // settings acessível se tem dashboard
  scraper_status: 'can_view_admin',
  telegram_bot: 'can_view_admin',
};

// Colunas de permissão editáveis (para o admin UI)
export const PERMISSION_COLUMNS: { column: keyof UserPermissionRow; label: string; description: string }[] = [
  { column: 'can_view_dashboard', label: 'Dashboard', description: 'Visão geral do sistema' },
  { column: 'can_view_sharkodds', label: 'SharkOdds', description: 'Acesso ao sistema de odds' },
  { column: 'can_view_payment_control', label: 'Controle de Pagamentos', description: 'Gerenciar assinaturas' },
  { column: 'can_view_procedure_control', label: 'Controle de Procedimentos', description: 'Gerenciar procedimentos' },
  { column: 'can_view_freebet_calculator', label: 'Calculadora Freebet', description: 'Calculadora de apostas' },
  { column: 'can_view_admin', label: 'Admin', description: 'Acesso administrativo' },
  { column: 'can_view_conta_corrente', label: 'Conta Corrente', description: 'Controle financeiro' },
  { column: 'can_view_plataformas', label: 'Plataformas', description: 'Gerenciar plataformas' },
  { column: 'can_view_betbra', label: 'Betbra', description: 'Dados de afiliação Betbra' },
];

// Configuração de páginas com labels e descrições (mantido para sidebar/UI)
export const PAGE_CONFIG: Record<string, { label: string; description: string }> = {
  [PAGE_KEYS.DASHBOARD]: { label: 'Dashboard', description: 'Visão geral do sistema' },
  [PAGE_KEYS.SHARKODDS]: { label: 'SharkOdds', description: 'Sistema de odds' },
  [PAGE_KEYS.SUBSCRIPTIONS]: { label: 'Assinaturas', description: 'Controle de pagamentos' },
  [PAGE_KEYS.PROCEDURE_CONTROL]: { label: 'Controle de Procedimentos', description: 'Gerenciar procedimentos' },
  [PAGE_KEYS.FREEBET_CALCULATOR]: { label: 'Calculadora Freebet', description: 'Calculadora de apostas' },
  [PAGE_KEYS.ADMIN]: { label: 'Admin', description: 'Acesso administrativo' },
  [PAGE_KEYS.ADMIN_USERS]: { label: 'Gerenciar Usuários', description: 'Aprovar e gerenciar usuários' },
  [PAGE_KEYS.ADMIN_LOGS]: { label: 'Logs / Diagnóstico', description: 'Visualizar logs do sistema' },
  [PAGE_KEYS.CONTA_CORRENTE]: { label: 'Conta Corrente', description: 'Controle financeiro' },
  [PAGE_KEYS.PLATAFORMAS]: { label: 'Plataformas', description: 'Gerenciar plataformas' },
  [PAGE_KEYS.BETBRA_AFFILIATE]: { label: 'Betbra Affiliate', description: 'Dados de afiliação Betbra' },
  [PAGE_KEYS.SETTINGS]: { label: 'Configurações', description: 'Configurações do sistema' },
  [PAGE_KEYS.SCRAPER_STATUS]: { label: 'Status Scrapers', description: 'Monitoramento dos scrapers' },
  [PAGE_KEYS.TELEGRAM_BOT]: { label: 'Bot Telegram', description: 'Configurar bot de Duplo Green' },
};

// Permissões padrão para novos usuários aprovados
export const DEFAULT_USER_PERMISSIONS: { pageKey: PageKey; canView: boolean; canEdit: boolean }[] = [
  { pageKey: PAGE_KEYS.DASHBOARD, canView: true, canEdit: true },
  { pageKey: PAGE_KEYS.SETTINGS, canView: true, canEdit: true },
];

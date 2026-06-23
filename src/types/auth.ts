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

// Estrutura da tabela user_permissions no banco externo.
//
// `allowed_pages` é a NOVA fonte da verdade (array de page keys do registro em
// config/pages.ts). As colunas can_view_* são legadas — mantidas pra
// compatibilidade/migração, mas a leitura/escrita nova usa allowed_pages.
export interface UserPermissionRow {
  id: string;
  user_email: string;
  /** Páginas liberadas pra esse usuário (keys do registro config/pages.ts). */
  allowed_pages: string[] | null;
  // --- legado (não usar em código novo) ---
  can_view_dashboard?: boolean;
  can_view_payment_control?: boolean;
  can_view_procedure_control?: boolean;
  can_view_freebet_calculator?: boolean;
  can_view_admin?: boolean;
  can_view_sharkodds?: boolean;
  can_view_conta_corrente?: boolean;
  can_view_plataformas?: boolean;
  can_view_betbra?: boolean;
  can_view_trial?: boolean;
  can_view_lastlink?: boolean;
  can_view_watermark?: boolean;
  // -----------------------------------------
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
  TRIAL: 'trial',
  LASTLINK: 'lastlink',
  // Aliases para compatibilidade com código existente
  SETTINGS: 'settings',
  ADMIN_USERS: 'admin_users',
  ADMIN_LOGS: 'admin_logs',
  SCRAPER_STATUS: 'scraper_status',
  TELEGRAM_BOT: 'telegram_bot',
  WATERMARK: 'watermark',
  PUSH_NOTIFICATIONS: 'push_notifications',
  APP_STATS: 'app_stats',
  // Manter keys legadas para não quebrar referências existentes
  LEAGUES: 'sharkodds',
  TEAMS: 'sharkodds',
  BOOKMAKERS: 'sharkodds',
} as const;

export type PageKey = typeof PAGE_KEYS[keyof typeof PAGE_KEYS];

// Mapeamento de PageKey (constante legada usada nas rotas/componentes) -> key
// do registro em config/pages.ts. Permite que chamadas existentes como
// canViewPage(PAGE_KEYS.SUBSCRIPTIONS) continuem funcionando sem reescrever
// todos os componentes: traduzimos pra key real do registro e checamos
// allowed_pages. Keys que mapeiam pra páginas adminOnly/inexistentes são
// resolvidas pelo gate de admin no canViewPage.
export const PAGE_KEY_TO_PAGE: Record<string, string> = {
  dashboard: 'dashboard',
  sharkodds: 'casas',                 // "sharkodds"/LEAGUES/TEAMS/BOOKMAKERS -> Casas
  subscriptions: 'subscriptions',
  procedure_control: 'procedure_control',
  freebet_calculator: 'dashboard',    // sem aba própria; cai no dashboard
  admin: 'admin_users',
  admin_users: 'admin_users',
  admin_logs: 'bot_logs',
  conta_corrente: 'dashboard',
  plataformas: 'casas',
  betbra_affiliate: 'betbra_affiliate',
  trial: 'trial',
  lastlink: 'lastlink_admin',
  settings: 'settings',
  scraper_status: 'admin_users',
  telegram_bot: 'admin_users',
  watermark: 'watermark',
  push_notifications: 'push_notifications',
  app_stats: 'app_stats',
};

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
  [PAGE_KEYS.TRIAL]: { label: 'Trial Telegram', description: 'CRM dos leads do trial gratuito' },
  [PAGE_KEYS.LASTLINK]: { label: 'Pagamentos Lastlink', description: 'Painel de pagamentos e assinaturas via Lastlink' },
  [PAGE_KEYS.SETTINGS]: { label: 'Configurações', description: 'Configurações do sistema' },
  [PAGE_KEYS.SCRAPER_STATUS]: { label: 'Status Scrapers', description: 'Monitoramento dos scrapers' },
  [PAGE_KEYS.TELEGRAM_BOT]: { label: 'Bot Telegram', description: 'Configurar bot de Duplo Green' },
  [PAGE_KEYS.WATERMARK]: { label: "Marca d'Água", description: 'Editor client-side para aplicar logo Shark sobre imagens' },
};

// Permissões padrão para novos usuários aprovados
export const DEFAULT_USER_PERMISSIONS: { pageKey: PageKey; canView: boolean; canEdit: boolean }[] = [
  { pageKey: PAGE_KEYS.DASHBOARD, canView: true, canEdit: true },
  { pageKey: PAGE_KEYS.SETTINGS, canView: true, canEdit: true },
];

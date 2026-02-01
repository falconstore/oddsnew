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

export interface UserPermission {
  id: string;
  user_id: string;
  page_key: string;
  can_view: boolean;
  can_edit: boolean;
  can_access?: boolean; // Legacy - para compatibilidade durante migração
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
  MONITOR_FUTEBOL: 'monitor_futebol',
  MONITOR_BASQUETE: 'monitor_basquete',
  FREEBET_EXTRACTION: 'freebet_extraction',
  LEAGUES: 'leagues',
  TEAMS: 'teams',
  BOOKMAKERS: 'bookmakers',
  SETTINGS: 'settings',
  ADMIN_USERS: 'admin_users',
  ADMIN_LOGS: 'admin_logs',
  PROCEDURE_CONTROL: 'procedure_control',
  BETBRA_AFFILIATE: 'betbra_affiliate',
  SUBSCRIPTIONS: 'subscriptions',
  SCRAPER_STATUS: 'scraper_status',
} as const;

export type PageKey = typeof PAGE_KEYS[keyof typeof PAGE_KEYS];

// Configuração de páginas com labels e descrições
export const PAGE_CONFIG: Record<PageKey, { label: string; description: string }> = {
  [PAGE_KEYS.DASHBOARD]: { 
    label: 'Dashboard', 
    description: 'Visão geral do sistema'
  },
  [PAGE_KEYS.MONITOR_FUTEBOL]: { 
    label: 'Monitor Futebol', 
    description: 'Monitor de odds de futebol'
  },
  [PAGE_KEYS.MONITOR_BASQUETE]: { 
    label: 'Monitor Basquete', 
    description: 'Monitor de odds de basquete'
  },
  [PAGE_KEYS.FREEBET_EXTRACTION]: { 
    label: 'Extração Freebet', 
    description: 'Monitor de arbitragem para extração de freebets'
  },
  [PAGE_KEYS.LEAGUES]: { 
    label: 'Ligas', 
    description: 'Gerenciar campeonatos'
  },
  [PAGE_KEYS.TEAMS]: { 
    label: 'Times', 
    description: 'Gerenciar times e aliases'
  },
  [PAGE_KEYS.BOOKMAKERS]: { 
    label: 'Casas de Apostas', 
    description: 'Gerenciar fontes de odds'
  },
  [PAGE_KEYS.SETTINGS]: { 
    label: 'Configurações', 
    description: 'Configurações do sistema'
  },
  [PAGE_KEYS.ADMIN_USERS]: { 
    label: 'Gerenciar Usuários', 
    description: 'Aprovar e gerenciar usuários'
  },
  [PAGE_KEYS.ADMIN_LOGS]: { 
    label: 'Logs / Diagnóstico', 
    description: 'Visualizar logs do sistema'
  },
  [PAGE_KEYS.PROCEDURE_CONTROL]: { 
    label: 'Controle de Procedimentos', 
    description: 'Gerenciar procedimentos de apostas'
  },
  [PAGE_KEYS.BETBRA_AFFILIATE]: { 
    label: 'Betbra Affiliate', 
    description: 'Dados de afiliação Betbra'
  },
  [PAGE_KEYS.SUBSCRIPTIONS]: { 
    label: 'Assinaturas', 
    description: 'Controle de pagamentos'
  },
  [PAGE_KEYS.SCRAPER_STATUS]: { 
    label: 'Status Scrapers', 
    description: 'Monitoramento em tempo real dos scrapers'
  },
};

// Permissões padrão para novos usuários aprovados
export const DEFAULT_USER_PERMISSIONS: { pageKey: PageKey; canView: boolean; canEdit: boolean }[] = [
  { pageKey: PAGE_KEYS.DASHBOARD, canView: true, canEdit: true },
  { pageKey: PAGE_KEYS.MONITOR_FUTEBOL, canView: true, canEdit: true },
  { pageKey: PAGE_KEYS.MONITOR_BASQUETE, canView: true, canEdit: true },
  { pageKey: PAGE_KEYS.SETTINGS, canView: true, canEdit: true },
];

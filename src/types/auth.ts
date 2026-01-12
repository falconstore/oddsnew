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
  can_access: boolean;
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
  LEAGUES: 'leagues',
  TEAMS: 'teams',
  BOOKMAKERS: 'bookmakers',
  SETTINGS: 'settings',
  ADMIN_USERS: 'admin_users',
  ADMIN_LOGS: 'admin_logs',
} as const;

export type PageKey = typeof PAGE_KEYS[keyof typeof PAGE_KEYS];

// Configuração de páginas com labels
export const PAGE_CONFIG: Record<PageKey, { label: string; adminOnly: boolean }> = {
  [PAGE_KEYS.DASHBOARD]: { label: 'Dashboard', adminOnly: false },
  [PAGE_KEYS.MONITOR_FUTEBOL]: { label: 'Monitor Futebol', adminOnly: false },
  [PAGE_KEYS.MONITOR_BASQUETE]: { label: 'Monitor Basquete', adminOnly: false },
  [PAGE_KEYS.LEAGUES]: { label: 'Ligas', adminOnly: true },
  [PAGE_KEYS.TEAMS]: { label: 'Times', adminOnly: true },
  [PAGE_KEYS.BOOKMAKERS]: { label: 'Casas de Apostas', adminOnly: true },
  [PAGE_KEYS.SETTINGS]: { label: 'Configurações', adminOnly: false },
  [PAGE_KEYS.ADMIN_USERS]: { label: 'Gerenciar Usuários', adminOnly: true },
  [PAGE_KEYS.ADMIN_LOGS]: { label: 'Logs / Diagnóstico', adminOnly: true },
};

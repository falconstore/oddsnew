import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { PAGE_KEYS, PageKey } from '@/types/auth';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import {
  LayoutDashboard,
  Building2,
  Settings,
  Menu,
  X,
  LogOut,
  Shield,
  UserCog,
  FileText,
  TrendingUp,
  CreditCard,
  Gift,
  Receipt,
  Trophy,
  Stamp,
  BookOpen,
  ScrollText,
  Megaphone,
  Bell,
  BarChart3,
  Brain,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

type NavigationItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  pageKey: PageKey;
  alwaysVisible?: boolean;
};

// Grupos operacionais — o console agrupa a navegação por função, com um
// hairline e um label de telemetria por seção.
const navGroups: { label: string; items: NavigationItem[] }[] = [
  {
    label: 'OPERAÇÃO',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard, pageKey: PAGE_KEYS.DASHBOARD },
      { name: 'Procedimentos', href: '/procedures', icon: FileText, pageKey: PAGE_KEYS.PROCEDURE_CONTROL },
      { name: 'FreeBets Ganhas', href: '/procedures/freebets-ganhas', icon: Trophy, pageKey: PAGE_KEYS.PROCEDURE_CONTROL },
      { name: 'Templates Bot', href: '/bot-templates', icon: BookOpen, pageKey: PAGE_KEYS.DASHBOARD, alwaysVisible: true },
      { name: 'Casas', href: '/cadastros', icon: Building2, pageKey: PAGE_KEYS.LEAGUES },
    ],
  },
  {
    label: 'RECEITA',
    items: [
      { name: 'Betbra Affiliate', href: '/betbra', icon: TrendingUp, pageKey: PAGE_KEYS.BETBRA_AFFILIATE },
      { name: 'Assinaturas', href: '/subscriptions', icon: CreditCard, pageKey: PAGE_KEYS.SUBSCRIPTIONS },
      { name: 'Pagamentos Lastlink', href: '/lastlink-admin', icon: Receipt, pageKey: PAGE_KEYS.LASTLINK },
      { name: 'Dashboard Lastlink', href: '/lastlink-dashboard', icon: BarChart3, pageKey: PAGE_KEYS.LASTLINK },
    ],
  },
  {
    label: 'AQUISIÇÃO',
    items: [
      { name: 'Trial Telegram', href: '/trial-admin', icon: Gift, pageKey: PAGE_KEYS.TRIAL },
      { name: 'Anúncios', href: '/ads-admin', icon: Megaphone, pageKey: PAGE_KEYS.TRIAL },
      { name: 'Estatísticas App', href: '/app-stats', icon: BarChart3, pageKey: PAGE_KEYS.APP_STATS },
      { name: 'Push Notifications', href: '/push-notifications', icon: Bell, pageKey: PAGE_KEYS.PUSH_NOTIFICATIONS },
    ],
  },
  {
    label: 'SISTEMA',
    items: [
      { name: "Marca d'Água", href: '/watermark', icon: Stamp, pageKey: PAGE_KEYS.WATERMARK },
      { name: 'Configurações', href: '/settings', icon: Settings, pageKey: PAGE_KEYS.SETTINGS },
      { name: 'Usuários', href: '/admin/users', icon: UserCog, pageKey: PAGE_KEYS.ADMIN_USERS },
      { name: 'Logs do Bot', href: '/admin/bot-logs', icon: ScrollText, pageKey: PAGE_KEYS.ADMIN_USERS },
      { name: 'Parser IA', href: '/admin/parser-ia', icon: Brain, pageKey: PAGE_KEYS.ADMIN_USERS },
    ],
  },
];

interface SidebarProps {
  /** Colapsada no desktop (escondida). Controlada pelo Layout. */
  collapsed?: boolean;
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const location = useLocation();
  const { user, isAdmin, signOut, canViewPage } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { onTouchStart, onTouchMove, onTouchEnd, swipeDistance } = useSwipeGesture({
    threshold: 50,
    onSwipeLeft: () => setMobileOpen(false),
  });

  const visibleGroups = navGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => (item.alwaysVisible ? !!user : canViewPage(item.pageKey))),
    }))
    .filter((g) => g.items.length > 0);

  const handleSignOut = async () => {
    await signOut();
  };

  const displayName = user?.user_metadata?.full_name || user?.email || 'Usuário';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  const sidebarTransform = mobileOpen && swipeDistance > 0
    ? `translateX(-${Math.min(swipeDistance, 256)}px)`
    : undefined;

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-1.5 left-3 z-50 md:hidden h-8 w-8 border border-border bg-card"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen w-64 flex flex-col',
          'transition-transform duration-300 ease-out',
          'bg-sidebar border-r border-sidebar-border',
          // Desktop: visível, a não ser que colapsada. Mobile: controlada por mobileOpen.
          collapsed ? 'md:-translate-x-full' : 'md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ transform: sidebarTransform }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Logo / identidade */}
        <div className="flex h-11 items-center gap-2.5 px-4 border-b border-sidebar-border">
          <div className="w-6 h-6 flex items-center justify-center bg-primary text-primary-foreground font-bold text-xs">
            S
          </div>
          <span className="text-sm font-semibold tracking-tight text-sidebar-foreground leading-none">
            BETSHARK
          </span>
          <span className="telemetry-label text-primary ml-auto">PRO</span>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-4 px-3 py-4 flex-1 overflow-y-auto">
          {visibleGroups.map((group) => (
            <div key={group.label} className="flex flex-col gap-0.5">
              <p className="telemetry-label text-muted-foreground/50 px-2 pb-1.5">{group.label}</p>
              {group.items.map((item) => {
                const isActive = location.pathname === item.href ||
                  (item.href !== '/' && location.pathname === item.href);
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'group relative flex items-center gap-2.5 px-2 py-2 text-[13px] transition-colors duration-150',
                      isActive
                        ? 'bg-accent text-primary'
                        : 'text-sidebar-foreground/70 hover:bg-accent/50 hover:text-sidebar-foreground'
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" />
                    )}
                    <item.icon className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-primary' : 'text-muted-foreground/60')} />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User footer */}
        {user && (
          <div className="p-3 border-t border-sidebar-border">
            <div className="flex items-center gap-2.5 p-2 border border-sidebar-border bg-card">
              <div className="h-7 w-7 flex items-center justify-center bg-accent text-primary text-[11px] font-bold flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate text-sidebar-foreground leading-tight">
                  {displayName}
                </p>
                <p className="telemetry-label text-muted-foreground flex items-center gap-1 mt-0.5">
                  {isAdmin && <Shield className="h-2.5 w-2.5 text-primary" />}
                  {isAdmin ? 'ADMIN' : 'USUARIO'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="h-7 w-7 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                title="Sair"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

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
  BarChart3,
  LogOut,
  Shield,
  UserCog,
  FileWarning,
  FileText,
  TrendingUp,
  Cpu,
  CreditCard,
  Gift,
  Bot,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';

// Ícone SVG personalizado para Futebol
const FootballIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    <path d="M2 12h20" />
  </svg>
);

// Ícone SVG personalizado para Basquete
const BasketballIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2v20" />
    <path d="M2 12h20" />
    <path d="M4.93 4.93c4.08 2.39 8.16 4.78 14.14 0" />
    <path d="M4.93 19.07c4.08-2.39 8.16-4.78 14.14 0" />
  </svg>
);

type NavigationItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  pageKey: PageKey;
};

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, pageKey: PAGE_KEYS.DASHBOARD },
  { name: 'Controle Procedimentos', href: '/procedures', icon: FileText, pageKey: PAGE_KEYS.PROCEDURE_CONTROL },
  { name: 'Betbra Affiliate', href: '/betbra', icon: TrendingUp, pageKey: PAGE_KEYS.BETBRA_AFFILIATE },
  { name: 'Assinaturas', href: '/subscriptions', icon: CreditCard, pageKey: PAGE_KEYS.SUBSCRIPTIONS },
  { name: 'Bot Telegram', href: '/telegram-bot', icon: Bot, pageKey: PAGE_KEYS.TELEGRAM_BOT },
  { name: 'Cadastros', href: '/cadastros', icon: Building2, pageKey: PAGE_KEYS.LEAGUES },
  { name: 'Configurações', href: '/settings', icon: Settings, pageKey: PAGE_KEYS.SETTINGS },
  { name: 'Gerenciar Usuários', href: '/admin/users', icon: UserCog, pageKey: PAGE_KEYS.ADMIN_USERS },
  { name: 'Logs / Diagnóstico', href: '/admin/logs', icon: FileWarning, pageKey: PAGE_KEYS.ADMIN_LOGS },
  { name: 'Status Scrapers', href: '/admin/scraper-status', icon: Cpu, pageKey: PAGE_KEYS.SCRAPER_STATUS },
];

export function Sidebar() {
  const location = useLocation();
  const { user, isAdmin, signOut, canViewPage, userProfile } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Swipe gesture to close sidebar on mobile
  const { onTouchStart, onTouchMove, onTouchEnd, swipeDistance } = useSwipeGesture({
    threshold: 50,
    onSwipeLeft: () => setMobileOpen(false),
  });

  // Filtrar navegação baseado em permissões de visualização
  const filteredNavigation = navigation.filter(item => {
    return canViewPage(item.pageKey);
  });

  const handleSignOut = async () => {
    await signOut();
  };

  const displayName = userProfile?.full_name || user?.email || 'Usuário';

  // Calculate sidebar transform based on swipe distance
  const sidebarTransform = mobileOpen && swipeDistance > 0 
    ? `translateX(-${Math.min(swipeDistance, 256)}px)` 
    : undefined;

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 md:hidden h-12 w-12 rounded-full bg-card/80 backdrop-blur-sm border border-border/50 shadow-lg hover:shadow-xl transition-all duration-200"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col",
          "transition-transform duration-300 ease-out md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ transform: sidebarTransform }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Header with animated logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <div className="p-2 rounded-lg bg-primary/10 animate-float">
            <BarChart3 className="h-5 w-5 text-sidebar-primary" />
          </div>
          <span className="text-lg font-semibold text-sidebar-foreground tracking-tight">BetShark Pro</span>
        </div>
        
        {/* Navigation with animated indicators */}
        <nav className="flex flex-col gap-1 p-4 flex-1 overflow-y-auto">
          {filteredNavigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium",
                  "transition-all duration-200 ease-out",
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground hover:translate-x-1"
                )}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-sidebar-primary rounded-r-full transition-all duration-200" />
                )}
                <span className={cn(
                  "transition-transform duration-200",
                  isActive && "scale-110"
                )}>
                  <item.icon className="h-4 w-4" />
                </span>
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Theme Toggle */}
        <div className="px-4 py-3 border-t border-sidebar-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Tema</span>
            <ThemeToggle />
          </div>
        </div>

        {/* User Footer with enhanced styling */}
        {user && (
          <div className="p-4 border-t border-sidebar-border bg-sidebar-accent/10">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 ring-2 ring-sidebar-primary/20">
                <AvatarFallback className="text-xs bg-sidebar-primary/10 text-sidebar-primary font-semibold">
                  {displayName[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-sidebar-foreground">
                  {displayName}
                </p>
                <p className="text-xs text-sidebar-foreground/60 flex items-center gap-1">
                  {isAdmin && <Shield className="h-3 w-3" />}
                  {isAdmin ? 'Admin' : 'Usuário'}
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleSignOut}
                className="h-9 w-9 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

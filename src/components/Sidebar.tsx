import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { PAGE_KEYS, PageKey } from '@/types/auth';
import { 
  LayoutDashboard, 
  Trophy, 
  Users, 
  Building2, 
  Settings,
  Menu,
  X,
  BarChart3,
  LogOut,
  Shield,
  UserCog,
  FileWarning,
  type LucideIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useState } from 'react';

const FootballIcon = () => <span className="text-base">⚽</span>;
const BasketballIcon = () => <span className="text-base">🏀</span>;

type NavigationItem = {
  name: string;
  href: string;
  icon: LucideIcon | (() => JSX.Element);
  adminOnly?: boolean;
  pageKey: PageKey;
};

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, pageKey: PAGE_KEYS.DASHBOARD },
  { name: 'Monitor Futebol', href: '/monitor-futebol', icon: FootballIcon, pageKey: PAGE_KEYS.MONITOR_FUTEBOL },
  { name: 'Monitor Basquete', href: '/monitor-basquete', icon: BasketballIcon, pageKey: PAGE_KEYS.MONITOR_BASQUETE },
  { name: 'Ligas', href: '/leagues', icon: Trophy, adminOnly: true, pageKey: PAGE_KEYS.LEAGUES },
  { name: 'Times', href: '/teams', icon: Users, adminOnly: true, pageKey: PAGE_KEYS.TEAMS },
  { name: 'Casas de Apostas', href: '/bookmakers', icon: Building2, adminOnly: true, pageKey: PAGE_KEYS.BOOKMAKERS },
  { name: 'Configurações', href: '/settings', icon: Settings, pageKey: PAGE_KEYS.SETTINGS },
  { name: 'Gerenciar Usuários', href: '/admin/users', icon: UserCog, adminOnly: true, pageKey: PAGE_KEYS.ADMIN_USERS },
  { name: 'Logs / Diagnóstico', href: '/admin/logs', icon: FileWarning, adminOnly: true, pageKey: PAGE_KEYS.ADMIN_LOGS },
];

export function Sidebar() {
  const location = useLocation();
  const { user, isAdmin, signOut, canAccessPage, userProfile } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Filtrar navegação baseado em permissões granulares e adminOnly
  const filteredNavigation = navigation.filter(item => {
    // Se for adminOnly e não é admin, esconder
    if (item.adminOnly && !isAdmin) return false;
    // Se não for admin, verificar permissão granular
    if (!isAdmin && !canAccessPage(item.pageKey)) return false;
    return true;
  });

  const handleSignOut = async () => {
    await signOut();
  };

  const displayName = userProfile?.full_name || user?.email || 'Usuário';

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border transition-transform md:translate-x-0 flex flex-col",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Header */}
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
          <BarChart3 className="h-6 w-6 text-sidebar-primary" />
          <span className="text-lg font-semibold text-sidebar-foreground">OddsCompare</span>
        </div>
        
        {/* Navigation */}
        <nav className="flex flex-col gap-1 p-4 flex-1">
          {filteredNavigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User Footer */}
        {user && (
          <div className="p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">
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
                className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground"
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

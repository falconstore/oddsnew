import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
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
};

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Monitor Futebol', href: '/monitor-futebol', icon: FootballIcon },
  { name: 'Monitor Basquete', href: '/monitor-basquete', icon: BasketballIcon },
  { name: 'Ligas', href: '/leagues', icon: Trophy, adminOnly: true },
  { name: 'Times', href: '/teams', icon: Users, adminOnly: true },
  { name: 'Casas de Apostas', href: '/bookmakers', icon: Building2, adminOnly: true },
  { name: 'Configurações', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const { user, isAdmin, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const filteredNavigation = navigation.filter(item => !item.adminOnly || isAdmin);

  const handleSignOut = async () => {
    await signOut();
  };

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
                  {user.email?.[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-sidebar-foreground">
                  {user.email}
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

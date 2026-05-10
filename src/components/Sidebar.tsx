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
  Zap,
  Gift,
  Receipt,
  Trophy,
  Stamp,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';

type NavigationItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  pageKey: PageKey;
  color?: string;
  alwaysVisible?: boolean;
};

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, pageKey: PAGE_KEYS.DASHBOARD, color: 'text-primary' },
  { name: 'Procedimentos', href: '/procedures', icon: FileText, pageKey: PAGE_KEYS.PROCEDURE_CONTROL, color: 'text-cyan-400' },
  { name: 'FreeBets Ganhas', href: '/procedures/freebets-ganhas', icon: Trophy, pageKey: PAGE_KEYS.PROCEDURE_CONTROL, color: 'text-emerald-400' },
  { name: 'Templates Bot', href: '/bot-templates', icon: BookOpen, pageKey: PAGE_KEYS.DASHBOARD, color: 'text-orange-400', alwaysVisible: true },
  { name: 'Betbra Affiliate', href: '/betbra', icon: TrendingUp, pageKey: PAGE_KEYS.BETBRA_AFFILIATE, color: 'text-amber-400' },
  { name: 'Assinaturas', href: '/subscriptions', icon: CreditCard, pageKey: PAGE_KEYS.SUBSCRIPTIONS, color: 'text-purple-400' },
  { name: 'Casas', href: '/cadastros', icon: Building2, pageKey: PAGE_KEYS.LEAGUES, color: 'text-indigo-400' },
  { name: 'Trial Telegram', href: '/trial-admin', icon: Gift, pageKey: PAGE_KEYS.TRIAL, color: 'text-pink-400' },
  { name: 'Pagamentos Lastlink', href: '/lastlink-admin', icon: Receipt, pageKey: PAGE_KEYS.LASTLINK, color: 'text-emerald-400' },
  { name: "Marca d'Água", href: '/watermark', icon: Stamp, pageKey: PAGE_KEYS.WATERMARK, color: 'text-green-400' },
  { name: 'Configurações', href: '/settings', icon: Settings, pageKey: PAGE_KEYS.SETTINGS, color: 'text-slate-400' },
  { name: 'Usuários', href: '/admin/users', icon: UserCog, pageKey: PAGE_KEYS.ADMIN_USERS, color: 'text-red-400' },
];

export function Sidebar() {
  const location = useLocation();
  const { user, isAdmin, isApproved, signOut, canViewPage } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { onTouchStart, onTouchMove, onTouchEnd, swipeDistance } = useSwipeGesture({
    threshold: 50,
    onSwipeLeft: () => setMobileOpen(false),
  });

  const filteredNavigation = navigation.filter(item =>
    item.alwaysVisible ? !!user : canViewPage(item.pageKey)
  );

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
        className="fixed top-3 left-3 z-50 md:hidden h-11 w-11 rounded-xl bg-card/80 dark:bg-card/60 backdrop-blur-md border border-border/50 shadow-lg"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen w-64 flex flex-col",
          "transition-transform duration-300 ease-out md:translate-x-0",
          "bg-sidebar border-r border-sidebar-border",
          "dark:bg-sidebar",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ transform: sidebarTransform }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Top gradient line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-5 border-b border-sidebar-border">
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center shadow-lg dark:glow-primary-sm">
              <Zap className="h-4.5 w-4.5 text-white" fill="white" />
            </div>
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary animate-pulse-glow" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-sidebar-foreground leading-none">BetShark</span>
            <span className="text-[10px] font-semibold tracking-widest text-primary uppercase leading-none mt-0.5">Pro</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-0.5 p-3 flex-1 overflow-y-auto">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 py-2 mb-1">
            Menu Principal
          </p>
          {filteredNavigation.map((item, i) => {
            const isActive = location.pathname === item.href ||
              (item.href !== '/' && location.pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                  "transition-all duration-200 ease-out",
                  "animate-fade-in-up",
                  isActive
                    ? "bg-primary/10 dark:bg-primary/15 text-primary dark:text-primary border border-primary/20 dark:shadow-[0_0_12px_hsl(145_80%_48%/0.15)]"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground hover:translate-x-0.5"
                )}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                {/* Active left bar */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full shadow-[0_0_8px_hsl(145_80%_48%/0.8)]" />
                )}

                <item.icon className={cn(
                  "h-4 w-4 flex-shrink-0 transition-all duration-200",
                  isActive ? "text-primary" : item.color || "text-muted-foreground/60",
                  !isActive && "group-hover:scale-110"
                )} />
                <span className="truncate">{item.name}</span>

                {/* Hover glow dot */}
                {!isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-muted-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Theme Toggle */}
        <div className="px-4 py-3 border-t border-sidebar-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground/70">Aparência</span>
            <ThemeToggle />
          </div>
        </div>

        {/* User footer */}
        {user && (
          <div className="p-3 border-t border-sidebar-border">
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-sidebar-accent/20 dark:bg-white/[0.03] border border-sidebar-border/50">
              <Avatar className="h-8 w-8 ring-2 ring-primary/30 ring-offset-1 ring-offset-sidebar flex-shrink-0">
                <AvatarFallback className="text-xs bg-gradient-to-br from-primary/20 to-emerald-500/20 text-primary font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate text-sidebar-foreground leading-tight">
                  {displayName}
                </p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  {isAdmin && <Shield className="h-2.5 w-2.5 text-primary" />}
                  {isAdmin ? 'Admin' : 'Usuário'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="h-7 w-7 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-all rounded-lg flex-shrink-0"
                title="Sair"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Bottom gradient line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      </aside>
    </>
  );
}

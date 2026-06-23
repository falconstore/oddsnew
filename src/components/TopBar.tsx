import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

// Rótulos de telemetria por rota — alimenta o breadcrumb SHK// no rail de status.
const ROUTE_LABELS: Record<string, string> = {
  '/': 'DASHBOARD',
  '/procedures': 'PROCEDIMENTOS',
  '/procedures/freebets-ganhas': 'FREEBETS_GANHAS',
  '/bot-templates': 'TEMPLATES_BOT',
  '/betbra': 'BETBRA_AFFILIATE',
  '/subscriptions': 'ASSINATURAS',
  '/cadastros': 'CASAS',
  '/trial-admin': 'TRIAL_TELEGRAM',
  '/ads-admin': 'ANUNCIOS',
  '/lastlink-admin': 'PAGAMENTOS_LASTLINK',
  '/lastlink-dashboard': 'DASHBOARD_LASTLINK',
  '/app-stats': 'ESTATISTICAS_APP',
  '/push-notifications': 'PUSH_NOTIFICATIONS',
  '/watermark': 'MARCA_DAGUA',
  '/settings': 'CONFIGURACOES',
  '/telegram-bot': 'BOT_TELEGRAM',
  '/admin/users': 'USUARIOS',
  '/admin/bot-logs': 'LOGS_DO_BOT',
};

function labelForPath(pathname: string): string {
  if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname];
  // match por prefixo (rotas com :id, sub-rotas)
  const hit = Object.keys(ROUTE_LABELS)
    .filter((p) => p !== '/' && pathname.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];
  return hit ? ROUTE_LABELS[hit] : 'ADMIN';
}

function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now.toLocaleTimeString('pt-BR', { hour12: false });
}

interface TopBarProps {
  collapsed?: boolean;
  onToggleSidebar?: () => void;
}

export function TopBar({ collapsed = false, onToggleSidebar }: TopBarProps) {
  const location = useLocation();
  const clock = useClock();
  const page = labelForPath(location.pathname);

  return (
    <header className="sticky top-0 z-30 h-11 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="h-full flex items-center justify-between px-4 md:px-6">
        {/* Breadcrumb SHK// */}
        <div className="flex items-center gap-2 min-w-0 pl-12 md:pl-0">
          {/* Toggle da sidebar (desktop) — esconde/mostra o menu lateral */}
          <button
            type="button"
            onClick={onToggleSidebar}
            title={collapsed ? 'Mostrar menu' : 'Ocultar menu'}
            aria-label={collapsed ? 'Mostrar menu lateral' : 'Ocultar menu lateral'}
            className="hidden md:flex items-center justify-center h-7 w-7 -ml-1 mr-1 text-muted-foreground/60 hover:text-foreground hover:bg-accent/50 transition-colors"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
          <span className="telemetry-label text-muted-foreground/60">SHK//</span>
          <span className="telemetry-label text-foreground truncate">{page}</span>
        </div>

        {/* Status + relógio */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <span className="hidden sm:flex items-center gap-1.5">
            <span className="status-dot" data-state="live" />
            <span className="telemetry-label text-primary">ONLINE</span>
          </span>
          <span className="telemetry-label tabular-nums text-muted-foreground">{clock}</span>
        </div>
      </div>
    </header>
  );
}

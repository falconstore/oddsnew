import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { PageTransition } from './PageTransition';
import { RequireAuth } from './RequireAuth';
import { PAGE_KEYS } from '@/types/auth';
import { useLastlinkAlerts } from '@/hooks/useLastlinkAlerts';

// Pages
import Dashboard from '@/pages/Dashboard';
import MatchDetails from '@/pages/MatchDetails';
import EntityManagement from '@/pages/EntityManagement';
import Settings from '@/pages/Settings';
import Login from '@/pages/Login';
import ResetPassword from '@/pages/ResetPassword';
import AdminUsers from '@/pages/admin/Users';
import AdminLogs from '@/pages/admin/Logs';
import ScraperStatus from '@/pages/admin/ScraperStatus';
import BotLogs from '@/pages/admin/BotLogs';
import ProcedureControl from '@/pages/ProcedureControl';
import FreebetsGanhas from '@/pages/FreebetsGanhas';
import BetbraAffiliate from '@/pages/BetbraAffiliate';
import Subscriptions from '@/pages/Subscriptions';

import TelegramBot from '@/pages/TelegramBot';
import TrialLanding from '@/pages/TrialLanding';
import TrialObrigado from '@/pages/TrialObrigado';
import TrialUpgrade from '@/pages/TrialUpgrade';
import TrialAdmin from '@/pages/TrialAdmin';
import LastlinkAdmin from '@/pages/LastlinkAdmin';
import WatermarkStudio from '@/pages/WatermarkStudio';
import BotTemplates from '@/pages/BotTemplates';
import NotFound from '@/pages/NotFound';

// Componente para redirect que preserva query params
function RedirectWithParams({ 
  to, 
  params = {} 
}: { 
  to: string; 
  params?: Record<string, string> 
}) {
  const location = useLocation();
  const currentParams = new URLSearchParams(location.search);
  
  // Merge current params with new params
  Object.entries(params).forEach(([key, value]) => {
    currentParams.set(key, value);
  });
  
  const search = currentParams.toString();
  return <Navigate to={`${to}${search ? `?${search}` : ''}`} replace />;
}

// URL pública do subdomínio do trial. Usada para CTAs e redirects do admin.
export const TRIAL_PUBLIC_URL = 'https://trial.sharkgreen.com.br';

// Detecta se estamos no subdomínio público do trial (ex.: trial.sharkgreen.com.br).
// Em produção: hostname começa com "trial.".
// Em dev/Replit: também respeita ?host=trial para conseguirmos testar localmente.
function isTrialHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  if (host.startsWith('trial.')) return true;
  const params = new URLSearchParams(window.location.search);
  if (params.get('host') === 'trial') return true;
  return false;
}

// Redireciona externamente para o subdomínio público do trial,
// preservando o path original (ex.: /trial-upgrade?lead=...).
function ExternalTrialRedirect({ path }: { path: string }) {
  const location = useLocation();
  if (typeof window !== 'undefined') {
    window.location.replace(`${TRIAL_PUBLIC_URL}${path}${location.search}`);
  }
  return null;
}

export function AnimatedRoutes() {
  const location = useLocation();
  const trialHost = isTrialHost();

  // Listener global de alertas críticos (cancel/refund/chargeback). Mantém-se
  // montado durante toda a navegação interna — só desativa no host público
  // do trial, onde o usuário não está logado no admin.
  useLastlinkAlerts({ enabled: !trialHost });

  // Subdomínio público do trial: só expõe a landing e a página de upgrade.
  // Qualquer outra rota cai na landing.
  if (trialHost) {
    return (
      <AnimatePresence mode="wait" initial={false}>
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={
            <PageTransition>
              <TrialLanding />
            </PageTransition>
          } />
          <Route path="/trial" element={<Navigate to="/" replace />} />
          <Route path="/obrigado" element={
            <PageTransition>
              <TrialObrigado />
            </PageTransition>
          } />
          <Route path="/trial-upgrade" element={
            <PageTransition>
              <TrialUpgrade />
            </PageTransition>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={
          <PageTransition>
            <Login />
          </PageTransition>
        } />
        <Route path="/reset-password" element={
          <PageTransition>
            <ResetPassword />
          </PageTransition>
        } />
        {/* /trial e /trial-upgrade no domínio do admin redirecionam para o subdomínio público */}
        <Route path="/trial" element={<ExternalTrialRedirect path="/" />} />
        <Route path="/trial-upgrade" element={<ExternalTrialRedirect path="/trial-upgrade" />} />
        
        {/* Protected routes with granular permissions */}
        <Route path="/" element={
          <RequireAuth pageKey={PAGE_KEYS.DASHBOARD}>
            <PageTransition>
              <Dashboard />
            </PageTransition>
          </RequireAuth>
        } />
        <Route path="/match/:matchId" element={
          <RequireAuth>
            <PageTransition>
              <MatchDetails />
            </PageTransition>
          </RequireAuth>
        } />
        <Route path="/settings" element={
          <RequireAuth pageKey={PAGE_KEYS.SETTINGS}>
            <PageTransition>
              <Settings />
            </PageTransition>
          </RequireAuth>
        } />
        
        {/* Unified entity management page with tabs */}
        <Route path="/cadastros" element={
          <RequireAuth pageKey={PAGE_KEYS.LEAGUES}>
            <PageTransition>
              <EntityManagement />
            </PageTransition>
          </RequireAuth>
        } />
        <Route path="/admin/users" element={
          <RequireAuth pageKey={PAGE_KEYS.ADMIN_USERS}>
            <PageTransition>
              <AdminUsers />
            </PageTransition>
          </RequireAuth>
        } />
        <Route path="/admin/logs" element={
          <RequireAuth pageKey={PAGE_KEYS.ADMIN_LOGS}>
            <PageTransition>
              <AdminLogs />
            </PageTransition>
          </RequireAuth>
        } />
        <Route path="/admin/scraper-status" element={
          <RequireAuth pageKey={PAGE_KEYS.SCRAPER_STATUS}>
            <PageTransition>
              <ScraperStatus />
            </PageTransition>
          </RequireAuth>
        } />
        <Route path="/procedures" element={
          <RequireAuth pageKey={PAGE_KEYS.PROCEDURE_CONTROL}>
            <PageTransition>
              <ProcedureControl />
            </PageTransition>
          </RequireAuth>
        } />
        <Route path="/procedures/freebets-ganhas" element={
          <RequireAuth pageKey={PAGE_KEYS.PROCEDURE_CONTROL}>
            <PageTransition>
              <FreebetsGanhas />
            </PageTransition>
          </RequireAuth>
        } />
        <Route path="/betbra" element={
          <RequireAuth pageKey={PAGE_KEYS.BETBRA_AFFILIATE}>
            <PageTransition>
              <BetbraAffiliate />
            </PageTransition>
          </RequireAuth>
        } />
        <Route path="/subscriptions" element={
          <RequireAuth pageKey={PAGE_KEYS.SUBSCRIPTIONS}>
            <PageTransition>
              <Subscriptions />
            </PageTransition>
          </RequireAuth>
        } />
        <Route path="/telegram-bot" element={
          <RequireAuth pageKey={PAGE_KEYS.TELEGRAM_BOT}>
            <PageTransition>
              <TelegramBot />
            </PageTransition>
          </RequireAuth>
        } />
        <Route path="/trial-admin" element={
          <RequireAuth pageKey={PAGE_KEYS.TRIAL}>
            <PageTransition>
              <TrialAdmin />
            </PageTransition>
          </RequireAuth>
        } />
        <Route path="/lastlink-admin" element={
          <RequireAuth pageKey={PAGE_KEYS.LASTLINK}>
            <PageTransition>
              <LastlinkAdmin />
            </PageTransition>
          </RequireAuth>
        } />
        <Route path="/watermark" element={
          <RequireAuth pageKey={PAGE_KEYS.WATERMARK}>
            <PageTransition>
              <WatermarkStudio />
            </PageTransition>
          </RequireAuth>
        } />
        <Route path="/bot-templates" element={
          <RequireAuth pageKey={PAGE_KEYS.DASHBOARD}>
            <PageTransition>
              <BotTemplates />
            </PageTransition>
          </RequireAuth>
        } />
        <Route path="/admin/bot-logs" element={
          <RequireAuth pageKey={PAGE_KEYS.ADMIN_USERS}>
            <PageTransition>
              <BotLogs />
            </PageTransition>
          </RequireAuth>
        } />
        
        {/* Legacy route redirects for backward compatibility - preserves query params */}
        <Route path="/teams" element={<RedirectWithParams to="/cadastros" params={{ tab: 'teams' }} />} />
        <Route path="/leagues" element={<RedirectWithParams to="/cadastros" params={{ tab: 'leagues' }} />} />
        <Route path="/bookmakers" element={<RedirectWithParams to="/cadastros" params={{ tab: 'bookmakers' }} />} />
        
        <Route path="*" element={
          <PageTransition>
            <NotFound />
          </PageTransition>
        } />
      </Routes>
    </AnimatePresence>
  );
}

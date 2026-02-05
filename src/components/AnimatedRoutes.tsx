import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { PageTransition } from './PageTransition';
import { RequireAuth } from './RequireAuth';
import { PAGE_KEYS } from '@/types/auth';

// Pages
import Dashboard from '@/pages/Dashboard';
import MonitorFutebol from '@/pages/MonitorFutebol';
import MonitorBasquete from '@/pages/MonitorBasquete';
import MatchDetails from '@/pages/MatchDetails';
import EntityManagement from '@/pages/EntityManagement';
import Settings from '@/pages/Settings';
import Login from '@/pages/Login';
import AdminUsers from '@/pages/admin/Users';
import AdminLogs from '@/pages/admin/Logs';
import ScraperStatus from '@/pages/admin/ScraperStatus';
import ProcedureControl from '@/pages/ProcedureControl';
import BetbraAffiliate from '@/pages/BetbraAffiliate';
import Subscriptions from '@/pages/Subscriptions';
import FreebetExtraction from '@/pages/FreebetExtraction';
import TelegramBot from '@/pages/TelegramBot';
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

export function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="popLayout">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={
          <PageTransition>
            <Login />
          </PageTransition>
        } />
        
        {/* Protected routes with granular permissions */}
        <Route path="/" element={
          <RequireAuth pageKey={PAGE_KEYS.DASHBOARD}>
            <PageTransition>
              <Dashboard />
            </PageTransition>
          </RequireAuth>
        } />
        <Route path="/monitor-futebol" element={
          <RequireAuth pageKey={PAGE_KEYS.MONITOR_FUTEBOL}>
            <PageTransition>
              <MonitorFutebol />
            </PageTransition>
          </RequireAuth>
        } />
        <Route path="/monitor-basquete" element={
          <RequireAuth pageKey={PAGE_KEYS.MONITOR_BASQUETE}>
            <PageTransition>
              <MonitorBasquete />
            </PageTransition>
          </RequireAuth>
        } />
        <Route path="/freebet" element={
          <RequireAuth pageKey={PAGE_KEYS.FREEBET_EXTRACTION}>
            <PageTransition>
              <FreebetExtraction />
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

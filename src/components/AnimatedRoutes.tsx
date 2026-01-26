import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { PageTransition } from './PageTransition';
import { RequireAuth } from './RequireAuth';
import { PAGE_KEYS } from '@/types/auth';

// Pages
import Dashboard from '@/pages/Dashboard';
import MonitorFutebol from '@/pages/MonitorFutebol';
import MonitorBasquete from '@/pages/MonitorBasquete';
import MatchDetails from '@/pages/MatchDetails';
import Leagues from '@/pages/Leagues';
import Teams from '@/pages/Teams';
import Bookmakers from '@/pages/Bookmakers';
import Settings from '@/pages/Settings';
import Login from '@/pages/Login';
import AdminUsers from '@/pages/admin/Users';
import AdminLogs from '@/pages/admin/Logs';
import ProcedureControl from '@/pages/ProcedureControl';
import BetbraAffiliate from '@/pages/BetbraAffiliate';
import Subscriptions from '@/pages/Subscriptions';
import NotFound from '@/pages/NotFound';

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
        
        {/* All pages now use granular permissions instead of requireAdmin */}
        <Route path="/leagues" element={
          <RequireAuth pageKey={PAGE_KEYS.LEAGUES}>
            <PageTransition>
              <Leagues />
            </PageTransition>
          </RequireAuth>
        } />
        <Route path="/teams" element={
          <RequireAuth pageKey={PAGE_KEYS.TEAMS}>
            <PageTransition>
              <Teams />
            </PageTransition>
          </RequireAuth>
        } />
        <Route path="/bookmakers" element={
          <RequireAuth pageKey={PAGE_KEYS.BOOKMAKERS}>
            <PageTransition>
              <Bookmakers />
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
        
        <Route path="*" element={
          <PageTransition>
            <NotFound />
          </PageTransition>
        } />
      </Routes>
    </AnimatePresence>
  );
}

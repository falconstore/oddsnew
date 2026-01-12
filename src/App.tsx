import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { RequireAuth } from "@/components/RequireAuth";
import { PAGE_KEYS } from "@/types/auth";
import Dashboard from "./pages/Dashboard";
import MonitorFutebol from "./pages/MonitorFutebol";
import MonitorBasquete from "./pages/MonitorBasquete";
import MatchDetails from "./pages/MatchDetails";
import Leagues from "./pages/Leagues";
import Teams from "./pages/Teams";
import Bookmakers from "./pages/Bookmakers";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import AdminUsers from "./pages/admin/Users";
import AdminLogs from "./pages/admin/Logs";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* Rotas protegidas - com permissões granulares */}
            <Route path="/" element={
              <RequireAuth pageKey={PAGE_KEYS.DASHBOARD}>
                <Dashboard />
              </RequireAuth>
            } />
            <Route path="/monitor-futebol" element={
              <RequireAuth pageKey={PAGE_KEYS.MONITOR_FUTEBOL}>
                <MonitorFutebol />
              </RequireAuth>
            } />
            <Route path="/monitor-basquete" element={
              <RequireAuth pageKey={PAGE_KEYS.MONITOR_BASQUETE}>
                <MonitorBasquete />
              </RequireAuth>
            } />
            <Route path="/match/:matchId" element={
              <RequireAuth>
                <MatchDetails />
              </RequireAuth>
            } />
            <Route path="/settings" element={
              <RequireAuth pageKey={PAGE_KEYS.SETTINGS}>
                <Settings />
              </RequireAuth>
            } />
            
            {/* Rotas protegidas - apenas admin */}
            <Route path="/leagues" element={
              <RequireAuth requireAdmin pageKey={PAGE_KEYS.LEAGUES}>
                <Leagues />
              </RequireAuth>
            } />
            <Route path="/teams" element={
              <RequireAuth requireAdmin pageKey={PAGE_KEYS.TEAMS}>
                <Teams />
              </RequireAuth>
            } />
            <Route path="/bookmakers" element={
              <RequireAuth requireAdmin pageKey={PAGE_KEYS.BOOKMAKERS}>
                <Bookmakers />
              </RequireAuth>
            } />
            <Route path="/admin/users" element={
              <RequireAuth requireAdmin pageKey={PAGE_KEYS.ADMIN_USERS}>
                <AdminUsers />
              </RequireAuth>
            } />
            <Route path="/admin/logs" element={
              <RequireAuth requireAdmin pageKey={PAGE_KEYS.ADMIN_LOGS}>
                <AdminLogs />
              </RequireAuth>
            } />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

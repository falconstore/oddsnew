import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AnimatedRoutes } from "@/components/AnimatedRoutes";
import { UpdateBanner } from "@/components/UpdateBanner";
import { ThemeProvider } from "next-themes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 segundos antes de considerar stale
      gcTime: 5 * 60 * 1000, // 5 minutos no garbage collection
      retry: 2,
      refetchOnWindowFocus: false, // Evita reset ao trocar de aba
      refetchOnReconnect: true,
      // NOTE: placeholderData NÃO é default global — versões anteriores tentaram
      // isso e quebraram filtros client-side de forma sutil. Hooks de listas
      // grandes (useTrialLeads, useLastlinkPayments, useLastlinkEvents) ativam
      // `placeholderData: (prev) => prev` localmente pra evitar o "pisca" no
      // refetch sem afetar queries pequenas.
    },
  },
});

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <UpdateBanner />
          <BrowserRouter>
            <AnimatedRoutes />
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;

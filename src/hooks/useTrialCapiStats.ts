import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface TrialCapiEvent {
  id: string;
  lead_id: string | null;
  event_name: string;
  event_id: string | null;
  source: string | null;
  status: 'success' | 'error';
  http_status: number | null;
  fb_trace_id: string | null;
  error_message: string | null;
  created_at: string;
}

export interface TrialCapiStats {
  total: number;
  success: number;
  errors: number;
  successRate: number;
  byEventName: Record<string, { success: number; errors: number }>;
  lastError: TrialCapiEvent | null;
}

// Métricas de envio Conversions API (server-side) das últimas 24h.
// Usado pelo painel /trial-admin pra detectar quando o token da Meta
// caiu, quota estourou ou o token está faltando.
export const useTrialCapiStats = () => {
  return useQuery({
    queryKey: ['trial_capi_stats', '24h'],
    queryFn: async (): Promise<TrialCapiStats> => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Conta exata via head:true (sem trazer linhas) garante que totais não
      // ficam capados pelo limite de paginação do supabase-js.
      const totalsQ = supabase
        .from('trial_capi_events')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since);
      const successQ = supabase
        .from('trial_capi_events')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since)
        .eq('status', 'success');
      const errorsQ = supabase
        .from('trial_capi_events')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since)
        .eq('status', 'error');
      // Lista detalhada (até 10k) só pra montar breakdown por event_name e
      // pegar último erro. Para 24h de tráfego do trial isso é mais que
      // suficiente; os totais já vêm dos counts acima de qualquer jeito.
      const detailsQ = supabase
        .from('trial_capi_events')
        .select('id, lead_id, event_name, event_id, source, status, http_status, fb_trace_id, error_message, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(10000);

      const [totalsRes, successRes, errorsRes, detailsRes] =
        await Promise.all([totalsQ, successQ, errorsQ, detailsQ]);
      if (totalsRes.error) throw totalsRes.error;
      if (successRes.error) throw successRes.error;
      if (errorsRes.error) throw errorsRes.error;
      if (detailsRes.error) throw detailsRes.error;

      const events = (detailsRes.data ?? []) as TrialCapiEvent[];
      const byEventName: Record<string, { success: number; errors: number }> = {};
      let lastError: TrialCapiEvent | null = null;

      for (const e of events) {
        const bucket = byEventName[e.event_name] ?? { success: 0, errors: 0 };
        if (e.status === 'success') bucket.success++;
        else {
          bucket.errors++;
          if (!lastError) lastError = e;
        }
        byEventName[e.event_name] = bucket;
      }

      const total = totalsRes.count ?? 0;
      const success = successRes.count ?? 0;
      const errors = errorsRes.count ?? 0;
      const successRate = total > 0 ? (success / total) * 100 : 0;

      return { total, success, errors, successRate, byEventName, lastError };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
};

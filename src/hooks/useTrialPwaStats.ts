import { useQuery } from '@tanstack/react-query';
import { supabaseProcedures } from '@/lib/supabaseProcedures';

export type PwaLeadStats = {
  pushLeadIds: Set<string>; // leads com push subscription ativa
  appLeadIds: Set<string>;  // leads que já abriram o app (pwa_events)
};

export const useTrialPwaStats = () => {
  return useQuery<PwaLeadStats>({
    queryKey: ['trial_pwa_stats'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [pushRes, eventsRes] = await Promise.all([
        supabaseProcedures
          .from('push_subscriptions')
          .select('lead_id')
          .not('lead_id', 'is', null),
        supabaseProcedures
          .from('pwa_events')
          .select('lead_id')
          .not('lead_id', 'is', null),
      ]);
      const pushLeadIds = new Set<string>(
        (pushRes.data ?? []).map((r: any) => r.lead_id as string).filter(Boolean)
      );
      const appLeadIds = new Set<string>(
        (eventsRes.data ?? []).map((r: any) => r.lead_id as string).filter(Boolean)
      );
      return { pushLeadIds, appLeadIds };
    },
  });
};

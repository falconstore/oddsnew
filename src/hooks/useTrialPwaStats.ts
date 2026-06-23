import { useQuery } from '@tanstack/react-query';
import { supabaseProcedures } from '@/lib/supabaseProcedures';
import { differenceInHours, differenceInDays } from 'date-fns';

export type ActivityLevel = 'today' | 'recent' | 'sleeping' | 'inactive' | 'gone' | 'never';

export type ActivityInfo = {
  level: ActivityLevel;
  label: string;
  sublabel: string;
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
};

export type PwaLeadStats = {
  pushLeadIds: Set<string>;
  appLeadIds: Set<string>;
  lastSeenMap: Map<string, string>;    // lead_id → ISO timestamp of last event
  sessionCountMap: Map<string, number>; // lead_id → # unique sessions
};

export function getActivityInfo(lastSeenIso: string | undefined): ActivityInfo {
  if (!lastSeenIso) {
    return {
      level: 'never',
      label: 'Nunca abriu',
      sublabel: 'Sem acesso ao app',
      color: 'text-muted-foreground',
      bgClass: 'bg-muted',
      textClass: 'text-muted-foreground',
      borderClass: 'border-border',
    };
  }

  const now = new Date();
  const lastSeen = new Date(lastSeenIso);
  const hours = differenceInHours(now, lastSeen);
  const days = differenceInDays(now, lastSeen);

  if (hours < 24) {
    return {
      level: 'today',
      label: 'Ativo hoje',
      sublabel: hours < 1 ? 'Há menos de 1h' : `Há ${hours}h`,
      color: 'text-primary',
      bgClass: 'bg-primary/15',
      textClass: 'text-primary',
      borderClass: 'border-primary/30',
    };
  }
  if (days <= 3) {
    return {
      level: 'recent',
      label: `Ativo ${days}d atrás`,
      sublabel: 'Uso recente',
      color: 'text-muted-foreground',
      bgClass: 'bg-muted',
      textClass: 'text-muted-foreground',
      borderClass: 'border-border',
    };
  }
  if (days <= 7) {
    return {
      level: 'sleeping',
      label: `Dormindo ${days}d`,
      sublabel: 'Sem acesso recente',
      color: 'text-warning',
      bgClass: 'bg-warning/15',
      textClass: 'text-warning',
      borderClass: 'border-warning/30',
    };
  }
  if (days <= 14) {
    return {
      level: 'inactive',
      label: `Inativo ${days}d`,
      sublabel: 'Precisa de reativação',
      color: 'text-warning',
      bgClass: 'bg-warning/15',
      textClass: 'text-warning',
      borderClass: 'border-warning/30',
    };
  }
  return {
    level: 'gone',
    label: `Sumiu ${days}d`,
    sublabel: 'Abandono',
    color: 'text-destructive',
    bgClass: 'bg-destructive/15',
    textClass: 'text-destructive',
    borderClass: 'border-destructive/30',
  };
}

export const useTrialPwaStats = () => {
  return useQuery<PwaLeadStats>({
    queryKey: ['trial_pwa_stats'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const since30d = new Date(Date.now() - 90 * 24 * 3600_000).toISOString();

      const [pushRes, eventsRes] = await Promise.all([
        supabaseProcedures
          .from('push_subscriptions')
          .select('lead_id')
          .not('lead_id', 'is', null),
        supabaseProcedures
          .from('pwa_events')
          .select('lead_id, created_at, session_id')
          .not('lead_id', 'is', null)
          .gte('created_at', since30d)
          .order('created_at', { ascending: false }),
      ]);

      const pushLeadIds = new Set<string>(
        (pushRes.data ?? []).map((r: any) => r.lead_id as string).filter(Boolean)
      );

      // Build lastSeenMap and sessionCountMap from events
      const lastSeenMap = new Map<string, string>();
      const sessionSetMap = new Map<string, Set<string>>();

      for (const row of (eventsRes.data ?? []) as any[]) {
        const lid = row.lead_id as string;
        if (!lid) continue;

        // last_seen: events are ordered newest first, so first occurrence per lead = most recent
        if (!lastSeenMap.has(lid)) {
          lastSeenMap.set(lid, row.created_at as string);
        }

        // session count
        if (!sessionSetMap.has(lid)) sessionSetMap.set(lid, new Set());
        if (row.session_id) sessionSetMap.get(lid)!.add(row.session_id as string);
      }

      const sessionCountMap = new Map<string, number>();
      for (const [lid, sessions] of sessionSetMap) {
        sessionCountMap.set(lid, sessions.size);
      }

      const appLeadIds = new Set<string>(lastSeenMap.keys());

      return { pushLeadIds, appLeadIds, lastSeenMap, sessionCountMap };
    },
  });
};

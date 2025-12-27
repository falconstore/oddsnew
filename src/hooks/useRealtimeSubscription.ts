import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

type PostgresEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseRealtimeSubscriptionOptions {
  tableName: string;
  queryKeys: string[][];
  event?: PostgresEvent;
  enabled?: boolean;
}

export const useRealtimeSubscription = ({
  tableName,
  queryKeys,
  event = '*',
  enabled = true
}: UseRealtimeSubscriptionOptions) => {
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabase>['channel']> | null>(null);

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured()) return;

    const supabase = getSupabase();
    if (!supabase) return;

    // Create unique channel name
    const channelName = `realtime-${tableName}-${event}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as any,
        {
          event,
          schema: 'public',
          table: tableName
        },
        (payload: any) => {
          console.log(`[Realtime] ${tableName} ${payload.eventType}:`, payload);
          // Invalidate all related queries
          queryKeys.forEach(key => {
            queryClient.invalidateQueries({ queryKey: key });
          });
        }
      )
      .subscribe((status: string) => {
        console.log(`[Realtime] ${tableName} subscription status:`, status);
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [tableName, event, enabled, queryClient, JSON.stringify(queryKeys)]);
};

// Hook to subscribe to odds_history changes
export const useOddsRealtimeSubscription = () => {
  useRealtimeSubscription({
    tableName: 'odds_history',
    queryKeys: [['odds_comparison']],
    event: 'INSERT'
  });
};

// Hook to subscribe to alerts changes
export const useAlertsRealtimeSubscription = () => {
  useRealtimeSubscription({
    tableName: 'alerts',
    queryKeys: [['alerts']],
    event: 'INSERT'
  });
};

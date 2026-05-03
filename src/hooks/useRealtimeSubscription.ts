import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

type PostgresEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseRealtimeSubscriptionOptions {
  tableName: string;
  queryKeys: string[][];
  event?: PostgresEvent;
  enabled?: boolean;
  /** Debounce em ms pra coalescer rajadas de eventos (ex: webhook processando lote). Default: 400ms. */
  debounceMs?: number;
}

export const useRealtimeSubscription = ({
  tableName,
  queryKeys,
  event = '*',
  enabled = true,
  debounceMs = 400,
}: UseRealtimeSubscriptionOptions) => {
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabase>['channel']> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingWhileHiddenRef = useRef(false);

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured()) return;

    const supabase = getSupabase();
    if (!supabase) return;

    const channelName = `realtime-${tableName}-${event}`;

    // Coalesce: vários eventos próximos viram UMA única invalidação.
    // Sem isso, um burst (cron, webhook em lote, admin editando 10 linhas) dispara
    // N refetches simultâneos e cada cliente conectado pisca várias vezes seguidas.
    const flush = () => {
      timerRef.current = null;
      // Se a aba está escondida (usuário tirando print, em outra tab),
      // adiamos o refetch pra quando ela voltar — evita o "pisca" que
      // aparece logo após capturar a tela.
      if (typeof document !== 'undefined' && document.hidden) {
        pendingWhileHiddenRef.current = true;
        return;
      }
      queryKeys.forEach(key => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    };

    const onVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      if (!document.hidden && pendingWhileHiddenRef.current) {
        pendingWhileHiddenRef.current = false;
        queryKeys.forEach(key => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as any,
        {
          event,
          schema: 'public',
          table: tableName,
        },
        (payload: any) => {
          console.log(`[Realtime] ${tableName} ${payload.eventType}`);
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(flush, debounceMs);
        },
      )
      .subscribe((status: string) => {
        console.log(`[Realtime] ${tableName} subscription status:`, status);
      });

    channelRef.current = channel;

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [tableName, event, enabled, debounceMs, queryClient, JSON.stringify(queryKeys)]);
};

// Hook to subscribe to odds_history changes
export const useOddsRealtimeSubscription = () => {
  useRealtimeSubscription({
    tableName: 'odds_history',
    queryKeys: [['odds_comparison']],
    event: 'INSERT',
  });
};

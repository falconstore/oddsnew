import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseProcedures, isProceduresSupabaseConfigured } from '@/lib/supabaseProcedures';
import { BetbraEntry } from '@/types/betbra';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const BETBRA_KEY = ['betbra-affiliate'];

// Fetch all betbra entries
export function useBetbraData() {
  return useQuery({
    queryKey: BETBRA_KEY,
    queryFn: async (): Promise<BetbraEntry[]> => {
      if (!isProceduresSupabaseConfigured()) {
        console.warn('Procedures Supabase not configured');
        return [];
      }

      const { data, error } = await supabaseProcedures
        .from('betbra_affiliate_data')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching betbra data:', error);
        throw error;
      }

      return (data || []) as BetbraEntry[];
    },
    staleTime: 60000,
    refetchInterval: 120000,
    refetchIntervalInBackground: false,
    enabled: isProceduresSupabaseConfigured(),
    placeholderData: (prev) => prev,
  });
}

// Pre-check: calls betbra-scraper with action="check" to verify cookie is configured.
// Returns { cookie_configured: boolean }. Runs once on mount, stale for 5 min.
export function useBetbraScraperCheck() {
  return useQuery({
    queryKey: ['betbra-scraper-check'],
    queryFn: async (): Promise<{ cookie_configured: boolean }> => {
      if (!isProceduresSupabaseConfigured()) return { cookie_configured: false };
      const { data, error } = await supabaseProcedures.functions.invoke('betbra-scraper', {
        body: { action: 'check' },
      });
      if (error) return { cookie_configured: false };
      return { cookie_configured: Boolean(data?.cookie_configured) };
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: isProceduresSupabaseConfigured(),
  });
}

// Create a new betbra entry
export function useCreateBetbraEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entry: Omit<BetbraEntry, 'id' | 'created_date' | 'updated_date'>) => {
      if (!isProceduresSupabaseConfigured()) {
        throw new Error('Procedures Supabase not configured');
      }

      const { data, error } = await supabaseProcedures
        .from('betbra_affiliate_data')
        .insert([entry])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BETBRA_KEY });
      toast({
        title: 'Sucesso',
        description: 'Registro criado com sucesso!',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: `Erro ao criar registro: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

// Update an existing betbra entry
export function useUpdateBetbraEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BetbraEntry> & { id: string }) => {
      if (!isProceduresSupabaseConfigured()) {
        throw new Error('Procedures Supabase not configured');
      }

      const { data, error } = await supabaseProcedures
        .from('betbra_affiliate_data')
        .update({ ...updates, updated_date: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BETBRA_KEY });
      toast({
        title: 'Sucesso',
        description: 'Registro atualizado com sucesso!',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: `Erro ao atualizar registro: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

// Delete a betbra entry
export function useDeleteBetbraEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!isProceduresSupabaseConfigured()) {
        throw new Error('Procedures Supabase not configured');
      }

      const { error } = await supabaseProcedures
        .from('betbra_affiliate_data')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BETBRA_KEY });
      toast({
        title: 'Sucesso',
        description: 'Registro removido com sucesso!',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: `Erro ao remover registro: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

// Invoke the betbra-scraper edge function for a given month
export function useRefreshBetbraScraper() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (selectedMonth: Date) => {
      if (!isProceduresSupabaseConfigured()) {
        throw new Error('Procedures Supabase não configurado');
      }

      const year = selectedMonth.getFullYear();
      const month = selectedMonth.getMonth();
      const startDate = format(new Date(year, month, 1), 'yyyy-MM-dd');
      const endDate = format(new Date(year, month + 1, 0), 'yyyy-MM-dd');

      const { data, error } = await supabaseProcedures.functions.invoke('betbra-scraper', {
        body: { start_date: startDate, end_date: endDate },
      });

      // If HTTP error, try to read the response body so we surface the real reason
      let body: any = data;
      if (error) {
        try {
          const ctxResp = (error as any)?.context;
          if (ctxResp && typeof ctxResp.json === 'function') {
            body = await ctxResp.json();
          } else if (ctxResp && typeof ctxResp.text === 'function') {
            body = JSON.parse(await ctxResp.text());
          }
        } catch {
          /* fall through with original error */
        }
        if (!body || typeof body !== 'object') {
          throw new Error(error.message);
        }
      }

      if (!body?.ok) {
        const msg = body?.error ?? error?.message ?? 'Erro desconhecido no scraper';
        throw Object.assign(new Error(msg), { cookieExpired: body?.cookie_expired === true });
      }

      return body as { ok: boolean; days_updated: number; errors: string[] };
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: BETBRA_KEY });
      queryClient.invalidateQueries({ queryKey: ['betbra-scraper-check'] });
      toast({
        title: 'Scraper concluído',
        description: `${data.days_updated} dia${data.days_updated !== 1 ? 's' : ''} atualizado${data.days_updated !== 1 ? 's' : ''} com sucesso.`,
      });
    },
    onError: (error: any) => {
      const isCookieError =
        error?.cookieExpired === true ||
        error.message.toLowerCase().includes('cookie') ||
        error.message.toLowerCase().includes('betbra_cookie');
      toast({
        title: isCookieError ? 'Cookie expirado' : 'Erro no scraper',
        description: isCookieError
          ? 'O cookie do BetBra expirou. Atualize o secret BETBRA_COOKIE no Supabase.'
          : error.message,
        variant: 'destructive',
      });
    },
  });
}

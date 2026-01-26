import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseProcedures, isProceduresSupabaseConfigured } from '@/lib/supabaseProcedures';
import { BetbraEntry } from '@/types/betbra';
import { toast } from '@/hooks/use-toast';

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
    staleTime: 5000,
    refetchInterval: 10000,
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

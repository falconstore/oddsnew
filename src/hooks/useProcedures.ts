import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseProcedures, isProceduresSupabaseConfigured } from '@/lib/supabaseProcedures';
import { Procedure } from '@/types/procedures';
import { toast } from '@/hooks/use-toast';

const PROCEDURES_KEY = ['procedures'];

// Fetch all procedures
export function useProcedures() {
  return useQuery({
    queryKey: PROCEDURES_KEY,
    queryFn: async (): Promise<Procedure[]> => {
      if (!isProceduresSupabaseConfigured()) {
        console.warn('Procedures Supabase not configured');
        return [];
      }

      const { data, error } = await supabaseProcedures
        .from('procedures')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching procedures:', error);
        throw error;
      }

      return (data || []) as Procedure[];
    },
    staleTime: 5000,
    refetchInterval: 10000,
    enabled: isProceduresSupabaseConfigured(),
  });
}

// Create a new procedure
export function useCreateProcedure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (procedure: Omit<Procedure, 'id' | 'created_date' | 'updated_date'>) => {
      if (!isProceduresSupabaseConfigured()) {
        throw new Error('Procedures Supabase not configured');
      }

      const { data, error } = await supabaseProcedures
        .from('procedures')
        .insert([procedure])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROCEDURES_KEY });
      toast({
        title: 'Sucesso',
        description: 'Procedimento criado com sucesso!',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: `Erro ao criar procedimento: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

// Update an existing procedure
export function useUpdateProcedure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Procedure> & { id: string }) => {
      if (!isProceduresSupabaseConfigured()) {
        throw new Error('Procedures Supabase not configured');
      }

      const { data, error } = await supabaseProcedures
        .from('procedures')
        .update({ ...updates, updated_date: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROCEDURES_KEY });
      toast({
        title: 'Sucesso',
        description: 'Procedimento atualizado com sucesso!',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: `Erro ao atualizar procedimento: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

// Delete a procedure
export function useDeleteProcedure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!isProceduresSupabaseConfigured()) {
        throw new Error('Procedures Supabase not configured');
      }

      const { error } = await supabaseProcedures
        .from('procedures')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROCEDURES_KEY });
      toast({
        title: 'Sucesso',
        description: 'Procedimento removido com sucesso!',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: `Erro ao remover procedimento: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

// Toggle favorite
export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_favorite }: { id: string; is_favorite: boolean }) => {
      if (!isProceduresSupabaseConfigured()) {
        throw new Error('Procedures Supabase not configured');
      }

      const { data, error } = await supabaseProcedures
        .from('procedures')
        .update({ is_favorite, updated_date: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROCEDURES_KEY });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: `Erro ao atualizar favorito: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

// Bulk create procedures (for CSV import)
export function useBulkCreateProcedures() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (procedures: Omit<Procedure, 'id' | 'created_date' | 'updated_date'>[]) => {
      if (!isProceduresSupabaseConfigured()) {
        throw new Error('Procedures Supabase not configured');
      }

      const { data, error } = await supabaseProcedures
        .from('procedures')
        .insert(procedures)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: PROCEDURES_KEY });
      toast({
        title: 'Sucesso',
        description: `${data?.length || 0} procedimentos importados com sucesso!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: `Erro ao importar procedimentos: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

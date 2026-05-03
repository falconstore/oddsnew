import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseProcedures, isProceduresSupabaseConfigured } from '@/lib/supabaseProcedures';
import { Procedure, FreebetCreditada } from '@/types/procedures';
import { toast } from '@/hooks/use-toast';
import { syncProcedureBestEffort } from '@/lib/freebetproSync';

const PROCEDURES_KEY = ['procedures'];

// Fetch all procedures (incluindo arquivados — o filtro "showArchived" mora na UI)
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
    staleTime: 60000,
    refetchInterval: 120000,
    refetchIntervalInBackground: false,
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: PROCEDURES_KEY });
      // §8.5 — sync best-effort com FreeBet Pro
      if (data?.id) syncProcedureBestEffort(data.id, 'upsert');
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: PROCEDURES_KEY });
      // §8.5 — sync best-effort com FreeBet Pro
      if (data?.id) syncProcedureBestEffort(data.id, 'upsert');
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

// Delete a procedure (hard delete — separado do arquivar)
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

// Archive / Unarchive (soft delete — paridade com §8.5 do FreeBet Pro)
export function useArchiveProcedure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      if (!isProceduresSupabaseConfigured()) {
        throw new Error('Procedures Supabase not configured');
      }

      const { data, error } = await supabaseProcedures
        .from('procedures')
        .update({
          archived,
          archived_at: archived ? new Date().toISOString() : null,
          updated_date: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: PROCEDURES_KEY });
      // §8.5 — sync best-effort com FreeBet Pro (archive/unarchive)
      if (data?.id) syncProcedureBestEffort(data.id, 'archive');
      toast({
        title: variables.archived ? 'Procedimento arquivado' : 'Procedimento restaurado',
        description: variables.archived
          ? 'Você pode ver os arquivados ativando "Mostrar arquivados" nos filtros.'
          : 'O procedimento voltou pra lista ativa.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: `Erro ao arquivar procedimento: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

// Definir resultados pós-jogo (paridade com §8.4 do FreeBet Pro)
// Auto-decide status_operacao:
//   - LUCRO_DIRETO  se freebet_valor_previsto = 0/null OU freebet_creditada = 'NAO'
//   - FALTA_GIRAR_FB se freebet_valor_previsto > 0 E freebet_creditada = 'SIM'
export function useSetProcedureResult() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      freebet_valor_previsto: number | null;
      resultado_lucro: number;
      resultado_freebet_ganha: number | null;
      freebet_creditada: FreebetCreditada | null;
      resultado_observacao: string | null;
    }) => {
      if (!isProceduresSupabaseConfigured()) {
        throw new Error('Procedures Supabase not configured');
      }

      const hasFreebet = (input.freebet_valor_previsto ?? 0) > 0;
      const auto_status = hasFreebet && input.freebet_creditada === 'SIM'
        ? 'Falta Girar Freebet'
        : 'Lucro Direto';

      const { data, error } = await supabaseProcedures
        .from('procedures')
        .update({
          resultado_lucro: input.resultado_lucro,
          resultado_freebet_ganha: input.resultado_freebet_ganha,
          freebet_creditada: input.freebet_creditada,
          resultado_observacao: input.resultado_observacao,
          // Espelha pra profit_loss pra preservar gráficos/KPIs legados
          profit_loss: input.resultado_lucro,
          status: auto_status,
          updated_date: new Date().toISOString(),
        })
        .eq('id', input.id)
        .select()
        .single();

      if (error) throw error;
      return { data, auto_status };
    },
    onSuccess: ({ data, auto_status }) => {
      queryClient.invalidateQueries({ queryKey: PROCEDURES_KEY });
      // §8.5 — sync best-effort com FreeBet Pro (resultado)
      if (data?.id) syncProcedureBestEffort(data.id, 'result');
      toast({
        title: 'Resultado registrado',
        description: `Status atualizado pra "${auto_status}".`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: `Erro ao registrar resultado: ${error.message}`,
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

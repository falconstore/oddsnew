import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseProcedures } from '@/lib/supabaseProcedures';
import type { Bookmaker } from '@/types/database';
import { toast } from '@/hooks/use-toast';

// =====================================================
// BOOKMAKERS (casas de apostas / plataformas)
// Extraído de useOddsData.ts ao remover o sistema legado de odds.
// A tabela `bookmakers` continua viva pois é usada pelos PROCEDIMENTOS
// (dropdown de plataforma no ProcedureModal, autocomplete no BotTemplates,
// e CRUD em EntityManagement).
// =====================================================

export const useBookmakers = () => {
  return useQuery({
    queryKey: ['bookmakers'],
    queryFn: async () => {
      const { data, error } = await supabaseProcedures
        .from('bookmakers')
        .select('*')
        .order('priority');
      if (error) throw error;
      return data as Bookmaker[];
    },
    staleTime: 30000,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });
};

export const useCreateBookmaker = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bookmaker: Partial<Bookmaker>) => {
      const { data, error } = await supabaseProcedures.from('bookmakers').insert(bookmaker).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmakers'] });
      toast({ title: 'Casa de apostas criada!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar', description: error.message, variant: 'destructive' });
    }
  });
};

export const useUpdateBookmaker = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...bookmaker }: Partial<Bookmaker> & { id: string }) => {
      const { data, error } = await supabaseProcedures.from('bookmakers').update(bookmaker).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmakers'] });
      toast({ title: 'Atualizado!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    }
  });
};

export const useDeleteBookmaker = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseProcedures.from('bookmakers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmakers'] });
      toast({ title: 'Removido!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    }
  });
};

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
        .order('date', { ascending: false })
        .limit(10000);

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
    // Mantém a lista estável durante refetches — evita o "pisca" do skeleton.
    placeholderData: (prev) => prev,
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

      // Sinaliza ao FreeBet Pro ANTES de deletar localmente — a edge function
      // precisa da row no banco pra buscar o external_id e chamar /arquivar.
      syncProcedureBestEffort(id, 'delete');

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
      resultado_lucro: number | null;
      resultado_freebet_ganha: number | null;
      freebet_creditada: FreebetCreditada | null;
      resultado_observacao: string | null;
      duplo_green_confirmado?: boolean;
      duplo_green_lucro?: number | null;
    }) => {
      if (!isProceduresSupabaseConfigured()) {
        throw new Error('Procedures Supabase not configured');
      }

      // Paridade doc 06 §3 — freebet_creditada é AUTO baseado no valor da FB ganha:
      // SIM se valor > 0, NAO se = 0/null. Mas se o caller já mandou explícito, respeita.
      const fbValor = input.resultado_freebet_ganha ?? 0;
      const fbCreditadaAuto: FreebetCreditada | null =
        input.freebet_creditada !== undefined && input.freebet_creditada !== null
          ? input.freebet_creditada
          : fbValor > 0
            ? 'SIM'
            : 'NAO';

      const hasFB = fbValor > 0;
      const auto_status = hasFB && fbCreditadaAuto === 'SIM'
        ? 'Falta Girar Freebet'
        : 'Lucro Direto';

      const updatePayload: Record<string, unknown> = {
        resultado_lucro: input.resultado_lucro,
        resultado_freebet_ganha: input.resultado_freebet_ganha,
        freebet_creditada: fbCreditadaAuto,
        resultado_observacao: input.resultado_observacao,
        // Espelha pra profit_loss pra preservar gráficos/KPIs legados
        profit_loss: input.resultado_lucro ?? 0,
        status: auto_status,
        updated_date: new Date().toISOString(),
      };
      if (input.duplo_green_confirmado !== undefined) {
        updatePayload.duplo_green_confirmado = input.duplo_green_confirmado;
        updatePayload.duplo_green_lucro = input.duplo_green_lucro ?? null;
      }

      const { data, error } = await supabaseProcedures
        .from('procedures')
        .update(updatePayload)
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

// Toggle Tachado (paridade FreeBet PRO doc 05 §2.5 — "passou da hora")
export function useToggleTachado() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, tachado }: { id: string; tachado: boolean }) => {
      if (!isProceduresSupabaseConfigured()) {
        throw new Error('Procedures Supabase not configured');
      }
      const now = new Date().toISOString();
      // doc 05 §2.5 — captura `tachado_em` no momento da marcação (limpa quando desmarcar)
      const { data, error } = await supabaseProcedures
        .from('procedures')
        .update({ tachado, tachado_em: tachado ? now : null, updated_date: now })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, tachado }) => {
      // Optimistic update — reflete instantâneo na lista
      await queryClient.cancelQueries({ queryKey: PROCEDURES_KEY });
      const prev = queryClient.getQueryData<Procedure[]>(PROCEDURES_KEY);
      const now = new Date().toISOString();
      if (prev) {
        queryClient.setQueryData<Procedure[]>(
          PROCEDURES_KEY,
          prev.map((p) => (p.id === id ? { ...p, tachado, tachado_em: tachado ? now : null } : p)),
        );
      }
      return { prev };
    },
    onError: (error: Error, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(PROCEDURES_KEY, ctx.prev);
      toast({
        title: 'Erro',
        description: `Falha ao atualizar tachado: ${error.message}`,
        variant: 'destructive',
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: PROCEDURES_KEY });
      if (data?.id) syncProcedureBestEffort(data.id, 'upsert');
    },
  });
}

// Toggle Reenviado (paridade FreeBet PRO doc 05 §2.5 — "atualizei depois de publicar")
//   - mode='toggle'    → marca/desmarca. Marcar = reenviado_em=now, count=1. Desmarcar = null/0.
//   - mode='increment' → mantém marcado, atualiza reenviado_em e incrementa count.
//   - mode='clear'     → reset null/0.
export function useToggleReenviado() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      mode,
      currentReenviadoEm,
      currentCount,
    }: {
      id: string;
      mode: 'toggle' | 'increment' | 'clear';
      currentReenviadoEm: string | null;
      currentCount: number;
    }) => {
      if (!isProceduresSupabaseConfigured()) {
        throw new Error('Procedures Supabase not configured');
      }
      let payload: { reenviado_em: string | null; reenviado_count: number };
      if (mode === 'clear') {
        payload = { reenviado_em: null, reenviado_count: 0 };
      } else if (mode === 'increment') {
        payload = { reenviado_em: new Date().toISOString(), reenviado_count: (currentCount || 0) + 1 };
      } else {
        // toggle
        if (currentReenviadoEm) {
          payload = { reenviado_em: null, reenviado_count: 0 };
        } else {
          payload = { reenviado_em: new Date().toISOString(), reenviado_count: 1 };
        }
      }
      const { data, error } = await supabaseProcedures
        .from('procedures')
        .update({ ...payload, updated_date: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      // mode='clear' / desmarcar (toggle quando já estava marcado) NÃO dispara broadcast.
      // Marcar/incrementar (payload.reenviado_em != null) = sinal explícito do admin
      // de "atualizei o card, dispara aviso pros assinantes" — vai com `reenviar: true`.
      const triggerBroadcast = payload.reenviado_em !== null;
      return { data, triggerBroadcast };
    },
    onSuccess: ({ data, triggerBroadcast }) => {
      queryClient.invalidateQueries({ queryKey: PROCEDURES_KEY });
      if (data?.id) {
        syncProcedureBestEffort(data.id, 'upsert', { reenviar: triggerBroadcast });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: `Falha ao marcar reenvio: ${error.message}`,
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

// Confirmar dados de procedimento registrado pelo bot Telegram
// Limpa bot_needs_review e bot_missing_fields — indica que o gerente verificou os dados
export function useConfirmBotProcedure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!isProceduresSupabaseConfigured()) {
        throw new Error('Procedures Supabase not configured');
      }

      const { data, error } = await supabaseProcedures
        .from('procedures')
        .update({
          bot_needs_review: false,
          bot_missing_fields: null,
          updated_date: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROCEDURES_KEY });
      toast({
        title: 'Dados confirmados',
        description: 'Procedimento marcado como verificado.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: `Falha ao confirmar: ${error.message}`,
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

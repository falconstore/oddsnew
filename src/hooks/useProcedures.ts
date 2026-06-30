import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseProcedures, isProceduresSupabaseConfigured } from '@/lib/supabaseProcedures';
import { Procedure, FreebetCreditada } from '@/types/procedures';
import { toast } from '@/hooks/use-toast';
import { syncProcedureBestEffort } from '@/lib/freebetproSync';
import { normalizePlatformName } from '@/lib/procedureUtils';

const PROCEDURES_KEY = ['procedures'];

// Performance: NÃO trazer bot_raw_message (texto inteiro do Telegram por
// procedimento — campo mais pesado e não usado na lista/cálculo). Com milhares
// de procedimentos, isso reduz muito o payload e acelera a navegação. Quem
// precisa do raw (RegisterBotMessageModal, BotTemplates) carrega à parte.
const COLS = 'id,created_date,updated_date,created_by,date,procedure_number,platform,promotion_name,category,status,freebet_reference,freebet_value,profit_loss,telegram_link,dp,tags,is_favorite,data_partida,horario_partida,partida_descricao,tipo,archived,archived_at,lucro_prejuizo_previsto,freebet_valor_previsto,resultado_lucro,resultado_freebet_ganha,freebet_creditada,resultado_observacao,freebetpro_external_id,freebetpro_synced_at,freebetpro_last_error,freebetpro_numero,freebetpro_last_request_id,freebet_reference_id,freebet_reference_ids,is_extra,editado_por,kickoff_at,fixture_id,esporte,cenario_b_cash,tachado,tachado_em,reenviado_em,reenviado_count,duplo_green_confirmado,duplo_green_lucro,bot_needs_review,bot_missing_fields,observacoes';

const PAGE = 1000; // teto de linhas por request do PostgREST

// Limites ISO (UTC) do mês de uma data — usados pra filtrar created_date no
// servidor. O mês é interpretado em America/Sao_Paulo (UTC-3): início é
// dia 1 00:00 BRT = dia 1 03:00 UTC; fim é o início do mês seguinte.
function mesRangeISO(month: Date): { gte: string; lt: string } {
  const y = month.getFullYear();
  const m = month.getMonth(); // 0-11
  // 03:00 UTC = 00:00 BRT (UTC-3)
  const gte = new Date(Date.UTC(y, m, 1, 3, 0, 0)).toISOString();
  const lt = new Date(Date.UTC(y, m + 1, 1, 3, 0, 0)).toISOString();
  return { gte, lt };
}

// Pagina uma query até trazer todas as linhas (ultrapassa o teto de 1000 do
// PostgREST). `build` recebe o range e devolve a query já com filtros/ordem.
async function fetchAllPages(
  build: (from: number, to: number) => Promise<{ data: unknown[] | null; error: unknown }>,
): Promise<Procedure[]> {
  const all: Procedure[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) {
      console.error('Error fetching procedures:', error);
      throw error;
    }
    const rows = (data || []) as unknown as Procedure[];
    all.push(...rows);
    if (rows.length < PAGE) break; // página incompleta = fim
  }
  return all;
}

export interface UseProceduresOptions {
  // Quando passado, traz só os procedimentos criados nesse mês (filtro
  // server-side por created_date). Sem ele, pagina e traz TODOS — usado por
  // telas que só precisam da lista de plataformas/relatórios.
  month?: Date;
}

// Fetch de procedimentos (incluindo arquivados — o filtro "showArchived" mora
// na UI). Sem options → todos (paginado). Com { month } → só aquele mês.
export function useProcedures(options?: UseProceduresOptions) {
  const month = options?.month;
  const monthKey = month ? `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}` : null;

  return useQuery({
    queryKey: monthKey ? [...PROCEDURES_KEY, 'month', monthKey] : [...PROCEDURES_KEY, 'all'],
    queryFn: async (): Promise<Procedure[]> => {
      if (!isProceduresSupabaseConfigured()) {
        console.warn('Procedures Supabase not configured');
        return [];
      }

      if (month) {
        const { gte, lt } = mesRangeISO(month);
        return fetchAllPages((from, to) =>
          supabaseProcedures
            .from('procedures')
            .select(COLS)
            .gte('created_date', gte)
            .lt('created_date', lt)
            .order('created_date', { ascending: false })
            .range(from, to),
        );
      }

      // Sem mês: traz todos, paginando (ultrapassa o teto de 1000).
      return fetchAllPages((from, to) =>
        supabaseProcedures
          .from('procedures')
          .select(COLS)
          .order('created_date', { ascending: false })
          .range(from, to),
      );
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

      const normalized = {
        ...procedure,
        platform: normalizePlatformName(procedure.platform ?? ''),
      };

      const { data, error } = await supabaseProcedures
        .from('procedures')
        .insert([normalized])
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

      if (updates.platform !== undefined) {
        updates = { ...updates, platform: normalizePlatformName(updates.platform ?? '') };
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
//   - Concluído      se freebet_valor_previsto = 0/null OU freebet_creditada = 'NAO'
//   - Falta Girar FB se freebet_valor_previsto > 0 E freebet_creditada = 'SIM'
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
      // Status final padrão = 'Concluído'. ('Lucro Direto' fica reservado pra
      // marcação manual em Cashback / Aposta Sem Risco.)
      const auto_status = hasFB && fbCreditadaAuto === 'SIM'
        ? 'Falta Girar Freebet'
        : 'Concluído';

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
      // Optimistic update — reflete instantâneo na lista. Aplica em TODAS as
      // queries de procedimentos (key 'all' e cada 'month/YYYY-MM'), via prefixo.
      await queryClient.cancelQueries({ queryKey: PROCEDURES_KEY });
      const prev = queryClient.getQueriesData<Procedure[]>({ queryKey: PROCEDURES_KEY });
      const now = new Date().toISOString();
      for (const [key, list] of prev) {
        if (!list) continue;
        queryClient.setQueryData<Procedure[]>(
          key,
          list.map((p) => (p.id === id ? { ...p, tachado, tachado_em: tachado ? now : null } : p)),
        );
      }
      return { prev };
    },
    onError: (error: Error, _vars, ctx) => {
      // Restaura cada cache ao valor anterior
      if (ctx?.prev) {
        for (const [key, list] of ctx.prev) queryClient.setQueryData(key, list);
      }
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

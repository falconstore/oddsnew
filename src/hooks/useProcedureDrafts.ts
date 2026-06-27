import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseProcedures } from '@/lib/supabaseProcedures';
import { toast } from '@/hooks/use-toast';

// ============================================================================
// procedure_drafts — rascunhos de procedimento no fluxo de REVISÃO.
//
// Leitura: direta na tabela (cliente "procedures").
// Escrita (criar / revisar / marcar enviado): via Edge Function
//   procedure-draft-save, que roda com service_role e também sobe as imagens
//   pro bucket procedure-images. Isso evita escrever status pelo frontend.
// ============================================================================

export type DraftStatus = 'pendente' | 'aprovado' | 'rejeitado' | 'enviado';

export interface DraftEntrada {
  casa: string;
  odd: string;
  aposte: string;
  link: string;
  observacao: string;
  freebet: boolean;
  lay?: boolean;             // entrada LAY (contra)
  responsabilidade?: string; // valor exposto na lay
  image_path: string | null; // path no bucket procedure-images (ou null)
}

export interface DraftCalc {
  image_path: string | null;
  link: string;
  obs?: string;
}

export interface DraftPromocao {
  image_path: string | null;
  descricao: string;
  link: string;
  chamada: string;
}

export interface ProcedureDraft {
  id: string;
  status: DraftStatus;
  template_id: string | null;
  texto: string;
  entradas: DraftEntrada[];
  calc: DraftCalc | null;
  promocoes?: DraftPromocao[];
  created_by_email: string | null;
  created_by_id: string | null;
  reviewed_by_email: string | null;
  reviewed_at: string | null;
  reject_reason: string | null;
  sent_at: string | null;
  sent_chat_id: number | null;
  sent_message_ids: number[] | null;
  deleted_from_telegram_at: string | null;
  created_at: string;
  updated_at: string;
}

const BUCKET = 'procedure-images';

/** URL pública de uma imagem do draft a partir do seu path no Storage. */
export function draftImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const { data } = supabaseProcedures.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? null;
}

/** Lista os drafts. Passe um status pra filtrar (ex.: 'pendente' = fila). */
export function useProcedureDrafts(status?: DraftStatus) {
  return useQuery({
    queryKey: ['procedure_drafts', status ?? 'all'],
    queryFn: async () => {
      let q = supabaseProcedures
        .from('procedure_drafts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ProcedureDraft[];
    },
    staleTime: 10000,
    refetchInterval: 20000,
    refetchIntervalInBackground: false,
  });
}

async function invokeDraftSave(body: Record<string, unknown>) {
  const { data, error } = await supabaseProcedures.functions.invoke('procedure-draft-save', { body });
  if (error) {
    // Em status não-2xx (ex.: 409 de conflito), o supabase-js entrega o corpo
    // JSON em error.context — extraímos a mensagem amigável de lá.
    try {
      const ctx = (error as any)?.context;
      const parsed = typeof ctx?.json === 'function' ? await ctx.json() : null;
      if (parsed?.error) throw new Error(parsed.error);
    } catch (inner: any) {
      if (inner instanceof Error && inner.message) throw inner;
    }
    throw error;
  }
  if (data?.ok === false) throw new Error(data?.error || 'Falha na operação');
  return data;
}

interface CreateDraftInput {
  templateId: string | null;
  texto: string;
  entradas: Array<{
    casa: string; odd: string; aposte: string; link: string;
    observacao: string; freebet: boolean; lay: boolean; responsabilidade: string;
    printDataUrl: string | null;
  }>;
  calc: { printDataUrl: string | null; link: string; obs: string } | null;
  promocoes?: Array<{ descricao: string; link: string; chamada: string; printDataUrl: string | null }>;
  createdByEmail: string | null;
  createdById: string | null;
}

/** Cria um draft (status=pendente) e sobe as imagens. Retorna { id }. */
export function useCreateDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDraftInput) => invokeDraftSave({ action: 'create', ...input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['procedure_drafts'] });
    },
    onError: (e: any) => {
      toast({ title: 'Erro ao enviar para revisão', description: e?.message, variant: 'destructive' });
    },
  });
}

interface ResubmitDraftInput extends CreateDraftInput {
  id: string;
}

/** Corrige um rascunho rejeitado e reenvia — REABRE o mesmo (volta a pendente). */
export function useResubmitDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ResubmitDraftInput) => invokeDraftSave({ action: 'resubmit', ...input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['procedure_drafts'] });
    },
    onError: (e: any) => {
      toast({ title: 'Erro ao reenviar', description: e?.message, variant: 'destructive' });
    },
  });
}

/** Aprova ou rejeita um draft pendente. */
export function useReviewDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; decision: 'aprovado' | 'rejeitado'; reviewedByEmail: string | null; rejectReason?: string }) =>
      invokeDraftSave({ action: 'review', ...input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['procedure_drafts'] });
    },
    onError: (e: any) => {
      toast({ title: 'Erro ao revisar', description: e?.message, variant: 'destructive' });
    },
  });
}

/** Exclui o rascunho do SISTEMA (registro + imagens do Storage). Não mexe no
 *  Telegram — pra isso use useDeleteFromTelegram antes/depois. */
export function useDeleteDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invokeDraftSave({ action: 'delete', id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['procedure_drafts'] });
      toast({ title: 'Excluído do sistema' });
    },
    onError: (e: any) => {
      toast({ title: 'Erro ao excluir', description: e?.message, variant: 'destructive' });
    },
  });
}

/** Apaga do grupo do Telegram todas as mensagens que o procedimento gerou.
 *  Chama o procedure-send com action=delete (usa os sent_message_ids salvos). */
export function useDeleteFromTelegram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draftId: string) => {
      const { data, error } = await supabaseProcedures.functions.invoke('procedure-send', {
        body: { action: 'delete', draftId },
      });
      if (error) {
        try {
          const ctx = (error as any)?.context;
          const parsed = typeof ctx?.json === 'function' ? await ctx.json() : null;
          if (parsed?.error) throw new Error(parsed.error);
        } catch (inner: any) {
          if (inner instanceof Error && inner.message) throw inner;
        }
        throw error;
      }
      if (data?.ok === false) throw new Error(data?.error || 'Falha ao apagar');
      return data as { ok: true; apagadas: number; total: number; falhas: any[] };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['procedure_drafts'] });
      const falhas = data?.falhas?.length ?? 0;
      if (falhas > 0) {
        toast({
          title: `Apagadas ${data.apagadas}/${data.total}`,
          description: `${falhas} não puderam ser apagadas (mais de 48h ou sem permissão do bot).`,
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Removido do grupo', description: `${data.apagadas} mensagens apagadas do Telegram.` });
      }
    },
    onError: (e: any) => {
      toast({ title: 'Erro ao apagar do Telegram', description: e?.message, variant: 'destructive' });
    },
  });
}


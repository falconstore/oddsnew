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
  image_path: string | null; // path no bucket procedure-images (ou null)
}

export interface DraftCalc {
  image_path: string | null;
  link: string;
}

export interface ProcedureDraft {
  id: string;
  status: DraftStatus;
  template_id: string | null;
  texto: string;
  entradas: DraftEntrada[];
  calc: DraftCalc | null;
  created_by_email: string | null;
  created_by_id: string | null;
  reviewed_by_email: string | null;
  reviewed_at: string | null;
  reject_reason: string | null;
  sent_at: string | null;
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
    observacao: string; freebet: boolean; printDataUrl: string | null;
  }>;
  calc: { printDataUrl: string | null; link: string } | null;
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


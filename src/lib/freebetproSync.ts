// Helper best-effort pra disparar a Edge Function `freebetpro-sync` após
// mutações em procedures. NUNCA lança — falhas viram apenas console.warn
// + ficam registradas em `procedures.freebetpro_last_error` pela Edge Function.
//
// O JWT do usuário logado (anon key + sessão) é injetado automaticamente
// pelo cliente Supabase do frontend.
import { supabaseProcedures, isProceduresSupabaseConfigured } from '@/lib/supabaseProcedures';

export type FreebetproAction = 'upsert' | 'result' | 'archive';

export interface SyncOptions {
  /**
   * Doc 06 §6 / §8 — quando `true`, o PATCH /procedimentos/:id inclui o flag
   * `reenviar: true`, que dispara um novo broadcast no Telegram da FreeBet PRO
   * pros clientes PRO. Use somente em `useToggleReenviado` (ações onde o
   * usuário explicitamente marcou "reenviar"). Ausência do flag = PATCH
   * silencioso (atualiza campos sem notificar).
   */
  reenviar?: boolean;
}

export function syncProcedureBestEffort(
  procedureId: string,
  action: FreebetproAction,
  opts: SyncOptions = {},
): void {
  if (!isProceduresSupabaseConfigured()) return;
  // Fire-and-forget — não bloqueia a UI/toast.
  void (async () => {
    try {
      const { data, error } = await supabaseProcedures.functions.invoke('freebetpro-sync', {
        body: {
          procedure_id: procedureId,
          action,
          ...(opts.reenviar ? { reenviar: true } : {}),
        },
      });
      if (error) {
        console.warn('[freebetpro-sync] invoke error', { procedureId, action, error: error.message });
        return;
      }
      if (data && data.ok === false) {
        console.warn('[freebetpro-sync] remote not-ok', { procedureId, action, data });
      }
    } catch (e: any) {
      console.warn('[freebetpro-sync] crash', { procedureId, action, err: e?.message });
    }
  })();
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import type { TrialLead } from '@/types/trial';

export const useTrialLeads = () => {
  return useQuery<TrialLead[]>({
    queryKey: ['trial_leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trial_leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as TrialLead[];
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
    // Mantém os leads antigos visíveis durante refetch (interval/realtime),
    // pra UI não piscar pro skeleton e o usuário não perder scroll.
    placeholderData: (prev) => prev,
  });
};

export const usePurgeTrialLead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (leadId: string) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const url = `${import.meta.env.VITE_MAIN_SUPABASE_URL}/functions/v1/trial-purge`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ lead_id: leadId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || json?.error || 'Falha ao apagar do banco');
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trial_leads'] });
      toast({ title: 'Lead apagado do banco' });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao apagar', description: err.message, variant: 'destructive' });
    },
  });
};

export const useKickTrialLead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (leadId: string) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const url = `${import.meta.env.VITE_MAIN_SUPABASE_URL}/functions/v1/trial-kick`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ lead_id: leadId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Falha ao remover do grupo');
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trial_leads'] });
      toast({ title: 'Usuário removido do grupo' });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    },
  });
};

export type TelegramDiagnose = {
  ok: boolean;
  env: {
    has_bot_token: boolean;
    has_chat_id: boolean;
    has_webhook_secret: boolean;
    chat_id_value: string | null;
  };
  summary: {
    bot_alive: boolean;
    bot_username: string | null;
    webhook_registered: boolean;
    webhook_url: string | null;
    webhook_url_ok: boolean;
    webhook_pending_update_count: number | null;
    webhook_last_error_date: number | null;
    webhook_last_error_message: string | null;
    webhook_allowed_updates: string[];
    webhook_has_chat_member_subscription: boolean;
    bot_in_chat: boolean;
    bot_status_in_chat: string | null;
    bot_can_restrict_members: boolean | null;
    chat_title: string | null;
    chat_type: string | null;
  };
  issues: string[];
};

export const useDiagnoseTelegram = () => {
  return useMutation<TelegramDiagnose>({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const url = `${import.meta.env.VITE_MAIN_SUPABASE_URL}/functions/v1/trial-diagnose`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: '{}',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Falha ao rodar diagnóstico');
      return json as TelegramDiagnose;
    },
    onError: (err: Error) => {
      toast({ title: 'Erro no diagnóstico', description: err.message, variant: 'destructive' });
    },
  });
};

export type LinkManualResult = {
  ok?: boolean;
  action?: 'activated' | 'already-active' | 'not-in-group';
  message?: string;
  need_manual_id?: boolean;
  error?: string;
  telegram_error?: string | null;
  telegram_user_id?: number;
  telegram_member_status?: string;
};

export const useLinkManual = () => {
  const qc = useQueryClient();
  return useMutation<LinkManualResult, Error, { leadId: string; manualUserId?: string }>({
    mutationFn: async ({ leadId, manualUserId }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const url = `${import.meta.env.VITE_MAIN_SUPABASE_URL}/functions/v1/trial-link-manual`;
      const body: Record<string, unknown> = { lead_id: leadId };
      if (manualUserId && manualUserId.trim()) body.manual_user_id = manualUserId.trim();
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as LinkManualResult & { message?: string };
      // 200 com need_manual_id é caminho esperado (auto-resolve falhou).
      if (json?.need_manual_id) return json;
      if (!res.ok) {
        // Para 409 (blocked-repeat), o backend manda `message` clara.
        // Caso contrário cai pro `error` ou um fallback genérico.
        throw new Error(json?.message || json?.error || 'Falha ao vincular o lead');
      }
      return json;
    },
    onSuccess: (data) => {
      if (data?.action === 'activated') {
        qc.invalidateQueries({ queryKey: ['trial_leads'] });
        toast({ title: 'Lead vinculado!', description: data.message });
      } else if (data?.action === 'already-active') {
        qc.invalidateQueries({ queryKey: ['trial_leads'] });
        toast({ title: 'Já estava ativo', description: data.message });
      } else if (data?.action === 'not-in-group') {
        toast({ title: 'Usuário fora do grupo', description: data.message, variant: 'destructive' });
      }
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao vincular', description: err.message, variant: 'destructive' });
    },
  });
};

export const useForceActivate = () => {
  const qc = useQueryClient();
  return useMutation<
    { ok: boolean; action: string; message: string },
    Error,
    { leadId: string; telegramUserId?: number | null } | string
  >({
    mutationFn: async (input) => {
      const { leadId, telegramUserId } = typeof input === 'string'
        ? { leadId: input, telegramUserId: undefined as number | null | undefined }
        : input;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const url = `${import.meta.env.VITE_MAIN_SUPABASE_URL}/functions/v1/trial-force-activate`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          lead_id: leadId,
          ...(telegramUserId ? { telegram_user_id: telegramUserId } : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || json?.error || 'Falha ao liberar lead');
      return json;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['trial_leads'] });
      toast({ title: 'Lead liberado e ativado', description: data.message });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao liberar', description: err.message, variant: 'destructive' });
    },
  });
};

export type TrialSettings = {
  reminder_coupon: string;
  recall_after_hours: number;
  recall_repeat_after_days: number;
  recall_daily_cap: number;
  updated_at: string;
  updated_by: string | null;
};

export const useTrialSettings = () => {
  return useQuery({
    queryKey: ['trial_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trial_settings')
        .select('reminder_coupon, recall_after_hours, recall_repeat_after_days, recall_daily_cap, updated_at, updated_by')
        .eq('id', true)
        .maybeSingle();
      if (error) throw error;
      return (data ?? {
        reminder_coupon: 'PODPROMO',
        recall_after_hours: 12,
        recall_repeat_after_days: 7,
        recall_daily_cap: 100,
        updated_at: '',
        updated_by: null,
      }) as TrialSettings;
    },
    staleTime: 30_000,
  });
};

export type UpdateTrialSettingsInput = {
  coupon?: string;
  recallAfterHours?: number;
  recallRepeatAfterDays?: number;
  recallDailyCap?: number;
};

export const useUpdateTrialSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateTrialSettingsInput) => {
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (input.coupon !== undefined) {
        const trimmed = input.coupon.trim();
        if (!trimmed) throw new Error('Cupom não pode ficar em branco');
        patch.reminder_coupon = trimmed;
      }
      if (input.recallAfterHours !== undefined) {
        const v = Math.floor(input.recallAfterHours);
        if (!Number.isFinite(v) || v < 1) throw new Error('Horas devem ser ≥ 1');
        patch.recall_after_hours = v;
      }
      if (input.recallRepeatAfterDays !== undefined) {
        const v = Math.floor(input.recallRepeatAfterDays);
        if (!Number.isFinite(v) || v < 1) throw new Error('Dias devem ser ≥ 1');
        patch.recall_repeat_after_days = v;
      }
      if (input.recallDailyCap !== undefined) {
        const v = Math.floor(input.recallDailyCap);
        if (!Number.isFinite(v) || v < 1) throw new Error('Cap diário deve ser ≥ 1');
        patch.recall_daily_cap = v;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      patch.updated_by = sessionData.session?.user?.email ?? null;
      const { data, error } = await supabase
        .from('trial_settings')
        .update(patch)
        .eq('id', true)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trial_settings'] });
      toast({ title: 'Configuração salva' });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    },
  });
};

export type RecallResult = {
  ok: boolean;
  mode: 'manual' | 'cron';
  requested?: number;
  sent: number;
  failed: number;
  message?: string;
  results: Array<{ lead_id: string; ok: boolean; reason?: string }>;
};

export const useRecallLeads = () => {
  const qc = useQueryClient();
  return useMutation<RecallResult, Error, { leadIds: string[] }>({
    mutationFn: async ({ leadIds }) => {
      if (!leadIds.length) throw new Error('Nenhum lead selecionado');
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const url = `${import.meta.env.VITE_MAIN_SUPABASE_URL}/functions/v1/trial-recall`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(
          leadIds.length === 1 ? { lead_id: leadIds[0] } : { lead_ids: leadIds },
        ),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || json?.error || 'Falha ao enviar recall');
      return json as RecallResult;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['trial_leads'] });
      const desc = data.message
        ?? (data.failed === 0
          ? `${data.sent} enviado(s) com sucesso.`
          : `${data.sent} enviado(s), ${data.failed} falharam.`);
      toast({
        title: data.failed === 0 ? 'Recall enviado' : 'Recall com falhas',
        description: desc,
        variant: data.failed > 0 && data.sent === 0 ? 'destructive' : undefined,
      });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro no recall', description: err.message, variant: 'destructive' });
    },
  });
};

export type ReminderTestInput = {
  variant: '24h' | '1h';
  telegramUserId?: string;
  telegramUsername?: string;
  name?: string;
};

export const useSendReminderTest = () => {
  return useMutation<{ ok: boolean; message: string; variant: string }, Error, ReminderTestInput>({
    mutationFn: async ({ variant, telegramUserId, telegramUsername, name }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const url = `${import.meta.env.VITE_MAIN_SUPABASE_URL}/functions/v1/trial-reminder-test`;
      const body: Record<string, unknown> = { variant };
      if (telegramUserId && telegramUserId.trim()) body.telegram_user_id = telegramUserId.trim();
      if (telegramUsername && telegramUsername.trim()) body.telegram_username = telegramUsername.trim();
      if (name && name.trim()) body.name = name.trim();
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.hint || json?.error || 'Falha ao enviar teste');
      return json;
    },
    onSuccess: (data) => {
      toast({ title: 'Teste enviado', description: data.message });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro no teste', description: err.message, variant: 'destructive' });
    },
  });
};

export type LinkGcResult = {
  ok: boolean;
  message: string;
  scanned: number;
  vip_revoked: number;
  vip_failed: number;
  bonus_revoked: number;
  bonus_failed: number;
  cleared_rows: number;
};

export const useLinkGc = () => {
  const qc = useQueryClient();
  return useMutation<LinkGcResult>({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const url = `${import.meta.env.VITE_MAIN_SUPABASE_URL}/functions/v1/trial-link-gc`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: '{}',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Falha ao limpar links antigos');
      return json as LinkGcResult;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['trial_leads'] });
      toast({ title: 'Limpeza concluída', description: data.message });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro na limpeza', description: err.message, variant: 'destructive' });
    },
  });
};

export const useResetWebhook = () => {
  return useMutation<{ ok: boolean; message: string; webhook_url: string }>({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const url = `${import.meta.env.VITE_MAIN_SUPABASE_URL}/functions/v1/trial-webhook-reset`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: '{}',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Falha ao resetar webhook');
      return json;
    },
    onSuccess: (data) => {
      toast({ title: 'Webhook reinstalado', description: data.message });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao resetar webhook', description: err.message, variant: 'destructive' });
    },
  });
};

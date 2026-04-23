import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import type { TrialLead } from '@/types/trial';

export const useTrialLeads = () => {
  return useQuery({
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
  updated_at: string;
  updated_by: string | null;
};

export const useTrialSettings = () => {
  return useQuery({
    queryKey: ['trial_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trial_settings')
        .select('reminder_coupon, updated_at, updated_by')
        .eq('id', true)
        .maybeSingle();
      if (error) throw error;
      return (data ?? { reminder_coupon: 'PODPROMO', updated_at: '', updated_by: null }) as TrialSettings;
    },
    staleTime: 30_000,
  });
};

export const useUpdateTrialSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ coupon }: { coupon: string }) => {
      const trimmed = coupon.trim();
      if (!trimmed) throw new Error('Cupom não pode ficar em branco');
      const { data: sessionData } = await supabase.auth.getSession();
      const email = sessionData.session?.user?.email ?? null;
      const { data, error } = await supabase
        .from('trial_settings')
        .update({ reminder_coupon: trimmed, updated_at: new Date().toISOString(), updated_by: email })
        .eq('id', true)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trial_settings'] });
      toast({ title: 'Cupom atualizado', description: 'O próximo aviso já vai usar o novo valor.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao atualizar cupom', description: err.message, variant: 'destructive' });
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

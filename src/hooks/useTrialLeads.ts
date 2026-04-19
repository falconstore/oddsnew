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

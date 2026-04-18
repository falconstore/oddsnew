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

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { TelegramBotConfig, TelegramDGEnviado, TelegramBotStats } from '@/types/telegram';
import { toast } from 'sonner';

export function useTelegramBotConfig() {
  return useQuery({
    queryKey: ['telegram-bot-config'],
    queryFn: async (): Promise<TelegramBotConfig | null> => {
      const { data, error } = await supabase
        .from('telegram_bot_config')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateTelegramConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: Partial<TelegramBotConfig>) => {
      // Get existing config ID
      const { data: existing } = await supabase
        .from('telegram_bot_config')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (!existing) {
        throw new Error('Configuração não encontrada');
      }

      const { data, error } = await supabase
        .from('telegram_bot_config')
        .update({
          ...config,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['telegram-bot-config'] });
      toast.success('Configuração atualizada');
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });
}

export function useTelegramDGEnviados(limit = 50) {
  return useQuery({
    queryKey: ['telegram-dg-enviados', limit],
    queryFn: async (): Promise<TelegramDGEnviado[]> => {
      const { data, error } = await supabase
        .from('telegram_dg_enviados')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },
  });
}

export function useTelegramBotStats() {
  return useQuery({
    queryKey: ['telegram-bot-stats'],
    queryFn: async (): Promise<TelegramBotStats> => {
      const today = new Date().toISOString().split('T')[0];

      // Total enviados
      const { count: totalEnviados } = await supabase
        .from('telegram_dg_enviados')
        .select('*', { count: 'exact', head: true });

      // Enviados hoje
      const { count: enviadosHoje } = await supabase
        .from('telegram_dg_enviados')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${today}T00:00:00`);

      // ROI médio e lucro total
      const { data: allEnviados } = await supabase
        .from('telegram_dg_enviados')
        .select('roi, retorno_green, stake_casa, stake_fora');

      let roiMedio = 0;
      let lucroTotalPotencial = 0;

      if (allEnviados && allEnviados.length > 0) {
        roiMedio = allEnviados.reduce((acc, e) => acc + (e.roi || 0), 0) / allEnviados.length;
        lucroTotalPotencial = allEnviados.reduce((acc, e) => {
          const investimento = (e.stake_casa || 0) + (e.stake_fora || 0);
          return acc + ((e.retorno_green || 0) - investimento);
        }, 0);
      }

      return {
        totalEnviados: totalEnviados || 0,
        enviadosHoje: enviadosHoje || 0,
        roiMedio,
        lucroTotalPotencial,
      };
    },
  });
}

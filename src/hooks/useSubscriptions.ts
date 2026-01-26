import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseProcedures } from '@/lib/supabaseProcedures';
import { Subscriber, SubscriberFormData } from '@/types/subscriptions';
import { toast } from 'sonner';

const QUERY_KEY = 'subscribers';

// Fetch all subscribers
export function useSubscriptions() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async (): Promise<Subscriber[]> => {
      const { data, error } = await supabaseProcedures
        .from('subscribers')
        .select('*')
        .order('payment_date', { ascending: false });

      if (error) {
        console.error('Error fetching subscribers:', error);
        throw error;
      }

      return data || [];
    },
    refetchInterval: 10000, // Refetch every 10 seconds
  });
}

// Create subscriber
export function useCreateSubscriber() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: SubscriberFormData) => {
      const { data, error } = await supabaseProcedures
        .from('subscribers')
        .insert([{
          full_name: formData.full_name,
          telegram_link: formData.telegram_link || null,
          amount_paid: formData.amount_paid,
          payment_date: formData.payment_date,
          plan: formData.plan,
          situation: formData.situation,
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating subscriber:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Assinante criado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao criar assinante: ' + error.message);
    },
  });
}

// Update subscriber
export function useUpdateSubscriber() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: SubscriberFormData }) => {
      const { data, error } = await supabaseProcedures
        .from('subscribers')
        .update({
          full_name: formData.full_name,
          telegram_link: formData.telegram_link || null,
          amount_paid: formData.amount_paid,
          payment_date: formData.payment_date,
          plan: formData.plan,
          situation: formData.situation,
          updated_date: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating subscriber:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Assinante atualizado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar assinante: ' + error.message);
    },
  });
}

// Delete subscriber
export function useDeleteSubscriber() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseProcedures
        .from('subscribers')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting subscriber:', error);
        throw error;
      }

      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Assinante removido com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao remover assinante: ' + error.message);
    },
  });
}

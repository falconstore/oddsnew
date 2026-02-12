import { useState, useMemo } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SubscriptionStats } from '@/components/subscriptions/SubscriptionStats';
import { SubscriptionFilters } from '@/components/subscriptions/SubscriptionFilters';
import { SubscriptionTable } from '@/components/subscriptions/SubscriptionTable';
import { SubscriptionModal } from '@/components/subscriptions/SubscriptionModal';
import { 
  useSubscriptions, 
  useCreateSubscriber, 
  useUpdateSubscriber, 
  useDeleteSubscriber 
} from '@/hooks/useSubscriptions';
import { calculateStats, filterSubscribers } from '@/lib/subscriptionUtils';
import { Subscriber, SubscriberFormData, SubscriptionFilters as Filters } from '@/types/subscriptions';
import { RefreshCw, Plus, CreditCard } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { PAGE_KEYS } from '@/types/auth';

export default function Subscriptions() {
  const { canEditPage } = useAuth();
  const canEdit = canEditPage(PAGE_KEYS.SUBSCRIPTIONS);
  const { data: subscribers = [], isLoading, refetch, isRefetching } = useSubscriptions();
  const createMutation = useCreateSubscriber();
  const updateMutation = useUpdateSubscriber();
  const deleteMutation = useDeleteSubscriber();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSubscriber, setEditingSubscriber] = useState<Subscriber | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [subscriberToDelete, setSubscriberToDelete] = useState<string | null>(null);

  const [filters, setFilters] = usePersistedState<Filters>('subs_filters', {
    searchName: '',
    plan: 'all',
    status: 'all',
    situation: 'all',
    daysRemaining: 'all',
  });

  // Calcular estatísticas
  const stats = useMemo(() => calculateStats(subscribers), [subscribers]);

  // Filtrar assinantes
  const filteredSubscribers = useMemo(() => 
    filterSubscribers(subscribers, filters), 
    [subscribers, filters]
  );

  const handleOpenModal = (subscriber?: Subscriber) => {
    setEditingSubscriber(subscriber || null);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingSubscriber(null);
  };

  const handleSubmit = async (formData: SubscriberFormData) => {
    try {
      if (editingSubscriber) {
        await updateMutation.mutateAsync({ id: editingSubscriber.id, formData });
      } else {
        await createMutation.mutateAsync(formData);
      }
      handleCloseModal();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleDeleteClick = (id: string) => {
    setSubscriberToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (subscriberToDelete) {
      await deleteMutation.mutateAsync(subscriberToDelete);
      setDeleteDialogOpen(false);
      setSubscriberToDelete(null);
    }
  };

  return (
    <Layout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Assinaturas</h1>
              <p className="text-xs text-muted-foreground">
                Controle de pagamentos e assinantes
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${isRefetching ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            {canEdit && (
              <Button size="sm" onClick={() => handleOpenModal()}>
                <Plus className="h-4 w-4 mr-1.5" />
                Adicionar
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <SubscriptionStats stats={stats} />

        {/* Main Content */}
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Assinantes ({filteredSubscribers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <SubscriptionFilters filters={filters} onFiltersChange={setFilters} />

            {/* Table */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredSubscribers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CreditCard className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {subscribers.length === 0 
                    ? 'Nenhum assinante cadastrado ainda'
                    : 'Nenhum assinante encontrado com os filtros aplicados'
                  }
                </p>
              </div>
            ) : (
              <SubscriptionTable
                subscribers={filteredSubscribers}
                onEdit={canEdit ? handleOpenModal : undefined}
                onDelete={canEdit ? handleDeleteClick : undefined}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal */}
      <SubscriptionModal
        open={modalOpen}
        onOpenChange={handleCloseModal}
        subscriber={editingSubscriber}
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este assinante? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

import { useState, useMemo } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import { startOfMonth, endOfMonth, endOfDay, differenceInDays } from 'date-fns';
import { Plus, FileText, Columns, Upload, List, Bot } from 'lucide-react';

import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';

import { useProcedures, useDeleteProcedure, useToggleFavorite, useArchiveProcedure, useConfirmBotProcedure } from '@/hooks/useProcedures';
import { Procedure, ProcedureFilters as FiltersType, AVAILABLE_COLUMNS } from '@/types/procedures';
import { getGameTimeBucket } from '@/lib/procedureGameTime';
import { DefinirResultadosModal } from '@/components/procedures/DefinirResultadosModal';
import {
  parseDate,
  getAllPlatforms,
  getAllStatuses,
  getAllTags,
} from '@/lib/procedureUtils';

import { ProcedureFilters } from '@/components/procedures/ProcedureFilters';
import { ProcedureTable } from '@/components/procedures/ProcedureTable';
import { ProcedureMobileCards } from '@/components/procedures/ProcedureMobileCards';
import { ProcedureModal } from '@/components/procedures/ProcedureModal';
import { ImportModal } from '@/components/procedures/ImportModal';
import { GerarRelatorioModal } from '@/components/procedures/GerarRelatorioModal';
import { RegisterBotMessageModal } from '@/components/procedures/RegisterBotMessageModal';
import { ColumnCustomizer } from '@/components/procedures/ColumnCustomizer';
import { NotificationPanel } from '@/components/procedures/NotificationPanel';
import { useAuth } from '@/contexts/AuthContext';
import { PAGE_KEYS } from '@/types/auth';

export default function ProcedureControl() {
  const { canEditPage } = useAuth();
  const canEdit = canEditPage(PAGE_KEYS.PROCEDURE_CONTROL);
  const { data: procedures = [], refetch } = useProcedures();
  const deleteProcedure = useDeleteProcedure();
  const toggleFavorite = useToggleFavorite();
  const archiveProcedure = useArchiveProcedure();
  const confirmBotProcedure = useConfirmBotProcedure();

  const [showModal, setShowModal] = useState(false);
  const [editingProcedure, setEditingProcedure] = useState<Procedure | null>(null);
  const [resultProcedure, setResultProcedure] = useState<Procedure | null>(null);
  // selectedMonth shared via localStorage with Dashboard (same key)
  const [selectedMonth] = usePersistedState('proc_month', new Date());
  const [showNotifications, setShowNotifications] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showRelatorioModal, setShowRelatorioModal] = useState(false);
  const [showColumnCustomizer, setShowColumnCustomizer] = useState(false);
  const [showRegisterBotModal, setShowRegisterBotModal] = useState(false);

  const [filters, setFilters] = usePersistedState<FiltersType>('proc_filters', {
    searchNumber: '',
    searchPromotion: '',
    searchTags: 'all',
    platform: 'all',
    category: 'all',
    status: 'all',
    profitLoss: 'all',
    urgent: 'all',
    hasFreebetValue: 'all',
    onlyFavorites: false,
    showArchived: false,
    gameTime: 'all',
  });

  const [visibleColumns, setVisibleColumns] = usePersistedState<string[]>('proc_columns', AVAILABLE_COLUMNS.map(col => col.key));

  const handleEdit = (proc: Procedure) => {
    setEditingProcedure(proc);
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingProcedure(null);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja EXCLUIR PERMANENTEMENTE este procedimento? Esta ação não pode ser desfeita. Para esconder sem perder, use Arquivar.')) {
      await deleteProcedure.mutateAsync(id);
    }
  };

  const handleArchive = async (proc: Procedure) => {
    await archiveProcedure.mutateAsync({ id: proc.id, archived: !proc.archived });
  };

  const handleCheckResult = (proc: Procedure) => {
    setResultProcedure(proc);
  };

  const handleToggleFavorite = (proc: Procedure) => {
    toggleFavorite.mutate({ id: proc.id, is_favorite: !proc.is_favorite });
  };

  const handleConfirmBot = (id: string) => {
    confirmBotProcedure.mutate(id);
  };

  const filteredProcedures = useMemo(() => {
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfDay(endOfMonth(selectedMonth));
    const today = new Date();

    return procedures.filter(proc => {
      const procDate = parseDate(proc.date);
      if (!procDate || procDate < monthStart || procDate > monthEnd) return false;
      if (!filters.showArchived && proc.archived) return false;
      if (filters.gameTime !== 'all' && getGameTimeBucket(proc, today) !== filters.gameTime) return false;
      if (filters.searchNumber && !proc.procedure_number?.toLowerCase().includes(filters.searchNumber.toLowerCase())) return false;
      if (filters.searchPromotion && proc.promotion_name && !proc.promotion_name.toLowerCase().includes(filters.searchPromotion.toLowerCase())) return false;
      if (filters.searchTags !== 'all' && !proc.tags?.includes(filters.searchTags)) return false;
      if (filters.onlyFavorites && !proc.is_favorite) return false;
      if (filters.platform !== 'all' && proc.platform !== filters.platform) return false;
      if (filters.category !== 'all' && proc.category !== filters.category) return false;
      if (filters.status !== 'all' && proc.status !== filters.status) return false;

      if (filters.profitLoss !== 'all') {
        if (filters.profitLoss === 'profit' && (proc.profit_loss === null || proc.profit_loss <= 0)) return false;
        if (filters.profitLoss === 'loss' && (proc.profit_loss === null || proc.profit_loss >= 0)) return false;
      }

      if (filters.urgent !== 'all') {
        const daysAgo = procDate ? differenceInDays(today, procDate) : 0;
        const cleanStatus = (proc.status || '').trim().toLowerCase();
        if (filters.urgent === 'urgent') {
          const isUrgent = (
            ((cleanStatus === 'falta girar freebet' || cleanStatus === 'falta girar freeebet') && daysAgo > 3) ||
            (cleanStatus === 'enviada partida em aberto' && daysAgo > 2) ||
            (cleanStatus === 'referência faltando' && daysAgo > 1)
          );
          if (!isUrgent) return false;
        }
        if (filters.urgent === 'pending') {
          const isPending = (
            cleanStatus === 'falta girar freebet' ||
            cleanStatus === 'falta girar freeebet' ||
            cleanStatus === 'enviada partida em aberto' ||
            cleanStatus === 'freebet pendente' ||
            cleanStatus === 'referência faltando'
          );
          if (!isPending) return false;
        }
      }

      if (filters.hasFreebetValue !== 'all') {
        if (filters.hasFreebetValue === 'yes' && !proc.freebet_value) return false;
        if (filters.hasFreebetValue === 'no' && proc.freebet_value) return false;
      }

      return true;
    }).sort((a, b) => {
      const numA = parseInt(a.procedure_number, 10) || 0;
      const numB = parseInt(b.procedure_number, 10) || 0;
      return numB - numA;
    });
  }, [procedures, selectedMonth, filters]);

  const monthProcedures = useMemo(() => {
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfDay(endOfMonth(selectedMonth));
    return procedures.filter(proc => {
      const procDate = parseDate(proc.date);
      return procDate && procDate >= monthStart && procDate <= monthEnd;
    });
  }, [procedures, selectedMonth]);

  return (
    <Layout>
      <div className="space-y-5 animate-fade-in">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/25 to-cyan-500/5 border border-cyan-500/25 flex items-center justify-center shadow-lg shadow-cyan-500/10 flex-shrink-0">
              <FileText className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight gradient-text">
                Controle de Procedimentos
              </h1>
              <p className="text-muted-foreground text-xs md:text-sm mt-0.5">
                Rastreie e gerencie procedimentos de apostas
              </p>
            </div>
          </div>
          {canEdit && (
            <div className="flex gap-2 flex-shrink-0">
              <Button
                variant="outline"
                onClick={() => setShowRegisterBotModal(true)}
                size="sm"
                className="border-primary/30 hover:bg-primary/10 text-primary h-9"
                data-testid="button-registrar-bot"
              >
                <Bot className="w-3.5 h-3.5 mr-1.5" />
                Registrar via Bot
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowRelatorioModal(true)}
                size="sm"
                className="border-white/10 hover:bg-white/5 h-9"
                data-testid="button-gerar-relatorio"
              >
                <FileText className="w-3.5 h-3.5 mr-1.5" />
                Gerar Relatório
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowImportModal(true)}
                size="sm"
                className="border-white/10 hover:bg-white/5 h-9"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Importar CSV
              </Button>
              <Button
                onClick={handleAdd}
                size="sm"
                className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-md shadow-primary/20 h-9 font-semibold"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Adicionar
              </Button>
            </div>
          )}
        </div>

        {/* ── Alertas ── */}
        {showNotifications && (
          <NotificationPanel
            procedures={monthProcedures}
            onDismiss={() => setShowNotifications(false)}
            onProcedureClick={(proc) => handleEdit(proc)}
          />
        )}

        {/* ── Filtros ── */}
        <ProcedureFilters
          filters={filters}
          onFilterChange={setFilters}
          platforms={getAllPlatforms(procedures)}
          statuses={getAllStatuses(procedures)}
          availableTags={getAllTags(procedures)}
        />

        {/* ── Lista de Procedimentos ── */}
        <div className="glass rounded-2xl border border-white/5 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 p-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
                <List className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Lista de Procedimentos</h3>
                <p className="text-[10px] text-muted-foreground">
                  {filteredProcedures.length} de {procedures.length} procedimentos
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowColumnCustomizer(true)}
              className="hidden lg:flex border-white/10 hover:bg-white/5 h-8 text-xs"
            >
              <Columns className="w-3.5 h-3.5 mr-1.5" />
              Colunas
            </Button>
          </div>
          <div className="p-0">
            <ProcedureTable
              procedures={filteredProcedures}
              visibleColumns={visibleColumns}
              onEdit={canEdit ? handleEdit : undefined}
              onDelete={canEdit ? handleDelete : undefined}
              onArchive={canEdit ? handleArchive : undefined}
              onCheckResult={canEdit ? handleCheckResult : undefined}
              onToggleFavorite={handleToggleFavorite}
              onConfirmBot={canEdit ? handleConfirmBot : undefined}
            />
          </div>
          <div className="p-3">
            <ProcedureMobileCards
              procedures={filteredProcedures}
              onEdit={canEdit ? handleEdit : undefined}
              onDelete={canEdit ? handleDelete : undefined}
              onArchive={canEdit ? handleArchive : undefined}
              onCheckResult={canEdit ? handleCheckResult : undefined}
              onToggleFavorite={handleToggleFavorite}
              onConfirmBot={canEdit ? handleConfirmBot : undefined}
            />
          </div>
        </div>
      </div>

      {/* ── Modais ── */}
      {showModal && (
        <ProcedureModal
          procedure={editingProcedure}
          onClose={() => {
            setShowModal(false);
            setEditingProcedure(null);
          }}
        />
      )}
      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => refetch()}
        />
      )}
      <GerarRelatorioModal
        open={showRelatorioModal}
        onOpenChange={setShowRelatorioModal}
        procedures={procedures}
      />
      <RegisterBotMessageModal
        open={showRegisterBotModal}
        onClose={() => setShowRegisterBotModal(false)}
      />
      {showColumnCustomizer && (
        <ColumnCustomizer
          visibleColumns={visibleColumns}
          onColumnsChange={setVisibleColumns}
          onClose={() => setShowColumnCustomizer(false)}
        />
      )}
      {resultProcedure && (
        <DefinirResultadosModal
          procedure={resultProcedure}
          originProcedure={
            resultProcedure.tipo === 'QUEIMAR_FB' && resultProcedure.freebet_reference_id
              ? procedures.find((p) => p.id === resultProcedure.freebet_reference_id) ?? null
              : null
          }
          onClose={() => setResultProcedure(null)}
        />
      )}
    </Layout>
  );
}

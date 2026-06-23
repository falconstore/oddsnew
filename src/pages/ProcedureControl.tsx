import { useState, useMemo } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import { startOfMonth, endOfMonth, endOfDay, differenceInDays } from 'date-fns';
import { Plus, FileText, Columns, Upload, List, Bot, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabaseProcedures } from '@/lib/supabaseProcedures';

import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';

import { useProcedures, useDeleteProcedure, useToggleFavorite, useArchiveProcedure } from '@/hooks/useProcedures';
import { Procedure, ProcedureFilters as FiltersType, AVAILABLE_COLUMNS } from '@/types/procedures';
import { getGameTimeBucket } from '@/lib/procedureGameTime';
import { DefinirResultadosModal } from '@/components/procedures/DefinirResultadosModal';
import {
  parseDate,
  getAllPlatforms,
  getAllStatuses,
  getAllTags,
  normalizePlatformName,
} from '@/lib/procedureUtils';

import { ProcedureFilters } from '@/components/procedures/ProcedureFilters';
import { ProcedureTable } from '@/components/procedures/ProcedureTable';
import { ProcedureMobileCards } from '@/components/procedures/ProcedureMobileCards';
import { ProcedureModal } from '@/components/procedures/ProcedureModal';
import { ImportModal } from '@/components/procedures/ImportModal';
import { GerarRelatorioModal } from '@/components/procedures/GerarRelatorioModal';
import { RegisterBotMessageModal } from '@/components/procedures/RegisterBotMessageModal';
import { ColumnCustomizer } from '@/components/procedures/ColumnCustomizer';
import { FilaConferencia } from '@/components/procedures/FilaConferencia';
import { useAuth } from '@/contexts/AuthContext';
import { PAGE_KEYS } from '@/types/auth';

export default function ProcedureControl() {
  const { canEditPage } = useAuth();
  const canEdit = canEditPage(PAGE_KEYS.PROCEDURE_CONTROL);
  const { data: procedures = [], refetch } = useProcedures();
  const proceduresById = useMemo(() => {
    const m = new Map<string, Procedure>();
    for (const p of procedures) m.set(p.id, p);
    return m;
  }, [procedures]);
  const deleteProcedure = useDeleteProcedure();
  const toggleFavorite = useToggleFavorite();
  const archiveProcedure = useArchiveProcedure();

  const [showModal, setShowModal] = useState(false);
  const [editingProcedure, setEditingProcedure] = useState<Procedure | null>(null);
  const [resultProcedure, setResultProcedure] = useState<Procedure | null>(null);
  // selectedMonth shared via localStorage with Dashboard (same key)
  const [selectedMonth, setSelectedMonth] = usePersistedState('proc_month', new Date());
  const [showImportModal, setShowImportModal] = useState(false);
  const [showRelatorioModal, setShowRelatorioModal] = useState(false);
  const [showColumnCustomizer, setShowColumnCustomizer] = useState(false);
  const [showRegisterBotModal, setShowRegisterBotModal] = useState(false);
  const [isNormalizingPlatforms, setIsNormalizingPlatforms] = useState(false);
  const { toast } = useToast();

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

  const handleNormalizePlatforms = async () => {
    setIsNormalizingPlatforms(true);
    try {
      const { data, error } = await supabaseProcedures.rpc('normalize_procedure_platforms');
      if (error) throw error;
      const count = data as number;
      await refetch();
      toast({
        title: 'Plataformas normalizadas',
        description: count > 0
          ? `${count} registro${count !== 1 ? 's' : ''} corrigido${count !== 1 ? 's' : ''} com sucesso.`
          : 'Nenhum registro precisava de correção.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({ title: 'Erro ao normalizar', description: msg, variant: 'destructive' });
    } finally {
      setIsNormalizingPlatforms(false);
    }
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
      if (filters.platform !== 'all' && normalizePlatformName(proc.platform) !== filters.platform) return false;
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
            (cleanStatus === 'aguardando resultado' && daysAgo > 1) ||
            (cleanStatus === 'referência faltando' && daysAgo > 1)
          );
          if (!isUrgent) return false;
        }
        if (filters.urgent === 'pending') {
          const isPending = (
            cleanStatus === 'falta girar freebet' ||
            cleanStatus === 'falta girar freeebet' ||
            cleanStatus === 'enviada partida em aberto' ||
            cleanStatus === 'aguardando resultado' ||
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
      // 1º critério: data DESC (mais recente primeiro) — mantém agrupamento por data correto
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      // 2º critério: nº do procedimento DESC dentro do mesmo dia
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
        <PageHeader
          eyebrow="PROC"
          title="Controle de Procedimentos"
          subtitle="RASTREIE E GERENCIE PROCEDIMENTOS DE APOSTAS"
          icon={FileText}
          actions={canEdit ? (
            <>
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
                onClick={handleNormalizePlatforms}
                disabled={isNormalizingPlatforms}
                size="sm"
                className="border-white/10 hover:bg-white/5 h-9"
                data-testid="button-normalizar-plataformas"
                title="Corrige capitalização dos nomes de plataforma já salvos no banco"
              >
                <Wand2 className="w-3.5 h-3.5 mr-1.5" />
                {isNormalizingPlatforms ? 'Normalizando...' : 'Normalizar Plataformas'}
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
            </>
          ) : undefined}
        />

        {/* ── Fila de Conferência ── */}
        {canEdit && (
          <FilaConferencia
            procedures={procedures}
            onCheckResult={handleCheckResult}
          />
        )}

        {/* ── Filtros ── */}
        <ProcedureFilters
          filters={filters}
          onFilterChange={setFilters}
          platforms={getAllPlatforms(procedures)}
          statuses={getAllStatuses(procedures)}
          availableTags={getAllTags(procedures)}
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
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
              proceduresById={proceduresById}
              visibleColumns={visibleColumns}
              onEdit={canEdit ? handleEdit : undefined}
              onDelete={canEdit ? handleDelete : undefined}
              onCheckResult={canEdit ? handleCheckResult : undefined}
              onToggleFavorite={handleToggleFavorite}
            />
          </div>
          <div className="p-3">
            <ProcedureMobileCards
              procedures={filteredProcedures}
              proceduresById={proceduresById}
              onEdit={canEdit ? handleEdit : undefined}
              onDelete={canEdit ? handleDelete : undefined}
              onCheckResult={canEdit ? handleCheckResult : undefined}
              onToggleFavorite={handleToggleFavorite}
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
          originProcedures={
            resultProcedure.tipo === 'QUEIMAR_FB'
              ? (() => {
                  // Multi-origem: resolve TODAS as origens (array), com fallback
                  // pro singular legado. Ordem preservada; primeiro = primário.
                  const ids = resultProcedure.freebet_reference_ids?.length
                    ? resultProcedure.freebet_reference_ids
                    : (resultProcedure.freebet_reference_id ? [resultProcedure.freebet_reference_id] : []);
                  return ids
                    .map((id) => procedures.find((p) => p.id === id))
                    .filter(Boolean) as typeof procedures;
                })()
              : null
          }
          onClose={() => setResultProcedure(null)}
        />
      )}
    </Layout>
  );
}

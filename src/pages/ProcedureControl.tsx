import { useState, useMemo } from 'react';
import { startOfMonth, endOfMonth, endOfDay, differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Plus, TrendingUp, Calendar, Activity, FileText, 
  Clock, Trophy, Columns, Upload 
} from 'lucide-react';

import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { useProcedures, useDeleteProcedure, useToggleFavorite } from '@/hooks/useProcedures';
import { Procedure, ProcedureFilters as FiltersType, AVAILABLE_COLUMNS } from '@/types/procedures';
import {
  parseDate,
  getCurrentMonthProfit,
  getAverageDailyProfit,
  getAverageProceduresPerDay,
  getTotalProceduresForMonth,
  getOpenProcedures,
  getOpenMatches,
  getBestPlatform,
  getDayWithMostProfit,
  getDayWithMostProcedures,
  getMountainChartData,
  getDailyProfitData,
  getAllPlatforms,
  getAllStatuses,
  getAllTags,
  generateMonthOptions,
  capitalizeMonth
} from '@/lib/procedureUtils';

import { StatCard } from '@/components/procedures/ProcedureStats';
import { ProcedureFilters } from '@/components/procedures/ProcedureFilters';
import { ProcedureTable } from '@/components/procedures/ProcedureTable';
import { ProcedureMobileCards } from '@/components/procedures/ProcedureMobileCards';
import { ProcedureModal } from '@/components/procedures/ProcedureModal';
import { ImportModal } from '@/components/procedures/ImportModal';
import { ColumnCustomizer } from '@/components/procedures/ColumnCustomizer';
import { NotificationPanel } from '@/components/procedures/NotificationPanel';
import { MountainChart } from '@/components/procedures/MountainChart';
import { CalendarChart } from '@/components/procedures/CalendarChart';

export default function ProcedureControl() {
  const { data: procedures = [], refetch } = useProcedures();
  const deleteProcedure = useDeleteProcedure();
  const toggleFavorite = useToggleFavorite();
  
  const [showModal, setShowModal] = useState(false);
  const [editingProcedure, setEditingProcedure] = useState<Procedure | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showNotifications, setShowNotifications] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showColumnCustomizer, setShowColumnCustomizer] = useState(false);
  
  const [filters, setFilters] = useState<FiltersType>({
    searchNumber: '',
    searchPromotion: '',
    searchTags: 'all',
    platform: 'all',
    category: 'all',
    status: 'all',
    profitLoss: 'all',
    urgent: 'all',
    hasFreebetValue: 'all',
    onlyFavorites: false
  });
  
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('procedureVisibleColumns');
    return saved ? JSON.parse(saved) : AVAILABLE_COLUMNS.map(col => col.key);
  });

  const handleEdit = (proc: Procedure) => {
    setEditingProcedure(proc);
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingProcedure(null);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja remover este procedimento?')) {
      await deleteProcedure.mutateAsync(id);
    }
  };

  const handleToggleFavorite = (proc: Procedure) => {
    toggleFavorite.mutate({ id: proc.id, is_favorite: !proc.is_favorite });
  };

  // Filtered procedures
  const filteredProcedures = useMemo(() => {
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfDay(endOfMonth(selectedMonth));
    const today = new Date();

    return procedures.filter(proc => {
      const procDate = parseDate(proc.date);
      if (!procDate || procDate < monthStart || procDate > monthEnd) return false;

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

  // Stats
  const bestPlatform = getBestPlatform(procedures, selectedMonth);
  const dayWithMostProfit = getDayWithMostProfit(procedures, selectedMonth);
  const dayWithMostProcedures = getDayWithMostProcedures(procedures, selectedMonth);

  // Procedures for notifications (current month only)
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
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold mb-2">Controle de Procedimentos</h1>
            <p className="text-muted-foreground text-xs md:text-sm">Rastreie e gerencie procedimentos de apostas</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowImportModal(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Importar CSV
            </Button>
            <Button onClick={handleAdd}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          </div>
        </div>

        {/* Stats Row 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2 md:gap-3">
          {/* Month Selector Card */}
          <Card className="p-4 flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-[10px] text-muted-foreground font-medium mb-1">Mês Atual</p>
                <Select
                  value={selectedMonth.toISOString()}
                  onValueChange={(value) => setSelectedMonth(new Date(value))}
                >
                  <SelectTrigger className="bg-transparent border-none text-xl font-bold p-0 h-auto hover:text-primary transition-colors">
                    <SelectValue>
                      {capitalizeMonth(format(selectedMonth, 'MMMM', { locale: ptBR }))}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {generateMonthOptions().map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {capitalizeMonth(option.label)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {format(selectedMonth, 'yyyy', { locale: ptBR })}
                </p>
              </div>
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center backdrop-blur-sm flex-shrink-0">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
            </div>
          </Card>

          <StatCard
            title="Lucro Mensal"
            value={`R$ ${getCurrentMonthProfit(procedures, selectedMonth).toFixed(2)}`}
            icon={TrendingUp}
            gradient="bg-success/10"
          />
          <StatCard
            title="Lucro Médio Diário"
            value={`R$ ${getAverageDailyProfit(procedures, selectedMonth).toFixed(2)}`}
            icon={Activity}
            gradient="bg-purple-500/10"
          />
          <StatCard
            title="Média Proc./Dia"
            value={getAverageProceduresPerDay(procedures, selectedMonth)}
            icon={FileText}
            gradient="bg-cyan-500/10"
          />
          <StatCard
            title="Total de Procedimentos"
            value={getTotalProceduresForMonth(procedures, selectedMonth)}
            icon={FileText}
            gradient="bg-indigo-500/10"
          />
        </div>

        {/* Stats Row 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 md:gap-3">
          <StatCard
            title="Procedimentos Abertos"
            value={getOpenProcedures(procedures, selectedMonth)}
            subtitle="Falta Girar Freebet"
            icon={Clock}
            gradient="bg-amber-500/10"
          />
          <StatCard
            title="Partidas em Aberto"
            value={getOpenMatches(procedures, selectedMonth)}
            subtitle="Aguardando resultado"
            icon={Activity}
            gradient="bg-orange-500/10"
          />
          <StatCard
            title="Melhor Plataforma"
            value={bestPlatform.name}
            subtitle={`R$ ${bestPlatform.profit.toFixed(2)} • ${bestPlatform.count} proc.`}
            icon={Trophy}
            gradient="bg-yellow-500/10"
          />
          <StatCard
            title="Dia com Maior Lucro"
            value={dayWithMostProfit.date}
            subtitle={`R$ ${dayWithMostProfit.profit.toFixed(2)}`}
            icon={TrendingUp}
            gradient="bg-success/10"
          />
          <StatCard
            title="Dia com Mais Proc."
            value={dayWithMostProcedures.date}
            subtitle={`${dayWithMostProcedures.count} procedimentos`}
            icon={FileText}
            gradient="bg-primary/10"
          />
        </div>

        {/* Notifications */}
        {showNotifications && (
          <NotificationPanel
            procedures={monthProcedures}
            onDismiss={() => setShowNotifications(false)}
            onProcedureClick={(proc) => handleEdit(proc)}
          />
        )}

        {/* Filters */}
        <ProcedureFilters
          filters={filters}
          onFilterChange={setFilters}
          platforms={getAllPlatforms(procedures)}
          statuses={getAllStatuses(procedures)}
          availableTags={getAllTags(procedures)}
        />

        {/* Charts */}
        <div className="grid grid-cols-1 gap-6">
          <CalendarChart
            data={getDailyProfitData(procedures, selectedMonth)}
            title="Calendário de Lucro/Prejuízo"
            selectedMonth={selectedMonth}
          />
          <MountainChart
            data={getMountainChartData(procedures, selectedMonth)}
            title="Evolução do Lucro (Inicial: R$ 1.000)"
          />
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <CardTitle className="text-base md:text-lg">Lista de Procedimentos</CardTitle>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  Mostrando {filteredProcedures.length} de {procedures.length} procedimentos
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowColumnCustomizer(true)}
                  className="hidden lg:flex"
                >
                  <Columns className="w-4 h-4 mr-2" />
                  Colunas
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ProcedureTable
              procedures={filteredProcedures}
              visibleColumns={visibleColumns}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleFavorite={handleToggleFavorite}
            />
            <ProcedureMobileCards
              procedures={filteredProcedures}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleFavorite={handleToggleFavorite}
            />
          </CardContent>
        </Card>

        {/* Modals */}
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

        {showColumnCustomizer && (
          <ColumnCustomizer
            visibleColumns={visibleColumns}
            onColumnsChange={setVisibleColumns}
            onClose={() => setShowColumnCustomizer(false)}
          />
        )}
      </div>
    </Layout>
  );
}

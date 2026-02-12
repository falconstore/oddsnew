import { useState, useMemo } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Calendar, RefreshCw, Download } from 'lucide-react';

import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { useBetbraData, useDeleteBetbraEntry } from '@/hooks/useBetbraData';
import { BetbraEntry } from '@/types/betbra';
import {
  calculateBetbraStats,
  filterByMonth,
  generateBetbraMonthOptions,
  capitalizeMonth,
  getDailyTurnoverData,
  getDailyNgrData,
  getAccumulatedNgrData,
} from '@/lib/betbraUtils';

import { BetbraStats } from '@/components/betbra/BetbraStats';
import { BetbraCharts } from '@/components/betbra/BetbraCharts';
import { BetbraTable, BetbraMobileCards } from '@/components/betbra/BetbraTable';
import { BetbraModal } from '@/components/betbra/BetbraModal';
import { useAuth } from '@/contexts/AuthContext';
import { PAGE_KEYS } from '@/types/auth';

export default function BetbraAffiliate() {
  const { canEditPage } = useAuth();
  const canEdit = canEditPage(PAGE_KEYS.BETBRA_AFFILIATE);
  const { data: entries = [], refetch, isRefetching } = useBetbraData();
  const deleteEntry = useDeleteBetbraEntry();

  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BetbraEntry | null>(null);
  const [selectedMonth, setSelectedMonth] = usePersistedState('betbra_month', new Date());

  // Filter entries by selected month
  const filteredEntries = useMemo(() => {
    return filterByMonth(entries, selectedMonth)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, selectedMonth]);

  // Calculate stats
  const stats = useMemo(() => {
    return calculateBetbraStats(filteredEntries);
  }, [filteredEntries]);

  // Chart data
  const turnoverData = useMemo(() => getDailyTurnoverData(entries, selectedMonth), [entries, selectedMonth]);
  const ngrData = useMemo(() => getDailyNgrData(entries, selectedMonth), [entries, selectedMonth]);
  const accumulatedNgrData = useMemo(() => getAccumulatedNgrData(entries, selectedMonth), [entries, selectedMonth]);

  const handleEdit = (entry: BetbraEntry) => {
    setEditingEntry(entry);
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingEntry(null);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja remover este registro?')) {
      await deleteEntry.mutateAsync(id);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Data', 'Registros', 'Apostas', 'NGR', 'Turnover', 'CPA'];
    const rows = filteredEntries.map(entry => [
      entry.date,
      entry.registros,
      entry.numero_de_apostas,
      entry.ngr,
      entry.turnover,
      entry.cpa,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `betbra_${format(selectedMonth, 'yyyy-MM')}.csv`;
    link.click();
  };

  return (
    <Layout>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold mb-2">Betbra Affiliate</h1>
            <p className="text-muted-foreground text-xs md:text-sm">Gerenciar dados de afiliação Betbra</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
            <Button variant="outline" onClick={() => refetch()} disabled={isRefetching}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            {canEdit && (
              <Button onClick={handleAdd}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar
              </Button>
            )}
          </div>
        </div>

        {/* Month Selector */}
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-medium">Mês Selecionado</p>
                <Select
                  value={selectedMonth.toISOString()}
                  onValueChange={(value) => setSelectedMonth(new Date(value))}
                >
                  <SelectTrigger className="bg-transparent border-none text-lg font-bold p-0 h-auto hover:text-primary transition-colors">
                    <SelectValue>
                      {capitalizeMonth(format(selectedMonth, 'MMMM yyyy', { locale: ptBR }))}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {generateBetbraMonthOptions().map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {capitalizeMonth(option.label)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="ml-auto text-xs text-muted-foreground">
              {filteredEntries.length} registros
            </div>
          </div>
        </Card>

        {/* Stats Cards */}
        <BetbraStats stats={stats} />

        {/* Charts */}
        <BetbraCharts
          turnoverData={turnoverData}
          ngrData={ngrData}
          accumulatedNgrData={accumulatedNgrData}
        />

        {/* Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <CardTitle className="text-base md:text-lg">Lista de Registros</CardTitle>
              <span className="text-xs text-muted-foreground">
                Mostrando {filteredEntries.length} de {entries.length} registros
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {/* Desktop Table */}
            <div className="hidden lg:block">
              <BetbraTable
                entries={filteredEntries}
                onEdit={canEdit ? handleEdit : undefined}
                onDelete={canEdit ? handleDelete : undefined}
              />
            </div>
            {/* Mobile Cards */}
            <BetbraMobileCards
              entries={filteredEntries}
              onEdit={canEdit ? handleEdit : undefined}
              onDelete={canEdit ? handleDelete : undefined}
            />
          </CardContent>
        </Card>

        {/* Modal */}
        {showModal && (
          <BetbraModal
            entry={editingEntry}
            onClose={() => {
              setShowModal(false);
              setEditingEntry(null);
            }}
          />
        )}
      </div>
    </Layout>
  );
}

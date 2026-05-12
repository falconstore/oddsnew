import { useState, useMemo } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Calendar, RefreshCw, Download, TrendingUp, Zap, Bot, Clock, AlertTriangle } from 'lucide-react';

import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { useBetbraData, useDeleteBetbraEntry, useRefreshBetbraScraper, useBetbraScraperCheck } from '@/hooks/useBetbraData';
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
  const refreshScraper = useRefreshBetbraScraper();
  const { data: scraperCheck } = useBetbraScraperCheck();

  const cookieConfigured = scraperCheck?.cookie_configured ?? true; // optimistic while loading

  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BetbraEntry | null>(null);
  const [selectedMonth, setSelectedMonth] = usePersistedState('betbra_month', new Date());

  const filteredEntries = useMemo(() => {
    return filterByMonth(entries, selectedMonth)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, selectedMonth]);

  const stats = useMemo(() => calculateBetbraStats(filteredEntries), [filteredEntries]);

  const turnoverData = useMemo(() => getDailyTurnoverData(entries, selectedMonth), [entries, selectedMonth]);
  const ngrData = useMemo(() => getDailyNgrData(entries, selectedMonth), [entries, selectedMonth]);
  const accumulatedNgrData = useMemo(() => getAccumulatedNgrData(entries, selectedMonth), [entries, selectedMonth]);

  // Last update timestamp from scraped rows in the current month
  const lastUpdatedAt = useMemo(() => {
    const timestamps = filteredEntries
      .map(e => e.updated_at)
      .filter(Boolean) as string[];
    if (!timestamps.length) return null;
    return timestamps.sort().reverse()[0];
  }, [filteredEntries]);

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdatedAt) return null;
    try {
      return formatDistanceToNow(new Date(lastUpdatedAt), { locale: ptBR, addSuffix: true });
    } catch {
      return null;
    }
  }, [lastUpdatedAt]);

  const handleEdit = (entry: BetbraEntry) => { setEditingEntry(entry); setShowModal(true); };
  const handleAdd = () => { setEditingEntry(null); setShowModal(true); };
  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja remover este registro?')) {
      await deleteEntry.mutateAsync(id);
    }
  };

  const handleScrape = () => {
    if (!cookieConfigured) {
      return; // guard: button is disabled, this won't be called
    }
    refreshScraper.mutate(selectedMonth);
  };

  const handleExportCSV = () => {
    const headers = ['Data', 'Registros', 'Apostas', 'NGR', 'Turnover', 'CPA'];
    const rows = filteredEntries.map(entry => [
      entry.date, entry.registros, entry.numero_de_apostas, entry.ngr, entry.turnover, entry.cpa,
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `betbra_${format(selectedMonth, 'yyyy-MM')}.csv`;
    link.click();
  };

  return (
    <Layout>
      <div className="relative space-y-4 md:space-y-6 animate-fade-in">

        {/* Background glow + grid effect */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-amber-500/5 blur-[140px]" />
          <div className="absolute top-1/3 right-0 w-[500px] h-[500px] rounded-full bg-primary/4 blur-[120px]" />
        </div>
        <div
          className="fixed inset-0 pointer-events-none -z-10 opacity-30"
          style={{
            backgroundImage: `linear-gradient(hsl(145 80% 48% / 0.04) 1px, transparent 1px), linear-gradient(90deg, hsl(145 80% 48% / 0.04) 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, white 30%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, white 30%, transparent 100%)',
          }}
        />

        {/* Hero Header */}
        <div className="relative rounded-3xl overflow-hidden border border-white/8 glass p-6 md:p-8">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] rounded-full bg-amber-500/8 blur-[80px]" />
          </div>
          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              backgroundImage: `linear-gradient(hsl(145 80% 48% / 0.05) 1px, transparent 1px), linear-gradient(90deg, hsl(145 80% 48% / 0.05) 1px, transparent 1px)`,
              backgroundSize: '40px 40px',
              maskImage: 'radial-gradient(ellipse 100% 100% at 50% 0%, white 20%, transparent 80%)',
              WebkitMaskImage: 'radial-gradient(ellipse 100% 100% at 50% 0%, white 20%, transparent 80%)',
            }}
          />

          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                <Zap className="w-3 h-3" />
                Afiliado Betbra
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse-glow" />
              </div>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/25 to-amber-600/10 border border-amber-500/25 flex items-center justify-center shadow-lg shadow-amber-500/10 flex-shrink-0">
                  <TrendingUp className="h-7 w-7 text-amber-400" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight gradient-text-warm">
                    Betbra Affiliate
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    Gerenciar dados de afiliação Betbra
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <Button variant="glass" size="sm" onClick={handleExportCSV} data-testid="button-export">
                <Download className="w-4 h-4 mr-1.5" />
                Exportar
              </Button>
              <Button variant="glass" size="sm" onClick={() => refetch()} disabled={isRefetching} data-testid="button-refresh">
                <RefreshCw className={`w-4 h-4 mr-1.5 ${isRefetching ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              {canEdit && !cookieConfigured && (
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs"
                  title="Configure o secret BETBRA_COOKIE no Supabase para usar o scraper"
                  data-testid="badge-cookie-missing"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  BETBRA_COOKIE não configurado
                </div>
              )}
              {canEdit && (
                <Button
                  size="sm"
                  onClick={handleScrape}
                  disabled={refreshScraper.isPending || !cookieConfigured}
                  title={!cookieConfigured ? 'Configure o secret BETBRA_COOKIE no Supabase para usar o scraper' : 'Buscar dados automaticamente do painel Betbra'}
                  className="bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 text-white font-semibold shadow-lg shadow-violet-500/20 border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="button-scrape"
                >
                  <Bot className={`w-4 h-4 mr-1.5 ${refreshScraper.isPending ? 'animate-spin' : ''}`} />
                  {refreshScraper.isPending ? 'Buscando...' : 'Atualizar via Scraper'}
                </Button>
              )}
              {canEdit && (
                <Button size="sm" onClick={handleAdd} className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold shadow-lg shadow-amber-500/20 border-0" data-testid="button-add">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Adicionar
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Month Selector */}
        <div className="glass rounded-2xl border border-white/5 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/15 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-0.5">Mês Selecionado</p>
              <Select
                value={selectedMonth.toISOString()}
                onValueChange={(value) => setSelectedMonth(new Date(value))}
              >
                <SelectTrigger className="bg-transparent border-none text-lg font-bold p-0 h-auto hover:text-amber-400 transition-colors w-auto min-w-[180px]" data-testid="select-month">
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
          <div className="flex items-center gap-3 flex-wrap">
            {lastUpdatedLabel && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-500/10 border border-violet-500/20" data-testid="badge-last-updated">
                <Clock className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-xs text-violet-300">Scraper: {lastUpdatedLabel}</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/3 border border-white/5">
              <span className="text-xs text-muted-foreground">{filteredEntries.length} registros</span>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <BetbraStats stats={stats} />

        {/* Charts */}
        <BetbraCharts
          turnoverData={turnoverData}
          ngrData={ngrData}
          accumulatedNgrData={accumulatedNgrData}
        />

        {/* Table */}
        <div className="glass rounded-2xl border border-white/5 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 p-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-amber-400 to-amber-600" />
              <h2 className="text-base font-semibold">Lista de Registros</h2>
            </div>
            <span className="text-xs text-muted-foreground">
              Mostrando {filteredEntries.length} de {entries.length} registros
            </span>
          </div>
          <div className="p-4">
            <div className="hidden lg:block">
              <BetbraTable
                entries={filteredEntries}
                onEdit={canEdit ? handleEdit : undefined}
                onDelete={canEdit ? handleDelete : undefined}
              />
            </div>
            <BetbraMobileCards
              entries={filteredEntries}
              onEdit={canEdit ? handleEdit : undefined}
              onDelete={canEdit ? handleDelete : undefined}
            />
          </div>
        </div>

        {showModal && (
          <BetbraModal
            entry={editingEntry}
            onClose={() => { setShowModal(false); setEditingEntry(null); }}
          />
        )}
      </div>
    </Layout>
  );
}

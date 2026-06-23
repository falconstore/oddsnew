import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Building2, Plus, Pencil, Power, ExternalLink, BarChart2,
  Trophy, TrendingUp, Activity, Calendar, Search, ChevronUp, ChevronDown, Download
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/components/ui/action-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBookmakers, useCreateBookmaker, useUpdateBookmaker } from '@/hooks/useBookmakers';
import { useProcedures } from '@/hooks/useProcedures';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useAuth } from '@/contexts/AuthContext';
import { PAGE_KEYS } from '@/types/auth';
import type { Bookmaker, EntityStatus } from '@/types/database';
import { capitalizeMonth, generateBetbraMonthOptions } from '@/lib/betbraUtils';
import { getAllPlatforms } from '@/lib/procedureUtils';

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1.5">
      {label}
      {required && <span className="text-primary">*</span>}
    </Label>
  );
}

function BookmakerModal({
  bookmaker,
  initialName,
  onClose,
  onCreate,
  onUpdate,
  isPending,
}: {
  bookmaker: Bookmaker | null;
  initialName?: string;
  onClose: () => void;
  onCreate: (data: Partial<Bookmaker>) => void;
  onUpdate: (data: Partial<Bookmaker> & { id: string }) => void;
  isPending: boolean;
}) {
  const isEditing = !!bookmaker;
  const [formData, setFormData] = useState({
    name: bookmaker?.name || initialName || '',
    website_url: bookmaker?.website_url || '',
    priority: bookmaker?.priority ?? 0,
    status: (bookmaker?.status || 'active') as EntityStatus,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      onUpdate({ id: bookmaker!.id, ...formData });
    } else {
      onCreate(formData);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md animate-fade-in-up">
        <div className="glass rounded-3xl border border-border shadow-2xl shadow-black/50 overflow-hidden">
          <div className="relative border-b border-white/10 p-5 bg-card">
            <div className="absolute inset-0 bg-gradient-to-b from-background/90 to-background/70" />
            <div className="relative flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl border border-border bg-muted flex items-center justify-center">
                <Building2 className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-base font-bold">{isEditing ? 'Editar Casa' : 'Cadastrar Casa'}</h2>
                <p className="text-xs text-muted-foreground">{isEditing ? `Editando ${bookmaker?.name}` : 'Cadastrar casa de apostas'}</p>
              </div>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-4 bg-background/95">
            <div>
              <FieldLabel label="Nome" required />
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Betano, Bet365..."
                required
                className="bg-white/5 border-white/10 focus:border-primary/50 h-9 text-sm"
                data-testid="input-casa-name"
              />
            </div>
            <div>
              <FieldLabel label="Website" />
              <Input
                value={formData.website_url}
                onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                placeholder="https://betano.com.br"
                className="bg-white/5 border-white/10 focus:border-primary/50 h-9 text-sm"
                data-testid="input-casa-website"
              />
            </div>
            <div>
              <FieldLabel label="Prioridade (ordenação)" />
              <Input
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                className="bg-white/5 border-white/10 focus:border-primary/50 h-9 text-sm"
                data-testid="input-casa-priority"
              />
            </div>
            <div>
              <FieldLabel label="Status" required />
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as EntityStatus })}>
                <SelectTrigger className="bg-white/5 border-white/10 focus:border-primary/50 h-9 text-sm" data-testid="select-casa-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="inactive">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}
                className="flex-1 border-white/10 hover:bg-white/5 h-9 text-sm">
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground border-0 h-9 text-sm font-semibold"
                data-testid="button-save-casa">
                {isPending ? 'Salvando...' : isEditing ? 'Salvar' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

type SortKey = 'name' | 'count_month' | 'profit_month' | 'count_total' | 'profit_total';
type SortDir = 'asc' | 'desc';

const fmtBRL = (value: number, decimals = 2) => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
};

const EntityManagement = () => {
  const { canEditPage } = useAuth();
  const canEdit = canEditPage(PAGE_KEYS.BOOKMAKERS);

  const { data: bookmakers = [], isLoading: loadingCasas } = useBookmakers();
  const { data: procedures = [], isLoading: loadingProcs } = useProcedures();

  const [activeTab, setActiveTab] = usePersistedState<'casas' | 'analise'>('crm_tab', 'casas');
  const [showModal, setShowModal] = useState(false);
  const [editingCasa, setEditingCasa] = useState<Bookmaker | null>(null);
  const [prefillName, setPrefillName] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'db' | 'orphan'>('all');
  const [selectedMonth, setSelectedMonth] = usePersistedState('crm_month', new Date());
  const [sortKey, setSortKey] = useState<SortKey>('count_month');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const createBookmaker = useCreateBookmaker();
  const updateBookmaker = useUpdateBookmaker();

  const handleEdit = (casa: Bookmaker) => { setEditingCasa(casa); setPrefillName(undefined); setShowModal(true); };
  const handleAdd = (name?: string) => { setEditingCasa(null); setPrefillName(name); setShowModal(true); };
  const handleToggleStatus = (casa: Bookmaker) => {
    updateBookmaker.mutate({ id: casa.id, status: casa.status === 'active' ? 'inactive' : 'active' });
  };
  const handleModalClose = () => { setShowModal(false); setEditingCasa(null); setPrefillName(undefined); };

  const monthStr = format(selectedMonth, 'yyyy-MM');

  // All platforms used in procedures (sorted)
  const procedurePlatforms = useMemo(() => getAllPlatforms(procedures), [procedures]);

  // Bookmaker names from DB (normalized for comparison)
  const bookmakerNamesLower = useMemo(
    () => new Set(bookmakers.map(b => b.name.toLowerCase().trim())),
    [bookmakers]
  );

  // Platforms that exist in procedures but NOT in the bookmakers table
  const orphanPlatforms = useMemo(
    () => procedurePlatforms.filter(p => !bookmakerNamesLower.has(p.toLowerCase().trim())),
    [procedurePlatforms, bookmakerNamesLower]
  );

  const statsPerCasa = useMemo(() => {
    const map = new Map<string, { countTotal: number; countMonth: number; profitTotal: number; profitMonth: number }>();
    for (const proc of procedures) {
      const name = (proc.platform || '').toLowerCase().trim();
      if (!name) continue;
      if (!map.has(name)) map.set(name, { countTotal: 0, countMonth: 0, profitTotal: 0, profitMonth: 0 });
      const s = map.get(name)!;
      s.countTotal++;
      s.profitTotal += Number(proc.profit_loss) || 0;
      if (proc.date && proc.date.startsWith(monthStr)) {
        s.countMonth++;
        s.profitMonth += Number(proc.profit_loss) || 0;
      }
    }
    return map;
  }, [procedures, monthStr]);

  const getCasaStats = (name: string) =>
    statsPerCasa.get(name.toLowerCase().trim()) || { countTotal: 0, countMonth: 0, profitTotal: 0, profitMonth: 0 };

  // Combined list for filtering in Casas tab: DB bookmakers + orphan (from procedures)
  const allKnownNames = useMemo(
    () => [...bookmakers.map(b => b.name), ...orphanPlatforms],
    [bookmakers, orphanPlatforms]
  );

  const filteredCasas = useMemo(() => {
    let list = bookmakers;
    if (statusFilter !== 'all') list = list.filter(b => b.status === statusFilter);
    if (searchQuery) { const q = searchQuery.toLowerCase(); list = list.filter(b => b.name.toLowerCase().includes(q)); }
    return list;
  }, [bookmakers, searchQuery, statusFilter]);

  const filteredOrphans = useMemo(() => {
    if (statusFilter === 'inactive') return [];
    let list = orphanPlatforms;
    if (searchQuery) { const q = searchQuery.toLowerCase(); list = list.filter(p => p.toLowerCase().includes(q)); }
    return list;
  }, [orphanPlatforms, searchQuery, statusFilter]);

  const activeCasas = bookmakers.filter(b => b.status === 'active');

  // Combined ranking for Análise tab: DB bookmakers + orphan platforms as virtual entries
  const allEntries = useMemo(() => {
    const dbEntries = bookmakers.map(b => ({
      key: b.id,
      name: b.name,
      isOrphan: false,
      status: b.status,
      bookmaker: b,
    }));
    const orphanEntries = orphanPlatforms.map(p => ({
      key: `orphan:${p}`,
      name: p,
      isOrphan: true,
      status: 'active' as EntityStatus,
      bookmaker: null,
    }));
    return [...dbEntries, ...orphanEntries];
  }, [bookmakers, orphanPlatforms]);

  const analiseRanking = useMemo(() => {
    return allEntries.map(e => {
      const s = getCasaStats(e.name);
      return { ...e, ...s };
    }).sort((a, b) => {
      if (sortKey === 'name') return sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      let av = 0, bv = 0;
      if (sortKey === 'count_month') { av = a.countMonth; bv = b.countMonth; }
      if (sortKey === 'profit_month') { av = a.profitMonth; bv = b.profitMonth; }
      if (sortKey === 'count_total') { av = a.countTotal; bv = b.countTotal; }
      if (sortKey === 'profit_total') { av = a.profitTotal; bv = b.profitTotal; }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [allEntries, statsPerCasa, sortKey, sortDir]);

  const topMonthCasa = useMemo(() => {
    let best: string | null = null;
    let bestCount = 0;
    for (const e of allEntries) {
      const s = getCasaStats(e.name);
      if (s.countMonth > bestCount) { bestCount = s.countMonth; best = e.name; }
    }
    return bestCount > 0 ? { name: best!, count: bestCount } : null;
  }, [allEntries, statsPerCasa]);

  const topProfitCasa = useMemo(() => {
    let best: string | null = null;
    let bestProfit = -Infinity;
    for (const e of allEntries) {
      const s = getCasaStats(e.name);
      if (s.profitMonth > bestProfit) { bestProfit = s.profitMonth; best = e.name; }
    }
    return bestProfit > -Infinity ? { name: best!, profit: bestProfit } : null;
  }, [allEntries, statsPerCasa]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'desc' ? <ChevronDown className="w-3 h-3 text-primary" /> : <ChevronUp className="w-3 h-3 text-primary" />;
  };

  const tabBtn = (tab: 'casas' | 'analise', icon: React.ReactNode, label: string) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${activeTab === tab
        ? 'bg-primary/15 text-primary border border-primary/25 shadow-sm'
        : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
        }`}
      data-testid={`tab-${tab}`}
    >
      {icon}
      {label}
    </button>
  );

  const isLoading = loadingCasas || loadingProcs;
  const totalKnown = allKnownNames.length;

  return (
    <Layout>
      <div className="relative space-y-4 md:space-y-6 animate-fade-in">
        {/* Background glow */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
          <div className="absolute top-0 left-1/3 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-primary/5 blur-[130px]" />
          <div className="absolute top-1/2 right-0 w-[400px] h-[400px] rounded-full bg-muted/4 blur-[100px]" />
        </div>
        <div className="fixed inset-0 pointer-events-none -z-10 opacity-25"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--border) / 0.4) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.4) 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, white 30%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, white 30%, transparent 100%)',
          }}
        />

        <PageHeader
          eyebrow="CASAS"
          title="Casas de Apostas"
          subtitle={`${activeCasas.length} CADASTRADAS · ${orphanPlatforms.length > 0 ? `${orphanPlatforms.length} APENAS NOS PROCEDIMENTOS` : `${totalKnown} TOTAL`}`}
          icon={Building2}
          actions={canEdit && activeTab === 'casas' ? (
            <Button size="sm" onClick={() => handleAdd()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold border-0"
              data-testid="button-add-casa">
              <Plus className="w-4 h-4 mr-1.5" />
              Nova Casa
            </Button>
          ) : undefined}
        />

        {/* Tabs */}
        <div className="flex items-center gap-2 p-1 glass rounded-2xl border border-white/5 w-fit">
          {tabBtn('casas', <Building2 className="w-4 h-4" />, 'Casas')}
          {tabBtn('analise', <BarChart2 className="w-4 h-4" />, 'Análise')}
        </div>

        {/* Tab: Casas */}
        {activeTab === 'casas' && (
          <div className="space-y-5">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[140px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar casa..."
                  className="pl-9 bg-white/5 border-white/10 h-9 text-sm"
                  data-testid="input-search-casa"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'active' | 'inactive')} data-testid="select-filter-status">
                <SelectTrigger className="bg-white/5 border-white/10 h-9 text-sm w-full sm:w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="active">Apenas ativas</SelectItem>
                  <SelectItem value="inactive">Apenas inativas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as 'all' | 'db' | 'orphan')} data-testid="select-filter-source">
                <SelectTrigger className="bg-white/5 border-white/10 h-9 text-sm w-full sm:w-[170px]">
                  <SelectValue placeholder="Origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as origens</SelectItem>
                  <SelectItem value="db">Cadastradas</SelectItem>
                  <SelectItem value="orphan">Só nos procedimentos</SelectItem>
                </SelectContent>
              </Select>
              {(searchQuery || statusFilter !== 'all' || sourceFilter !== 'all') && (
                <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground hover:text-foreground px-2"
                  onClick={() => { setSearchQuery(''); setStatusFilter('all'); setSourceFilter('all'); }}
                  data-testid="button-clear-filters">
                  Limpar filtros
                </Button>
              )}
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="glass rounded-2xl border border-white/5 p-4 h-36 animate-pulse bg-white/2" />
                ))}
              </div>
            ) : (
              <>
                {/* Registered bookmakers */}
                {sourceFilter !== 'orphan' && filteredCasas.length > 0 && (
                  <div className="space-y-3">
                    {bookmakers.length > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-4 rounded-full bg-primary" />
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cadastradas ({filteredCasas.length})</p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {filteredCasas.map((casa) => {
                        const s = getCasaStats(casa.name);
                        const isActive = casa.status === 'active';
                        return (
                          <div key={casa.id} className={`relative rounded-2xl border p-4 card-hover overflow-hidden transition-all duration-300
                            ${isActive
                              ? 'bg-primary/10 border-primary/20'
                              : 'bg-white/2 border-white/8 opacity-60'
                            }`}
                            data-testid={`card-casa-${casa.id}`}
                          >
                            <div className={`absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r ${isActive ? 'from-primary to-primary/50' : 'from-white/20 to-transparent'} opacity-70`} />
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1 min-w-0">
                                <h3 className={`font-bold text-base truncate ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>{casa.name}</h3>
                                {casa.website_url && (
                                  <a href={casa.website_url} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 truncate mt-0.5">
                                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{(() => { try { return new URL(casa.website_url).hostname; } catch { return casa.website_url; } })()}</span>
                                  </a>
                                )}
                              </div>
                              <Badge className={`text-[10px] ml-2 flex-shrink-0 ${isActive ? 'bg-primary/15 text-primary border-primary/25' : 'bg-white/5 text-muted-foreground border-white/10'}`}>
                                {isActive ? 'Ativa' : 'Inativa'}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              <div className="bg-white/3 rounded-xl p-2 border border-white/5">
                                <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Procedimentos</p>
                                <p className="text-sm font-bold text-foreground">{s.countTotal}</p>
                              </div>
                              <div className="bg-white/3 rounded-xl p-2 border border-white/5">
                                <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Lucro Total</p>
                                <p className={`text-sm font-bold ${s.profitTotal >= 0 ? 'text-primary' : 'text-destructive'}`}>
                                  {fmtBRL(s.profitTotal, 2)}
                                </p>
                              </div>
                            </div>
                            {canEdit && (
                              <div className="flex gap-1.5">
                                <ActionButton
                                  showLabel
                                  block
                                  icon={Pencil}
                                  intent="edit"
                                  label="Editar"
                                  onClick={() => handleEdit(casa)}
                                  data-testid={`button-edit-casa-${casa.id}`}
                                />
                                <ActionButton
                                  showLabel
                                  block
                                  icon={Power}
                                  intent="warning"
                                  label={isActive ? 'Desativar' : 'Ativar'}
                                  onClick={() => handleToggleStatus(casa)}
                                  data-testid={`button-toggle-casa-${casa.id}`}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Orphan platforms from procedures */}
                {sourceFilter !== 'db' && filteredOrphans.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-4 rounded-full bg-warning" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nos procedimentos, não cadastradas ({filteredOrphans.length})</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {filteredOrphans.map((platformName) => {
                        const s = getCasaStats(platformName);
                        return (
                          <div key={platformName}
                            className="relative rounded-2xl border border-dashed border-warning/25 p-4 bg-warning/5 overflow-hidden transition-all duration-300 card-hover"
                            data-testid={`card-orphan-${platformName}`}
                          >
                            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-warning/50 to-warning/20 opacity-70" />
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-base truncate text-warning">{platformName}</h3>
                                <p className="text-[10px] text-warning/70 mt-0.5">Apenas nos procedimentos</p>
                              </div>
                              <Badge className="text-[10px] ml-2 flex-shrink-0 bg-warning/10 text-warning border-warning/20">
                                Importar
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              <div className="bg-warning/5 rounded-xl p-2 border border-warning/10">
                                <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Procedimentos</p>
                                <p className="text-sm font-bold text-warning">{s.countTotal}</p>
                              </div>
                              <div className="bg-warning/5 rounded-xl p-2 border border-warning/10">
                                <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Lucro Total</p>
                                <p className={`text-sm font-bold ${s.profitTotal >= 0 ? 'text-primary' : 'text-destructive'}`}>
                                  {fmtBRL(s.profitTotal, 2)}
                                </p>
                              </div>
                            </div>
                            {canEdit && (
                              <ActionButton
                                showLabel
                                block
                                icon={Download}
                                intent="warning"
                                label="Cadastrar"
                                onClick={() => handleAdd(platformName)}
                                data-testid={`button-import-orphan-${platformName}`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {(sourceFilter === 'db' ? filteredCasas.length === 0 : sourceFilter === 'orphan' ? filteredOrphans.length === 0 : filteredCasas.length === 0 && filteredOrphans.length === 0) && (
                  <div className="glass rounded-2xl border border-white/5 p-12 text-center">
                    <Building2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">
                      {searchQuery ? 'Nenhuma casa encontrada para esta busca' : 'Nenhuma casa encontrada'}
                    </p>
                    {!searchQuery && canEdit && (
                      <Button size="sm" onClick={() => handleAdd()} className="mt-4 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/25">
                        <Plus className="w-4 h-4 mr-1" /> Adicionar primeira casa
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab: Análise */}
        {activeTab === 'analise' && (
          <div className="space-y-4">
            {/* Month selector */}
            <div className="glass rounded-2xl border border-white/5 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-xl border border-border bg-muted flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-0.5">Mês Analisado</p>
                  <Select value={selectedMonth.toISOString()} onValueChange={(v) => setSelectedMonth(new Date(v))}>
                    <SelectTrigger className="bg-transparent border-none text-lg font-bold p-0 h-auto hover:text-primary transition-colors w-auto min-w-[180px]" data-testid="select-analise-month">
                      <SelectValue>{capitalizeMonth(format(selectedMonth, 'MMMM yyyy', { locale: ptBR }))}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {generateBetbraMonthOptions().map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{capitalizeMonth(opt.label)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Quick stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative rounded-2xl border border-border p-4 bg-card overflow-hidden card-hover">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-border opacity-70" />
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl border border-border bg-muted flex items-center justify-center flex-shrink-0">
                    <Trophy className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Mais Usada no Mês</p>
                    <p className="text-base font-bold text-foreground truncate">{topMonthCasa?.name || '—'}</p>
                    {topMonthCasa && <p className="text-[10px] text-muted-foreground mt-0.5">{topMonthCasa.count} procedimentos</p>}
                  </div>
                </div>
              </div>
              <div className="relative rounded-2xl border border-primary/20 p-4 bg-primary/10 overflow-hidden card-hover">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-primary to-primary/50 opacity-70" />
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/25 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Maior Lucro no Mês</p>
                    <p className="text-base font-bold text-primary truncate">{topProfitCasa?.name || '—'}</p>
                    {topProfitCasa && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {fmtBRL(topProfitCasa.profit)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="relative rounded-2xl border border-border p-4 bg-card overflow-hidden card-hover">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-border opacity-70" />
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl border border-border bg-muted flex items-center justify-center flex-shrink-0">
                    <Activity className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Casas Conhecidas</p>
                    <p className="text-2xl font-bold text-foreground">{totalKnown}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{activeCasas.length} cadastradas · {orphanPlatforms.length} só nos proc.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Ranking table */}
            <div className="glass rounded-2xl border border-white/5 overflow-hidden">
              <div className="flex items-center gap-2 p-4 border-b border-white/5">
                <div className="w-1.5 h-5 rounded-full bg-primary" />
                <h2 className="text-base font-semibold">Ranking por Casa</h2>
                <span className="text-xs text-muted-foreground ml-auto">{capitalizeMonth(format(selectedMonth, 'MMMM yyyy', { locale: ptBR }))}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      {([
                        ['name', 'Casa'],
                        ['count_month', 'Proc. Mês'],
                        ['profit_month', 'Lucro Mês'],
                        ['count_total', 'Proc. Total'],
                        ['profit_total', 'Lucro Total'],
                      ] as [SortKey, string][]).map(([key, label]) => (
                        <th key={key}
                          onClick={() => toggleSort(key)}
                          className="text-left px-4 py-3 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors select-none"
                          data-testid={`th-sort-${key}`}
                        >
                          <span className="flex items-center gap-1">
                            {label}
                            <SortIcon col={key} />
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analiseRanking.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-10 text-muted-foreground text-sm">Nenhuma casa encontrada</td></tr>
                    ) : analiseRanking.map((entry, i) => {
                      const rank = i + 1;
                      const rankColor = rank === 1 ? 'text-warning' : rank === 2 ? 'text-muted-foreground' : rank === 3 ? 'text-warning/70' : 'text-muted-foreground/50';
                      return (
                        <tr key={entry.key} className="border-b border-white/5 hover:bg-white/3 transition-colors group">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-mono w-5 ${rankColor}`}>#{rank}</span>
                              <span className="font-semibold text-foreground">{entry.name}</span>
                              {entry.isOrphan && (
                                <Badge className="text-[9px] bg-warning/10 text-warning border-warning/20 py-0 h-4">Proc. apenas</Badge>
                              )}
                              {!entry.isOrphan && entry.status === 'inactive' && (
                                <Badge className="text-[9px] bg-white/5 text-muted-foreground border-white/10 py-0 h-4">Inativa</Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-foreground font-semibold">{entry.countMonth}</td>
                          <td className={`px-4 py-3 font-bold ${entry.profitMonth >= 0 ? 'text-primary' : 'text-destructive'}`}>
                            {fmtBRL(entry.profitMonth)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground font-medium">{entry.countTotal}</td>
                          <td className={`px-4 py-3 font-semibold ${entry.profitTotal >= 0 ? 'text-primary/70' : 'text-destructive/70'}`}>
                            {fmtBRL(entry.profitTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <BookmakerModal
            bookmaker={editingCasa}
            initialName={prefillName}
            onClose={handleModalClose}
            onCreate={(data) => createBookmaker.mutate(data)}
            onUpdate={(data) => updateBookmaker.mutate(data)}
            isPending={createBookmaker.isPending || updateBookmaker.isPending}
          />
        )}
      </div>
    </Layout>
  );
};

export default EntityManagement;

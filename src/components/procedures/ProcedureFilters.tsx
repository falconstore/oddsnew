import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ProcedureFilters as FiltersType, PROCEDURE_CATEGORIES, PROCEDURE_STATUSES } from '@/types/procedures';
import { Search, Building2, Tag, Activity, TrendingUp, AlertCircle, Ticket, Star } from 'lucide-react';

interface ProcedureFiltersProps {
  filters: FiltersType;
  onFilterChange: (filters: FiltersType) => void;
  platforms: string[];
  statuses: string[];
  availableTags: string[];
}

export function ProcedureFilters({ filters, onFilterChange, platforms, availableTags }: ProcedureFiltersProps) {
  const updateFilter = <K extends keyof FiltersType>(key: K, value: FiltersType[K]) => {
    onFilterChange({ ...filters, [key]: value });
  };

  return (
    <div className="glass rounded-2xl border border-white/5 p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center">
          <Search className="w-3.5 h-3.5 text-primary" />
        </div>
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Filtros</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        <div>
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1.5">
            <Search className="w-3 h-3" /> Nº Procedimento
          </Label>
          <Input
            placeholder="Buscar..."
            value={filters.searchNumber}
            onChange={(e) => updateFilter('searchNumber', e.target.value)}
            className="h-8 text-xs bg-white/5 border-white/10 focus:border-primary/50"
          />
        </div>

        <div>
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1.5">
            <Search className="w-3 h-3" /> Promoção
          </Label>
          <Input
            placeholder="Buscar..."
            value={filters.searchPromotion}
            onChange={(e) => updateFilter('searchPromotion', e.target.value)}
            className="h-8 text-xs bg-white/5 border-white/10 focus:border-primary/50"
          />
        </div>

        <div>
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1.5">
            <Building2 className="w-3 h-3" /> Plataforma
          </Label>
          <Select value={filters.platform} onValueChange={(v) => updateFilter('platform', v)}>
            <SelectTrigger className="h-8 text-xs bg-white/5 border-white/10">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {platforms.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1.5">
            <Tag className="w-3 h-3" /> Categoria
          </Label>
          <Select value={filters.category} onValueChange={(v) => updateFilter('category', v)}>
            <SelectTrigger className="h-8 text-xs bg-white/5 border-white/10">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {PROCEDURE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1.5">
            <Activity className="w-3 h-3" /> Status
          </Label>
          <Select value={filters.status} onValueChange={(v) => updateFilter('status', v)}>
            <SelectTrigger className="h-8 text-xs bg-white/5 border-white/10">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {PROCEDURE_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1.5">
            <Tag className="w-3 h-3" /> Tags
          </Label>
          <Select value={filters.searchTags} onValueChange={(v) => updateFilter('searchTags', v)}>
            <SelectTrigger className="h-8 text-xs bg-white/5 border-white/10">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {availableTags.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1.5">
            <TrendingUp className="w-3 h-3" /> Lucro/Prejuízo
          </Label>
          <Select value={filters.profitLoss} onValueChange={(v) => updateFilter('profitLoss', v)}>
            <SelectTrigger className="h-8 text-xs bg-white/5 border-white/10">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="profit">Apenas Lucro</SelectItem>
              <SelectItem value="loss">Apenas Prejuízo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1.5">
            <AlertCircle className="w-3 h-3" /> Urgência
          </Label>
          <Select value={filters.urgent} onValueChange={(v) => updateFilter('urgent', v)}>
            <SelectTrigger className="h-8 text-xs bg-white/5 border-white/10">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="urgent">Urgentes</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1.5">
            <Ticket className="w-3 h-3" /> Freebet
          </Label>
          <Select value={filters.hasFreebetValue} onValueChange={(v) => updateFilter('hasFreebetValue', v)}>
            <SelectTrigger className="h-8 text-xs bg-white/5 border-white/10">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="yes">Com Freebet</SelectItem>
              <SelectItem value="no">Sem Freebet</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 pt-5">
          <Switch
            id="onlyFavorites"
            checked={filters.onlyFavorites}
            onCheckedChange={(checked) => updateFilter('onlyFavorites', checked)}
          />
          <Label htmlFor="onlyFavorites" className="text-xs flex items-center gap-1.5 cursor-pointer">
            <Star className="w-3 h-3 text-yellow-400" /> Favoritos
          </Label>
        </div>
      </div>
    </div>
  );
}

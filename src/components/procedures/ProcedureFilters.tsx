import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { ProcedureFilters as FiltersType, PROCEDURE_CATEGORIES, PROCEDURE_STATUSES } from '@/types/procedures';

interface ProcedureFiltersProps {
  filters: FiltersType;
  onFilterChange: (filters: FiltersType) => void;
  platforms: string[];
  statuses: string[];
  availableTags: string[];
}

export function ProcedureFilters({ 
  filters, 
  onFilterChange, 
  platforms, 
  availableTags 
}: ProcedureFiltersProps) {
  const updateFilter = <K extends keyof FiltersType>(key: K, value: FiltersType[K]) => {
    onFilterChange({ ...filters, [key]: value });
  };

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          <div>
            <Label htmlFor="searchNumber" className="text-xs">Nº Procedimento</Label>
            <Input
              id="searchNumber"
              placeholder="Buscar..."
              value={filters.searchNumber}
              onChange={(e) => updateFilter('searchNumber', e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="searchPromotion" className="text-xs">Promoção</Label>
            <Input
              id="searchPromotion"
              placeholder="Buscar..."
              value={filters.searchPromotion}
              onChange={(e) => updateFilter('searchPromotion', e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="platform" className="text-xs">Plataforma</Label>
            <Select 
              value={filters.platform} 
              onValueChange={(value) => updateFilter('platform', value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {platforms.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="category" className="text-xs">Categoria</Label>
            <Select 
              value={filters.category} 
              onValueChange={(value) => updateFilter('category', value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {PROCEDURE_CATEGORIES.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="status" className="text-xs">Status</Label>
            <Select 
              value={filters.status} 
              onValueChange={(value) => updateFilter('status', value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {PROCEDURE_STATUSES.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="searchTags" className="text-xs">Tags</Label>
            <Select 
              value={filters.searchTags} 
              onValueChange={(value) => updateFilter('searchTags', value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {availableTags.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="profitLoss" className="text-xs">Lucro/Prejuízo</Label>
            <Select 
              value={filters.profitLoss} 
              onValueChange={(value) => updateFilter('profitLoss', value)}
            >
              <SelectTrigger className="mt-1">
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
            <Label htmlFor="urgent" className="text-xs">Urgência</Label>
            <Select 
              value={filters.urgent} 
              onValueChange={(value) => updateFilter('urgent', value)}
            >
              <SelectTrigger className="mt-1">
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
            <Label htmlFor="hasFreebetValue" className="text-xs">Freebet</Label>
            <Select 
              value={filters.hasFreebetValue} 
              onValueChange={(value) => updateFilter('hasFreebetValue', value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="yes">Com Freebet</SelectItem>
                <SelectItem value="no">Sem Freebet</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 pt-6">
            <Switch
              id="onlyFavorites"
              checked={filters.onlyFavorites}
              onCheckedChange={(checked) => updateFilter('onlyFavorites', checked)}
            />
            <Label htmlFor="onlyFavorites" className="text-xs">Apenas Favoritos</Label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

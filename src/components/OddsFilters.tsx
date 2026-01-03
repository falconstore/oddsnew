import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Filter, ArrowUpDown } from 'lucide-react';
import { useLeagues, useBookmakers } from '@/hooks/useOddsData';

export interface OddsFiltersState {
  sport: string;
  league: string;
  dateFilter: string;
  bookmaker: string;
  opportunityType: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface OddsFiltersProps {
  filters: OddsFiltersState;
  onFiltersChange: (filters: OddsFiltersState) => void;
}

const DATE_OPTIONS = [
  { value: 'all', label: 'Todas as datas' },
  { value: 'today', label: 'Hoje' },
  { value: 'tomorrow', label: 'Amanhã' },
  { value: 'week', label: 'Próximos 7 dias' },
];

const OPPORTUNITY_OPTIONS = [
  { value: 'all', label: 'Todas' },
  { value: 'surebet', label: 'Apenas Surebets' },
];

const SPORT_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'football', label: '⚽ Futebol' },
  { value: 'basketball', label: '🏀 Basquete' },
];

const SORT_OPTIONS = [
  { value: 'date', label: 'Data' },
  { value: 'margin', label: 'Margem' },
  { value: 'team', label: 'Time (A-Z)' },
  { value: 'bookmakers', label: 'Nº de Casas' },
];

export const defaultFilters: OddsFiltersState = {
  sport: 'all',
  league: 'all',
  dateFilter: 'all',
  bookmaker: 'all',
  opportunityType: 'all',
  sortBy: 'date',
  sortOrder: 'asc',
};

export function OddsFilters({ filters, onFiltersChange }: OddsFiltersProps) {
  const { data: leagues } = useLeagues();
  const { data: bookmakers } = useBookmakers();

  const updateFilter = <K extends keyof OddsFiltersState>(key: K, value: OddsFiltersState[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const resetFilters = () => {
    onFiltersChange(defaultFilters);
  };

  const hasActiveFilters = 
    filters.sport !== 'all' ||
    filters.league !== 'all' ||
    filters.dateFilter !== 'all' ||
    filters.bookmaker !== 'all' ||
    filters.opportunityType !== 'all';

  const toggleSortOrder = () => {
    updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc');
  };

  return (
    <div className="space-y-4">
      {/* Main Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>Filtros:</span>
        </div>

        {/* Sport Filter */}
        <Select value={filters.sport} onValueChange={(v) => updateFilter('sport', v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Esporte" />
          </SelectTrigger>
          <SelectContent>
            {SPORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* League Filter */}
        <Select value={filters.league} onValueChange={(v) => updateFilter('league', v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Liga" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ligas</SelectItem>
            {leagues?.map((league) => (
              <SelectItem key={league.id} value={league.name}>
                {league.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date Filter */}
        <Select value={filters.dateFilter} onValueChange={(v) => updateFilter('dateFilter', v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Data" />
          </SelectTrigger>
          <SelectContent>
            {DATE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Bookmaker Filter */}
        <Select value={filters.bookmaker} onValueChange={(v) => updateFilter('bookmaker', v)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Casa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as casas</SelectItem>
            {bookmakers?.filter(b => b.status === 'active').map((bookmaker) => (
              <SelectItem key={bookmaker.id} value={bookmaker.name}>
                {bookmaker.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Opportunity Type */}
        <Select value={filters.opportunityType} onValueChange={(v) => updateFilter('opportunityType', v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            {OPPORTUNITY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9">
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {/* Sort Row */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Ordenar:</span>
          <Select value={filters.sortBy} onValueChange={(v) => updateFilter('sortBy', v)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={toggleSortOrder}>
            <ArrowUpDown className={`h-4 w-4 transition-transform ${filters.sortOrder === 'desc' ? 'rotate-180' : ''}`} />
          </Button>
        </div>
      </div>
    </div>
  );
}

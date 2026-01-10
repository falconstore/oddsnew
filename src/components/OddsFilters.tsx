import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MultiSelectPopover } from '@/components/ui/multi-select-popover';
import { X, Filter, ArrowUpDown, CalendarIcon, Search } from 'lucide-react';
import { useLeagues, useBookmakers } from '@/hooks/useOddsData';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { OddsFiltersState, defaultFilters } from '@/hooks/useFiltersFromUrl';
import { cn } from '@/lib/utils';

export { defaultFilters };
export type { OddsFiltersState };

interface OddsFiltersProps {
  filters: OddsFiltersState;
  onFiltersChange: (filters: OddsFiltersState) => void;
  hasActiveFilters?: boolean;
  hideSportFilter?: boolean;
}

const OPPORTUNITY_OPTIONS = [
  { value: 'all', label: 'Todas' },
  { value: 'surebet', label: 'Apenas Surebets' },
];

const SORT_OPTIONS = [
  { value: 'date', label: 'Data' },
  { value: 'margin', label: 'Margem' },
  { value: 'team', label: 'Time (A-Z)' },
  { value: 'bookmakers', label: 'Nº de Casas' },
];

export function OddsFilters({ filters, onFiltersChange, hasActiveFilters, hideSportFilter }: OddsFiltersProps) {
  const { data: leagues } = useLeagues();
  const { data: bookmakers } = useBookmakers();

  const updateFilter = <K extends keyof OddsFiltersState>(key: K, value: OddsFiltersState[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const resetFilters = () => {
    onFiltersChange(defaultFilters);
  };

  const toggleSortOrder = () => {
    updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc');
  };

  // Convert date strings to Date objects for Calendar
  const selectedDates = filters.dates
    .map(d => {
      try {
        return parse(d, 'yyyy-MM-dd', new Date());
      } catch {
        return null;
      }
    })
    .filter((d): d is Date => d !== null);

  const handleDatesChange = (dates: Date[] | undefined) => {
    if (!dates) {
      updateFilter('dates', []);
      return;
    }
    const formatted = dates.map(d => format(d, 'yyyy-MM-dd'));
    updateFilter('dates', formatted);
  };

  const formatDateDisplay = () => {
    if (selectedDates.length === 0) return 'Todas as datas';
    if (selectedDates.length === 1) return format(selectedDates[0], 'dd/MM/yyyy', { locale: ptBR });
    return `${selectedDates.length} datas`;
  };

  const leagueOptions = leagues?.map(l => ({ value: l.name, label: l.name })) || [];
  const bookmakerOptions = bookmakers
    ?.filter(b => b.status === 'active')
    .map(b => ({ value: b.name, label: b.name })) || [];

  return (
    <div className="space-y-4">
      {/* Main Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar time..."
            value={filters.searchTerm}
            onChange={(e) => updateFilter('searchTerm', e.target.value)}
            className="pl-9 w-[180px] h-9"
          />
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>Filtros:</span>
        </div>

        {/* League Filter - Multi Select */}
        <MultiSelectPopover
          options={leagueOptions}
          selected={filters.leagues}
          onChange={(selected) => updateFilter('leagues', selected)}
          placeholder="Todas as ligas"
          className="w-[160px]"
        />

        {/* Date Filter - Calendar Multi Select */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[160px] justify-start text-left font-normal",
                selectedDates.length === 0 && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              <span className="truncate">{formatDateDisplay()}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="multiple"
              selected={selectedDates}
              onSelect={handleDatesChange}
              locale={ptBR}
              className={cn("p-3 pointer-events-auto")}
              initialFocus
            />
            {selectedDates.length > 0 && (
              <div className="p-2 border-t">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full"
                  onClick={() => updateFilter('dates', [])}
                >
                  <X className="h-4 w-4 mr-1" />
                  Limpar datas
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Bookmaker Filter - Multi Select */}
        <MultiSelectPopover
          options={bookmakerOptions}
          selected={filters.bookmakers}
          onChange={(selected) => updateFilter('bookmakers', selected)}
          placeholder="Todas as casas"
          className="w-[150px]"
        />

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

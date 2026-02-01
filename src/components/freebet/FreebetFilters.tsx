import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MultiSelectPopover } from '@/components/ui/multi-select-popover';
import { Slider } from '@/components/ui/slider';
import { X, Filter, CalendarIcon, Percent } from 'lucide-react';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { FreebetFiltersState } from '@/types/freebet';
import { defaultFreebetFilters } from '@/types/freebet';

interface BookmakerOption {
  name: string;
  status: string;
}

interface LeagueOption {
  name: string;
}

interface FreebetFiltersProps {
  filters: FreebetFiltersState;
  onFiltersChange: (filters: FreebetFiltersState) => void;
  bookmakers: BookmakerOption[];
  leagues: LeagueOption[];
  hasActiveFilters?: boolean;
}

export function FreebetFilters({
  filters,
  onFiltersChange,
  bookmakers,
  leagues,
  hasActiveFilters,
}: FreebetFiltersProps) {
  const updateFilter = <K extends keyof FreebetFiltersState>(key: K, value: FreebetFiltersState[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const resetFilters = () => {
    onFiltersChange(defaultFreebetFilters);
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

  // Filter only PA bookmakers (not SO) for freebet placement
  const paBookmakers = bookmakers.filter(b => {
    const name = b.name.toLowerCase();
    // Exclude SO bookmakers
    return !['novibet', 'betbra', 'betnacional'].some(so => name.includes(so));
  });

  const leagueOptions = leagues.map(l => ({ value: l.name, label: l.name }));

  return (
    <div className="space-y-3 p-4 bg-card rounded-lg border">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <Filter className="h-4 w-4" />
        <span className="font-medium">Filtros</span>
      </div>

      {/* First Row: Bookmaker, Leagues, Dates */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
        {/* Bookmaker Filter */}
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Casa da Freebet</Label>
          <Select 
            value={filters.freebetBookmaker || 'all'} 
            onValueChange={(v) => updateFilter('freebetBookmaker', v === 'all' ? null : v)}
          >
            <SelectTrigger className="w-full sm:w-[160px] h-10 sm:h-9">
              <SelectValue placeholder="Todas as casas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as casas</SelectItem>
              {paBookmakers.map((b) => (
                <SelectItem key={b.name} value={b.name}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* League Filter - Multi Select */}
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Ligas</Label>
          <MultiSelectPopover
            options={leagueOptions}
            selected={filters.leagues}
            onChange={(selected) => updateFilter('leagues', selected)}
            placeholder="Todas as ligas"
            className="w-full sm:w-[160px]"
          />
        </div>

        {/* Date Filter - Calendar Multi Select */}
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Datas</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full sm:w-[160px] justify-start text-left font-normal h-10 sm:h-9",
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
        </div>

        {/* Min Extraction Filter */}
        <div className="flex flex-col gap-1 sm:min-w-[200px]">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Percent className="h-3 w-3" />
            Extração Mínima: {filters.minExtraction}%
          </Label>
          <div className="flex items-center gap-2 h-10 sm:h-9">
            <Slider
              value={[filters.minExtraction]}
              onValueChange={(v) => updateFilter('minExtraction', v[0])}
              max={100}
              min={0}
              step={5}
              className="flex-1"
            />
            <Input
              type="number"
              min={0}
              max={100}
              value={filters.minExtraction}
              onChange={(e) => updateFilter('minExtraction', Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
              className="w-16 h-9 text-center"
            />
          </div>
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <div className="flex flex-col gap-1 justify-end">
            <Label className="text-xs text-transparent hidden sm:block">-</Label>
            <Button variant="ghost" size="sm" onClick={resetFilters} className="h-10 sm:h-9 w-full sm:w-auto">
              <X className="h-4 w-4 mr-1" />
              Limpar filtros
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

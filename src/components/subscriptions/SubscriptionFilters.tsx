import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SubscriptionFilters as Filters, PLAN_OPTIONS, SITUATION_OPTIONS } from '@/types/subscriptions';
import { Search } from 'lucide-react';

interface SubscriptionFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

export function SubscriptionFilters({ filters, onFiltersChange }: SubscriptionFiltersProps) {
  const updateFilter = (key: keyof Filters, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="flex flex-wrap gap-3">
      {/* Busca por nome */}
      <div className="relative flex-1 min-w-[200px] max-w-[300px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome..."
          value={filters.searchName}
          onChange={(e) => updateFilter('searchName', e.target.value)}
          className="pl-9 h-9 text-xs"
        />
      </div>

      {/* Filtro por plano */}
      <Select
        value={filters.plan}
        onValueChange={(value) => updateFilter('plan', value)}
      >
        <SelectTrigger className="w-[130px] h-9 text-xs">
          <SelectValue placeholder="Plano" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos Planos</SelectItem>
          {PLAN_OPTIONS.map((plan) => (
            <SelectItem key={plan} value={plan}>{plan}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Filtro por status */}
      <Select
        value={filters.status}
        onValueChange={(value) => updateFilter('status', value)}
      >
        <SelectTrigger className="w-[120px] h-9 text-xs">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos Status</SelectItem>
          <SelectItem value="active">Ativo</SelectItem>
          <SelectItem value="expired">Expirado</SelectItem>
        </SelectContent>
      </Select>

      {/* Filtro por situação */}
      <Select
        value={filters.situation}
        onValueChange={(value) => updateFilter('situation', value)}
      >
        <SelectTrigger className="w-[160px] h-9 text-xs">
          <SelectValue placeholder="Situação" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas Situações</SelectItem>
          {SITUATION_OPTIONS.map((situation) => (
            <SelectItem key={situation} value={situation}>{situation}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Filtro por vencimento */}
      <Select
        value={filters.daysRemaining}
        onValueChange={(value) => updateFilter('daysRemaining', value)}
      >
        <SelectTrigger className="w-[150px] h-9 text-xs">
          <SelectValue placeholder="Vencimento" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="active">Ativos (&gt;7 dias)</SelectItem>
          <SelectItem value="expiring">Vencendo (≤7 dias)</SelectItem>
          <SelectItem value="expired">Expirados</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { useOddsComparison, useLeagues, useBookmakers } from '@/hooks/useOddsData';
import { FreebetConfig } from '@/components/freebet/FreebetConfig';
import { FreebetFilters } from '@/components/freebet/FreebetFilters';
import { FreebetCard } from '@/components/freebet/FreebetCard';
import { generateFreebetOpportunitiesWithFilters } from '@/lib/freebetUtils';
import { generateBookmakerLink } from '@/lib/bookmakerLinks';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import type { FreebetFiltersState } from '@/types/freebet';
import { defaultFreebetFilters } from '@/types/freebet';

function FreebetCardSkeleton() {
  return (
    <div className="bg-card rounded-lg border p-4 space-y-3">
      <div className="flex justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-8" />
        <Skeleton className="h-5 w-24" />
      </div>
      <Skeleton className="h-6 w-20 rounded-full" />
      <div className="space-y-2 pt-2">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </div>
  );
}

export default function FreebetExtraction() {
  const [freebetValue, setFreebetValue] = useState(10);
  const [filters, setFilters] = useState<FreebetFiltersState>(defaultFreebetFilters);
  
  const { data: matches, isLoading, error } = useOddsComparison();
  const { data: leagues } = useLeagues();
  const { data: bookmakers } = useBookmakers();
  
  const opportunities = useMemo(() => {
    if (!matches) return [];
    return generateFreebetOpportunitiesWithFilters(
      matches, 
      freebetValue, 
      generateBookmakerLink,
      filters
    );
  }, [matches, freebetValue, filters]);
  
  // Check if any filter is active
  const hasActiveFilters = useMemo(() => {
    return (
      filters.freebetBookmaker !== null ||
      filters.leagues.length > 0 ||
      filters.dates.length > 0 ||
      filters.minExtraction > 0
    );
  }, [filters]);
  
  // Prepare bookmakers and leagues for filters
  const activeBookmakers = useMemo(() => {
    return bookmakers?.filter(b => b.status === 'active') || [];
  }, [bookmakers]);
  
  const activeLeagues = useMemo(() => {
    return leagues || [];
  }, [leagues]);
  
  return (
    <Layout>
      <div className="space-y-4">
        <FreebetConfig
          freebetValue={freebetValue}
          onFreebetValueChange={setFreebetValue}
          opportunitiesCount={opportunities.length}
        />
        
        <FreebetFilters
          filters={filters}
          onFiltersChange={setFilters}
          bookmakers={activeBookmakers}
          leagues={activeLeagues}
          hasActiveFilters={hasActiveFilters}
        />
        
        {error && (
          <div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-lg">
            <AlertCircle className="h-5 w-5" />
            <span>Erro ao carregar dados: {error.message}</span>
          </div>
        )}
        
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <FreebetCardSkeleton key={i} />
            ))}
          </div>
        ) : opportunities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Nenhuma oportunidade encontrada</h3>
            <p className="text-muted-foreground max-w-md mt-1">
              {hasActiveFilters 
                ? 'Nenhuma oportunidade corresponde aos filtros selecionados. Tente ajustar os filtros.'
                : 'Não há oportunidades de extração de freebet com lucro positivo no momento. Tente novamente mais tarde ou ajuste o valor da freebet.'
              }
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {opportunities.map((opportunity) => (
              <FreebetCard
                key={opportunity.match.match_id}
                opportunity={opportunity}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

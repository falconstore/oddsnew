import { useSearchParams } from 'react-router-dom';
import { useMemo, useCallback } from 'react';

export interface OddsFiltersState {
  leagues: string[];
  dates: string[];
  bookmakers: string[];
  opportunityType: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  searchTerm: string;
}

export const defaultFilters: OddsFiltersState = {
  leagues: [],
  dates: [],
  bookmakers: [],
  opportunityType: 'all',
  sortBy: 'date',
  sortOrder: 'asc',
  searchTerm: '',
};

export function useFiltersFromUrl() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo((): OddsFiltersState => {
    return {
      leagues: searchParams.get('leagues')?.split(',').filter(Boolean) || [],
      dates: searchParams.get('dates')?.split(',').filter(Boolean) || [],
      bookmakers: searchParams.get('bookmakers')?.split(',').filter(Boolean) || [],
      opportunityType: searchParams.get('type') || 'all',
      sortBy: searchParams.get('sortBy') || 'date',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc',
      searchTerm: searchParams.get('search') || '',
    };
  }, [searchParams]);

  const setFilters = useCallback((newFilters: OddsFiltersState) => {
    const params = new URLSearchParams();
    
    if (newFilters.leagues.length) params.set('leagues', newFilters.leagues.join(','));
    if (newFilters.dates.length) params.set('dates', newFilters.dates.join(','));
    if (newFilters.bookmakers.length) params.set('bookmakers', newFilters.bookmakers.join(','));
    if (newFilters.opportunityType !== 'all') params.set('type', newFilters.opportunityType);
    if (newFilters.sortBy !== 'date') params.set('sortBy', newFilters.sortBy);
    if (newFilters.sortOrder !== 'asc') params.set('sortOrder', newFilters.sortOrder);
    if (newFilters.searchTerm) params.set('search', newFilters.searchTerm);
    
    setSearchParams(params, { replace: true });
  }, [setSearchParams]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.leagues.length > 0 ||
      filters.dates.length > 0 ||
      filters.bookmakers.length > 0 ||
      filters.opportunityType !== 'all' ||
      filters.searchTerm.length > 0
    );
  }, [filters]);

  return { filters, setFilters, hasActiveFilters };
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ScraperStatus } from '@/types/scraperStatus';

export const useScraperStatus = () => {
  return useQuery({
    queryKey: ['scraper_status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scraper_status_view')
        .select('*')
        .order('scraper_name');
      
      if (error) throw error;
      return data as ScraperStatus[];
    },
    refetchInterval: 30000, // 30 segundos
  });
};

export const useScraperStatusStats = () => {
  const { data: scrapers, ...rest } = useScraperStatus();
  
  const stats = {
    total: scrapers?.length ?? 0,
    ok: scrapers?.filter(s => s.computed_status === 'ok').length ?? 0,
    warning: scrapers?.filter(s => s.computed_status === 'warning').length ?? 0,
    error: scrapers?.filter(s => s.computed_status === 'error').length ?? 0,
    totalOddsCollected: scrapers?.reduce((sum, s) => sum + (s.odds_collected ?? 0), 0) ?? 0,
    totalOddsInserted: scrapers?.reduce((sum, s) => sum + (s.odds_inserted ?? 0), 0) ?? 0,
  };
  
  return { stats, scrapers, ...rest };
};

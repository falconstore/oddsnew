import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { League, Team, Bookmaker, Match, TeamAlias, Alert, OddsComparison, MatchOddsGroup, BookmakerOdds } from '@/types/database';
import { toast } from '@/hooks/use-toast';
import { useOddsRealtimeSubscription, useAlertsRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

// =====================================================
// LEAGUES
// =====================================================

export const useLeagues = () => {
  return useQuery({
    queryKey: ['leagues'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leagues')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as League[];
    }
  });
};

export const useCreateLeague = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (league: Partial<League>) => {
      const { data, error } = await supabase
        .from('leagues')
        .insert(league)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leagues'] });
      toast({ title: 'Liga criada com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar liga', description: error.message, variant: 'destructive' });
    }
  });
};

export const useUpdateLeague = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...league }: Partial<League> & { id: string }) => {
      const { data, error } = await supabase
        .from('leagues')
        .update(league)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leagues'] });
      toast({ title: 'Liga atualizada!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    }
  });
};

export const useDeleteLeague = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leagues').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leagues'] });
      toast({ title: 'Liga removida!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    }
  });
};

// =====================================================
// TEAMS
// =====================================================

export const useTeams = (leagueId?: string) => {
  return useQuery({
    queryKey: ['teams', leagueId],
    queryFn: async () => {
      let query = supabase.from('teams').select('*, league:leagues(*)').order('standard_name');
      if (leagueId) query = query.eq('league_id', leagueId);
      const { data, error } = await query;
      if (error) throw error;
      return data as Team[];
    }
  });
};

export const useCreateTeam = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (team: Partial<Team>) => {
      const { data, error } = await supabase.from('teams').insert(team).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast({ title: 'Time criado com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar time', description: error.message, variant: 'destructive' });
    }
  });
};

export const useUpdateTeam = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...team }: Partial<Team> & { id: string }) => {
      const { data, error } = await supabase.from('teams').update(team).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast({ title: 'Time atualizado!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    }
  });
};

export const useDeleteTeam = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('teams').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast({ title: 'Time removido!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    }
  });
};

// =====================================================
// TEAM ALIASES
// =====================================================

export const useTeamAliases = (teamId?: string) => {
  return useQuery({
    queryKey: ['team_aliases', teamId],
    queryFn: async () => {
      let query = supabase.from('team_aliases').select('*, team:teams(*)');
      if (teamId) query = query.eq('team_id', teamId);
      const { data, error } = await query;
      if (error) throw error;
      return data as TeamAlias[];
    }
  });
};

export const useCreateTeamAlias = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (alias: Partial<TeamAlias>) => {
      const { data, error } = await supabase.from('team_aliases').insert(alias).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team_aliases'] });
      toast({ title: 'Alias criado!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar alias', description: error.message, variant: 'destructive' });
    }
  });
};

export const useDeleteTeamAlias = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('team_aliases').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team_aliases'] });
      toast({ title: 'Alias removido!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    }
  });
};

// =====================================================
// BOOKMAKERS
// =====================================================

export const useBookmakers = () => {
  return useQuery({
    queryKey: ['bookmakers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookmakers')
        .select('*')
        .order('priority');
      if (error) throw error;
      return data as Bookmaker[];
    }
  });
};

export const useCreateBookmaker = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bookmaker: Partial<Bookmaker>) => {
      const { data, error } = await supabase.from('bookmakers').insert(bookmaker).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmakers'] });
      toast({ title: 'Casa de apostas criada!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar', description: error.message, variant: 'destructive' });
    }
  });
};

export const useUpdateBookmaker = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...bookmaker }: Partial<Bookmaker> & { id: string }) => {
      const { data, error } = await supabase.from('bookmakers').update(bookmaker).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmakers'] });
      toast({ title: 'Atualizado!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    }
  });
};

export const useDeleteBookmaker = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bookmakers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmakers'] });
      toast({ title: 'Removido!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    }
  });
};

// =====================================================
// ODDS COMPARISON (Main Dashboard Data)
// =====================================================

export const useOddsComparison = (filters?: {
  leagueName?: string;
  dateFrom?: string;
  dateTo?: string;
}) => {
  // Subscribe to realtime updates for odds_history
  useOddsRealtimeSubscription();

  return useQuery({
    queryKey: ['odds_comparison', filters],
    queryFn: async () => {
      let query = supabase
        .from('odds_comparison')
        .select('*')
        .order('match_date', { ascending: true });

      if (filters?.leagueName) {
        query = query.eq('league_name', filters.leagueName);
      }
      if (filters?.dateFrom) {
        query = query.gte('match_date', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('match_date', filters.dateTo);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Group by match
      const grouped = groupOddsByMatch(data as OddsComparison[]);
      return grouped;
    },
    // Keep a fallback refetch in case realtime connection drops
    refetchInterval: 15000, // Fallback: refetch every 15 seconds
    staleTime: 3000 // Consider data stale after 3 seconds
  });
};

function groupOddsByMatch(data: OddsComparison[]): MatchOddsGroup[] {
  const matchMap = new Map<string, MatchOddsGroup>();
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  for (const row of data) {
    // Skip matches that started more than 5 minutes ago
    const matchDate = new Date(row.match_date);
    if (matchDate < fiveMinutesAgo) continue;

    if (!matchMap.has(row.match_id)) {
      matchMap.set(row.match_id, {
        match_id: row.match_id,
        match_date: row.match_date,
        match_status: row.match_status,
        league_name: row.league_name,
        league_country: row.league_country,
        home_team: row.home_team,
        away_team: row.away_team,
        odds: [],
        best_home: 0,
        best_draw: 0,
        best_away: 0,
        worst_home: Infinity,
        worst_draw: Infinity,
        worst_away: Infinity
      });
    }

    const group = matchMap.get(row.match_id)!;
    
    const bookmakerOdds: BookmakerOdds = {
      bookmaker_id: row.bookmaker_id,
      bookmaker_name: row.bookmaker_name,
      home_odd: row.home_odd,
      draw_odd: row.draw_odd,
      away_odd: row.away_odd,
      margin_percentage: row.margin_percentage,
      data_age_seconds: row.data_age_seconds,
      scraped_at: row.scraped_at,
      extra_data: row.extra_data
    };

    group.odds.push(bookmakerOdds);

    // Track best/worst odds
    if (row.home_odd > group.best_home) group.best_home = row.home_odd;
    if (row.draw_odd > group.best_draw) group.best_draw = row.draw_odd;
    if (row.away_odd > group.best_away) group.best_away = row.away_odd;
    if (row.home_odd < group.worst_home) group.worst_home = row.home_odd;
    if (row.draw_odd < group.worst_draw) group.worst_draw = row.draw_odd;
    if (row.away_odd < group.worst_away) group.worst_away = row.away_odd;
  }

  return Array.from(matchMap.values());
}

// =====================================================
// ALERTS
// =====================================================

export const useAlerts = (unreadOnly = false) => {
  // Subscribe to realtime updates for alerts
  useAlertsRealtimeSubscription();

  return useQuery({
    queryKey: ['alerts', unreadOnly],
    queryFn: async () => {
      let query = supabase
        .from('alerts')
        .select('*, match:matches(*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)), bookmaker:bookmakers(*)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (unreadOnly) {
        query = query.eq('is_read', false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Alert[];
    },
    // Keep a fallback refetch in case realtime connection drops
    refetchInterval: 60000, // Fallback: refetch every 60 seconds
    staleTime: 5000 // Consider data stale after 5 seconds
  });
};

export const useMarkAlertRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('alerts').update({ is_read: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    }
  });
};

export const useMarkAllAlertsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('alerts').update({ is_read: true }).eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      toast({ title: 'Todos os alertas marcados como lidos' });
    }
  });
};

// =====================================================
// MATCHES (for management)
// =====================================================

export const useMatches = (filters?: { leagueId?: string; status?: string }) => {
  return useQuery({
    queryKey: ['matches', filters],
    queryFn: async () => {
      let query = supabase
        .from('matches')
        .select('*, league:leagues(*), home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
        .order('match_date', { ascending: true });

      if (filters?.leagueId) {
        query = query.eq('league_id', filters.leagueId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Match[];
    }
  });
};

// =====================================================
// ODDS HISTORY (for charts)
// =====================================================

export const useOddsHistory = (matchId: string) => {
  return useQuery({
    queryKey: ['odds_history', matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('odds_history')
        .select('*, bookmaker:bookmakers(*)')
        .eq('match_id', matchId)
        .order('scraped_at', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!matchId
  });
};

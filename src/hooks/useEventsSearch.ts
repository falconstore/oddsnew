// Hook que invoca a Edge Function events-search com debounce e AbortController
// (paridade doc 02 §6). Retorna uma função `search(termo)` + estado.
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabaseProcedures, isProceduresSupabaseConfigured } from '@/lib/supabaseProcedures';

export interface EventSuggestion {
  nome: string;
  campeonato: string;
  data_hora: string;
  fixture_id: number;
  kickoff_at: string;
  esporte: string;
  source: string;
}

interface SearchState {
  loading: boolean;
  items: EventSuggestion[];
  error: string | null;
}

const DEBOUNCE_MS = 250;

export function useEventsSearch() {
  const [state, setState] = useState<SearchState>({ loading: false, items: [], error: null });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback((termo: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const t = termo.trim();
    if (t.length < 2) {
      setState({ loading: false, items: [], error: null });
      return;
    }
    if (!isProceduresSupabaseConfigured()) {
      setState({ loading: false, items: [], error: 'Supabase não configurado' });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      try {
        // supabase-js .functions.invoke não expõe AbortSignal nativo de forma simples,
        // mas podemos chamar fetch direto na URL da function.
        const url = `${import.meta.env.VITE_PROCEDURES_SUPABASE_URL}/functions/v1/events-search?q=${encodeURIComponent(t)}`;
        const session = await supabaseProcedures.auth.getSession();
        const token = session.data.session?.access_token ?? import.meta.env.VITE_PROCEDURES_SUPABASE_ANON_KEY;
        const r = await fetch(url, {
          signal: abortRef.current.signal,
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_PROCEDURES_SUPABASE_ANON_KEY as string,
          },
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        setState({ loading: false, items: json.items || [], error: null });
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        setState({ loading: false, items: [], error: e?.message || 'Erro' });
      }
    }, DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return { ...state, search };
}

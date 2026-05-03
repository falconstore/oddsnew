// Autocomplete de evento esportivo (paridade FreeBet PRO doc 02 §6).
// Mostra sugestões da API-Football via edge function `events-search`.
//
// Comportamento:
//  - Debounce 250ms + AbortController (no hook).
//  - Mínimo 2 caracteres.
//  - Editar manualmente o texto LIMPA fixture_id/kickoff_at.
//  - Selecionar sugestão preenche os 3 campos atomicamente.
//  - Auto-vincular ao reabrir: se o texto bate exato com uma sugestão da lista atual,
//    preserva o fixture_id já gravado (sem perda em re-renders).
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Trophy, CheckCircle2, Loader2 } from 'lucide-react';
import { useEventsSearch, EventSuggestion } from '@/hooks/useEventsSearch';

interface EventoAutocompleteProps {
  partidaDescricao: string;
  fixtureId: number | null;
  kickoffAt: string | null;
  onChange: (partial: {
    partida_descricao: string;
    fixture_id: number | null;
    kickoff_at: string | null;
    esporte?: string;
  }) => void;
  className?: string;
  inputClassName?: string;
}

export function EventoAutocomplete({
  partidaDescricao,
  fixtureId,
  kickoffAt,
  onChange,
  inputClassName,
}: EventoAutocompleteProps) {
  const { items, loading, search } = useEventsSearch();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Click fora fecha
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function handleType(v: string) {
    // Edição manual desfaz o vínculo (paridade doc 02 §6 checklist 3)
    onChange({
      partida_descricao: v,
      fixture_id: null,
      kickoff_at: null,
    });
    search(v);
    setOpen(true);
  }

  function selecionar(s: EventSuggestion) {
    onChange({
      partida_descricao: s.nome,
      fixture_id: s.fixture_id,
      kickoff_at: s.kickoff_at,
      esporte: s.esporte || 'futebol',
    });
    setOpen(false);
  }

  const linked = fixtureId != null;

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Input
          value={partidaDescricao}
          onChange={(e) => handleType(e.target.value)}
          onFocus={() => { if (items.length > 0) setOpen(true); }}
          placeholder="Ex: Flamengo x Palmeiras"
          data-testid="input-evento-autocomplete"
          className={inputClassName}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs">
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />}
          {linked && !loading && (
            <span className="flex items-center gap-1 text-emerald-400" title={`Vinculado ao fixture ${fixtureId}`}>
              <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
      </div>
      {linked && kickoffAt && (
        <p className="text-[10px] text-emerald-400/80 mt-1 flex items-center gap-1">
          <Trophy className="w-3 h-3" />
          Vinculado · kickoff {new Date(kickoffAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
        </p>
      )}
      {open && partidaDescricao.trim().length >= 2 && (
        <div
          className="absolute z-50 left-0 right-0 mt-1 max-h-72 overflow-auto rounded-xl border border-amber-500/30 bg-background/98 backdrop-blur shadow-2xl shadow-black/60"
          data-testid="dropdown-evento-sugestoes"
        >
          {loading && items.length === 0 && (
            <div className="p-3 text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Buscando jogos...
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="p-3 text-xs text-muted-foreground">Nenhum jogo encontrado para "{partidaDescricao}".</div>
          )}
          {items.map((s) => (
            <button
              key={s.fixture_id}
              type="button"
              onClick={() => selecionar(s)}
              data-testid={`sugestao-evento-${s.fixture_id}`}
              className="w-full text-left p-2.5 hover:bg-amber-500/10 border-b border-white/5 last:border-0 transition-colors"
            >
              <div className="text-sm font-medium text-foreground">{s.nome}</div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[11px] text-muted-foreground truncate pr-2">{s.campeonato}</span>
                <span className="text-[11px] text-amber-300 font-mono shrink-0">
                  {new Date(s.data_hora).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

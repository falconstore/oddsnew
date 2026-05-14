// Autocomplete da Origem da Freebet — multi-select.
//
// Permite vincular UMA QUEIMAR_FB a 1..N origens GANHAR_FB (caso comum: usuário
// recebe múltiplas FBs no mesmo evento e gira tudo numa aposta só).
// Origens elegíveis: GANHAR_FB com freebet_creditada=SIM, não-arquivada, e
// que NÃO esteja vinculada a outra QUEIMAR_FB (verifica array E singular legado).
//
// Ao mudar a seleção, devolve:
//   - selectedIds: lista de UUIDs (ordem = ordem de seleção; primeiro = primário)
//   - primaryRefText: procedure_number da PRIMEIRA selecionada (vai pro freebet_reference)
//   - primaryPlatform: casa da PRIMEIRA selecionada (auto-fill da Plataforma)
import { useMemo, useRef, useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { CheckCircle2, AlertCircle, Ticket, X } from 'lucide-react';
import { Procedure } from '@/types/procedures';

interface OrigemFreebetAutocompleteProps {
  procedures: Procedure[];
  currentId: string | null;          // procedimento sendo editado (não pode ser sua própria origem)
  refValue: string;                   // texto livre exibido (refall back quando sem vínculo)
  selectedIds: string[];              // UUIDs já vinculados (multi)
  onChange: (next: {
    selectedIds: string[];
    primaryRefText: string;            // procedure_number do primário (ou texto manual quando sem vínculo)
    primaryPlatform?: string;          // casa do primário, undefined quando o usuário só digita texto manual
  }) => void;
  inputClassName?: string;
}

export function OrigemFreebetAutocomplete({
  procedures,
  currentId,
  refValue,
  selectedIds,
  onChange,
  inputClassName,
}: OrigemFreebetAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const procById = useMemo(() => {
    const m = new Map<string, Procedure>();
    for (const p of procedures) m.set(p.id, p);
    return m;
  }, [procedures]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // IDs já queimados por OUTRAS QUEIMAR_FB — não devem aparecer como elegíveis.
  // Olha tanto o array novo quanto o singular legado.
  const referenciados = useMemo(() => {
    const s = new Set<string>();
    for (const p of procedures) {
      if (p.archived) continue;
      if (p.id === currentId) continue;
      if (p.tipo !== 'QUEIMAR_FB') continue;
      if (p.freebet_reference_ids && p.freebet_reference_ids.length > 0) {
        for (const id of p.freebet_reference_ids) s.add(id);
      } else if (p.freebet_reference_id) {
        s.add(p.freebet_reference_id);
      }
    }
    return s;
  }, [procedures, currentId]);

  const elegiveis = useMemo(() => {
    return procedures
      .filter((p) =>
        p.tipo === 'GANHAR_FB' &&
        p.freebet_creditada === 'SIM' &&
        !p.archived &&
        p.id !== currentId &&
        // Mostra se está disponível OU se já é uma das selecionadas (toggle off)
        (!referenciados.has(p.id) || selectedSet.has(p.id)),
      )
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [procedures, currentId, referenciados, selectedSet]);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return elegiveis.slice(0, 15);
    return elegiveis
      .filter((p) =>
        (p.procedure_number || '').toLowerCase().includes(q) ||
        (p.platform || '').toLowerCase().includes(q) ||
        (p.partida_descricao || '').toLowerCase().includes(q) ||
        (p.promotion_name || '').toLowerCase().includes(q),
      )
      .slice(0, 15);
  }, [elegiveis, query]);

  function emit(nextIds: string[]) {
    const primary = nextIds[0] ? procById.get(nextIds[0]) : null;
    const primaryText = primary?.procedure_number || '';
    const primaryPlatform = primary?.platform || undefined;
    if (nextIds.length > 1 && primary) {
      // Texto exibido lista os Nº pra fácil cópia/relatório
      const allNumbers = nextIds
        .map((id) => procById.get(id)?.procedure_number)
        .filter(Boolean)
        .join(', ');
      onChange({ selectedIds: nextIds, primaryRefText: allNumbers, primaryPlatform });
    } else {
      onChange({ selectedIds: nextIds, primaryRefText: primaryText, primaryPlatform });
    }
  }

  function toggle(p: Procedure) {
    if (selectedSet.has(p.id)) {
      emit(selectedIds.filter((x) => x !== p.id));
    } else {
      emit([...selectedIds, p.id]);
    }
    setQuery('');
  }

  function remove(id: string) {
    emit(selectedIds.filter((x) => x !== id));
  }

  function handleType(v: string) {
    setQuery(v);
    setOpen(true);
    // Edit manual sem nenhuma seleção = texto livre puro (sem vínculo)
    if (selectedIds.length === 0) {
      onChange({ selectedIds: [], primaryRefText: v });
    }
  }

  const hasLink = selectedIds.length > 0;
  const orphan = !hasLink && refValue.trim().length > 0;
  const placeholder = hasLink
    ? 'Adicionar mais uma freebet origem...'
    : 'Buscar Nº do procedimento que ganhou a FB...';

  return (
    <div ref={wrapRef} className="relative">
      {/* Chips das FBs selecionadas */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1.5" data-testid="chips-origem-fb">
          {selectedIds.map((id, idx) => {
            const p = procById.get(id);
            if (!p) {
              // FB removida do conjunto elegível mas vínculo persiste (status mudou) — mostra placeholder
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-amber-500/15 border border-amber-500/40 text-amber-200"
                  data-testid={`chip-origem-${id}`}
                >
                  <AlertCircle className="w-3 h-3" />
                  vínculo órfão
                  <button type="button" onClick={() => remove(id)} className="hover:text-white" aria-label="Remover">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            }
            return (
              <span
                key={id}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border ${
                  idx === 0
                    ? 'bg-purple-500/20 border-purple-400/50 text-purple-100'
                    : 'bg-purple-500/10 border-purple-500/30 text-purple-200'
                }`}
                data-testid={`chip-origem-${p.id}`}
                title={idx === 0 ? 'Primária — sincroniza com FreeBet PRO' : 'Adicional'}
              >
                <Ticket className="w-3 h-3" />
                <span className="font-mono font-semibold">#{p.procedure_number}</span>
                <span className="opacity-70">{p.platform}</span>
                <span className="font-mono opacity-80">
                  R$ {Number(p.freebet_valor_previsto ?? p.freebet_value ?? 0).toFixed(2)}
                </span>
                {idx === 0 && selectedIds.length > 1 && (
                  <span className="text-[9px] uppercase tracking-wider opacity-70">primária</span>
                )}
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  className="hover:text-white -mr-0.5"
                  aria-label={`Remover #${p.procedure_number}`}
                  data-testid={`button-remove-origem-${p.id}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="relative">
        <Input
          value={query}
          onChange={(e) => handleType(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          data-testid="input-origem-fb-autocomplete"
          className={inputClassName}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {hasLink && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
          {orphan && <AlertCircle className="w-3.5 h-3.5 text-amber-400" />}
        </div>
      </div>
      {orphan && (
        <p className="text-[10px] text-amber-400/90 mt-1">
          ⚠ Sem vínculo automático — o ciclo da freebet não vai fechar sozinho. Selecione uma origem da lista.
        </p>
      )}
      {selectedIds.length > 1 && (
        <p className="text-[10px] text-purple-300/80 mt-1">
          {selectedIds.length} freebets vinculadas — todas serão fechadas como Concluído quando esta queimadora rodar.
        </p>
      )}
      {open && (
        <div
          className="absolute z-50 left-0 right-0 mt-1 max-h-72 overflow-auto rounded-xl border border-purple-500/30 bg-background/98 backdrop-blur shadow-2xl shadow-black/60"
          data-testid="dropdown-origem-fb"
        >
          {filtrados.length === 0 && (
            <div className="p-3 text-xs text-muted-foreground">
              Nenhuma freebet disponível pra queimar.
              <br />
              <span className="text-[10px] opacity-70">
                Origens elegíveis: GANHAR_FB com Freebet Creditada = SIM e ainda não queimadas.
              </span>
            </div>
          )}
          {filtrados.map((p) => {
            const checked = selectedSet.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p)}
                data-testid={`sugestao-origem-${p.id}`}
                aria-pressed={checked}
                className={`w-full text-left p-2.5 hover:bg-purple-500/10 border-b border-white/5 last:border-0 transition-colors ${
                  checked ? 'bg-purple-500/15' : ''
                }`}
              >
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                      checked
                        ? 'bg-purple-500 border-purple-400'
                        : 'border-purple-500/40 bg-transparent'
                    }`}
                  >
                    {checked && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </span>
                  <Ticket className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span className="font-mono font-semibold text-purple-200">#{p.procedure_number}</span>
                  <span className="text-foreground truncate">{p.platform}</span>
                  <span className="ml-auto text-[11px] text-emerald-300 font-mono shrink-0">
                    R$ {Number(p.freebet_valor_previsto ?? p.freebet_value ?? 0).toFixed(2)}
                  </span>
                </div>
                {p.partida_descricao && (
                  <div className="text-[11px] text-muted-foreground mt-0.5 ml-9 truncate">
                    {p.partida_descricao}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

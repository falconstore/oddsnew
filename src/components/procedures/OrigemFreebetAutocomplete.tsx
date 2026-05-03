// Autocomplete da Origem da Freebet (paridade doc 03 §6 — usado quando tipo=QUEIMAR_FB).
//
// Lista os procedimentos GANHAR_FB com freebet_creditada=SIM e SEM queimador apontando
// pra eles ainda. Busca local (in-memory) — o conjunto é pequeno o suficiente.
//
// Ao selecionar, grava:
//   - freebet_reference_id = id (UUID) da origem  ← pro backend FreeBet PRO resolver via external_referencia_id
//   - freebet_reference    = procedure_number da origem (legível pro humano)
import { useMemo, useRef, useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { CheckCircle2, AlertCircle, Ticket } from 'lucide-react';
import { Procedure } from '@/types/procedures';

interface OrigemFreebetAutocompleteProps {
  procedures: Procedure[];
  currentId: string | null;       // procedimento sendo editado (não pode ser sua própria origem)
  refValue: string;                // freebet_reference (texto exibido)
  refId: string | null;            // freebet_reference_id (UUID resolvido)
  onChange: (next: { freebet_reference: string; freebet_reference_id: string | null }) => void;
  inputClassName?: string;
}

export function OrigemFreebetAutocomplete({
  procedures,
  currentId,
  refValue,
  refId,
  onChange,
  inputClassName,
}: OrigemFreebetAutocompleteProps) {
  const [query, setQuery] = useState(refValue);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(refValue); }, [refValue]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Conjunto elegível: GANHAR_FB com freebet_creditada=SIM, não-arquivado, e que ainda
  // NÃO tem outro procedimento referenciando-o como freebet_reference_id.
  const elegiveis = useMemo(() => {
    const referenciados = new Set(
      procedures
        .filter((p) => p.freebet_reference_id && p.id !== currentId && !p.archived)
        .map((p) => p.freebet_reference_id as string),
    );
    return procedures
      .filter((p) =>
        p.tipo === 'GANHAR_FB' &&
        p.freebet_creditada === 'SIM' &&
        !p.archived &&
        p.id !== currentId &&
        !referenciados.has(p.id),
      )
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [procedures, currentId]);

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

  function handleType(v: string) {
    setQuery(v);
    onChange({ freebet_reference: v, freebet_reference_id: null }); // edit manual desfaz vínculo
    setOpen(true);
  }

  function selecionar(p: Procedure) {
    setQuery(p.procedure_number || '');
    onChange({
      freebet_reference: p.procedure_number || '',
      freebet_reference_id: p.id,
    });
    setOpen(false);
  }

  const linked = !!refId;
  const orphan = !linked && refValue.trim().length > 0;

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => handleType(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Buscar Nº do procedimento que ganhou a FB..."
          data-testid="input-origem-fb-autocomplete"
          className={inputClassName}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {linked && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
          {orphan && <AlertCircle className="w-3.5 h-3.5 text-amber-400" />}
        </div>
      </div>
      {orphan && (
        <p className="text-[10px] text-amber-400/90 mt-1">
          ⚠ Sem vínculo automático — o ciclo da freebet não vai fechar sozinho. Selecione uma origem da lista.
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
          {filtrados.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => selecionar(p)}
              data-testid={`sugestao-origem-${p.id}`}
              className="w-full text-left p-2.5 hover:bg-purple-500/10 border-b border-white/5 last:border-0 transition-colors"
            >
              <div className="flex items-center gap-2 text-sm">
                <Ticket className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span className="font-mono font-semibold text-purple-200">#{p.procedure_number}</span>
                <span className="text-foreground truncate">{p.platform}</span>
                <span className="ml-auto text-[11px] text-emerald-300 font-mono shrink-0">
                  R$ {Number(p.freebet_valor_previsto ?? p.freebet_value ?? 0).toFixed(2)}
                </span>
              </div>
              {p.partida_descricao && (
                <div className="text-[11px] text-muted-foreground mt-0.5 ml-5 truncate">
                  {p.partida_descricao}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

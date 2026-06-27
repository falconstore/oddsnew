import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, ChevronDown, Search, X, Check, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { traduzirEvento } from '@/lib/traduzirEvento';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────
// FreebetSelectField — seletor de FBs disponíveis para queimar.
// Compartilhado entre Templates Bot e Envio Procedimentos.
// Multi-select por ID; o value externo é a lista de procedure_number
// separados por vírgula (ex.: "469, 472 EXTRA").
// ─────────────────────────────────────────

interface FreebetOption {
  id: string;
  procedure_number: string;
  platform: string | null;
  freebet_value: number | null;
  freebet_valor_previsto: number | null;
  partida_descricao: string | null;
  date: string | null;
  promotion_name: string | null;
  freebet_creditada: string | null;
  status: string | null;
  is_extra: boolean;
}

export function FreebetSelectField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: freebets = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['available_freebets_to_burn'],
    queryFn: async (): Promise<FreebetOption[]> => {
      const { data, error } = await supabase
        .from('procedures')
        .select('id, is_extra, procedure_number, platform, freebet_value, freebet_valor_previsto, partida_descricao, date, promotion_name, freebet_creditada, status')
        .in('tipo', ['GANHAR_FB', 'ASR'])
        .eq('archived', false)
        .order('created_date', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as FreebetOption[];
    },
    staleTime: 30_000,
  });

  const fmtCurrency = (v: number | null) =>
    v != null ? `R$ ${v.toFixed(2).replace('.', ',')}` : null;

  const fmtDateBR = (iso: string | null) => {
    if (!iso) return null;
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  // Multi-select: rastreamos por ID internamente para evitar conflito quando dois
  // procedimentos têm o mesmo procedure_number (ex: original + EXTRA na mesma casa).
  const suppressSync = useRef(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Sincroniza selectedIds a partir do value externo (apenas quando não foi disparado
  // pelo próprio onChange do componente via buildOutputValue).
  useEffect(() => {
    if (suppressSync.current) { suppressSync.current = false; return; }
    if (freebets.length === 0) { if (!value) setSelectedIds([]); return; }
    const nums = value.split(',').map(s => s.trim()).filter(Boolean);
    if (nums.length === 0) { setSelectedIds([]); return; }
    const ids = nums.flatMap(numStr => {
      const isExtraRef = /\bEXTRA\b/i.test(numStr);
      const num = numStr.replace(/\s*EXTRA\s*/i, '').trim();
      const matches = freebets.filter(fb => fb.procedure_number === num);
      if (matches.length === 0) return [];
      const preferred = isExtraRef
        ? (matches.find(fb => fb.is_extra) ?? matches[0])
        : (matches.find(fb => !fb.is_extra) ?? matches[0]);
      return [preferred.id];
    });
    setSelectedIds(ids);
  }, [value, freebets]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedFbs = useMemo(
    () => selectedIds.map(id => freebets.find(fb => fb.id === id)).filter(Boolean) as FreebetOption[],
    [selectedIds, freebets]
  );
  const selectedNums = useMemo(() => selectedFbs.map(fb => fb.procedure_number), [selectedFbs]);
  const rawNums = useMemo(() => value.split(',').map(s => s.trim()).filter(Boolean), [value]);

  function buildOutputValue(ids: string[]): string {
    return ids
      .map(id => {
        const fb = freebets.find(f => f.id === id);
        if (!fb) return null;
        return fb.is_extra ? `${fb.procedure_number} EXTRA` : fb.procedure_number;
      })
      .filter(Boolean)
      .join(', ');
  }

  function toggleSelection(id: string) {
    const next = selectedIdSet.has(id)
      ? selectedIds.filter(x => x !== id)
      : [...selectedIds, id];
    setSelectedIds(next);
    suppressSync.current = true;
    onChange(buildOutputValue(next));
  }

  function removeSelection(id: string) {
    const next = selectedIds.filter(x => x !== id);
    setSelectedIds(next);
    suppressSync.current = true;
    onChange(buildOutputValue(next));
  }

  // Elegíveis = SIM/AGUARDANDO ou ainda não definida (NULL)
  const elegiveis = useMemo(
    () => freebets.filter(fb =>
      fb.freebet_creditada == null ||
      ['SIM', 'AGUARDANDO'].includes(fb.freebet_creditada)
    ),
    [freebets]
  );

  const visible = showAll ? freebets : elegiveis;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return visible;
    return visible.filter(fb =>
      fb.procedure_number.includes(q) ||
      (fb.platform ?? '').toLowerCase().includes(q) ||
      (fb.partida_descricao ?? '').toLowerCase().includes(q) ||
      (fb.promotion_name ?? '').toLowerCase().includes(q)
    );
  }, [visible, search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function handleRefresh(e: React.MouseEvent) {
    e.stopPropagation();
    queryClient.invalidateQueries({ queryKey: ['available_freebets_to_burn'] });
    refetch();
  }

  if (isLoading) {
    return (
      <div className="h-9 flex items-center gap-2 px-3 rounded-md border border-border/50 bg-background/50 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Carregando freebets...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      {/* Trigger */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => { setOpen(v => !v); setSearch(''); }}
          data-testid="select-freebet-ref"
          className={cn(
            'h-9 flex-1 min-w-0 flex items-center justify-between gap-2 px-3 rounded-md border text-sm transition-colors',
            'bg-background/50 border-border/50 hover:border-border',
            open && 'border-primary/50 ring-1 ring-primary/20',
          )}
        >
          {selectedFbs.length > 0 ? (
            <span className="truncate text-foreground flex items-center gap-1.5">
              {selectedFbs.length === 1
                ? `#${selectedFbs[0].procedure_number}${selectedFbs[0].is_extra ? ' EXTRA' : ''} · ${selectedFbs[0].platform ?? '—'} · ${fmtCurrency(selectedFbs[0].freebet_value ?? selectedFbs[0].freebet_valor_previsto) ?? '—'}`
                : `${selectedFbs.length} freebets selecionadas: ${selectedNums.join(', ')}`}
            </span>
          ) : rawNums.length > 0 ? (
            <span className="truncate text-warning">
              REF N° {rawNums.join(', ')} <span className="text-muted-foreground/60">(não encontrado na lista)</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Selecione a(s) freebet(s) a queimar...</span>
          )}
          <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform', open && 'rotate-180')} />
        </button>
        <button
          type="button"
          onClick={handleRefresh}
          title="Atualizar lista"
          className="h-9 w-9 shrink-0 flex items-center justify-center rounded-md border border-border/50 bg-background/50 hover:border-border hover:bg-muted/50 transition-colors"
          data-testid="btn-refresh-freebets"
        >
          <RefreshCw className={cn('h-3.5 w-3.5 text-muted-foreground', isFetching && 'animate-spin')} />
        </button>
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="relative z-50"
          >
            <div className="absolute top-0 left-0 right-0 bg-popover border border-border rounded-xl shadow-xl overflow-hidden">
              {/* Search + filtro */}
              <div className="flex flex-col gap-2 px-3 py-2 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <input
                    autoFocus
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por nº, casa ou jogo..."
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 text-foreground"
                    data-testid="input-freebet-search"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground">
                    <input
                      type="checkbox"
                      checked={showAll}
                      onChange={e => setShowAll(e.target.checked)}
                      className="h-3 w-3 accent-primary"
                      data-testid="check-show-all-freebets"
                    />
                    Mostrar todas (incluir NÃO/queimadas)
                  </label>
                  <span className="text-muted-foreground/60">
                    {filtered.length} de {freebets.length}
                  </span>
                </div>
                {selectedNums.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Múltipla seleção ativa — clique nos itens para adicionar/remover
                  </p>
                )}
              </div>

              {/* List */}
              <div className="max-h-60 overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-6 px-3">
                    {freebets.length === 0
                      ? 'Nenhuma freebet GANHAR_FB ativa encontrada.'
                      : showAll
                        ? 'Nenhum resultado pra essa busca.'
                        : 'Nenhuma freebet elegível. Marque "Mostrar todas" pra ver as queimadas/expiradas.'}
                  </div>
                ) : (
                  filtered.map(fb => {
                    const val = fmtCurrency(fb.freebet_value ?? fb.freebet_valor_previsto);
                    const dataBR = fmtDateBR(fb.date);
                    const isSelected = selectedIdSet.has(fb.id);
                    const credStatus = fb.freebet_creditada ?? 'PENDENTE';
                    const credBadgeColor =
                      credStatus === 'SIM' ? 'bg-primary/15 text-primary border-primary/30' :
                      credStatus === 'AGUARDANDO' ? 'bg-warning/15 text-warning border-warning/30' :
                      credStatus === 'NAO' ? 'bg-destructive/15 text-destructive border-destructive/30' :
                      'bg-muted/30 text-muted-foreground border-border/50';
                    return (
                      <button
                        key={fb.id}
                        type="button"
                        onClick={() => toggleSelection(fb.id)}
                        className={cn(
                          'w-full text-left px-3 py-2.5 flex flex-col gap-0.5 transition-colors border-b border-border/30 last:border-0',
                          isSelected
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-muted/50 text-foreground',
                        )}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            #{fb.procedure_number}{fb.is_extra ? ' EXTRA' : ''} · {fb.platform ?? '—'} · {val ?? '—'}
                          </span>
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', credBadgeColor)}>
                            {credStatus}
                          </span>
                          {fb.is_extra && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded border font-bold bg-warning/15 text-warning border-warning/30">
                              EXTRA
                            </span>
                          )}
                          {isSelected && <Check className="h-3 w-3 text-primary ml-auto" />}
                        </div>
                        {(fb.partida_descricao || dataBR) && (
                          <span className={cn('text-xs', isSelected ? 'text-primary/70' : 'text-muted-foreground')}>
                            {[traduzirEvento(fb.partida_descricao), dataBR].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {selectedNums.length > 0 && (
                <div className="px-3 py-2 border-t border-border/60 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">{selectedNums.length} selecionada(s)</span>
                  <button
                    type="button"
                    onClick={() => { setSelectedIds([]); suppressSync.current = true; onChange(''); }}
                    className="text-[11px] text-destructive hover:text-destructive/80"
                  >
                    Limpar todas
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cards das FBs selecionadas */}
      {selectedFbs.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {selectedFbs.map(fb => (
            <div key={fb.id} className="bg-muted/30 border border-border rounded-lg px-3 py-2 flex flex-col gap-0.5 relative">
              <button
                type="button"
                onClick={() => removeSelection(fb.id)}
                className="absolute top-1.5 right-1.5 h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Remover seleção"
              >
                <X className="h-3 w-3" />
              </button>
              <div className="flex items-center gap-2 text-xs flex-wrap pr-6">
                <span className="text-muted-foreground">Proc:</span>
                <span className="font-mono font-medium text-foreground">#{fb.procedure_number}</span>
                {fb.is_extra && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded border font-bold bg-warning/15 text-warning border-warning/30">EXTRA</span>
                )}
                <span className="text-muted-foreground">·</span>
                <span className="text-foreground font-medium">{fmtCurrency(fb.freebet_value ?? fb.freebet_valor_previsto) ?? '—'}</span>
                {fb.platform && <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-foreground">{fb.platform}</span>
                </>}
              </div>
              {fb.partida_descricao && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Jogo:</span>
                  <span className="text-foreground">{traduzirEvento(fb.partida_descricao)}</span>
                  {fb.date && <span className="text-muted-foreground">{fmtDateBR(fb.date)}</span>}
                </div>
              )}
            </div>
          ))}
          {selectedFbs.length > 1 && (
            <p className="text-[11px] text-primary/90 px-1">
              ✓ Todas as {selectedFbs.length} freebets serão vinculadas (#{selectedNums.join(', #')}). O cálculo soma o déficit de todas.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

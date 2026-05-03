// Botões inline ⏳ Tachar + ↻ Reenviar — paridade FreeBet PRO doc 05 §2.5.
// Aparecem ao lado do pill de status na coluna STATUS, em modo iconOnly.
import { useState, useRef, useEffect } from 'react';
import { Hourglass, RefreshCcw, MoreVertical } from 'lucide-react';
import { Procedure } from '@/types/procedures';
import { useToggleTachado, useToggleReenviado } from '@/hooks/useProcedures';

function formatReenviadoTooltip(iso: string | null, count: number): string {
  if (!iso) return '';
  const d = new Date(iso);
  const dt = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
  const hr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
  const suffix = count > 1 ? ` (${count}x)` : '';
  return `${dt} ${hr}${suffix}`;
}

export function StatusActionToggles({ procedure }: { procedure: Procedure }) {
  const toggleTachado = useToggleTachado();
  const toggleReenviado = useToggleReenviado();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const tachado = !!procedure.tachado;
  const reenviadoEm = procedure.reenviado_em;
  const reenviadoCount = procedure.reenviado_count || 0;
  const reenviadoAtivo = !!reenviadoEm;

  function handleTachar(e: React.MouseEvent) {
    e.stopPropagation();
    toggleTachado.mutate({ id: procedure.id, tachado: !tachado });
  }
  function handleReenviar(e: React.MouseEvent) {
    e.stopPropagation();
    toggleReenviado.mutate({
      id: procedure.id,
      mode: 'toggle',
      currentReenviadoEm: reenviadoEm,
      currentCount: reenviadoCount,
    });
  }
  function handleMenuToggle(e: React.MouseEvent) {
    e.stopPropagation();
    setMenuOpen((o) => !o);
  }
  function handleIncrement(e: React.MouseEvent) {
    e.stopPropagation();
    setMenuOpen(false);
    toggleReenviado.mutate({
      id: procedure.id,
      mode: 'increment',
      currentReenviadoEm: reenviadoEm,
      currentCount: reenviadoCount,
    });
  }
  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    setMenuOpen(false);
    toggleReenviado.mutate({
      id: procedure.id,
      mode: 'clear',
      currentReenviadoEm: reenviadoEm,
      currentCount: reenviadoCount,
    });
  }

  const reenviadoTip = reenviadoAtivo
    ? `Reenviado em ${formatReenviadoTooltip(reenviadoEm, reenviadoCount)}. Clique pra desmarcar; use ⋮ pra registrar nova atualização.`
    : 'Marcar como reenviado — avisa no PRO quem já marcou Feito que houve atualização.';

  return (
    <div className="inline-flex items-center gap-1 align-middle" onClick={(e) => e.stopPropagation()}>
      {/* ⏳ Tachar */}
      <button
        type="button"
        onClick={handleTachar}
        title={tachado ? 'Tachado — passou da hora. Clique pra destachar.' : 'Tachar — marca como passado. Quem pegou, pegou.'}
        data-testid={`button-tachar-${procedure.id}`}
        className={
          tachado
            ? 'inline-flex items-center gap-1 h-6 px-1.5 rounded-md bg-zinc-700 text-zinc-100 text-[10px] font-semibold border border-zinc-500/40 hover:bg-zinc-600 transition-colors'
            : 'inline-flex items-center justify-center h-6 w-6 rounded-md border border-white/10 text-muted-foreground/70 hover:text-foreground hover:border-white/30 hover:bg-white/5 transition-colors'
        }
      >
        <Hourglass className="w-3 h-3" />
        {tachado && <span className="line-through">Passou</span>}
      </button>

      {/* ↻ Reenviar */}
      <button
        type="button"
        onClick={handleReenviar}
        title={reenviadoTip}
        data-testid={`button-reenviar-${procedure.id}`}
        className={
          reenviadoAtivo
            ? 'inline-flex items-center gap-1 h-6 px-1.5 rounded-md bg-orange-500/20 text-orange-200 text-[10px] font-semibold border border-orange-400/40 hover:bg-orange-500/30 transition-colors'
            : 'inline-flex items-center justify-center h-6 w-6 rounded-md border border-white/10 text-muted-foreground/70 hover:text-orange-300 hover:border-orange-400/40 hover:bg-orange-500/10 transition-colors'
        }
      >
        <RefreshCcw className="w-3 h-3" />
        {reenviadoAtivo && reenviadoCount >= 1 && <span className="font-mono">{reenviadoCount}x</span>}
      </button>

      {/* Menu ⋮ — só aparece quando reenviado ativo */}
      {reenviadoAtivo && (
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={handleMenuToggle}
            title="Mais ações de reenvio"
            data-testid={`button-reenviar-menu-${procedure.id}`}
            className="inline-flex items-center justify-center h-6 w-5 rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-white/5 transition-colors"
          >
            <MoreVertical className="w-3 h-3" />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-7 z-50 min-w-[200px] rounded-lg border border-white/10 bg-background/98 backdrop-blur shadow-xl shadow-black/60 py-1"
              data-testid={`menu-reenviar-${procedure.id}`}
            >
              <button
                type="button"
                onClick={handleIncrement}
                className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-white/5 transition-colors"
                data-testid={`menu-item-nova-atualizacao-${procedure.id}`}
              >
                Marcar nova atualização
                <span className="block text-[10px] text-muted-foreground">Incrementa contador (mantém marcado)</span>
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="w-full text-left px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 transition-colors"
                data-testid={`menu-item-limpar-reenvio-${procedure.id}`}
              >
                Limpar reenvio
                <span className="block text-[10px] text-muted-foreground">Reseta data e contador</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

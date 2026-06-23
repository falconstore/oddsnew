// Botões inline ⏳ Tachar + ↻ Reenviar — paridade FreeBet PRO doc 05 §2.5.
// Aparecem ao lado do pill de status. Na tabela (revealOnHover) os botões
// INATIVOS só aparecem no hover da linha — estados ativos (tachado/reenviado)
// ficam sempre visíveis. Nos cards mobile (revealOnHover=false) ficam sempre.
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

export function StatusActionToggles({ procedure, revealOnHover = false }: { procedure: Procedure; revealOnHover?: boolean }) {
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

  // Botão inativo some no resting state quando na tabela (revela no hover da linha).
  const hideWhenInactive = revealOnHover ? 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity' : '';

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
            ? 'inline-flex items-center gap-1 h-7 px-1.5 bg-secondary text-secondary-foreground text-[10px] font-semibold border border-border hover:bg-muted transition-colors'
            : `inline-flex items-center justify-center h-7 w-7 shrink-0 text-muted-foreground/70 hover:text-foreground hover:bg-accent transition-colors ${hideWhenInactive}`
        }
      >
        <Hourglass className="w-3.5 h-3.5" />
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
            ? 'inline-flex items-center gap-1 h-7 px-1.5 bg-warning/20 text-warning text-[10px] font-semibold border border-warning/40 hover:bg-warning/30 transition-colors'
            : `inline-flex items-center justify-center h-7 w-7 shrink-0 text-warning/70 hover:text-warning hover:bg-warning/10 transition-colors ${hideWhenInactive}`
        }
      >
        <RefreshCcw className="w-3.5 h-3.5" />
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
            className="inline-flex items-center justify-center h-7 w-6 shrink-0 text-muted-foreground/70 hover:text-foreground hover:bg-accent transition-colors"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-7 z-50 min-w-[200px] border border-border bg-popover py-1"
              data-testid={`menu-reenviar-${procedure.id}`}
            >
              <button
                type="button"
                onClick={handleIncrement}
                className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
                data-testid={`menu-item-nova-atualizacao-${procedure.id}`}
              >
                Marcar nova atualização
                <span className="block text-[10px] text-muted-foreground">Incrementa contador (mantém marcado)</span>
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="w-full text-left px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors"
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

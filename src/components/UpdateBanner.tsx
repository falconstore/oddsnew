import { useState } from 'react';
import { RefreshCw, Loader2, Sparkles } from 'lucide-react';
import { useVersionCheck, clearCachesAndReload } from '@/hooks/useVersionCheck';

// Faixa de destaque no TOPO da página quando há nova versão publicada.
// Largura total, verde de accent, levemente pulsante — difícil de ignorar.
// O usuário clica em "Atualizar agora" → limpa caches e recarrega na versão nova.
export function UpdateBanner() {
  const { updateAvailable } = useVersionCheck();
  const [updating, setUpdating] = useState(false);

  if (!updateAvailable) return null;

  const handleUpdate = async () => {
    setUpdating(true);
    await clearCachesAndReload();
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] animate-in slide-in-from-top duration-300">
      <div className="bg-primary text-primary-foreground shadow-lg shadow-primary/30">
        <div className="mx-auto flex items-center justify-center gap-3 px-4 py-2.5 flex-wrap">
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-foreground/70 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary-foreground" />
          </span>
          <Sparkles className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm font-semibold">
            Nova versão do sistema disponível!
          </span>
          <span className="text-xs opacity-80 hidden sm:inline">
            Atualize para receber as últimas mudanças.
          </span>
          <button
            onClick={handleUpdate}
            disabled={updating}
            className="ml-1 inline-flex items-center gap-1.5 h-8 px-4 text-xs font-bold uppercase tracking-wide bg-primary-foreground text-primary rounded-lg hover:bg-primary-foreground/90 transition-colors disabled:opacity-60 shadow"
          >
            {updating ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Atualizando…</>
            ) : (
              <><RefreshCw className="h-3.5 w-3.5" /> Atualizar agora</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

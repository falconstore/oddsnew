import { useState } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useVersionCheck, clearCachesAndReload } from '@/hooks/useVersionCheck';

// Banner fixo que aparece quando uma nova versão do sistema foi publicada.
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
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] w-[min(92vw,440px)]">
      <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-card shadow-2xl shadow-black/40 px-4 py-3">
        <RefreshCw className="h-5 w-5 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight">
            Nova versão disponível
          </p>
          <p className="text-xs text-muted-foreground leading-tight mt-0.5">
            Atualize para receber as últimas mudanças do sistema.
          </p>
        </div>
        <button
          onClick={handleUpdate}
          disabled={updating}
          className="flex-shrink-0 inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {updating ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Atualizando…</>
          ) : (
            'Atualizar agora'
          )}
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';

// Detecta quando uma nova versão do app foi publicada.
//
// Como funciona:
//   - No build, o vite grava dist/version.json com a versão deste build e
//     embute a mesma versão no bundle (__APP_VERSION__).
//   - Aqui buscamos /version.json (sempre da rede, sem cache) e comparamos com
//     a versão que está rodando. Se diferente → há atualização disponível.
//   - Checa ao montar, quando a aba ganha foco e a cada CHECK_INTERVAL.
//
// O reload é responsabilidade do componente do banner (limpa caches + reload).

const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos
const RUNNING_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

export function useVersionCheck(): { updateAvailable: boolean } {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const check = useCallback(async () => {
    // Em dev a versão é instável (timestamp a cada start) — não faz sentido.
    if (RUNNING_VERSION === 'dev') return;
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { version?: string };
      if (data?.version && data.version !== RUNNING_VERSION) {
        setUpdateAvailable(true);
      }
    } catch {
      /* offline ou erro de rede — ignora, tenta de novo no próximo ciclo */
    }
  }, []);

  useEffect(() => {
    if (RUNNING_VERSION === 'dev') return;

    check(); // ao montar

    const interval = setInterval(check, CHECK_INTERVAL);
    const onFocus = () => check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [check]);

  return { updateAvailable };
}

// Recarrega a página buscando tudo da rede: limpa o Cache API (PWA/service
// worker, se houver) e força reload. Os hashes do Vite já garantem JS/CSS novos;
// isso é o "limpar o navegador" prático pro usuário.
export async function clearCachesAndReload(): Promise<void> {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    /* segue pro reload mesmo se a limpeza falhar */
  }
  // location.reload() já busca o documento da rede; com os caches limpos e os
  // hashes novos, o usuário recebe a versão atualizada.
  window.location.reload();
}

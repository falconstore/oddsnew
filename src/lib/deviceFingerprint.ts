/**
 * Calcula um fingerprint SHA-256 do dispositivo/browser a partir de sinais
 * disponíveis sem bibliotecas externas. Usado no signup do trial para
 * detecção de repetidores que criam nova conta Telegram + email + WhatsApp.
 *
 * Sinais utilizados:
 *  - user-agent
 *  - idioma do navegador
 *  - timezone
 *  - resolução de tela + profundidade de cor
 *  - lista de plugins do navegador
 *  - canvas fingerprint (renderização de texto com fonte específica)
 */

async function canvasHash(): Promise<string> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 280;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';

    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#0f9560';
    ctx.fillRect(0, 0, 280, 60);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('BetShark 🦈 canvas fp 2026', 2, 4);
    ctx.font = '11px monospace';
    ctx.fillStyle = '#10b981';
    ctx.fillText('Ωπβ∑∆ 1234567890 !@#$', 2, 30);

    return canvas.toDataURL();
  } catch {
    return 'canvas-error';
  }
}

function getPlugins(): string {
  try {
    if (!navigator.plugins || navigator.plugins.length === 0) return 'no-plugins';
    return Array.from(navigator.plugins)
      .map(p => p.name)
      .sort()
      .join(',');
  } catch {
    return 'plugins-error';
  }
}

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function computeDeviceFingerprint(): Promise<string> {
  try {
    const signals: string[] = [
      navigator.userAgent,
      navigator.language || navigator.languages?.join(',') || '',
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      `${screen.width}x${screen.height}x${screen.colorDepth}`,
      `${screen.availWidth}x${screen.availHeight}`,
      getPlugins(),
      await canvasHash(),
    ];

    const raw = signals.join('|||');
    return await sha256(raw);
  } catch {
    return 'fingerprint-error';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Z-API helper — envia mensagens via WhatsApp
// Docs: https://developer.z-api.io
//
// Secrets necessários (Supabase):
//   ZAPI_INSTANCE_ID   — ID da instância
//   ZAPI_TOKEN         — Token da instância
//   ZAPI_CLIENT_TOKEN  — Client-Token de segurança
// ─────────────────────────────────────────────────────────────────────────────

export interface ZApiTextPayload {
  phone: string;
  message: string;
}

export interface ZApiResult {
  ok: boolean;
  error?: string;
}

function zapiHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Client-Token": Deno.env.get("ZAPI_CLIENT_TOKEN") ?? "",
  };
}

function zapiBaseUrl(): string | null {
  const id    = Deno.env.get("ZAPI_INSTANCE_ID");
  const token = Deno.env.get("ZAPI_TOKEN");
  if (!id || !token) return null;
  return `https://api.z-api.io/instances/${id}/token/${token}`;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

/**
 * Envia uma mensagem de texto simples via Z-API.
 * Nunca lança — ideal para fire-and-forget.
 */
export async function sendZApiText(payload: ZApiTextPayload): Promise<ZApiResult> {
  const base = zapiBaseUrl();
  if (!base) return { ok: false, error: "ZAPI secrets não configurados" };

  try {
    const res = await fetch(`${base}/send-text`, {
      method: "POST",
      headers: zapiHeaders(),
      body: JSON.stringify({ phone: normalizePhone(payload.phone), message: payload.message }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Z-API HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export interface ZApiButtonItem {
  id: string;
  label: string;
}

export interface ZApiButtonListPayload {
  phone: string;
  message: string;
  buttonList: { buttons: ZApiButtonItem[] };
}

/**
 * Envia mensagem com lista de botões interativos (WhatsApp Business).
 * Nunca lança.
 */
export async function sendZApiButtonList(payload: ZApiButtonListPayload): Promise<ZApiResult> {
  const base = zapiBaseUrl();
  if (!base) return { ok: false, error: "ZAPI secrets não configurados" };

  try {
    const res = await fetch(`${base}/send-button-list`, {
      method: "POST",
      headers: zapiHeaders(),
      body: JSON.stringify({
        phone: normalizePhone(payload.phone),
        message: payload.message,
        buttonList: payload.buttonList,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Z-API HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export interface ZApiImagePayload {
  phone: string;
  imageUrl: string;
  caption?: string;
}

/**
 * Envia imagem com legenda opcional via Z-API.
 * Nunca lança.
 */
export async function sendZApiImage(payload: ZApiImagePayload): Promise<ZApiResult> {
  const base = zapiBaseUrl();
  if (!base) return { ok: false, error: "ZAPI secrets não configurados" };

  try {
    const res = await fetch(`${base}/send-image`, {
      method: "POST",
      headers: zapiHeaders(),
      body: JSON.stringify({
        phone: normalizePhone(payload.phone),
        image: payload.imageUrl,
        caption: payload.caption ?? "",
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Z-API HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export interface ZApiVideoPayload {
  phone: string;
  videoUrl: string;
  caption?: string;
}

/**
 * Envia vídeo com legenda opcional via Z-API.
 * Nunca lança.
 */
export async function sendZApiVideo(payload: ZApiVideoPayload): Promise<ZApiResult> {
  const base = zapiBaseUrl();
  if (!base) return { ok: false, error: "ZAPI secrets não configurados" };

  try {
    const res = await fetch(`${base}/send-video`, {
      method: "POST",
      headers: zapiHeaders(),
      body: JSON.stringify({
        phone: normalizePhone(payload.phone),
        video: payload.videoUrl,
        caption: payload.caption ?? "",
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Z-API HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * Mensagem curta de "primeiro contato" — mantida por compatibilidade,
 * mas o envio proativo no trial-signup foi desativado.
 * O lead é instruído na página /obrigado a nos mandar uma mensagem,
 * que dispara o funil interativo diretamente.
 */
export function buildWelcomeMessage(firstName: string, _botStartUrl: string): string {
  return [
    `Oi ${firstName}! 👋`,
    ``,
    `Aqui é a equipe do *Shark Green* 🦈`,
    ``,
    `Seu trial de *7 dias grátis* acabou de ser ativado! 🎉`,
    ``,
    `Me responda com *"Oi"* aqui que eu te envio seu acesso completo agora 🚀`,
  ].join("\n");
}

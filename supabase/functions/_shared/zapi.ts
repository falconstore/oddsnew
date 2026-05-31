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

/**
 * Monta a mensagem de boas-vindas para novos leads do trial.
 */
export function buildWelcomeMessage(firstName: string, botStartUrl: string): string {
  return [
    `Oi ${firstName}! 👋`,
    ``,
    `Aqui é a equipe do *Shark Green* 🦈`,
    ``,
    `Seu cadastro no trial gratuito foi confirmado com sucesso! 🎉`,
    ``,
    `Para receber os sinais, você vai precisar do *Telegram* — é gratuito e leva menos de 2 minutos pra instalar:`,
    ``,
    `📲 *Baixe o Telegram:*`,
    `🤖 Android → https://play.google.com/store/apps/details?id=org.telegram.messenger`,
    `🍎 iPhone → https://apps.apple.com/br/app/telegram-messenger/id686449807`,
    ``,
    `Depois de instalar, é só clicar no link abaixo e apertar *START* para ativar seu acesso:`,
    ``,
    `👉 ${botStartUrl}`,
    ``,
    `Qualquer dúvida é só responder aqui! 😊`,
  ].join("\n");
}

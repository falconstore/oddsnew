// ─────────────────────────────────────────────────────────────────────────────
// Z-API helper — envia mensagem de texto via WhatsApp
// Docs: https://developer.z-api.io/message/send-text
//
// Secrets necessários (Supabase):
//   ZAPI_INSTANCE_ID   — ID da instância (ex: 3D...)
//   ZAPI_TOKEN         — Token da instância
//   ZAPI_CLIENT_TOKEN  — Client-Token de segurança (gerado em Security no painel)
// ─────────────────────────────────────────────────────────────────────────────

export interface ZApiTextPayload {
  phone: string;   // apenas dígitos, incluindo DDI (ex: "5511999999999")
  message: string;
}

export interface ZApiResult {
  ok: boolean;
  error?: string;
}

/**
 * Envia uma mensagem de texto via Z-API.
 * Retorna { ok: true } em caso de sucesso, { ok: false, error } caso contrário.
 * Nunca lança — ideal para fire-and-forget.
 */
export async function sendZApiText(payload: ZApiTextPayload): Promise<ZApiResult> {
  const instanceId   = Deno.env.get("ZAPI_INSTANCE_ID");
  const token        = Deno.env.get("ZAPI_TOKEN");
  const clientToken  = Deno.env.get("ZAPI_CLIENT_TOKEN");

  if (!instanceId || !token || !clientToken) {
    return { ok: false, error: "ZAPI secrets não configurados (ZAPI_INSTANCE_ID / ZAPI_TOKEN / ZAPI_CLIENT_TOKEN)" };
  }

  // Remove qualquer não-dígito e garante DDI 55
  const digits = payload.phone.replace(/\D/g, "");
  const phone  = digits.startsWith("55") ? digits : `55${digits}`;

  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": clientToken,
      },
      body: JSON.stringify({ phone, message: payload.message }),
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
 * Inclui orientação sobre instalar o Telegram e link do bot.
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

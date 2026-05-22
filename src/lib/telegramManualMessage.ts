export const TELEGRAM_USERNAME_REGEX = /^[a-z0-9_]{3,32}$/;

export function normalizeTelegramUsername(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/^@/, '').toLowerCase();
  if (!TELEGRAM_USERNAME_REGEX.test(cleaned)) return null;
  return cleaned;
}

export function isValidTelegramUsername(raw: string | null | undefined): boolean {
  return normalizeTelegramUsername(raw) !== null;
}

export function extractFirstName(name: string | null | undefined): string | null {
  if (!name) return null;
  const first = name.trim().split(/\s+/)[0];
  if (!first) return null;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export function buildManualTelegramMessage(name: string | null | undefined): string {
  const first = extractFirstName(name);
  if (first) {
    return `Oi ${first}! Tudo bem? Tivemos uma instabilidade no nosso sistema que pode ter afetado a liberação do seu acesso ao trial. Você chegou a receber o convite do grupo certinho? Se não, me confirma por aqui que eu reenvio agora mesmo. 🦈💚`;
  }
  return `Oi! Tudo bem? Tivemos uma instabilidade no nosso sistema que pode ter afetado a liberação do seu acesso ao trial. Você chegou a receber o convite do grupo certinho? Se não, me confirma por aqui que eu reenvio agora mesmo. 🦈💚`;
}

export function buildTelegramChatUrl(username: string): string {
  const normalized = normalizeTelegramUsername(username);
  if (!normalized) throw new Error('Invalid telegram username');
  return `https://t.me/${normalized}`;
}

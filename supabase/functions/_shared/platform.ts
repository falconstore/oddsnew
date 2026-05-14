// Stop words PT-BR mantidas em minúscula em meio a nomes multi-palavra
// (ex.: "Bet da Sorte", "Jogo de Ouro", "Rei do Pitaco").
const PLATFORM_STOP_WORDS = new Set(["de", "da", "do", "das", "dos", "e"]);

// Aliases canônicos: nome lowercase sem espaços → nome canônico.
// Mantido em sync com src/lib/procedureUtils.ts.
const PLATFORM_ALIASES: Record<string, string> = {
  mcgames: "Mc Games",
  f12bet: "F12 Bet",
  goldebet: "Gol de Bet",
  jogodeouro: "Jogo de Ouro",
  reidopitaco: "Rei do Pitaco",
  betdasorte: "Bet da Sorte",
  lancedasorte: "Lance da Sorte",
  brasildasorte: "Brasil da Sorte",
  pixdasorte: "Pix da Sorte",
};

/**
 * Normaliza nome de plataforma/casa para Title Case PT-BR.
 * Espelho exato de src/lib/procedureUtils.ts#normalizePlatformName.
 *
 * Exemplos:
 *   "BET365"        -> "Bet365"
 *   "BETANO"        -> "Betano"
 *   "MC GAMES"      -> "Mc Games"
 *   "JOGO DE OURO"  -> "Jogo de Ouro"
 */
export function normalizePlatformName(input: string | null | undefined): string {
  if (!input) return "";
  const trimmed = String(input).trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  const aliasKey = trimmed.toLowerCase().replace(/\s+/g, "");
  if (PLATFORM_ALIASES[aliasKey]) return PLATFORM_ALIASES[aliasKey];
  return trimmed
    .split(" ")
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i > 0 && PLATFORM_STOP_WORDS.has(lower)) return lower;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

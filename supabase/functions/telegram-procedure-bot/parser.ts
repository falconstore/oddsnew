// Parser de mensagens do canal de procedimentos via Telegram.
// Extrai todos os campos necessários para inserção em `procedures`.
// deno-lint-ignore-file

export type ProcedureTipo = "SEM_FB" | "GANHAR_FB" | "QUEIMAR_FB";

export interface ParsedProcedure {
  procedure_number: string;
  date: string;                   // YYYY-MM-DD (data de referência do procedimento)
  platform: string;
  partida_descricao: string | null;
  kickoff_at: string | null;      // ISO UTC (construído a partir de data+hora local BRT)
  data_partida: string | null;    // YYYY-MM-DD
  horario_partida: string | null; // HH:MM
  tipo: ProcedureTipo;
  category: string;               // 'Promoção' | 'Superodd' | 'Extra' | 'Freebet'
  lucro_prejuizo_previsto: number | null;
  freebet_valor_previsto: number | null;
  ref_procedure_number: string | null; // número do proc de referência (QUEIMAR_FB)
  is_duplo_green: boolean;
}

export type ParseResult =
  | { ok: true; data: ParsedProcedure }
  | { ok: false; missingFields: string[] };

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function parseBrNumber(s: string): number {
  // "15,00" → 15.00   "1.500,00" → 1500.00
  return parseFloat(s.replace(/\./g, "").replace(",", "."));
}

function parseDayMonth(
  str: string,
  defaultYear: number,
): { year: number; month: number; day: number } | null {
  // Accepts "08/05", "08/05/26", "08/05/2026"
  const parts = str.trim().split("/");
  if (parts.length < 2) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  let year = defaultYear;
  if (parts.length >= 3) {
    const y = parseInt(parts[2], 10);
    year = y < 100 ? 2000 + y : y;
  }
  if (isNaN(day) || isNaN(month) || day < 1 || month < 1 || month > 12) return null;
  return { day, month, year };
}

function toISODate(day: number, month: number, year: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function kickoffToUtc(isoDate: string, time: string): string {
  // Brazil Standard Time = UTC-3 (BRT)
  // "2026-05-08T20:00:00-03:00" → UTC ISO string
  return new Date(`${isoDate}T${time}:00-03:00`).toISOString();
}

// Normaliza um texto removendo emojis e espaços extras pra facilitar o regex
function stripEmojis(s: string): string {
  return s.replace(
    /[\u{1F300}-\u{1FFFF}\u{2600}-\u{27FF}\u{FE00}-\u{FEFF}]/gu,
    "",
  ).trim();
}

// ──────────────────────────────────────────────────────────
// Extratores individuais
// ──────────────────────────────────────────────────────────

/** Extrai número do procedimento. Aceita "PROCEDIMENTO 29", "PROCEDIMENTO #29". */
function extractProcedureNumber(text: string): string | null {
  const m = text.match(/PROCEDIMENTO\s+#?(\d+)/i);
  return m ? m[1] : null;
}

/** Extrai número do procedimento de referência (QUEIMAR_FB). */
function extractRefProcedureNumber(text: string): string | null {
  const m = text.match(
    /REFERENTE\s+[AÀ][OS]?\s+FREEBETS?\s+DO\s+PROCEDIMENTO\s+#?(\d+)/i,
  );
  return m ? m[1] : null;
}

/** Extrai a data de referência do procedimento no formato dd/mm ou dd/mm/aaaa.
 * Padrões aceitos:
 *  - "DATA: 08/05/2026"
 *  - "PROCEDIMENTO 29 - 08/05/2026" ou "PROCEDIMENTO 29 — 08/05"
 */
function extractDate(text: string, defaultYear: number): string | null {
  // Primário: linha explícita "DATA: DD/MM[/AAAA]"
  const dataM = text.match(/DATA:\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i);
  if (dataM) {
    const parsed = parseDayMonth(dataM[1], defaultYear);
    if (parsed) return toISODate(parsed.day, parsed.month, parsed.year);
  }

  // Fallback: data na mesma linha que "PROCEDIMENTO N - DD/MM[/AAAA]"
  const procM = text.match(
    /PROCEDIMENTO\s+#?\d+\s*[-–—]\s*(?:[^0-9\n]*?\s)?(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,
  );
  if (procM) {
    const parsed = parseDayMonth(procM[1], defaultYear);
    if (parsed) return toISODate(parsed.day, parsed.month, parsed.year);
  }

  return null;
}

/** Extrai a plataforma/casa. Primeiro tenta `CASA: X`; fallback: linha
 * isolada no corpo que parece nome de uma casa de apostas. */
function extractPlatform(text: string): string | null {
  // Primary: explicit "CASA: Bet365" line
  const m = text.match(/CASA:\s*(.+?)(?:\s*[\n\r]|$)/i);
  if (m) return stripEmojis(m[1]).trim() || null;

  // Fallback: scan lines for a standalone word/phrase that looks like a
  // platform name (1-5 capitalized words, no colons, no dates, no match scores).
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const clean = stripEmojis(line).trim();
    if (!clean || clean.length < 2) continue;
    // Skip known keyword prefixes
    if (/^(PROCEDIMENTO|DATA|EVENTO|LUCRO|RECOMPENSA|REFERENTE|MISSÃO|MISSAO|SUPERODD|OBJETIVO|APOSTA|DUPLO)/i.test(clean)) continue;
    // Skip lines with colons (key: value) or numeric patterns (dates, scores)
    if (clean.includes(":")) continue;
    if (/\d{1,2}\/\d{1,2}/.test(clean)) continue;
    if (/\d{2}:\d{2}/.test(clean)) continue;
    // Skip lines that look like a match description "Team A x Team B"
    if (/\w+\s+[xX]\s+\w+/.test(clean)) continue;
    // Skip lines with emojis (already stripped, but check if it was all emojis)
    if (line.trim() && !clean) continue;
    // Accept: 1–5 words, starts with uppercase, reasonable length
    const words = clean.split(/\s+/);
    if (
      words.length >= 1 &&
      words.length <= 5 &&
      /^[A-ZÁÉÍÓÚÀÃÕÂÊÎÔÛÇ0-9]/.test(clean) &&
      clean.length <= 50
    ) {
      return clean;
    }
  }
  return null;
}

// ──────────────────────────────────────────────────────────
// Extração de eventos (partida + horário)
// ──────────────────────────────────────────────────────────

interface EventCandidate {
  description: string;
  dayMonth: string;   // "08/05"
  time: string;       // "20:00"
  kickoffUtc: string; // ISO
  isoDate: string;    // YYYY-MM-DD
}

/**
 * Extrai todos os pares (descrição do evento, data/hora) da mensagem.
 * Padrões aceitos:
 *  - Linha contendo "dd/mm às HH:MM" ou "dd/mm - HH:MM" ou "dd/mm as HH:MM"
 *  - "EVENTO: X - 08/05 às 20:00"
 *  - Linhas separadas: "EVENTO: Flamengo x Palmeiras\n08/05 às 18:00"
 */
function extractEventCandidates(
  text: string,
  defaultYear: number,
): EventCandidate[] {
  const candidates: EventCandidate[] = [];
  const lines = text.split(/\r?\n/);

  // Regex que captura data + hora na mesma linha ou separados
  // Padrão: "08/05 às 20:00" ou "08/05 - 20:00" ou "08/05/2026 20:00"
  const dtRe =
    /(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*(?:às|as|-|·|•)?\s*(\d{2}:\d{2})/i;

  // "EVENTO:" prefix (single-line)
  const eventoRe = /^(?:EVENTO\s*\d*:\s*|⚽\s*|🏀\s*|🎾\s*|🏐\s*)?(.+?)\s*[-–—]\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*(?:às|as)?\s*(\d{2}:\d{2})/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Try single-line with both description and datetime
    const em = line.match(eventoRe);
    if (em) {
      const desc = stripEmojis(em[1]).trim();
      const dateStr = em[2];
      const timeStr = em[3];
      const parsed = parseDayMonth(dateStr, defaultYear);
      if (parsed && desc) {
        const isoDate = toISODate(parsed.day, parsed.month, parsed.year);
        candidates.push({
          description: desc,
          dayMonth: dateStr,
          time: timeStr,
          kickoffUtc: kickoffToUtc(isoDate, timeStr),
          isoDate,
        });
        continue;
      }
    }

    // Try line with just datetime — look at the previous non-empty line as description
    const dtm = line.match(dtRe);
    if (dtm && !line.match(/^DATA:/i) && !line.match(/^EVENTO\s*\d*:/i)) {
      const parsed = parseDayMonth(dtm[1], defaultYear);
      if (parsed) {
        const isoDate = toISODate(parsed.day, parsed.month, parsed.year);
        // Look backwards for a description line
        let desc = "";
        for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
          const prev = stripEmojis(lines[j]).trim();
          if (prev && !prev.match(/^(?:CASA|DATA|PROCEDIMENTO|RECOMPENSA|LUCRO|MISSÃO|SUPERODD|REFERENTE):/i)) {
            desc = prev
              .replace(/^(?:EVENTO\s*\d*:\s*)/i, "")
              .replace(/^[⚽🏀🎾🏐🥊🎮⚾🏈]\s*/u, "")
              .trim();
            if (desc) break;
          }
        }
        candidates.push({
          description: desc || line,
          dayMonth: dtm[1],
          time: dtm[2],
          kickoffUtc: kickoffToUtc(isoDate, dtm[2]),
          isoDate,
        });
        continue;
      }
    }

    // "EVENTO: Flamengo x Palmeiras" on its own line
    const evOnlyRe = /^(?:EVENTO\s*\d*:\s*)(.+)/i;
    const eom = line.match(evOnlyRe);
    if (eom) {
      const desc = stripEmojis(eom[1]).trim();
      // Look for a datetime in the next 3 lines
      for (let j = i + 1; j <= Math.min(lines.length - 1, i + 3); j++) {
        const next = lines[j].trim();
        const dtNext = next.match(dtRe);
        if (dtNext) {
          const parsed = parseDayMonth(dtNext[1], defaultYear);
          if (parsed && desc) {
            const isoDate = toISODate(parsed.day, parsed.month, parsed.year);
            candidates.push({
              description: desc,
              dayMonth: dtNext[1],
              time: dtNext[2],
              kickoffUtc: kickoffToUtc(isoDate, dtNext[2]),
              isoDate,
            });
          }
          break;
        }
      }
    }
  }

  return candidates;
}

/**
 * Escolhe o evento mais relevante para o momento atual.
 * Estratégia:
 *  1. Prefere eventos com kickoff no futuro (kickoff >= now); entre eles,
 *     o de kickoff mais próximo (menor distância positiva do now).
 *  2. Se todos já passaram, usa o mais recente (maior kickoff no passado).
 * Isso garante que, em multi-evento, o bot sempre pega a próxima partida
 * e não uma partida que já começou/encerrou.
 */
function pickClosestEvent(
  candidates: EventCandidate[],
): EventCandidate | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  const now = Date.now();

  const future = candidates.filter(
    (c) => new Date(c.kickoffUtc).getTime() >= now,
  );

  if (future.length > 0) {
    // Nearest upcoming: smallest positive distance
    return future.reduce((best, c) => {
      const bDiff = new Date(best.kickoffUtc).getTime() - now;
      const cDiff = new Date(c.kickoffUtc).getTime() - now;
      return cDiff < bDiff ? c : best;
    });
  }

  // All in the past — return the most recent one
  return candidates.reduce((best, c) => {
    return new Date(c.kickoffUtc).getTime() > new Date(best.kickoffUtc).getTime()
      ? c
      : best;
  });
}

// ──────────────────────────────────────────────────────────
// Extração de valores monetários
// ──────────────────────────────────────────────────────────

const BR_NUM = /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+,\d{2}|\d+\.\d{2})/;

/**
 * Extrai lucro_previsto cobrindo 3 padrões:
 *  (a) "LUCRO: 💵 15,00"
 *  (b) "LUCRO: 💵 10,00 À 20,00 💵" → usa o maior
 *  (c) "OBJETIVO DUPLO GREEN - 💵 25,00"
 * Retorna { value, isDuploGreen }.
 */
function extractLucro(
  text: string,
): { value: number; isDuploGreen: boolean } | null {
  // (c) Duplo green
  const dgRe = new RegExp(
    `DUPLO\\s+GREEN[^\\n]*?${BR_NUM.source}`,
    "i",
  );
  const dgm = text.match(dgRe);
  if (dgm) {
    return { value: parseBrNumber(dgm[1]), isDuploGreen: true };
  }

  // (b) Range: "LUCRO: ... X,XX À Y,YY"
  const rangeRe = new RegExp(
    `LUCRO:[^\\n]*?${BR_NUM.source}\\s*[AÀ]\\s*${BR_NUM.source}`,
    "i",
  );
  const rm = text.match(rangeRe);
  if (rm) {
    const v1 = parseBrNumber(rm[1]);
    const v2 = parseBrNumber(rm[2]);
    return { value: Math.max(v1, v2), isDuploGreen: false };
  }

  // (a) Direct: "LUCRO: ... X,XX"
  const directRe = new RegExp(`LUCRO:[^\\n]*?${BR_NUM.source}`, "i");
  const dm = text.match(directRe);
  if (dm) {
    return { value: parseBrNumber(dm[1]), isDuploGreen: false };
  }

  return null;
}

/**
 * Extrai valor previsto de freebet.
 * Padrão: "RECOMPENSA: 🎁 50,00 EM FREEBET" ou "50,00 EM FREEBET"
 */
function extractFreebetValor(text: string): number | null {
  const re = new RegExp(`${BR_NUM.source}\\s*EM\\s*FREEBET`, "i");
  const m = text.match(re);
  return m ? parseBrNumber(m[1]) : null;
}

// ──────────────────────────────────────────────────────────
// Detecção de tipo e categoria
// ──────────────────────────────────────────────────────────

function detectTipo(text: string): ProcedureTipo {
  if (/REFERENTE\s+[AÀ][OS]?\s+FREEBETS?\s+DO\s+PROCEDIMENTO/i.test(text)) {
    return "QUEIMAR_FB";
  }
  if (/\bEM\s+FREEBET\b/i.test(text)) {
    return "GANHAR_FB";
  }
  return "SEM_FB";
}

function detectCategory(text: string): string {
  if (/\bSUPERODD\b/i.test(text)) return "Superodd";
  if (/\bMISS[ÃA]O\b/i.test(text)) return "Extra";
  if (/\bAPOSTA\s+GR[AÁ]TIS\b|\bFREEBET\b/i.test(text)) return "Freebet";
  return "Promoção";
}

// ──────────────────────────────────────────────────────────
// Função principal de parse
// ──────────────────────────────────────────────────────────

export function parseMessage(text: string): ParseResult {
  const now = new Date();
  const defaultYear = now.getFullYear();
  const missingFields: string[] = [];

  // 1. Número do procedimento
  const procedureNumber = extractProcedureNumber(text);
  if (!procedureNumber) missingFields.push("número do procedimento (PROCEDIMENTO N)");

  // 2. Data de referência (usa hoje se não encontrar)
  const dateStr = extractDate(text, defaultYear) ?? now.toISOString().slice(0, 10);

  // 3. Plataforma
  const platform = extractPlatform(text);
  if (!platform) missingFields.push("casa/plataforma (CASA: X)");

  // 4. Tipo
  const tipo = detectTipo(text);

  // 5. Categoria
  const category = detectCategory(text);

  // 6. Valores monetários
  const lucroResult = extractLucro(text);
  const freebetValor = extractFreebetValor(text);

  // Validação de valores esperados por tipo:
  //  - GANHAR_FB  → precisa de freebet_valor_previsto (X,XX EM FREEBET)
  //  - SEM_FB / QUEIMAR_FB → precisa de lucro_previsto (LUCRO: / DUPLO GREEN)
  if (tipo === "GANHAR_FB" && freebetValor == null) {
    missingFields.push("valor de freebet (X,XX EM FREEBET)");
  }
  if ((tipo === "SEM_FB" || tipo === "QUEIMAR_FB") && lucroResult == null) {
    missingFields.push("lucro previsto (LUCRO: 💵 X,XX ou OBJETIVO DUPLO GREEN - 💵 X,XX)");
  }

  // 7. Referência (QUEIMAR_FB)
  const refProcNumber = tipo === "QUEIMAR_FB" ? extractRefProcedureNumber(text) : null;
  if (tipo === "QUEIMAR_FB" && !refProcNumber) {
    missingFields.push("número do procedimento de referência (REFERENTE ÀS FREEBETS DO PROCEDIMENTO N)");
  }

  // 8. Eventos / partidas (obrigatório: o bot precisa do evento e kickoff)
  const events = extractEventCandidates(text, defaultYear);
  const chosenEvent = pickClosestEvent(events);

  if (!chosenEvent) {
    missingFields.push("evento e horário da partida (ex: Flamengo x Palmeiras - 08/05 às 18:00)");
  }

  if (missingFields.length > 0) {
    return { ok: false, missingFields };
  }

  return {
    ok: true,
    data: {
      procedure_number: procedureNumber!,
      date: dateStr,
      platform: platform!,
      partida_descricao: chosenEvent?.description ?? null,
      kickoff_at: chosenEvent?.kickoffUtc ?? null,
      data_partida: chosenEvent?.isoDate ?? null,
      horario_partida: chosenEvent?.time ?? null,
      tipo,
      category,
      lucro_prejuizo_previsto: lucroResult?.value ?? null,
      freebet_valor_previsto: freebetValor,
      ref_procedure_number: refProcNumber,
      is_duplo_green: lucroResult?.isDuploGreen ?? false,
    },
  };
}

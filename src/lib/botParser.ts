// Porta browser-compatível do parser do bot Telegram — Shark 100% Green VIP
// Espelho de supabase/functions/telegram-procedure-bot/parser.ts

export type ProcedureTipo = "SEM_FB" | "GANHAR_FB" | "QUEIMAR_FB";
export type Prioridade = "ALTA" | "MEDIA";

export interface ParsedProcedure {
  procedure_number: string;
  external_id: string;
  titulo: string;
  date: string;
  platform: string;
  category: string;
  tipo: ProcedureTipo;
  prioridade: Prioridade;
  partida_descricao: string | null;
  kickoff_at: string | null;
  data_partida: string | null;
  horario_partida: string | null;
  lucro_prejuizo_previsto: number | null;
  freebet_valor_previsto: number | null;
  ref_procedure_number: string | null;
  is_duplo_green: boolean;
  dp: boolean;
  observacoes: string | null;
}

export interface PartialParsedProcedure {
  procedure_number: string;
  external_id: string;
  titulo: string;
  date: string;
  platform: string | null;
  category: string;
  tipo: ProcedureTipo;
  prioridade: Prioridade;
  partida_descricao: string | null;
  kickoff_at: string | null;
  data_partida: string | null;
  horario_partida: string | null;
  lucro_prejuizo_previsto: number | null;
  freebet_valor_previsto: number | null;
  ref_procedure_number: string | null;
  is_duplo_green: boolean;
  dp: boolean;
  observacoes: string | null;
  missingFields: string[];
}

export type ParseResult =
  | { ok: true; data: ParsedProcedure }
  | { ok: "partial"; data: PartialParsedProcedure }
  | { ok: false; missingFields: string[] };

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function parseBrNumber(s: string): number {
  return parseFloat(s.replace(/\./g, "").replace(",", "."));
}

function stripEmojis(s: string): string {
  return s
    .replace(/[\u{1F300}-\u{1FFFF}\u{2600}-\u{27FF}\u{FE00}-\u{FEFF}\u{200D}]/gu, "")
    .replace(/[\u{1F000}-\u{1F9FF}]/gu, "")
    .replace(/[🟢🔵🟡🟥🔴😍]/gu, "")
    .trim();
}

function parseDateDMY(str: string, defaultYear: number): { y: number; m: number; d: number } | null {
  const parts = str.trim().split("/");
  if (parts.length < 2) return null;
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  let y = defaultYear;
  if (parts.length >= 3) {
    const raw = parseInt(parts[2], 10);
    y = raw < 100 ? 2000 + raw : raw;
  }
  if (isNaN(d) || isNaN(m) || d < 1 || d > 31 || m < 1 || m > 12) return null;
  return { y, m, d };
}

function toISODate(d: number, m: number, y: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function kickoffToUtc(isoDate: string, time: string): string {
  return new Date(`${isoDate}T${time}:00-03:00`).toISOString();
}

// ──────────────────────────────────────────────────────────
// Extratores
// ──────────────────────────────────────────────────────────

function extractProcedureNumber(text: string): string | null {
  const m = text.match(/PROCEDIMENTO\s+(?:EXTRA\s+)?#?(\d+)\s*[-–—]/i);
  if (m) return m[1];
  const m2 = text.match(/PROCEDIMENTO\s+(?:EXTRA\s+)?#?(\d+)/i);
  return m2 ? m2[1] : null;
}

function extractDate(text: string, defaultYear: number): string | null {
  const m = text.match(/PROCEDIMENTO\s+(?:EXTRA\s+)?#?\d+\s*[-–—]\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i);
  if (m) {
    const p = parseDateDMY(m[1], defaultYear);
    if (p) return toISODate(p.d, p.m, p.y);
  }
  const m2 = text.match(/DATA:\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i);
  if (m2) {
    const p = parseDateDMY(m2[1], defaultYear);
    if (p) return toISODate(p.d, p.m, p.y);
  }
  return null;
}

function extractPlatform(text: string, descricaoLinha: string): string | null {
  const casaM = text.match(/^CASA:\s*(.+?)(?:\s*[\n\r]|$)/im);
  if (casaM) {
    const v = stripEmojis(casaM[1]).trim();
    if (v) return v;
  }
  const fromDesc = descricaoLinha.match(/\bDA\s+([A-ZÁÉÍÓÚÀÃÕÂÊÎÔÛÇ][A-Za-záéíóúàãõâêîôûç0-9\s]{1,30}?)(?:\s*[-–—🔥\n\r]|$)/u);
  if (fromDesc) {
    const casa = stripEmojis(fromDesc[1]).trim();
    if (casa && casa.length >= 2) return casa;
  }
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const clean = stripEmojis(line).trim();
    if (!clean || clean.length < 2 || clean.length > 40) continue;
    if (/^(PROCEDIMENTO|DATA|EVENTO|LUCRO|RECOMPENSA|REFERENTE|MISSÃO|MISSAO|SUPERODD|OBJETIVO|APOSTA|DUPLO|UTILIZAR|CASO|ATENÇAO|ATENÇÃO)/i.test(clean)) continue;
    if (clean.includes(":")) continue;
    if (/\d{1,2}\/\d{1,2}/.test(clean)) continue;
    if (/\d{2}:\d{2}/.test(clean)) continue;
    if (/\w+\s+[xX]\s+\w+/.test(clean)) continue;
    const words = clean.split(/\s+/);
    if (words.length >= 1 && words.length <= 4 && /^[A-ZÁÉÍÓÚÀÃÕÂÊÎÔÛÇ]/u.test(clean)) {
      return clean;
    }
  }
  return null;
}

function extractTitulo(text: string): string {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const clean = stripEmojis(line).trim();
    if (/^PROCEDIMENTO\s+REFERENTE/i.test(clean)) {
      return clean
        .replace(/\s*🔥\s*$/u, "")
        .replace(/\s+EXTRA\s*$/i, "")
        .replace(/^PROCEDIMENTO\s+REFERENTE\s*(?:[AÀ][OS]?\s+|:\s*)?/i, "")
        .trim()
        .slice(0, 200);
    }
  }
  if (lines.length >= 2) {
    return stripEmojis(lines[1]).trim().slice(0, 200);
  }
  return "";
}

function extractRefProcedureNumber(text: string): string | null {
  // Formato longo: "REFERENTE ÀS FREEBETS DO PROCEDIMENTO 145"
  const m1 = text.match(/REFERENTE\s+[AÀ][OS]?\s+FREEBETS?\s+DO\s+PROCEDIMENTO\s+#?(\d+)/i);
  if (m1) return m1[1];
  // Formato abreviado: "REF N° 145" / "REF Nº 145" / "REF N 145"
  const m2 = text.match(/\bREF\s+N[°º]?\s*#?(\d+)/i);
  return m2 ? m2[1] : null;
}

/** Extrai linha "📝 OBS: ..." — usada para Opção 2 da Aposta Protegida e outros comentários */
function extractObservacoes(text: string): string | null {
  const m = text.match(/^📝?\s*OBS:\s*(.+?)(?:\s*[\n\r]|$)/im);
  return m ? m[1].trim() || null : null;
}

interface EventCandidate {
  description: string;
  time: string;
  kickoffUtc: string;
  isoDate: string;
}

function extractEventCandidates(text: string, defaultYear: number): EventCandidate[] {
  const candidates: EventCandidate[] = [];
  const eventRe =
    /^([^\n\r\d🟢🔵🟡🟥🔴😍]+?)\s*[-–—]\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(?:[AÀàa][Ss]|ÀS|às|as|-)\s*(\d{2}:\d{2})/iu;
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const raw = line.trim();
    if (!raw) continue;
    const clean = stripEmojis(raw).trim();
    if (!clean) continue;
    const m = clean.match(eventRe);
    if (m) {
      const desc = m[1].trim().replace(/^(?:EVENTO\s*\d*:\s*)/i, "");
      const dateStr = m[2];
      const timeStr = m[3];
      const p = parseDateDMY(dateStr, defaultYear);
      if (p && desc && /\bX\b/i.test(desc)) {
        const isoDate = toISODate(p.d, p.m, p.y);
        candidates.push({
          description: desc,
          time: timeStr,
          kickoffUtc: kickoffToUtc(isoDate, timeStr),
          isoDate,
        });
      }
    }
  }
  return candidates;
}

function pickClosestEvent(candidates: EventCandidate[]): EventCandidate | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  const now = Date.now();
  const future = candidates.filter(c => new Date(c.kickoffUtc).getTime() >= now);
  if (future.length > 0) {
    return future.reduce((best, c) =>
      (new Date(c.kickoffUtc).getTime() - now) < (new Date(best.kickoffUtc).getTime() - now) ? c : best
    );
  }
  return candidates.reduce((best, c) =>
    new Date(c.kickoffUtc).getTime() > new Date(best.kickoffUtc).getTime() ? c : best
  );
}

const BR_NUM = /(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+,\d{1,2}|\d+\.\d{2}|\d+)/;

function extractLucro(text: string): { value: number; isDuploGreen: boolean } | null {
  const dgRe = new RegExp(`DUPLO\\s+GREEN[^\\n]*?${BR_NUM.source}`, "i");
  const dgm = text.match(dgRe);
  if (dgm) return { value: parseBrNumber(dgm[1]), isDuploGreen: true };
  const rangeRe = new RegExp(
    `LUCRO:[^\\n]*?${BR_NUM.source}\\s*[AÀà]\\s*${BR_NUM.source}`,
    "i",
  );
  const rm = text.match(rangeRe);
  if (rm) {
    const v1 = parseBrNumber(rm[1]);
    const v2 = parseBrNumber(rm[2]);
    return { value: Math.max(v1, v2), isDuploGreen: false };
  }
  const directRe = new RegExp(`LUCRO:[^\\n]*?${BR_NUM.source}`, "i");
  const dm = text.match(directRe);
  if (dm) return { value: parseBrNumber(dm[1]), isDuploGreen: false };
  return null;
}

function extractFreebetValor(text: string): number | null {
  const re = new RegExp(`${BR_NUM.source}\\s*EM\\s*FREEBET`, "i");
  const m = text.match(re);
  return m ? parseBrNumber(m[1]) : null;
}

function detectTipo(text: string): ProcedureTipo {
  // Detecta QUEIMAR_FB pelo formato longo ou pelo abreviado (REF N°)
  if (/REFERENTE\s+[AÀ][OS]?\s+FREEBETS?\s+(?:DO\s+PROCEDIMENTO|[—\-]?\s*REF\s+N)/i.test(text)) return "QUEIMAR_FB";
  if (/\bEM\s+FREEBET\b/i.test(text)) return "GANHAR_FB";
  return "SEM_FB";
}

function detectCategory(text: string, tipo: ProcedureTipo): string {
  // 1. Linha explícita emitida pelo template: 📋 CATEGORIA: X
  const explicit = text.match(/^📋?\s*CATEGORIA:\s*(.+?)(?:\s*[\n\r]|$)/im);
  if (explicit && explicit[1].trim()) return explicit[1].trim();
  // 2. Fallback por keyword
  if (/\bSUPERODD\b/i.test(text)) return "Superodd";
  if (/\bMISS[ÃA]O\b/i.test(text)) return "Extra";
  if (tipo === "GANHAR_FB") return "Freebet";
  return "Promoção";
}

// ──────────────────────────────────────────────────────────
// Parse principal
// ──────────────────────────────────────────────────────────

export function parseMessage(text: string): ParseResult {
  // Gatilho: mensagem deve começar com 🟢 ou 🔵 (opt-in explícito)
  // Mensagens informativas que mencionam "PROCEDIMENTO NNN" no corpo são ignoradas.
  if (!/^\s*[🟢🔵]/u.test(text)) {
    return { ok: false, missingFields: ["mensagem não reconhecida como procedimento"] };
  }

  const now = new Date();
  const defaultYear = now.getFullYear();
  const missing: string[] = [];

  const procedureNumber = extractProcedureNumber(text);
  if (!procedureNumber) {
    return { ok: false, missingFields: ["número do procedimento (PROCEDIMENTO NNN - DD/MM/AAAA)"] };
  }

  const dateStr = extractDate(text, defaultYear) ?? now.toISOString().slice(0, 10);

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const descLine = lines.find(l => /PROCEDIMENTO\s+REFERENTE/i.test(stripEmojis(l))) ?? "";

  const titulo = extractTitulo(text);

  const platform = extractPlatform(text, stripEmojis(descLine));
  if (!platform) missing.push("casa/plataforma (CASA: X ou 'DA NOMECASA' na descrição)");

  const tipo = detectTipo(text);
  const category = detectCategory(text, tipo);

  const lucroResult = extractLucro(text);
  const freebetValor = extractFreebetValor(text);
  const observacoes = extractObservacoes(text);

  if (tipo === "GANHAR_FB" && freebetValor == null) {
    missing.push("valor de freebet (X,XX EM FREEBET)");
  }
  if ((tipo === "SEM_FB" || tipo === "QUEIMAR_FB") && lucroResult == null) {
    missing.push("lucro previsto (LUCRO: 💵 X,XX ou OBJETIVO DUPLO GREEN - 💵 X,XX)");
  }

  const refProcNumber = tipo === "QUEIMAR_FB" ? extractRefProcedureNumber(text) : null;
  if (tipo === "QUEIMAR_FB" && !refProcNumber) {
    missing.push("número do procedimento de referência (REF N° NNN ou FREEBETS DO PROCEDIMENTO NNN)");
  }

  const events = extractEventCandidates(text, defaultYear);
  const chosenEvent = pickClosestEvent(events);
  if (!chosenEvent) {
    missing.push("evento e horário (TIME A X TIME B - DD/MM/AAAA ÀS HH:MM)");
  }

  const isDuploGreen = lucroResult?.isDuploGreen ?? false;
  const hasDuploMention = /chance\s+de\s+duplo\s+green/i.test(text) || isDuploGreen;
  const prioridade: Prioridade = hasDuploMention ? "ALTA" : "MEDIA";

  if (missing.length > 0) {
    return {
      ok: "partial",
      data: {
        procedure_number: procedureNumber,
        external_id: `bsk:${procedureNumber}`,
        titulo,
        date: dateStr,
        platform: platform ?? null,
        category,
        tipo,
        prioridade,
        partida_descricao: chosenEvent?.description ?? null,
        kickoff_at: chosenEvent?.kickoffUtc ?? null,
        data_partida: chosenEvent?.isoDate ?? null,
        horario_partida: chosenEvent?.time ?? null,
        lucro_prejuizo_previsto: lucroResult?.value ?? null,
        freebet_valor_previsto: freebetValor,
        ref_procedure_number: refProcNumber,
        is_duplo_green: isDuploGreen,
        dp: hasDuploMention,
        observacoes,
        missingFields: missing,
      },
    };
  }

  return {
    ok: true,
    data: {
      procedure_number: procedureNumber,
      external_id: `bsk:${procedureNumber}`,
      titulo,
      date: dateStr,
      platform: platform!,
      category,
      tipo,
      prioridade,
      partida_descricao: chosenEvent?.description ?? null,
      kickoff_at: chosenEvent?.kickoffUtc ?? null,
      data_partida: chosenEvent?.isoDate ?? null,
      horario_partida: chosenEvent?.time ?? null,
      lucro_prejuizo_previsto: lucroResult?.value ?? null,
      freebet_valor_previsto: freebetValor,
      ref_procedure_number: refProcNumber,
      is_duplo_green: isDuploGreen,
      dp: hasDuploMention,
      observacoes,
    },
  };
}

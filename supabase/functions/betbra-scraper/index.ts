// Edge Function: betbra-scraper
//
// Scrapes earnings data from affiliates.betbra.bet.br for a given date range,
// doing two requests (All and Exchange) and upserting results into
// betbra_affiliate_data by date.
//
// POST body:
//   { start_date?, end_date? }  → default: first/last day of current month (BRT)
//   { action: "check" }         → { ok: true, cookie_configured: bool }
//
// Required secrets: BETBRA_COOKIE (mandatory), BETBRA_USER_AGENT (optional)
//
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(init.headers || {}) },
  });

const BETBRA_BASE = "https://affiliates.betbra.bet.br";
const BETBRA_EARNINGS_URL = `${BETBRA_BASE}/earnings/aListEarnings`;
const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const PER_PAGE = 25;

const log = (event: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ tag: "betbra-scraper", event, ...data }));

// Returns Brasília "today" as YYYY-MM-DD (UTC-3)
function brasiliaToday(): string {
  const now = new Date();
  const local = new Date(now.getTime() + (-3 * 60) * 60000);
  return local.toISOString().slice(0, 10);
}

function firstDayOfMonth(dateStr: string): string {
  return dateStr.slice(0, 7) + "-01";
}

function lastDayOfMonth(dateStr: string): string {
  const [year, month] = dateStr.slice(0, 7).split("-").map(Number);
  const last = new Date(year, month, 0);
  return `${year}-${String(month).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
}

function buildFormBody(params: [string, string][]): string {
  return params
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

// Parse numeric string: handles "1.234,56" (BR) and "1,234.56" (EN)
function parseNumber(raw: string): number {
  if (!raw) return 0;
  const s = raw.replace(/[^\d.,-]/g, "").trim();
  if (!s) return 0;
  if (s.includes(",") && s.includes(".")) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastComma > lastDot) {
      // BR: "1.234,56"
      return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
    }
  }
  if (s.includes(",") && !s.includes(".")) {
    return parseFloat(s.replace(",", ".")) || 0;
  }
  return parseFloat(s) || 0;
}

// Parse date: "DD/MM/YYYY" → "YYYY-MM-DD", passthrough if already ISO
function parseDate(raw: string): string {
  const t = raw.trim();
  const dmy = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  return t;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim();
}

// Column name synonyms → canonical field name
const COL_MAP: Record<string, string> = {
  data: "date",
  date: "date",
  dia: "date",
  registros: "registros",
  registro: "registros",
  signups: "registros",
  players: "registros",
  "new players": "registros",
  clientes: "registros",
  apostas: "numero_de_apostas",
  "nº de apostas": "numero_de_apostas",
  "num apostas": "numero_de_apostas",
  bets: "numero_de_apostas",
  "total bets": "numero_de_apostas",
  ngr: "ngr",
  "net gaming revenue": "ngr",
  "net revenue": "ngr",
  lucro: "ngr",
  turnover: "turnover",
  "users turnover": "turnover",
  volume: "turnover",
  apostado: "turnover",
  cpa: "cpa",
  "cpa total": "cpa",
  depositors: "cpa",
  "new depositors": "cpa",
  depositantes: "cpa",
};

function resolveCol(header: string): string | null {
  const h = header.toLowerCase().replace(/\s+/g, " ").trim();
  if (COL_MAP[h]) return COL_MAP[h];
  for (const [key, val] of Object.entries(COL_MAP)) {
    if (h.includes(key) || key.includes(h)) return val;
  }
  return null;
}

// ── HTML parsing (single-page) ────────────────────────────────────────────────

interface ParsedRow {
  date: string;
  registros: number;
  numero_de_apostas: number;
  ngr: number;
  turnover: number;
  cpa: number;
  raw_cells: string[];
}

// Extract header texts from a <thead> block or first <tr> with <th> tags
function extractHeadersFromBlock(html: string): string[] {
  const headers: string[] = [];
  const theadM = html.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
  const src = theadM ? theadM[1] : html;
  const thRe = /<th[^>]*>([\s\S]*?)<\/th>/gi;
  let m: RegExpExecArray | null;
  while ((m = thRe.exec(src)) !== null) headers.push(stripHtml(m[1]).toLowerCase());
  if (headers.length === 0) {
    // Try first <tr> of source
    const firstTrM = src.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
    if (firstTrM) {
      const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      while ((m = tdRe.exec(firstTrM[1])) !== null) headers.push(stripHtml(m[1]).toLowerCase());
    }
  }
  return headers;
}

// Extract data rows from a single HTML block (one page's worth of HTML)
// Handles multiple <tbody> blocks within a single page
function extractDataRowsFromBlock(html: string): string[][] {
  const rows: string[][] = [];

  // Try to find <tbody> blocks
  const tbodyRe = /<tbody[^>]*>([\s\S]*?)<\/tbody>/gi;
  const tbodyMatches: string[] = [];
  let tm: RegExpExecArray | null;
  while ((tm = tbodyRe.exec(html)) !== null) tbodyMatches.push(tm[1]);

  const searchIn = tbodyMatches.length > 0 ? tbodyMatches.join("") : html;

  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trM: RegExpExecArray | null;
  while ((trM = trRe.exec(searchIn)) !== null) {
    const cells: string[] = [];
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdM: RegExpExecArray | null;
    while ((tdM = tdRe.exec(trM[1])) !== null) cells.push(stripHtml(tdM[1]));
    if (cells.length >= 2) rows.push(cells);
  }
  return rows;
}

function buildColIndex(headers: string[]): Record<string, number> {
  const colIndex: Record<string, number> = {};
  headers.forEach((h, i) => {
    const canonical = resolveCol(h);
    if (canonical && colIndex[canonical] === undefined) colIndex[canonical] = i;
  });
  return colIndex;
}

// BetBra fixed column layout (the AJAX endpoint /earnings/aListEarnings
// returns only <tr> rows without <thead>, so positional mapping is the
// source of truth). Verified against affiliates.betbra.bet.br on 2026-05-12.
//
//   0: Date                          5: Active Accounts        10: (cpa-related)
//   1: Registrations (registros)     6: Number of bets         11: CPA count
//   2: New Depositing Accounts       7: Volume Matched
//   3: Depositing Accounts           8: Site NGR
//   4: System (label "All"/"Exchange") 9: Users Turnover
const BETBRA_COL = {
  date: 0,
  registros: 1,
  numero_de_apostas: 6,
  ngr: 8,
  turnover: 9,
  cpa: 11,
} as const;

// Parse one page of HTML → structured rows
function parsePageHtml(
  html: string,
  colIndexOverride?: Record<string, number>
): { rows: ParsedRow[]; headers: string[] } {
  const headers = extractHeadersFromBlock(html);
  const colIndex = colIndexOverride ?? buildColIndex(headers);
  const hasNamedCols = Object.keys(colIndex).length >= 4;

  const rawRows = extractDataRowsFromBlock(html);
  const rows: ParsedRow[] = [];

  for (const cells of rawRows) {
    // Use hardcoded BetBra layout when row matches expected width (≥10 cells)
    // and no full named-column map was detected from headers.
    const useBetbra = !hasNamedCols && cells.length >= 10;

    const dateIdx = hasNamedCols ? (colIndex["date"] ?? 0) : BETBRA_COL.date;
    const dateRaw = cells[dateIdx] ?? cells[0];
    const parsedDate = parseDate(dateRaw);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(parsedDate)) continue; // skip header/empty rows

    const get = (field: keyof typeof BETBRA_COL, fallback: number): number => {
      const idx = hasNamedCols
        ? (colIndex[field] ?? -1)
        : useBetbra
          ? BETBRA_COL[field]
          : -1;
      return parseNumber(idx >= 0 ? (cells[idx] ?? "") : (cells[fallback] ?? ""));
    };

    rows.push({
      date: parsedDate,
      registros: get("registros", 1),
      numero_de_apostas: get("numero_de_apostas", 2),
      ngr: get("ngr", 3),
      turnover: get("turnover", 3),
      cpa: get("cpa", 4),
      raw_cells: [...cells],
    });
  }
  return { rows, headers };
}

// ── HTTP fetch helpers ────────────────────────────────────────────────────────

interface FetchPageResult {
  ok: boolean;
  cookieExpired?: boolean;
  error?: string;
  html: string;
  rawJson?: unknown;
  totalPages: number;
}

async function fetchEarningsPage(opts: {
  cookie: string;
  userAgent: string;
  startDate: string;
  endDate: string;
  system?: string;
  page?: number;
}): Promise<FetchPageResult> {
  const { cookie, userAgent, startDate, endDate, system, page = 1 } = opts;

  // BetBra affiliate panel uses filters[date_range][] for date range
  // plus extra_param=changed-filter and search='' as typical AJAX params.
  // affiliate_earnings_types is ALWAYS commission/turnover/cpa (the report
  // categories shown). The system filter (=8 for Exchange) is separate.
  const params: [string, string][] = [
    ["filters[date_range][]", startDate],
    ["filters[date_range][]", endDate],
    ["filters[date_from]", startDate],
    ["filters[date_to]", endDate],
    ["filters[start_date]", startDate],
    ["filters[end_date]", endDate],
    ["filters[affiliate_earnings_types][]", "commission"],
    ["filters[affiliate_earnings_types][]", "turnover"],
    ["filters[affiliate_earnings_types][]", "cpa"],
    ["extra_param", "changed-filter"],
    ["search", ""],
    ["per_page", String(PER_PAGE)],
    ["filters[per_page]", String(PER_PAGE)],
    ["page", String(page)],
  ];
  if (system) {
    params.push(["filters[system]", system]);
  }

  // Sanitize header values: strip CR/LF and any non-ASCII bytes that would
  // make fetch reject the headers as "not a valid ByteString" (happens when
  // the secret was pasted with hidden Unicode chars like '…' or smart quotes)
  const safeHeader = (v: string) =>
    v.replace(/[\r\n]+/g, "").replace(/[^\x20-\x7E\t]/g, "");

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "X-Requested-With": "XMLHttpRequest",
    Origin: BETBRA_BASE,
    Referer: `${BETBRA_BASE}/earnings`,
    "User-Agent": safeHeader(userAgent),
    Cookie: safeHeader(cookie),
    Accept: "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  };

  let resp: Response;
  try {
    resp = await fetch(BETBRA_EARNINGS_URL, {
      method: "POST",
      headers,
      body: buildFormBody(params),
      redirect: "manual",
    });
  } catch (e: any) {
    return { ok: false, error: `Network error: ${e?.message}`, html: "", totalPages: 1 };
  }

  if (resp.status === 302 || resp.status === 301 || resp.status === 401 || resp.status === 403) {
    return { ok: false, cookieExpired: true, error: "Cookie expirado", html: "", totalPages: 1 };
  }
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    return { ok: false, error: `HTTP ${resp.status}: ${body.slice(0, 300)}`, html: "", totalPages: 1 };
  }

  const ct = resp.headers.get("content-type") ?? "";
  let html = "";
  let totalPages = 1;
  let rawJson: unknown;

  if (ct.includes("application/json")) {
    const data = await resp.json().catch(() => null);
    rawJson = data;
    if (!data) return { ok: false, error: "Invalid JSON response", html: "", totalPages: 1 };
    if (data.redirect || data.login || data.authenticated === false) {
      return { ok: false, cookieExpired: true, error: "Cookie expirado", html: "", totalPages: 1 };
    }
    html = data.html ?? data.data ?? data.content ?? data.table ?? data.tbody ?? "";
    if (typeof html !== "string") html = "";
    totalPages = Number(data.total_pages ?? data.last_page ?? data.pages ?? 1) || 1;
  } else {
    html = await resp.text().catch(() => "");
    if (html.includes("/login") && html.includes("<form") && !html.includes("<table")) {
      return { ok: false, cookieExpired: true, error: "Cookie expirado", html: "", totalPages: 1 };
    }
    const pageM = html.match(/data-last-page="(\d+)"|"last_page"\s*:\s*(\d+)|last_page:\s*(\d+)/);
    if (pageM) totalPages = Number(pageM[1] ?? pageM[2] ?? pageM[3]) || 1;
  }

  return { ok: true, html, totalPages, rawJson };
}

// Fetch all pages, parsing EACH page independently (avoids multi-tbody issue)
async function fetchAndParseAll(opts: {
  cookie: string;
  userAgent: string;
  startDate: string;
  endDate: string;
  system?: string;
}): Promise<{
  ok: boolean;
  cookieExpired?: boolean;
  error?: string;
  rowsByDate: Map<string, ParsedRow>;
  headers: string[];
  rawPages: unknown[];
}> {
  const first = await fetchEarningsPage({ ...opts, page: 1 });
  if (!first.ok) {
    return {
      ok: false,
      cookieExpired: first.cookieExpired,
      error: first.error,
      rowsByDate: new Map(),
      headers: [],
      rawPages: [],
    };
  }

  const { rows: firstRows, headers } = parsePageHtml(first.html);
  const colIndex = buildColIndex(headers);
  const rowsByDate = new Map<string, ParsedRow>(firstRows.map(r => [r.date, r]));
  const rawPages: unknown[] = [first.rawJson];
  const totalPages = Math.min(first.totalPages, 5); // safety cap

  for (let p = 2; p <= totalPages; p++) {
    const page = await fetchEarningsPage({ ...opts, page: p });
    if (!page.ok) {
      log("page_fetch_warn", { page: p, error: page.error });
      break;
    }
    // Parse with the SAME col index derived from first page's headers
    const { rows } = parsePageHtml(page.html, Object.keys(colIndex).length >= 2 ? colIndex : undefined);
    for (const row of rows) {
      if (!rowsByDate.has(row.date)) rowsByDate.set(row.date, row);
    }
    rawPages.push(page.rawJson);
  }

  return { ok: true, rowsByDate, headers, rawPages };
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const cookie = Deno.env.get("BETBRA_COOKIE") ?? "";
  const userAgent = Deno.env.get("BETBRA_USER_AGENT") ?? DEFAULT_UA;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* no body */ }

  // Cookie health-check (called from UI before invoking scraper)
  if (body.action === "check") {
    return json({ ok: true, cookie_configured: cookie.length > 0 });
  }

  if (!cookie) {
    return json({
      ok: false,
      cookie_configured: false,
      cookie_expired: false,
      error: "BETBRA_COOKIE não configurado. Adicione o secret nos secrets do Supabase.",
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

  const today = brasiliaToday();
  const startDate = (body.start_date as string | undefined) ?? firstDayOfMonth(today);
  const endDate = (body.end_date as string | undefined) ?? lastDayOfMonth(today);

  log("start", { startDate, endDate });

  // Fetch All (no system filter)
  const allResult = await fetchAndParseAll({ cookie, userAgent, startDate, endDate });
  if (!allResult.ok) {
    const errMsg = allResult.cookieExpired
      ? "Cookie expirado — atualize o secret BETBRA_COOKIE no Supabase."
      : (allResult.error ?? "Erro desconhecido ao buscar dados All");
    log("fetch_all_failed", { error: errMsg });
    return json({ ok: false, error: errMsg, cookie_expired: allResult.cookieExpired ?? false });
  }

  // Fetch Exchange (system=8)
  const exResult = await fetchAndParseAll({ cookie, userAgent, startDate, endDate, system: "8" });
  if (!exResult.ok) {
    const errMsg = exResult.cookieExpired
      ? "Cookie expirado — atualize o secret BETBRA_COOKIE no Supabase."
      : (exResult.error ?? "Erro desconhecido ao buscar dados Exchange");
    log("fetch_exchange_failed", { error: errMsg });
    return json({ ok: false, error: errMsg, cookie_expired: exResult.cookieExpired ?? false });
  }

  const allDates = new Set([...allResult.rowsByDate.keys(), ...exResult.rowsByDate.keys()]);

  if (allDates.size === 0) {
    log("no_data", { startDate, endDate });
    return json({ ok: true, days_updated: 0, errors: [], message: "Nenhum dado encontrado para o período" });
  }

  const errors: string[] = [];
  let daysUpdated = 0;
  const now = new Date().toISOString();

  for (const date of allDates) {
    const allRow = allResult.rowsByDate.get(date);
    const exRow = exResult.rowsByDate.get(date);

    // raw_all / raw_exchange: full raw cell arrays + detected headers for auditability
    const raw_all = allRow
      ? { cells: allRow.raw_cells, headers: allResult.headers }
      : null;
    const raw_exchange = exRow
      ? { cells: exRow.raw_cells, headers: exResult.headers }
      : null;

    const upsertData = {
      date,
      registros: allRow?.registros ?? 0,
      numero_de_apostas: allRow?.numero_de_apostas ?? 0,
      ngr: allRow?.ngr ?? 0,
      // Prefer Exchange turnover; fall back to All if Exchange had no data for this date
      turnover: exRow?.turnover ?? allRow?.turnover ?? 0,
      cpa: allRow?.cpa ?? 0,
      raw_all,
      raw_exchange,
      updated_at: now,
    };

    const { error } = await supa
      .from("betbra_affiliate_data")
      .upsert(upsertData, { onConflict: "date" });

    if (error) {
      log("upsert_error", { date, error: error.message });
      errors.push(`${date}: ${error.message}`);
    } else {
      daysUpdated++;
    }
  }

  log("done", { daysUpdated, errors: errors.length, startDate, endDate });

  return json({
    ok: true,
    days_updated: daysUpdated,
    errors,
    start_date: startDate,
    end_date: endDate,
  });
});

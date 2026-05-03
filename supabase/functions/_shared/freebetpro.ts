// Helpers compartilhados pro cliente FreeBet Pro.
// HMAC SHA-256 sobre `${timestamp}.${rawBody}` conforme spec aprovada
// (2026-05-03), header `X-BetShark-Signature: sha256=<hex>`.

const enc = new TextEncoder();

export async function hmacSha256Hex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Mapeamento Procedure (BetShark) → payload da §6.3 da spec.
type ProcRow = Record<string, unknown> & {
  id: string;
  platform: string;
  promotion_name: string | null;
  category: string;
  tipo: string | null;
  data_partida: string | null;
  horario_partida: string | null;
  partida_descricao: string | null;
  lucro_prejuizo_previsto: number | null;
  freebet_value: number | null;
  freebet_valor_previsto: number | null;
  dp: boolean | null;
  telegram_link: string | null;
  freebet_reference_id: string | null;
  archived: boolean | null;
  // Paridade FULL (doc 01/02)
  kickoff_at: string | null;
  fixture_id: number | null;
  esporte: string | null;
  cenario_b_cash: number | null;
  // Paridade doc 05 §2.5 / doc 06 — campos atualizados via PATCH
  tachado: boolean | null;
  tachado_em: string | null;
  reenviado_em: string | null;
  reenviado_count: number | null;
  duplo_green_confirmado: boolean | null;
  duplo_green_lucro: number | null;
};

const CATEGORIA_MAP: Record<string, string> = {
  "Promoção": "PROMOCAO",
  "Promocao": "PROMOCAO",
  "Cashback": "CASHBACK",
  "Freebet": "FREEBET",
  "Superodd": "SUPERODD",
  "Extra": "EXTRA",
  "Ganhar Giros Gratis": "GIROS_GRATIS",
};

const TIPO_MAP: Record<string, string> = {
  "SEM_FB": "SEM_FB",     // FreeBet Pro mapeia internamente pra NORMAL
  "GANHAR_FB": "GANHAR_FB",
  "QUEIMAR_FB": "QUEIMAR_FB",
};

export function buildUpsertPayload(p: ProcRow) {
  const titulo = p.promotion_name
    ? `${p.platform} — ${p.promotion_name}`
    : p.platform;

  const categoria = CATEGORIA_MAP[p.category] ?? "PROMOCAO";
  const tipo = TIPO_MAP[p.tipo ?? "SEM_FB"] ?? "SEM_FB";

  // Decimais como string com 2 casas (spec §6.3)
  const dec = (n: number | null | undefined) =>
    n == null ? null : Number(n).toFixed(2);

  return {
    external_id: p.id,
    titulo,
    casa_aposta: p.platform,
    categoria,
    prioridade: "MEDIA",
    tipo,
    data_partida: p.data_partida,
    horario_partida: p.horario_partida ? p.horario_partida.slice(0, 5) : null,
    partida_descricao: p.partida_descricao,
    lucro_prejuizo_previsto: dec(p.lucro_prejuizo_previsto),
    freebet_valor_previsto: dec(p.freebet_valor_previsto ?? p.freebet_value),
    dp: !!p.dp,
    descricao_promocao: null, // não temos campo dedicado
    link_promocao: null,      // idem
    link_telegram: p.telegram_link,
    external_referencia_id: p.freebet_reference_id, // null quando freebet_reference é texto livre
    arquivado: !!p.archived,
    // Paridade FULL com FreeBet Pro
    kickoff_at: p.kickoff_at,                  // ISO-UTC; FreeBet usa pra badge AO VIVO
    fixture_id: p.fixture_id,                  // API-Football id (link bidirecional)
    esporte: p.esporte || "futebol",
    cenario_b_cash: dec(p.cenario_b_cash),     // hedge cash do cenário B (GANHAR_FB c/ proteção)
    // doc 05 §2.5 — botões inline Tachar / Reenviar
    tachado: !!p.tachado,
    tachado_em: p.tachado_em,
    reenviado_em: p.reenviado_em,
    reenviado_count: p.reenviado_count ?? 0,
    // doc 06 — bloco DG do modal Definir Resultados
    duplo_green_confirmado: !!p.duplo_green_confirmado,
    duplo_green_lucro: dec(p.duplo_green_lucro),
  };
}

export function buildResultPayload(input: {
  resultado_lucro: number;
  resultado_freebet_ganha: number | null;
  freebet_creditada: "SIM" | "NAO" | null;
  resultado_observacao: string | null;
}) {
  const dec = (n: number | null | undefined) =>
    n == null ? null : Number(n).toFixed(2);
  return {
    resultado_lucro: dec(input.resultado_lucro)!,
    resultado_freebet_ganha: dec(input.resultado_freebet_ganha) ?? "0.00",
    freebet_creditada: input.freebet_creditada,
    resultado_observacao: input.resultado_observacao,
  };
}

export interface FreebetProResponse {
  ok: boolean;
  status: number;
  body: any;
  requestId: string | null;
  syncedAt: string | null;
  numero: number | null;
  errorCode: string | null;
}

export async function callFreebetPro(opts: {
  method: "GET" | "POST" | "PATCH";
  path: string;            // ex: "/procedimentos" ou "/procedimentos/<uuid>/resultado"
  body?: unknown;          // null/undefined → não envia body
  idempotencyKey?: string; // pra POST /procedimentos
}): Promise<FreebetProResponse> {
  const baseUrl = Deno.env.get("FREEBETPRO_BASE_URL");
  const keyId = Deno.env.get("FREEBETPRO_KEY_ID");
  const secret = Deno.env.get("FREEBETPRO_SECRET");
  if (!baseUrl || !keyId || !secret) {
    throw new Error("FREEBETPRO env vars missing");
  }

  const rawBody = opts.body === undefined || opts.body === null
    ? ""
    : JSON.stringify(opts.body);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);

  const headers: Record<string, string> = {
    "X-BetShark-Key-Id": keyId,
    "X-BetShark-Timestamp": timestamp,
    "X-BetShark-Signature": `sha256=${signature}`,
    "Accept": "application/json",
  };
  if (rawBody) headers["Content-Type"] = "application/json";
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;

  const url = `${baseUrl}${opts.path}`;
  const res = await fetch(url, {
    method: opts.method,
    headers,
    body: rawBody || undefined,
  });

  let parsed: any = null;
  const text = await res.text();
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }

  const data = parsed?.data ?? null;
  return {
    ok: res.ok && parsed?.ok !== false,
    status: res.status,
    body: parsed,
    requestId: res.headers.get("x-request-id") ?? parsed?.error?.request_id ?? null,
    syncedAt: data?.synced_at ?? null,
    numero: typeof data?.numero === "number" ? data.numero : null,
    errorCode: parsed?.error?.code ?? null,
  };
}

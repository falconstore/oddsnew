// Helper compartilhado: envia eventos pra Meta Conversions API e
// registra cada tentativa em `trial_capi_events` pro painel admin
// mostrar o saúde dos envios server-side.
//
// O `event_id` é crucial: precisa ser idêntico ao que o pixel do
// browser disparou pra que a Meta deduplique (ver Conversions API
// docs → "Event Deduplication").
//
// deno-lint-ignore-file
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const META_PIXEL_ID = "1295449168383975";
const META_GRAPH_VERSION = "v19.0";

export type CapiEventName = "Lead" | "PageView" | "ViewContent";

export interface CapiUserData {
  email?: string | null;
  phone?: string | null;
  client_ip?: string | null;
  client_user_agent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
}

export interface SendCapiOptions {
  eventName: CapiEventName;
  eventId: string;
  eventSourceUrl?: string | null;
  userData: CapiUserData;
  customData?: Record<string, unknown>;
  // Para o log: associa o evento a um lead e identifica a origem
  // (ex.: 'trial-signup', 'trial-pixel-track').
  leadId?: string | null;
  source?: string | null;
}

export interface CapiResult {
  ok: boolean;
  httpStatus: number;
  fbTraceId?: string | null;
  errorMessage?: string | null;
}

const enc = new TextEncoder();

async function sha256(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const normalizeEmail = (raw: string) => raw.trim().toLowerCase();

// Meta espera telefone em E.164 sem '+'. Para BR, prepende 55 se ainda
// não vier com DDI (10 ou 11 dígitos = só DDD + número).
const normalizePhone = (raw: string) => {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
};

async function buildHashedUserData(u: CapiUserData) {
  const out: Record<string, unknown> = {};
  if (u.email) {
    const norm = normalizeEmail(u.email);
    if (norm) out.em = [await sha256(norm)];
  }
  if (u.phone) {
    const norm = normalizePhone(u.phone);
    if (norm) out.ph = [await sha256(norm)];
  }
  if (u.client_ip) out.client_ip_address = u.client_ip;
  if (u.client_user_agent) out.client_user_agent = u.client_user_agent;
  if (u.fbp) out.fbp = u.fbp;
  if (u.fbc) out.fbc = u.fbc;
  return out;
}

let cachedSupabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient | null {
  if (cachedSupabase) return cachedSupabase;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  cachedSupabase = createClient(url, key, { auth: { persistSession: false } });
  return cachedSupabase;
}

async function logCapiEvent(params: {
  leadId?: string | null;
  source?: string | null;
  eventName: string;
  eventId: string;
  status: "success" | "error";
  httpStatus?: number | null;
  fbTraceId?: string | null;
  errorMessage?: string | null;
  meta?: Record<string, unknown>;
}) {
  const sb = getSupabase();
  if (!sb) return;
  try {
    await sb.from("trial_capi_events").insert({
      lead_id: params.leadId ?? null,
      event_name: params.eventName,
      event_id: params.eventId,
      source: params.source ?? null,
      status: params.status,
      http_status: params.httpStatus ?? null,
      fb_trace_id: params.fbTraceId ?? null,
      error_message: params.errorMessage ?? null,
      meta: params.meta ?? {},
    });
  } catch (err) {
    console.warn("trial_capi_events insert failed", err);
  }
}

// Extrai o IP real do request (atrás de proxy do Supabase).
export function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip");
}

export async function sendMetaCapiEvent(opts: SendCapiOptions): Promise<CapiResult> {
  const accessToken = Deno.env.get("META_CAPI_ACCESS_TOKEN");
  const pixelId = Deno.env.get("META_CAPI_PIXEL_ID") ?? META_PIXEL_ID;
  const testEventCode = Deno.env.get("META_CAPI_TEST_EVENT_CODE") ?? null;

  if (!accessToken) {
    const errorMessage = "META_CAPI_ACCESS_TOKEN não configurado";
    console.warn("meta-capi:", errorMessage);
    await logCapiEvent({
      leadId: opts.leadId,
      source: opts.source,
      eventName: opts.eventName,
      eventId: opts.eventId,
      status: "error",
      errorMessage,
    });
    return { ok: false, httpStatus: 0, errorMessage };
  }

  const userData = await buildHashedUserData(opts.userData);
  const eventTime = Math.floor(Date.now() / 1000);

  const eventPayload: Record<string, unknown> = {
    event_name: opts.eventName,
    event_time: eventTime,
    event_id: opts.eventId,
    action_source: "website",
    user_data: userData,
  };
  if (opts.eventSourceUrl) eventPayload.event_source_url = opts.eventSourceUrl;
  if (opts.customData && Object.keys(opts.customData).length > 0) {
    eventPayload.custom_data = opts.customData;
  }

  const body: Record<string, unknown> = {
    data: [eventPayload],
    access_token: accessToken,
  };
  if (testEventCode) body.test_event_code = testEventCode;

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${pixelId}/events`;
  let httpStatus = 0;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    httpStatus = res.status;
    const json = await res.json().catch(() => ({}));
    const fbTraceId = (json?.fbtrace_id ?? null) as string | null;

    if (!res.ok || json?.error) {
      const errorMessage = json?.error?.message
        ?? `HTTP ${httpStatus}`;
      await logCapiEvent({
        leadId: opts.leadId,
        source: opts.source,
        eventName: opts.eventName,
        eventId: opts.eventId,
        status: "error",
        httpStatus,
        fbTraceId,
        errorMessage,
        meta: { fb_response: json },
      });
      return { ok: false, httpStatus, fbTraceId, errorMessage };
    }

    await logCapiEvent({
      leadId: opts.leadId,
      source: opts.source,
      eventName: opts.eventName,
      eventId: opts.eventId,
      status: "success",
      httpStatus,
      fbTraceId,
      meta: {
        events_received: json?.events_received ?? null,
        messages: json?.messages ?? null,
      },
    });
    return { ok: true, httpStatus, fbTraceId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("meta-capi send error", errorMessage);
    await logCapiEvent({
      leadId: opts.leadId,
      source: opts.source,
      eventName: opts.eventName,
      eventId: opts.eventId,
      status: "error",
      httpStatus,
      errorMessage,
    });
    return { ok: false, httpStatus, errorMessage };
  }
}

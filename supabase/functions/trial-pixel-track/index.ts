// Edge Function: trial-pixel-track
// Recebe eventos do navegador (ex.: PageView na LP /trial) e replica
// pra Meta Conversions API server-side, usando o mesmo `event_id` que
// o pixel já disparou no front. Permite que conversões sejam contadas
// mesmo quando adblock / iOS ATT / cookies de terceiros bloqueiam o
// pixel no browser. Pública (deploy com --no-verify-jwt).
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import {
  getClientIp,
  sendMetaCapiEvent,
  type CapiEventName,
} from "../_shared/meta-capi.ts";

const ALLOWED_EVENTS = new Set<CapiEventName>(["PageView", "ViewContent", "Lead"]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, { status: 405 });

  try {
    const body = await req.json().catch(() => ({}));
    const eventName = String(body.event_name ?? "") as CapiEventName;
    if (!ALLOWED_EVENTS.has(eventName)) {
      return json({ error: "evento inválido" }, { status: 400 });
    }
    const eventId = String(body.event_id ?? "").trim();
    if (!eventId || eventId.length > 128) {
      return json({ error: "event_id obrigatório" }, { status: 400 });
    }

    const eventSourceUrl = typeof body.event_source_url === "string"
      ? body.event_source_url.slice(0, 512)
      : null;
    const source = typeof body.source === "string"
      ? body.source.slice(0, 64)
      : "trial-pixel-track";
    const customData = body.custom_data && typeof body.custom_data === "object"
      && !Array.isArray(body.custom_data)
      ? body.custom_data as Record<string, unknown>
      : undefined;
    const fbp = typeof body.fbp === "string" ? body.fbp.slice(0, 256) : null;
    const fbc = typeof body.fbc === "string" ? body.fbc.slice(0, 256) : null;

    const result = await sendMetaCapiEvent({
      eventName,
      eventId,
      eventSourceUrl,
      source,
      customData,
      userData: {
        client_ip: getClientIp(req),
        client_user_agent: req.headers.get("user-agent")?.slice(0, 512) ?? null,
        fbp,
        fbc,
      },
    });

    if (!result.ok) {
      return json({ ok: false, error: result.errorMessage ?? "send failed" }, { status: 502 });
    }
    return json({ ok: true, fb_trace_id: result.fbTraceId ?? null });
  } catch (err) {
    console.error("trial-pixel-track error", err);
    return json({ error: "internal" }, { status: 500 });
  }
});

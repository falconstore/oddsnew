// Edge Function: trial-upgrade-track
// Recebe eventos anônimos da página pública /trial-upgrade
// (visitas e cliques em CTAs) e grava em `trial_upgrade_events`.
// Pública (deploy com --no-verify-jwt). Usa apikey anon do Supabase.
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const ALLOWED_EVENTS = new Set([
  "view",
  "cta_whatsapp",
  "cta_checkout",
  "cta_telegram",
  "cta_free_group",
  "cta_open_form",
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, { status: 405 });

  try {
    const body = await req.json().catch(() => ({}));
    const event_type = String(body.event_type ?? "");
    if (!ALLOWED_EVENTS.has(event_type)) {
      return json({ error: "evento inválido" }, { status: 400 });
    }
    const lead_id = typeof body.lead_id === "string" && UUID_RE.test(body.lead_id)
      ? body.lead_id : null;
    const source = typeof body.source === "string"
      ? body.source.slice(0, 64) : null;
    const meta = body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
      ? body.meta : {};

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const ua = (req.headers.get("user-agent") ?? "").slice(0, 256);

    const { error } = await supabase.from("trial_upgrade_events").insert({
      lead_id,
      event_type,
      source,
      user_agent: ua,
      meta,
    });

    if (error) {
      // Se o lead_id não existir mais (ex.: lead deletado), grava sem ele.
      const code = (error as { code?: string }).code;
      if (code === "23503" && lead_id) {
        const { error: retryErr } = await supabase.from("trial_upgrade_events").insert({
          lead_id: null,
          event_type,
          source,
          user_agent: ua,
          meta: { ...meta, orphan_lead_id: lead_id },
        });
        if (retryErr) {
          console.error("track retry insert error", retryErr);
          return json({ error: "insert failed" }, { status: 500 });
        }
        return json({ ok: true, orphan: true });
      }
      console.error("track insert error", error);
      return json({ error: "insert failed" }, { status: 500 });
    }

    return json({ ok: true });
  } catch (err) {
    console.error("trial-upgrade-track error", err);
    return json({ error: "internal" }, { status: 500 });
  }
});

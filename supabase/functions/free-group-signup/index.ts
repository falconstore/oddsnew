// Edge Function: free-group-signup
// Captura lead do Grupo Free (LP /trial nova estratégia).
// Aceita nome + whatsapp (obrigatório) + email (opcional).
// Salva em trial_leads com cohort='free_group', status='active'.
// Sem geração de invite link ou envio de mensagens — apenas persiste o lead.
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, { status: 405 });

  try {
    const body = await req.json().catch(() => ({}));

    const name     = String(body.name ?? "").trim();
    const whatsapp = String(body.whatsapp ?? "").replace(/\D/g, "");

    // Email: usa o fornecido ou gera placeholder único
    const emailRaw = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const email    = emailRaw && emailRaw.includes("@") && emailRaw.length > 5
      ? emailRaw
      : `free_${whatsapp}@placeholder.betshark`;

    // telegram_username placeholder (campo NOT NULL no schema)
    const telegram_username = `free_${whatsapp}`;

    // UTMs / AdScala ct para rastreio de anúncios
    const utm_source   = typeof body.utm_source   === "string" ? body.utm_source.slice(0, 255)   : null;
    const utm_medium   = typeof body.utm_medium   === "string" ? body.utm_medium.slice(0, 255)   : null;
    const utm_campaign = typeof body.utm_campaign === "string" ? body.utm_campaign.slice(0, 255) : null;
    const ct           = typeof body.ct           === "string" ? body.ct.slice(0, 255)           : null;

    if (!name || name.length < 2) {
      return json({ error: "Informe seu nome completo." }, { status: 400 });
    }
    if (whatsapp.length < 10) {
      return json({ error: "WhatsApp inválido (mínimo 10 dígitos com DDD)." }, { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Backend não configurado." }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // Insere o lead — cohort='free_group', status='active'
    // expires_at = 90 dias (grupo free de longa duração)
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    const { error: insertErr } = await supabase
      .from("trial_leads")
      .insert({
        name,
        email,
        whatsapp,
        telegram_username,
        status: "active",
        cohort: "free_group",
        expires_at: expiresAt,
        utm_source,
        utm_medium,
        utm_campaign,
        ct,
      });

    if (insertErr) {
      const pgCode = (insertErr as { code?: string }).code;
      // 23505 = unique_violation — whatsapp já cadastrado, retorna ok silenciosamente
      if (pgCode === "23505") {
        return json({ ok: true });
      }
      console.error("free-group-signup: insert error", insertErr);
      return json({ error: "Erro ao salvar cadastro." }, { status: 500 });
    }

    return json({ ok: true });
  } catch (err) {
    console.error("free-group-signup unexpected", err);
    return json({ error: "Erro interno." }, { status: 500 });
  }
});

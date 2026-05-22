// Edge Function: trial-webhook-guard
//
// Chamada pelo cron pg_cron `trial-webhook-autoheal-5min` a cada 5min.
// Faz o ciclo "checar + corrigir + logar" do webhook do bot do trial:
//
//   1. Lê trial_settings.webhook_autoheal_enabled — se off, sai cedo.
//   2. Chama getWebhookInfo no Telegram.
//   3. Se a URL não termina em /trial-webhook OU chat_member sumiu das
//      allowed_updates, re-instala o webhook chamando setWebhook com a
//      config correta (mesma lógica do trial-webhook-reset, sem JWT).
//   4. Grava o que aconteceu em trial_webhook_audit (só quando há drift
//      ou erro — no-op não polui a tabela).
//
// Protegida por header `x-cron-secret`. Aceita tanto TRIAL_WEBHOOK_GUARD_SECRET
// (recomendado, pode rotacionar separado) quanto TRIAL_CRON_SECRET (fallback
// pra deploy zero-config, já que o cron usa o mesmo vault secret).
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const REQUIRED_ALLOWED = ["chat_member", "my_chat_member", "message"];
const REQUIRED_SUFFIX = "/trial-webhook";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // ----- Auth (cron-only) -----
  const headerSecret = req.headers.get("x-cron-secret")
    ?? (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const expectedSecret = Deno.env.get("TRIAL_WEBHOOK_GUARD_SECRET")
    ?? Deno.env.get("TRIAL_CRON_SECRET");
  if (!expectedSecret) {
    return json({ error: "guard secret not configured" }, { status: 500 });
  }
  if (!headerSecret || headerSecret !== expectedSecret) {
    return json({ error: "forbidden" }, { status: 403 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // ----- Flag de kill switch -----
  const { data: settings } = await admin
    .from("trial_settings")
    .select("webhook_autoheal_enabled")
    .eq("id", true)
    .maybeSingle();
  if (settings && settings.webhook_autoheal_enabled === false) {
    return json({ ok: true, action: "skipped-disabled" });
  }

  const botToken = Deno.env.get("TELEGRAM_TRIAL_BOT_TOKEN");
  const webhookSecret = Deno.env.get("TELEGRAM_TRIAL_WEBHOOK_SECRET");
  if (!botToken || !webhookSecret) {
    return json({ error: "bot token or webhook secret missing" }, { status: 500 });
  }

  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  const expectedUrl = `https://${ref}.functions.supabase.co/trial-webhook`;

  // ----- 1) getWebhookInfo -----
  let whData: any = null;
  try {
    const whRes = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
    whData = await whRes.json().catch(() => null);
  } catch (e) {
    console.error("trial-webhook-guard: getWebhookInfo threw", e);
  }

  if (!whData?.ok) {
    await admin.from("trial_webhook_audit").insert({
      was_drifted: false,
      action_taken: "error",
      error_message: "getWebhookInfo failed",
      telegram_response: whData ?? null,
    });
    return json({ ok: false, error: "getWebhookInfo failed", telegram_response: whData });
  }

  const currentUrl: string = whData.result?.url ?? "";
  const currentAllowed: string[] = whData.result?.allowed_updates ?? [];
  const urlOk = !!currentUrl && currentUrl.endsWith(REQUIRED_SUFFIX);
  const hasChatMember = currentAllowed.includes("chat_member");
  const drifted = !urlOk || !hasChatMember;

  if (!drifted) {
    return json({
      ok: true,
      action: "no-op",
      current_url: currentUrl,
      allowed_updates: currentAllowed,
    });
  }

  // ----- 2) setWebhook (corrige drift) -----
  let setData: any = {};
  let setOk = false;
  try {
    const setRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: expectedUrl,
        secret_token: webhookSecret,
        allowed_updates: REQUIRED_ALLOWED,
        drop_pending_updates: false,
      }),
    });
    setData = await setRes.json().catch(() => ({}));
    setOk = setRes.ok && setData?.ok === true;
  } catch (e) {
    console.error("trial-webhook-guard: setWebhook threw", e);
    setData = { error: String(e) };
  }

  await admin.from("trial_webhook_audit").insert({
    was_drifted: true,
    previous_url: currentUrl || null,
    previous_allowed_updates: currentAllowed,
    new_url: setOk ? expectedUrl : null,
    action_taken: setOk ? "reinstalled" : "error",
    telegram_response: setData ?? null,
    error_message: setOk ? null : (setData?.description ?? "setWebhook failed"),
  });

  console.log(JSON.stringify({
    tag: "trial-webhook-guard",
    event: setOk ? "reinstalled" : "error",
    previous_url: currentUrl,
    previous_allowed_updates: currentAllowed,
    new_url: setOk ? expectedUrl : null,
  }));

  return json({
    ok: setOk,
    action: setOk ? "reinstalled" : "error",
    previous_url: currentUrl,
    previous_allowed_updates: currentAllowed,
    new_url: setOk ? expectedUrl : null,
    telegram_response: setData,
  });
});

// Edge Function: trial-webhook-reset
// Re-instala o webhook no Telegram com a URL atual, secret_token e
// allowed_updates corretos. Útil quando:
//  - O Telegram suspendeu entregas após muitos erros (e mostra
//    last_error_message antigo no getWebhookInfo)
//  - allowed_updates ficou sem chat_member por engano
//  - admin precisa rotacionar o webhook secret
//
// Protegida por JWT do admin (mesma checagem can_view_trial / is_super_admin).
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, { status: 405 });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return json({ error: "Não autenticado" }, { status: 401 });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Sessão inválida" }, { status: 401 });
    const email = userData.user.email?.toLowerCase();
    if (!email) return json({ error: "Email não encontrado" }, { status: 401 });

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: perm } = await admin
      .from("user_permissions")
      .select("can_view_trial, is_super_admin")
      .eq("user_email", email)
      .maybeSingle();
    if (!perm || (!perm.can_view_trial && !perm.is_super_admin)) {
      return json({ error: "Sem permissão" }, { status: 403 });
    }

    const botToken = Deno.env.get("TELEGRAM_TRIAL_BOT_TOKEN");
    const webhookSecret = Deno.env.get("TELEGRAM_TRIAL_WEBHOOK_SECRET");
    const projectUrl = Deno.env.get("SUPABASE_URL")!;
    if (!botToken) return json({ error: "TELEGRAM_TRIAL_BOT_TOKEN ausente" }, { status: 500 });
    if (!webhookSecret) return json({ error: "TELEGRAM_TRIAL_WEBHOOK_SECRET ausente" }, { status: 500 });

    // Monta a URL pública do trial-webhook a partir do SUPABASE_URL.
    // Ex: https://wspsuempnswljkphatur.supabase.co  ->
    //     https://wspsuempnswljkphatur.functions.supabase.co/trial-webhook
    const ref = new URL(projectUrl).hostname.split(".")[0];
    const webhookUrl = `https://${ref}.functions.supabase.co/trial-webhook`;

    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: webhookSecret,
        allowed_updates: ["chat_member", "my_chat_member"],
        drop_pending_updates: false,
      }),
    });
    const tgData = await tgRes.json().catch(() => ({}));
    if (!tgRes.ok || !tgData?.ok) {
      console.error("setWebhook failed", tgData);
      return json({
        error: tgData?.description ?? "Falha ao configurar webhook",
        telegram_response: tgData,
      }, { status: 502 });
    }

    return json({
      ok: true,
      message: "Webhook reinstalado no Telegram com sucesso.",
      webhook_url: webhookUrl,
    });
  } catch (err) {
    console.error("trial-webhook-reset error", err);
    return json({ error: "internal" }, { status: 500 });
  }
});

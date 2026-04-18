// Edge Function: trial-webhook
// Recebe webhooks do Telegram (chat_member updates).
// Quando um usuário entra no grupo via invite_link rastreado,
// vincula o telegram_user_id ao lead e marca como "active" (expira em 7d).
//
// SEGURANÇA:
//  - Valida o cabeçalho `X-Telegram-Bot-Api-Secret-Token` contra o segredo
//    `TELEGRAM_TRIAL_WEBHOOK_SECRET` (configurado no setWebhook).
//  - Valida que o `chat.id` do update bate com `TELEGRAM_TRIAL_CHAT_ID`.
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const expectedSecret = Deno.env.get("TELEGRAM_TRIAL_WEBHOOK_SECRET");
    const expectedChatId = Deno.env.get("TELEGRAM_TRIAL_CHAT_ID");

    // Fail-closed: o segredo é OBRIGATÓRIO para evitar webhooks forjados.
    if (!expectedSecret) {
      console.error("trial-webhook: TELEGRAM_TRIAL_WEBHOOK_SECRET is not configured");
      return json({ ok: false, error: "webhook secret not configured" }, { status: 500 });
    }
    const headerSecret = req.headers.get("x-telegram-bot-api-secret-token");
    if (headerSecret !== expectedSecret) {
      console.warn("trial-webhook: invalid secret token");
      return json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const update = await req.json().catch(() => ({}));
    const cm = update.chat_member ?? update.my_chat_member;
    if (!cm) return json({ ok: true, ignored: "no chat_member" });

    // Validar que é o nosso grupo
    const updateChatId = String(cm.chat?.id ?? "");
    if (expectedChatId && updateChatId !== String(expectedChatId)) {
      return json({ ok: true, ignored: "wrong chat" });
    }

    const inviteLink: string | undefined = cm.invite_link?.invite_link;
    const newStatus: string | undefined = cm.new_chat_member?.status;
    const oldStatus: string | undefined = cm.old_chat_member?.status;
    const userId: number | undefined = cm.new_chat_member?.user?.id;

    if (!inviteLink || !userId) {
      return json({ ok: true, ignored: "missing invite_link or user" });
    }

    const joined = (newStatus === "member" || newStatus === "restricted") &&
      (oldStatus === "left" || oldStatus === "kicked" || !oldStatus);
    if (!joined) {
      return json({ ok: true, ignored: `status ${oldStatus} -> ${newStatus}` });
    }

    // Só processa leads ainda pendentes (idempotência)
    const { data: lead, error: findErr } = await supabase
      .from("trial_leads")
      .select("id, status")
      .eq("invite_link", inviteLink)
      .maybeSingle();
    if (findErr) {
      console.error("lookup error", findErr);
      return json({ ok: false, error: "lookup failed" }, { status: 500 });
    }
    if (!lead) return json({ ok: true, ignored: "no matching lead" });
    if (lead.status !== "pending") {
      return json({ ok: true, ignored: `lead already ${lead.status}` });
    }

    const now = new Date();
    const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const { error: updErr } = await supabase
      .from("trial_leads")
      .update({
        status: "active",
        telegram_user_id: userId,
        entered_at: now.toISOString(),
        expires_at: expires.toISOString(),
      })
      .eq("id", lead.id)
      .eq("status", "pending"); // guard de concorrência
    if (updErr) {
      console.error("update error", updErr);
      return json({ ok: false, error: "update failed" }, { status: 500 });
    }

    return json({ ok: true, lead_id: lead.id });
  } catch (err) {
    console.error("trial-webhook error", err);
    return json({ ok: false, error: "internal" }, { status: 500 });
  }
});

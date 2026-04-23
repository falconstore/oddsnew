// Edge Function: trial-reminder-test
// Envia uma DM de teste com a mesma mensagem real do trial-cron
// (variantes 24h ou 1h) para um usuário arbitrário do Telegram.
// Útil para o admin validar copy, botões, cupom e link sem precisar
// esperar um lead real chegar perto da expiração.
//
// Comportamento:
//   1) JWT obrigatório com can_view_trial OU is_super_admin.
//   2) Aceita { telegram_user_id?: number, telegram_username?: string,
//              variant?: '24h' | '1h', name?: string }.
//   3) Se vier username (sem @), tenta resolver via getChat. Se vier
//      user_id numérico, usa direto.
//   4) Lê o cupom do trial_settings (mesma fonte do cron).
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildCtaUrl(checkoutUrl: string, coupon: string, leadId: string, campaign: string): string {
  try {
    const u = new URL(checkoutUrl);
    u.searchParams.set("cp", coupon);
    u.searchParams.set("utm_source", "telegram");
    u.searchParams.set("utm_medium", "dm");
    u.searchParams.set("utm_campaign", campaign);
    u.searchParams.set("coupon", coupon);
    u.searchParams.set("lead_id", leadId);
    return u.toString();
  } catch {
    return checkoutUrl;
  }
}

function build24hMessage(firstName: string, coupon: string): string {
  return [
    `Oi, <b>${firstName}</b> 👋`,
    ``,
    `Seu acesso gratuito no grupo VIP da <b>SHARK 100% GREEN</b> termina em <b>24 horas</b>.`,
    ``,
    `Pra não perder os sinais, garanta sua assinatura agora com desconto exclusivo de quem já testou:`,
    ``,
    `🎁 Use o cupom <b>${escapeHtml(coupon)}</b> no checkout`,
    ``,
    `Essa promoção é exclusiva e você terá um super desconto: de <s>R$ 148,90</s> por apenas <b>R$ 99,90</b> usando o cupom. Não perca essa oportunidade.`,
    ``,
    `É só clicar no botão abaixo 👇`,
    ``,
    `<i>(mensagem de teste)</i>`,
  ].join("\n");
}

function build1hMessage(firstName: string, coupon: string): string {
  return [
    `⏰ <b>${firstName}</b>, falta só <b>1 hora</b>!`,
    ``,
    `Em 1h seu acesso ao grupo VIP da <b>SHARK 100% GREEN</b> expira e você sai automaticamente.`,
    ``,
    `Esta é sua <b>última chance</b> de garantir o desconto:`,
    ``,
    `🎁 Cupom <b>${escapeHtml(coupon)}</b> ainda está valendo: de <s>R$ 148,90</s> por apenas <b>R$ 99,90</b>.`,
    ``,
    `Não perca os próximos Duplos Green 🦈`,
    ``,
    `<i>(mensagem de teste)</i>`,
  ].join("\n");
}

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

    const body = await req.json().catch(() => ({}));
    const variant = body.variant === "1h" ? "1h" : "24h";
    const name = (typeof body.name === "string" && body.name.trim()) ? body.name.trim() : "amigo(a)";
    let telegramUserId: number | null = null;
    if (typeof body.telegram_user_id === "number" && Number.isFinite(body.telegram_user_id)) {
      telegramUserId = body.telegram_user_id;
    } else if (typeof body.telegram_user_id === "string" && /^\d+$/.test(body.telegram_user_id.trim())) {
      telegramUserId = Number(body.telegram_user_id.trim());
    }

    const botToken = Deno.env.get("TELEGRAM_TRIAL_BOT_TOKEN");
    if (!botToken) return json({ error: "TELEGRAM_TRIAL_BOT_TOKEN ausente" }, { status: 500 });

    // Se vier username, tenta resolver
    if (!telegramUserId && typeof body.telegram_username === "string" && body.telegram_username.trim()) {
      const handle = body.telegram_username.trim().replace(/^@+/, "");
      const r = await fetch(`https://api.telegram.org/bot${botToken}/getChat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: `@${handle}` }),
      });
      const d = await r.json().catch(() => ({}));
      if (d?.ok && d?.result?.id) {
        telegramUserId = d.result.id;
      } else {
        return json({
          error: "Não foi possível resolver o @username pelo Telegram. Cole o user_id numérico (peça pro usuário rodar @userinfobot).",
          telegram_error: d?.description ?? null,
        }, { status: 400 });
      }
    }

    if (!telegramUserId) {
      return json({ error: "Informe telegram_user_id ou telegram_username." }, { status: 400 });
    }

    // Lê cupom + URL idênticos ao cron
    const reminderCheckoutUrl = (
      Deno.env.get("TRIAL_REMINDER_CHECKOUT_URL")
        ?? "https://lastlink.com/p/CEAEE6585/checkout-payment/"
    ).trim();
    const { data: settingsRow } = await admin
      .from("trial_settings")
      .select("reminder_coupon")
      .eq("id", true)
      .maybeSingle();
    const reminderCoupon = (
      settingsRow?.reminder_coupon
        ?? Deno.env.get("TRIAL_REMINDER_COUPON")
        ?? "PODPROMO"
    ).trim();
    const supportUrl = "https://t.me/SuporteSharkGreen_financeiro";

    const firstName = escapeHtml((name).split(/\s+/)[0]);
    const ctaUrl = buildCtaUrl(reminderCheckoutUrl, reminderCoupon, "TEST", `trial_reminder_${variant}_test`);
    const text = variant === "1h"
      ? build1hMessage(firstName, reminderCoupon)
      : build24hMessage(firstName, reminderCoupon);

    const replyMarkup = {
      inline_keyboard: [
        [{ text: `🛒 Assinar com cupom ${reminderCoupon}`, url: ctaUrl }],
        [{ text: "💬 Falar com Suporte", url: supportUrl }],
      ],
    };

    const sendRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramUserId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: false,
        reply_markup: replyMarkup,
      }),
    });
    const sendData = await sendRes.json().catch(() => ({}));
    if (!sendRes.ok || !sendData?.ok) {
      console.error("trial-reminder-test send failed", sendData);
      return json({
        error: sendData?.description ?? "Falha ao enviar DM de teste",
        telegram_error: sendData?.description ?? null,
        hint: sendData?.error_code === 403
          ? "O usuário precisa ter iniciado conversa com o bot pelo menos uma vez (mandar /start no DM do bot)."
          : null,
      }, { status: 502 });
    }

    return json({
      ok: true,
      action: "sent",
      message: `DM de teste enviada para ${telegramUserId} (variante ${variant}).`,
      variant,
      telegram_user_id: telegramUserId,
    });
  } catch (err) {
    console.error("trial-reminder-test error", err);
    return json({ error: "internal" }, { status: 500 });
  }
});

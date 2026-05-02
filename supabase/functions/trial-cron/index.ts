// Edge Function: trial-cron
// Roda periodicamente (via pg_cron + pg_net):
//  1) Avisa por DM no Telegram, 24h antes da expiração, com link para /trial-upgrade.
//  2) Expira trials já vencidos: banChatMember + unbanChatMember (libera re-entrada paga).
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { runLinkGc } from "../_shared/link-gc.ts";

function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

async function tgKick(botToken: string, chatId: string, userId: number) {
  const banRes = await fetch(`https://api.telegram.org/bot${botToken}/banChatMember`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, user_id: userId, revoke_messages: false }),
  });
  const banData = await banRes.json().catch(() => ({}));
  if (!banRes.ok || !banData?.ok) {
    return { ok: false, error: banData?.description ?? "banChatMember failed" };
  }
  // unban para permitir re-entrar futuramente (cliente pago)
  const unbanRes = await fetch(`https://api.telegram.org/bot${botToken}/unbanChatMember`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, user_id: userId, only_if_banned: true }),
  });
  await unbanRes.json().catch(() => ({}));
  return { ok: true };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Erros do Telegram que NÃO compensam re-tentar amanhã (chat indisponível,
// usuário nunca iniciou DM, bot bloqueado, conta deletada, etc.).
function isPermanentTelegramError(status: number, description?: string): boolean {
  if (status === 403) return true; // bot was blocked / forbidden
  if (status === 400 && description) {
    const d = description.toLowerCase();
    if (
      d.includes("chat not found") ||
      d.includes("user is deactivated") ||
      d.includes("peer_id_invalid") ||
      d.includes("bot can't initiate conversation") ||
      d.includes("bots can't send messages to bots")
    ) return true;
  }
  return false;
}

function buildCtaUrl(checkoutUrl: string, coupon: string, leadId: string, campaign: string): string {
  try {
    const u = new URL(checkoutUrl);
    // cp = parâmetro do Lastlink que aplica o cupom automaticamente no checkout.
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
  ].join("\n");
}

function buildReplyMarkup(ctaUrl: string, coupon: string, supportUrl: string) {
  return {
    inline_keyboard: [
      [{ text: `🛒 Assinar com cupom ${coupon}`, url: ctaUrl }],
      [{ text: "💬 Falar com Suporte", url: supportUrl }],
    ],
  };
}

async function tgSendDM(botToken: string, userId: number, text: string, replyMarkup?: unknown) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: userId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: false,
      reply_markup: replyMarkup,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    return {
      ok: false as const,
      error: data?.description ?? "sendMessage failed",
      permanent: isPermanentTelegramError(res.status, data?.description),
    };
  }
  return { ok: true as const };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Defesa em profundidade: aceita Authorization: Bearer <SERVICE_ROLE_KEY>
  // OU Bearer <TRIAL_CRON_SECRET>. O segundo permite que o pg_cron interno
  // continue funcionando mesmo se o SUPABASE_SERVICE_ROLE_KEY auto-injetado
  // for rotacionado pela plataforma sem que o cron seja atualizado.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const trialCronSecret = Deno.env.get("TRIAL_CRON_SECRET") ?? "";
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return json({ error: "forbidden" }, { status: 403 });
  }
  const presented = auth.slice(7).trim();
  const matchesService = constantTimeEqual(presented, serviceKey);
  const matchesCron = trialCronSecret.length > 0 && constantTimeEqual(presented, trialCronSecret);
  if (!matchesService && !matchesCron) {
    return json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceKey,
      { auth: { persistSession: false } },
    );
    const botToken = Deno.env.get("TELEGRAM_TRIAL_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_TRIAL_CHAT_ID");
    const bonusChatId = Deno.env.get("TELEGRAM_TRIAL_BONUS_CHAT_ID") ?? null;
    if (!botToken || !chatId) {
      return json({ error: "Bot não configurado" }, { status: 500 });
    }

    const publicSiteUrl = (Deno.env.get("TRIAL_PUBLIC_SITE_URL") ?? "").replace(/\/+$/, "");
    // URL do checkout: hardcoded com override por env var (raramente muda).
    const reminderCheckoutUrl = (
      Deno.env.get("TRIAL_REMINDER_CHECKOUT_URL")
        ?? "https://lastlink.com/p/CEAEE6585/checkout-payment/"
    ).trim();
    // Cupom: lê do banco (trial_settings), com fallback env e hardcoded.
    // Admin troca pelo painel sem precisar redeploy.
    const { data: settingsRow } = await supabase
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

    // ===== 1) Avisos prévios (24h antes da expiração) =====
    let remindersSent = 0;
    let remindersFailed = 0;
    {
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const { data: dueReminders, error: remErr } = await supabase
        .from("trial_leads")
        .select("id, name, telegram_user_id, expires_at")
        .eq("status", "active")
        .eq("cohort", "v2")
        .is("reminder_sent_at", null)
        .gt("expires_at", now.toISOString())
        .lte("expires_at", in24h.toISOString())
        .limit(500);
      if (remErr) {
        console.error("reminder query error", remErr);
      } else {
        for (const lead of dueReminders ?? []) {
          if (!lead.telegram_user_id) {
            // Sem ID não dá para mandar DM; marca como enviado para não repetir tentativa.
            await supabase.from("trial_leads")
              .update({ reminder_sent_at: new Date().toISOString() })
              .eq("id", lead.id);
            continue;
          }

          const ctaUrl = buildCtaUrl(reminderCheckoutUrl, reminderCoupon, lead.id, "trial_reminder_24h");
          const firstName = escapeHtml(
            (lead.name ?? "").split(/\s+/)[0] || "tudo bem?",
          );
          const text = build24hMessage(firstName, reminderCoupon);
          const replyMarkup = buildReplyMarkup(ctaUrl, reminderCoupon, supportUrl);

          const sent = await tgSendDM(botToken, lead.telegram_user_id, text, replyMarkup);
          if (!sent.ok) {
            console.error("reminder DM failed", lead.id, sent.error, "permanent:", sent.permanent);
            remindersFailed++;
            // Só marca como enviado se for erro permanente (usuário nunca
            // iniciou o bot, bot bloqueado, chat inexistente). Erros
            // transientes (rede, 5xx, rate-limit) ficam null para retry no
            // próximo tick do cron.
            if (sent.permanent) {
              await supabase.from("trial_leads")
                .update({ reminder_sent_at: new Date().toISOString() })
                .eq("id", lead.id);
            }
            continue;
          }
          await supabase.from("trial_leads")
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq("id", lead.id);
          remindersSent++;
        }
      }
    }

    // ===== 1b) Avisos de última hora (~1h antes da expiração) =====
    // Independente do aviso de 24h: empurrão final pra quem não converteu.
    // IMPORTANTE: pra esse bloco funcionar bem, o pg_cron deve rodar ao menos
    // a cada 90 minutos. Em cron diário, a janela [now, now+90min] só captura
    // ~6% dos leads que expiram naquele dia. A janela é maior que 1h pra dar
    // folga em cron horário e evitar perder leads por offsets de fuso.
    let remindersSent1h = 0;
    let remindersFailed1h = 0;
    {
      const now = new Date();
      const in1h = new Date(now.getTime() + 90 * 60 * 1000);
      const { data: dueReminders1h, error: rem1hErr } = await supabase
        .from("trial_leads")
        .select("id, name, telegram_user_id, expires_at")
        .eq("status", "active")
        .eq("cohort", "v2")
        .is("reminder_1h_sent_at", null)
        .gt("expires_at", now.toISOString())
        .lte("expires_at", in1h.toISOString())
        .limit(500);
      if (rem1hErr) {
        console.error("reminder 1h query error", rem1hErr);
      } else {
        for (const lead of dueReminders1h ?? []) {
          if (!lead.telegram_user_id) {
            await supabase.from("trial_leads")
              .update({ reminder_1h_sent_at: new Date().toISOString() })
              .eq("id", lead.id);
            continue;
          }
          const ctaUrl = buildCtaUrl(reminderCheckoutUrl, reminderCoupon, lead.id, "trial_reminder_1h");
          const firstName = escapeHtml(
            (lead.name ?? "").split(/\s+/)[0] || "tudo bem?",
          );
          const text = build1hMessage(firstName, reminderCoupon);
          const replyMarkup = buildReplyMarkup(ctaUrl, reminderCoupon, supportUrl);

          const sent = await tgSendDM(botToken, lead.telegram_user_id, text, replyMarkup);
          if (!sent.ok) {
            console.error("reminder 1h DM failed", lead.id, sent.error, "permanent:", sent.permanent);
            remindersFailed1h++;
            if (sent.permanent) {
              await supabase.from("trial_leads")
                .update({ reminder_1h_sent_at: new Date().toISOString() })
                .eq("id", lead.id);
            }
            continue;
          }
          await supabase.from("trial_leads")
            .update({ reminder_1h_sent_at: new Date().toISOString() })
            .eq("id", lead.id);
          remindersSent1h++;
        }
      }
    }

    // ===== 2) Expirar trials vencidos =====
    const { data: expired, error } = await supabase
      .from("trial_leads")
      .select("id, telegram_user_id")
      .eq("status", "active")
      .eq("cohort", "v2")
      .lte("expires_at", new Date().toISOString())
      .limit(500);
    if (error) {
      console.error("query error", error);
      return json({ error: "query failed" }, { status: 500 });
    }

    let processed = 0, failed = 0, bonusKicked = 0, bonusFailed = 0;
    for (const lead of expired ?? []) {
      if (!lead.telegram_user_id) {
        // Sem ID → marca como expirado mesmo sem kick
        await supabase.from("trial_leads")
          .update({ status: "expired", removed_at: new Date().toISOString() })
          .eq("id", lead.id);
        processed++;
        continue;
      }
      const result = await tgKick(botToken, chatId, lead.telegram_user_id);
      if (!result.ok) {
        console.error("kick failed", lead.id, result.error);
        failed++;
        continue;
      }
      // Kick também do grupo bônus (best-effort — não bloqueia a expiração
      // mesmo se falhar, ex: lead nunca entrou no bônus, ou bot não é admin lá).
      if (bonusChatId) {
        const bRes = await tgKick(botToken, bonusChatId, lead.telegram_user_id);
        if (bRes.ok) {
          bonusKicked++;
          await supabase.from("trial_leads")
            .update({ bonus_removed_at: new Date().toISOString() })
            .eq("id", lead.id);
        } else {
          console.warn("bonus kick failed", lead.id, bRes.error);
          bonusFailed++;
        }
      }
      await supabase.from("trial_leads")
        .update({ status: "expired", removed_at: new Date().toISOString() })
        .eq("id", lead.id);
      processed++;
    }

    // ===== 3) GC dos invite_links com mais de 24h =====
    // O Telegram tem teto de "invite_links ativos por chat por bot". O
    // trial-signup cria 1 link novo por cadastro com expire_date=now+24h,
    // mas links expirados continuam contando pra cota até serem REVOGADOS.
    // Sem esse passo, depois de algum volume a LP para de gerar links e
    // ninguém consegue mais entrar no trial.
    let gcResult = null as Awaited<ReturnType<typeof runLinkGc>> | null;
    try {
      gcResult = await runLinkGc({
        supabase, botToken, chatId, bonusChatId,
        batchSize: 500,
        olderThanMs: 24 * 60 * 60 * 1000,
      });
    } catch (e) {
      // Best-effort — não derruba o cron se a limpeza falhar; só loga.
      console.error("trial-cron link-gc failed", e);
    }

    return json({
      ok: true,
      reminders_sent: remindersSent,
      reminders_failed: remindersFailed,
      reminders_sent_1h: remindersSent1h,
      reminders_failed_1h: remindersFailed1h,
      processed,
      failed,
      bonus_kicked: bonusKicked,
      bonus_failed: bonusFailed,
      total: expired?.length ?? 0,
      link_gc: gcResult,
    });
  } catch (err) {
    console.error("trial-cron error", err);
    return json({ error: "internal" }, { status: 500 });
  }
});

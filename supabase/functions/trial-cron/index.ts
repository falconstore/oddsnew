// Edge Function: trial-cron
// Roda periodicamente (via pg_cron + pg_net):
//  1) Avisa por DM no Telegram, 24h antes da expiração, com link para /trial-upgrade.
//  2) Expira trials já vencidos: banChatMember + unbanChatMember (libera re-entrada paga).
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

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

  // Defesa em profundidade: exige Authorization: Bearer <SERVICE_ROLE_KEY>.
  // Mesmo se a função for deployada sem --verify-jwt, callers públicos são bloqueados.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ") || auth.slice(7).trim() !== serviceKey) {
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
    if (!botToken || !chatId) {
      return json({ error: "Bot não configurado" }, { status: 500 });
    }

    const publicSiteUrl = (Deno.env.get("TRIAL_PUBLIC_SITE_URL") ?? "").replace(/\/+$/, "");

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

          const upgradeUrl = publicSiteUrl
            ? `${publicSiteUrl}/trial-upgrade?lead=${lead.id}&utm_source=telegram&utm_medium=dm&utm_campaign=trial_reminder`
            : null;

          const firstName = escapeHtml(
            (lead.name ?? "").split(/\s+/)[0] || "tudo bem?",
          );
          const text = [
            `Oi, <b>${firstName}</b> 👋`,
            ``,
            `Seu acesso gratuito ao grupo VIP da <b>BetShark Pro</b> termina em <b>24 horas</b>.`,
            ``,
            `Se quiser continuar recebendo os sinais de Duplo Green, garanta sua assinatura agora:`,
            upgradeUrl ? `\n👉 ${upgradeUrl}` : ``,
            ``,
            `Qualquer dúvida é só responder esta mensagem.`,
          ].filter(Boolean).join("\n");

          const replyMarkup = upgradeUrl
            ? {
                inline_keyboard: [[
                  { text: "🚀 Quero virar assinante", url: upgradeUrl },
                ]],
              }
            : undefined;

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

    let processed = 0, failed = 0;
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
      await supabase.from("trial_leads")
        .update({ status: "expired", removed_at: new Date().toISOString() })
        .eq("id", lead.id);
      processed++;
    }

    return json({
      ok: true,
      reminders_sent: remindersSent,
      reminders_failed: remindersFailed,
      processed,
      failed,
      total: expired?.length ?? 0,
    });
  } catch (err) {
    console.error("trial-cron error", err);
    return json({ error: "internal" }, { status: 500 });
  }
});

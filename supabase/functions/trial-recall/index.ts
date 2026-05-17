// Edge Function: trial-recall
// Reengaja leads travados em status='pending' (cadastraram mas nunca
// entraram no grupo VIP, normalmente porque o webhook do Telegram caiu
// ou o invite_link inicial expirou).
//
// Para cada lead elegível: cria um invite_link novo (1 uso, 24h) e
// manda DM amigável pelo bot, com 2 botões inline:
//   - "Entrar no VIP agora"  (url = invite_link novo)
//   - "Falar com Suporte"    (url = handle fixo)
//
// Modos de operação:
//
// A) Cron diário — Authorization: Bearer <SERVICE_ROLE_KEY> OU
//    Bearer <TRIAL_CRON_SECRET> com body { "cron": true }.
//    Seleciona automaticamente os pending elegíveis (idade mínima
//    configurada em trial_settings.recall_after_hours, sem recall
//    anterior OU último recall mais antigo que recall_repeat_after_days,
//    respeitando recall_daily_cap).
//
// B) Manual via admin — Authorization: Bearer <user JWT> + body
//    { lead_id: "<uuid>" } ou { lead_ids: ["<uuid>", ...] }.
//    Exige permissão can_view_trial OU is_super_admin.
//    Ignora a idade mínima (admin sabe o que está fazendo) MAS valida
//    que o lead está pending E tem telegram_user_id.
//
// Atualiza last_recall_at = now() + recall_count++ a cada envio bem-sucedido
// e loga em public.bot_logs (event='trial_recall_sent' ou
// 'trial_recall_failed').
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(init.headers || {}) },
  });

function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SUPPORT_URL = "https://t.me/SuporteSharkGreen_financeiro";

type LeadRow = {
  id: string;
  name: string | null;
  status: string;
  telegram_user_id: number | null;
  last_recall_at: string | null;
  recall_count: number | null;
};

function buildRecallMessage(firstName: string): string {
  return [
    `Oi, <b>${firstName}</b> 👋`,
    ``,
    `Vi aqui que você se cadastrou no trial gratuito da <b>SHARK 100% GREEN</b>, mas ainda não entrou no grupo VIP.`,
    ``,
    `Aconteceu alguma coisa? Posso te ajudar com algum problema? 🦈`,
    ``,
    `Gerei um <b>link novo</b> pra você — é só tocar no botão abaixo pra liberar seu acesso agora:`,
  ].join("\n");
}

async function tgCreateInviteLink(botToken: string, chatId: string, leadId: string) {
  const expireDate = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  const res = await fetch(
    `https://api.telegram.org/bot${botToken}/createChatInviteLink`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        member_limit: 1,
        expire_date: expireDate,
        name: `Recall ${leadId.slice(0, 8)}`,
        creates_join_request: false,
      }),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok || !data?.result?.invite_link) {
    return { ok: false as const, error: data?.description ?? "createChatInviteLink failed" };
  }
  return { ok: true as const, link: data.result.invite_link as string };
}

async function tgSendRecallDM(botToken: string, userId: number, text: string, inviteUrl: string) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: userId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [{ text: "🟢 Entrar no VIP agora", url: inviteUrl }],
          [{ text: "💬 Falar com Suporte", url: SUPPORT_URL }],
        ],
      },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    return {
      ok: false as const,
      status: res.status,
      error: data?.description ?? "sendMessage failed",
    };
  }
  return { ok: true as const };
}

async function logBot(
  admin: SupabaseClient,
  event: string,
  message: string,
  context: Record<string, unknown>,
  level: "info" | "warning" | "error" = "info",
) {
  try {
    await admin.from("bot_logs").insert({
      level,
      event,
      message,
      context,
    });
  } catch (e) {
    console.error("trial-recall: bot_logs insert failed", e);
  }
}

type SendResult = {
  lead_id: string;
  ok: boolean;
  reason?: string;
  invite_link?: string;
};

async function recallLead(
  admin: SupabaseClient,
  botToken: string,
  chatId: string,
  lead: LeadRow,
  minSeconds: number,
): Promise<SendResult> {
  if (lead.status !== "pending") {
    return { lead_id: lead.id, ok: false, reason: `status=${lead.status} (esperado pending)` };
  }
  if (!lead.telegram_user_id) {
    return { lead_id: lead.id, ok: false, reason: "sem telegram_user_id" };
  }

  // Throttle atômico + increment numa só query. Retorna NULL se o lead
  // foi reenviado há menos de `minSeconds` (ou virou inelegível). Isso
  // protege contra clique repetido / corrida cron×manual sem race.
  const { data: newCount, error: gateErr } = await admin.rpc("try_record_trial_recall", {
    p_lead_id: lead.id,
    p_min_seconds: Math.max(1, Math.floor(minSeconds)),
  });
  if (gateErr) {
    await logBot(admin, "trial_recall_failed", `gate rpc: ${gateErr.message}`, {
      lead_id: lead.id,
      stage: "throttle_gate",
    }, "error");
    return { lead_id: lead.id, ok: false, reason: `gate_error: ${gateErr.message}` };
  }
  if (newCount === null || newCount === undefined) {
    const lastIso = lead.last_recall_at ?? "(nunca)";
    return {
      lead_id: lead.id,
      ok: false,
      reason: `throttled (último envio: ${lastIso}, cooldown: ${minSeconds}s)`,
    };
  }

  const linkRes = await tgCreateInviteLink(botToken, chatId, lead.id);
  if (!linkRes.ok) {
    await logBot(admin, "trial_recall_failed", `createChatInviteLink: ${linkRes.error}`, {
      lead_id: lead.id,
      stage: "create_invite_link",
    }, "error");
    return { lead_id: lead.id, ok: false, reason: linkRes.error };
  }

  const firstName = escapeHtml((lead.name ?? "").split(/\s+/)[0] || "tudo bem?");
  const text = buildRecallMessage(firstName);
  const sendRes = await tgSendRecallDM(botToken, lead.telegram_user_id, text, linkRes.link);
  if (!sendRes.ok) {
    await logBot(admin, "trial_recall_failed", `sendMessage: ${sendRes.error}`, {
      lead_id: lead.id,
      stage: "send_dm",
      telegram_status: sendRes.status,
    }, "error");
    return { lead_id: lead.id, ok: false, reason: sendRes.error };
  }

  // Sucesso: atualiza last_recall_at e incrementa recall_count.
  // O invite_link novo NÃO sobrescreve trial_leads.invite_link — esse link
  // é efêmero (24h) e o trial-webhook pode achar o lead via telegram_user_id
  // mesmo sem ele estar no banco. Se o admin precisar acompanhar, o link
  // fica no bot_logs (context.invite_link).
  // Já validamos elegibilidade antes do envio via try_record_trial_recall
  // (atômico: throttle + increment numa só query). Aqui só fazemos logging.

  await logBot(admin, "trial_recall_sent", `Recall enviado para ${lead.telegram_user_id}`, {
    lead_id: lead.id,
    telegram_user_id: lead.telegram_user_id,
    invite_link: linkRes.link,
  }, "info");

  return { lead_id: lead.id, ok: true, invite_link: linkRes.link };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, { status: 405 });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const trialCronSecret = Deno.env.get("TRIAL_CRON_SECRET") ?? "";
    const botToken = Deno.env.get("TELEGRAM_TRIAL_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_TRIAL_CHAT_ID");

    if (!botToken || !chatId) {
      return json({ error: "Bot do Telegram não configurado" }, { status: 500 });
    }

    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return json({ error: "Não autenticado" }, { status: 401 });
    }
    const presented = auth.slice(7).trim();

    const body = await req.json().catch(() => ({}));
    const isCronCall = body?.cron === true;

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // ===== Modo A — cron =====
    if (isCronCall) {
      const matchesService = constantTimeEqual(presented, serviceKey);
      const matchesCron = trialCronSecret.length > 0 && constantTimeEqual(presented, trialCronSecret);
      if (!matchesService && !matchesCron) {
        return json({ error: "forbidden" }, { status: 403 });
      }

      const { data: settings } = await admin
        .from("trial_settings")
        .select("recall_after_hours, recall_repeat_after_days, recall_daily_cap")
        .eq("id", true)
        .maybeSingle();
      const afterHours = Math.max(1, Number(settings?.recall_after_hours ?? 12));
      const repeatDays = Math.max(1, Number(settings?.recall_repeat_after_days ?? 7));
      const dailyCap = Math.max(1, Number(settings?.recall_daily_cap ?? 100));

      const now = Date.now();
      const maxCreatedAt = new Date(now - afterHours * 60 * 60 * 1000).toISOString();
      const minRepeatAt = new Date(now - repeatDays * 24 * 60 * 60 * 1000).toISOString();

      // Elegíveis: pending + has telegram_user_id + criado há >= afterHours +
      // (nunca recebeu recall OR último recall há >= repeatDays).
      const { data: leads, error } = await admin
        .from("trial_leads")
        .select("id, name, status, telegram_user_id, last_recall_at, recall_count")
        .eq("status", "pending")
        .not("telegram_user_id", "is", null)
        .lte("created_at", maxCreatedAt)
        .or(`last_recall_at.is.null,last_recall_at.lte.${minRepeatAt}`)
        .order("created_at", { ascending: true })
        .limit(dailyCap);

      if (error) {
        console.error("trial-recall cron query error", error);
        return json({ error: "query failed" }, { status: 500 });
      }

      const cronMinSeconds = repeatDays * 24 * 60 * 60;
      const results: SendResult[] = [];
      for (const lead of leads ?? []) {
        results.push(await recallLead(admin, botToken, chatId, lead as LeadRow, cronMinSeconds));
      }
      const sent = results.filter(r => r.ok).length;
      const failed = results.length - sent;
      return json({
        ok: true,
        mode: "cron",
        eligible: results.length,
        sent,
        failed,
        cap: dailyCap,
        results,
      });
    }

    // ===== Modo B — manual (admin) =====
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Sessão inválida" }, { status: 401 });
    const email = userData.user.email?.toLowerCase();
    if (!email) return json({ error: "Email não encontrado" }, { status: 401 });

    const { data: perm } = await admin
      .from("user_permissions")
      .select("can_view_trial, is_super_admin")
      .eq("user_email", email)
      .maybeSingle();
    if (!perm || (!perm.can_view_trial && !perm.is_super_admin)) {
      return json({ error: "Sem permissão" }, { status: 403 });
    }

    const ids: string[] = [];
    if (typeof body.lead_id === "string" && body.lead_id.trim()) ids.push(body.lead_id.trim());
    if (Array.isArray(body.lead_ids)) {
      for (const v of body.lead_ids) {
        if (typeof v === "string" && v.trim()) ids.push(v.trim());
      }
    }
    const dedup = Array.from(new Set(ids));
    if (dedup.length === 0) {
      return json({ error: "Informe lead_id ou lead_ids[]" }, { status: 400 });
    }
    // Hard cap pra evitar abuso/erro humano (ex: clique acidental em "todos").
    if (dedup.length > 200) {
      return json({ error: "Máximo 200 leads por chamada" }, { status: 400 });
    }

    const { data: leads, error: leadErr } = await admin
      .from("trial_leads")
      .select("id, name, status, telegram_user_id, last_recall_at, recall_count")
      .in("id", dedup);
    if (leadErr) {
      console.error("trial-recall manual lookup error", leadErr);
      return json({ error: "Falha ao consultar leads" }, { status: 500 });
    }

    // Cooldown manual: 60min entre cliques no mesmo lead. Protege contra
    // spam (clique repetido, double-submit do bulk) sem bloquear o admin
    // de reenviar legitimamente em outro dia.
    const MANUAL_MIN_SECONDS = 60 * 60;
    const byId = new Map<string, LeadRow>((leads ?? []).map(l => [l.id, l as LeadRow]));
    const results: SendResult[] = [];
    for (const id of dedup) {
      const lead = byId.get(id);
      if (!lead) {
        results.push({ lead_id: id, ok: false, reason: "lead não encontrado" });
        continue;
      }
      results.push(await recallLead(admin, botToken, chatId, lead, MANUAL_MIN_SECONDS));
    }

    const sent = results.filter(r => r.ok).length;
    const failed = results.length - sent;
    return json({
      ok: true,
      mode: "manual",
      requested: dedup.length,
      sent,
      failed,
      results,
      message: failed === 0
        ? (sent === 1 ? "Recall enviado." : `${sent} recall(s) enviados.`)
        : `${sent} enviado(s), ${failed} falharam.`,
    });
  } catch (err) {
    console.error("trial-recall error", err);
    return json({ error: "internal" }, { status: 500 });
  }
});

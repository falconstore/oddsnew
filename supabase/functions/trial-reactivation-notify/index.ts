// Edge Function: trial-reactivation-notify
// Dispara WPP para leads restaurados de "removed" → "active" com trial válido.
// Para cada lead: gera novo link TG individual (7 dias, 1 uso), salva no banco
// e envia mensagem WPP perguntando se conseguiu entrar, com o link de backup.
// Rate-limit: delay configurável entre cada disparo pra não levar ban no Z-API.
// Protegida por x-cron-secret (mesma que trial-cron).
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const log = (event: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ tag: "trial-reactivation-notify", event, ...data }));

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

async function sendZApiText(instanceId: string, token: string, clientToken: string, phone: string, message: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Client-Token": clientToken },
        body: JSON.stringify({ phone: normalizePhone(phone), message }),
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Z-API HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function createTgInviteLink(botToken: string, chatId: string): Promise<string | null> {
  try {
    const expireDate = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // +7 dias
    const res = await fetch(`https://api.telegram.org/bot${botToken}/createChatInviteLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        member_limit: 1,
        expire_date: expireDate,
        name: "reativacao",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (data?.ok && data?.result?.invite_link) {
      return data.result.invite_link as string;
    }
    log("tg-link-failed", { status: res.status, description: data?.description ?? null });
    return null;
  } catch (e) {
    log("tg-link-error", { error: String(e) });
    return null;
  }
}

function buildMessage(firstName: string, inviteLink: string): string {
  const name = firstName?.split(" ")[0] || "amigo(a)";
  return [
    `Oi ${name}! Aqui é o Lucas do Shark Green 🦈`,
    ``,
    `Tive um probleminha técnico aqui que pode ter te impedido de entrar no *Grupo VIP do Telegram*. Já arrumamos!`,
    ``,
    `Conseguiu entrar no grupo? Se não, usa esse link atualizado aqui:`,
    ``,
    `👉 ${inviteLink}`,
    ``,
    `O link é pessoal e de uso único — não compartilha 😉`,
  ].join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth
  const headerSecret = req.headers.get("x-cron-secret")
    ?? (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const expectedSecret = Deno.env.get("TRIAL_CRON_SECRET");
  if (!expectedSecret || !headerSecret || headerSecret !== expectedSecret) {
    return json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  // delay em ms entre cada disparo (default 5s, max 30s)
  const delayMs = Math.min(Math.max(Number(body.delay_ms ?? 5000), 1000), 30000);
  // IDs específicos a notificar (obrigatório)
  const leadIds: string[] = Array.isArray(body.lead_ids) ? body.lead_ids : [];
  if (leadIds.length === 0) {
    return json({ error: "lead_ids obrigatório (array de UUIDs)" }, { status: 400 });
  }

  const botToken = Deno.env.get("TELEGRAM_TRIAL_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_TRIAL_CHAT_ID");
  const zapiInstanceId = Deno.env.get("ZAPI_INSTANCE_ID");
  const zapiToken = Deno.env.get("ZAPI_TOKEN");
  const zapiClientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");

  if (!botToken || !chatId || !zapiInstanceId || !zapiToken || !zapiClientToken) {
    return json({ error: "secrets não configurados" }, { status: 500 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // Busca os leads pelo ID
  const { data: leads, error: leadsErr } = await supabase
    .from("trial_leads")
    .select("id, name, whatsapp, expires_at, status")
    .in("id", leadIds);

  if (leadsErr) {
    return json({ error: leadsErr.message }, { status: 500 });
  }

  const results: Array<{ id: string; name: string; wpp: string; tg_link: string | null; wpp_ok: boolean; wpp_error?: string }> = [];

  for (const lead of leads ?? []) {
    if (!lead.whatsapp) {
      log("skip-no-wpp", { lead_id: lead.id });
      results.push({ id: lead.id, name: lead.name ?? "", wpp: "", tg_link: null, wpp_ok: false, wpp_error: "sem whatsapp" });
      continue;
    }

    // 1) Gerar novo link TG
    const tgLink = await createTgInviteLink(botToken, chatId);

    // 2) Salvar link no banco (se gerou com sucesso)
    if (tgLink) {
      await supabase
        .from("trial_leads")
        .update({ invite_link: tgLink })
        .eq("id", lead.id);
    }

    const linkToSend = tgLink ?? "https://t.me/+SEU_GRUPO_AQUI"; // fallback genérico

    // 3) Enviar WPP
    const message = buildMessage(lead.name ?? "", linkToSend);
    const wppResult = await sendZApiText(zapiInstanceId, zapiToken, zapiClientToken, lead.whatsapp, message);

    log(wppResult.ok ? "sent" : "wpp-failed", {
      lead_id: lead.id,
      wpp: lead.whatsapp,
      tg_link: tgLink,
      error: wppResult.error ?? null,
    });

    results.push({
      id: lead.id,
      name: lead.name ?? "",
      wpp: lead.whatsapp,
      tg_link: tgLink,
      wpp_ok: wppResult.ok,
      wpp_error: wppResult.error,
    });

    // 4) Delay antes do próximo disparo (evitar ban Z-API)
    if (lead !== (leads ?? [])[(leads ?? []).length - 1]) {
      await sleep(delayMs);
    }
  }

  const sent = results.filter((r) => r.wpp_ok).length;
  const failed = results.filter((r) => !r.wpp_ok).length;

  return json({ ok: true, sent, failed, total: results.length, results });
});

// Edge Function: telegram-procedure-bot
//
// Recebe mensagens do Telegram via webhook, faz parse e insere
// o procedimento diretamente no banco, disparando a sync com o FreeBet PRO.
//
// SECRETS necessários:
//   TELEGRAM_PROC_BOT_TOKEN  — token do bot (@BotFather)
//   TELEGRAM_PROC_CHAT_ID    — ID do canal/grupo monitorado
//
// SEGURANÇA:
//   - Valida o header X-Telegram-Bot-Api-Secret-Token contra
//     TELEGRAM_PROC_WEBHOOK_SECRET (configurado no setWebhook).
//   - Filtra mensagens por TELEGRAM_PROC_CHAT_ID.
//   - Ignora mensagens sem texto ou enviadas via bot.
//
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json } from "../_shared/cors.ts";
import { parseMessage } from "./parser.ts";

const log = (event: string, data: Record<string, unknown>) => {
  console.log(JSON.stringify({ tag: "telegram-procedure-bot", event, ...data }));
};

/** Escapa entidades HTML para uso seguro em mensagens Telegram com parse_mode HTML. */
function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ──────────────────────────────────────────────────────────
// Telegram API helpers
// ──────────────────────────────────────────────────────────

async function tgSend(
  token: string,
  chatId: number | string,
  text: string,
  replyToMessageId?: number,
): Promise<void> {
  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    };
    if (replyToMessageId) body.reply_to_message_id = replyToMessageId;
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(`[proc-bot] sendMessage failed: ${res.status} ${errText}`);
    }
  } catch (e) {
    console.warn("[proc-bot] sendMessage exception", e);
  }
}

// ──────────────────────────────────────────────────────────
// Main handler
// ──────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200 });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "method not allowed" }, { status: 405 });
  }

  // ── Configuração ─────────────────────────────────────────
  const BOT_TOKEN = Deno.env.get("TELEGRAM_PROC_BOT_TOKEN");
  const CHAT_ID = Deno.env.get("TELEGRAM_PROC_CHAT_ID");
  const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_PROC_WEBHOOK_SECRET");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!BOT_TOKEN) {
    log("config_error", { missing: "TELEGRAM_PROC_BOT_TOKEN" });
    return json({ ok: false, error: "bot token not configured" }, { status: 500 });
  }
  if (!CHAT_ID) {
    log("config_error", { missing: "TELEGRAM_PROC_CHAT_ID" });
    return json({ ok: false, error: "chat id not configured" }, { status: 500 });
  }

  // ── Validação do secret token (fail-closed) ───────────────
  // TELEGRAM_PROC_WEBHOOK_SECRET é OBRIGATÓRIO. Sem ele, rejeitamos todas as
  // requisições — endpoint público com escrita service-role não pode ficar aberto.
  if (!WEBHOOK_SECRET) {
    log("config_error", { missing: "TELEGRAM_PROC_WEBHOOK_SECRET" });
    return json({ ok: false, error: "webhook secret not configured" }, { status: 500 });
  }
  const headerSecret = req.headers.get("x-telegram-bot-api-secret-token");
  if (headerSecret !== WEBHOOK_SECRET) {
    log("invalid_secret", { has_header: !!headerSecret });
    return json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  // ── Parse do update ───────────────────────────────────────
  let update: any;
  try {
    update = await req.json();
  } catch {
    return json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const updateId = update?.update_id ?? null;

  // Só processa mensagens de texto (não editadas, não via bot)
  const msg = update?.message ?? update?.channel_post;
  if (!msg) {
    log("ignored", { reason: "no message/channel_post", update_id: updateId });
    return json({ ok: true, ignored: "no message" });
  }

  // Ignorar mensagens via bot
  if (msg.via_bot) {
    log("ignored", { reason: "via_bot", update_id: updateId });
    return json({ ok: true, ignored: "via_bot" });
  }

  const text: string | undefined = msg.text ?? msg.caption;
  if (!text || !text.trim()) {
    log("ignored", { reason: "no text", update_id: updateId });
    return json({ ok: true, ignored: "no text" });
  }

  // Verificar chat ID
  const msgChatId = String(msg.chat?.id ?? "");
  const expectedChatId = String(CHAT_ID);
  if (msgChatId !== expectedChatId) {
    log("ignored", {
      reason: "wrong chat",
      got: msgChatId,
      expected: expectedChatId,
      update_id: updateId,
    });
    return json({ ok: true, ignored: "wrong chat" });
  }

  const messageId: number | undefined = msg.message_id;
  const chatId = msg.chat.id;

  log("processing", { update_id: updateId, message_id: messageId, chat_id: chatId });

  // ── Parse da mensagem ─────────────────────────────────────
  const parseResult = parseMessage(text);

  if (!parseResult.ok) {
    const errMsg = `❌ Não consegui registrar. Campos ausentes: ${parseResult.missingFields.join(", ")}.`;
    log("parse_failed", {
      update_id: updateId,
      missing: parseResult.missingFields,
    });
    await tgSend(BOT_TOKEN, chatId, errMsg, messageId);
    return json({ ok: true, action: "parse_failed", missing: parseResult.missingFields });
  }

  const parsed = parseResult.data;

  // ── Inserção no banco ─────────────────────────────────────
  const supa = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // Para QUEIMAR_FB: resolver o UUID do procedimento de referência
  let freebetReferenceId: string | null = null;
  if (parsed.tipo === "QUEIMAR_FB" && parsed.ref_procedure_number) {
    const { data: refProc, error: refErr } = await supa
      .from("procedures")
      .select("id")
      .eq("procedure_number", parsed.ref_procedure_number)
      .order("created_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (refErr) {
      log("ref_lookup_error", { err: refErr.message, ref_number: parsed.ref_procedure_number });
    } else if (refProc) {
      freebetReferenceId = refProc.id;
      log("ref_resolved", { ref_number: parsed.ref_procedure_number, ref_id: freebetReferenceId });
    } else {
      log("ref_not_found", { ref_number: parsed.ref_procedure_number });
    }
  }

  // Monta a row a inserir
  const insertRow: Record<string, unknown> = {
    procedure_number: parsed.procedure_number,
    date: parsed.date,
    created_date: parsed.date,
    platform: parsed.platform,
    category: parsed.category,
    status: "Enviado",
    tipo: parsed.tipo,
    partida_descricao: parsed.partida_descricao,
    kickoff_at: parsed.kickoff_at,
    data_partida: parsed.data_partida,
    horario_partida: parsed.horario_partida,
    lucro_prejuizo_previsto: parsed.lucro_prejuizo_previsto,
    freebet_valor_previsto: parsed.freebet_valor_previsto,
    freebet_value: parsed.freebet_valor_previsto,   // campo legado espelhado
    freebet_reference_id: freebetReferenceId,
    profit_loss: 0,
    dp: false,
    tags: [],
    is_favorite: false,
    archived: false,
    tachado: false,
    reenviado_count: 0,
    duplo_green_confirmado: parsed.is_duplo_green,
    esporte: "futebol",
  };

  const { data: inserted, error: insertErr } = await supa
    .from("procedures")
    .insert([insertRow])
    .select()
    .single();

  if (insertErr || !inserted) {
    const errMsg = `❌ Não consegui registrar. Erro no banco: ${insertErr?.message ?? "desconhecido"}.`;
    log("insert_error", { err: insertErr?.message, update_id: updateId });
    await tgSend(BOT_TOKEN, chatId, errMsg, messageId);
    return json({ ok: false, error: insertErr?.message ?? "insert failed" }, { status: 500 });
  }

  log("inserted", { procedure_id: inserted.id, procedure_number: parsed.procedure_number });

  // ── Sync com FreeBet PRO (fire-and-forget, não bloqueia a resposta) ───
  void supa.functions.invoke("freebetpro-sync", {
    body: { procedure_id: inserted.id, action: "upsert" },
  }).catch((e: any) => {
    console.warn("[proc-bot] freebetpro-sync invoke failed (best-effort)", e?.message);
  });

  // ── Confirmação no Telegram ────────────────────────────────
  const tipoLabel: Record<string, string> = {
    SEM_FB: "Lucro Direto",
    GANHAR_FB: "Ganhar Freebet",
    QUEIMAR_FB: "Queimar Freebet",
  };
  const eventoStr = parsed.partida_descricao
    ? ` · ${escHtml(parsed.partida_descricao)}`
    : "";
  const confirMsg =
    `✅ Procedimento ${escHtml(parsed.procedure_number)} registrado — ${tipoLabel[parsed.tipo]} · ${escHtml(parsed.platform)}${eventoStr}`;

  await tgSend(BOT_TOKEN, chatId, confirMsg, messageId);

  return json({
    ok: true,
    action: "registered",
    procedure_id: inserted.id,
    procedure_number: parsed.procedure_number,
  });
});

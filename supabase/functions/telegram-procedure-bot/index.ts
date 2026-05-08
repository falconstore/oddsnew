// Edge Function: telegram-procedure-bot
//
// Recebe mensagens do Telegram via webhook, faz parse e insere
// o procedimento diretamente no banco, disparando a sync com o FreeBet PRO.
//
// Suporta também o comando manual "REGISTRE O PROCEDIMENTO N":
//   - Se proc N já existe no banco → re-dispara freebetpro-sync
//   - Se não existe e o comando é reply de uma mensagem de proc → parseia e registra
//   - Caso contrário → orienta o usuário a usar reply
//
// SECRETS necessários:
//   TELEGRAM_PROC_BOT_TOKEN       — token do bot (@BotFather)
//   TELEGRAM_PROC_CHAT_ID         — ID do canal/grupo monitorado
//   TELEGRAM_PROC_WEBHOOK_SECRET  — secret validado no header do webhook
//
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json } from "../_shared/cors.ts";
import { parseMessage, ParsedProcedure } from "./parser.ts";

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
// Detecção de comando manual
// ──────────────────────────────────────────────────────────

/**
 * Detecta o comando "REGISTRE O PROCEDIMENTO N" e variações.
 * Aceita (case-insensitive):
 *   - REGISTRE O PROCEDIMENTO 130
 *   - REGISTRE PROC 130
 *   - REGISTRAR PROCEDIMENTO 130
 *   - REGISTRAR 130
 *   - REGISTRA 130
 * Retorna o número do procedimento ou null.
 */
function detectRegisterCommand(text: string): string | null {
  const t = text.trim();
  // Comando deve ser curto (não confundir com a própria mensagem do procedimento)
  if (t.length > 80) return null;
  // Não pode conter quebra de linha (procedimentos sempre têm várias linhas)
  if (/\n/.test(t)) return null;

  const re = /^REGISTRA?R?E?\s+(?:O\s+)?(?:PROC(?:EDIMENTO)?\s+)?#?(\d+)\s*$/i;
  const m = t.match(re);
  return m ? m[1] : null;
}

// ──────────────────────────────────────────────────────────
// Parse + Insert + Sync (reutilizado pelo fluxo automático e pelo comando)
// ──────────────────────────────────────────────────────────

interface InsertResult {
  ok: true;
  procedureId: string;
  procedureNumber: string;
  parsed: ParsedProcedure;
}
interface InsertFailure {
  ok: false;
  error: string;
}

async function parseAndInsertProcedure(
  supa: any,
  text: string,
): Promise<InsertResult | InsertFailure | { ok: "missing"; missingFields: string[] }> {
  const parseResult = parseMessage(text);
  if (!parseResult.ok) {
    return { ok: "missing", missingFields: parseResult.missingFields };
  }
  const parsed = parseResult.data;

  // Resolver UUID do procedimento de referência (QUEIMAR_FB)
  let freebetReferenceId: string | null = null;
  if (parsed.tipo === "QUEIMAR_FB" && parsed.ref_procedure_number) {
    const { data: refProc } = await supa
      .from("procedures")
      .select("id")
      .eq("procedure_number", parsed.ref_procedure_number)
      .order("created_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (refProc) freebetReferenceId = refProc.id;
  }

  const insertRow: Record<string, unknown> = {
    procedure_number: parsed.procedure_number,
    external_id: parsed.external_id,
    titulo: parsed.titulo || undefined,
    date: parsed.date,
    created_date: parsed.date,
    platform: parsed.platform,
    category: parsed.category,
    status: "Enviado",
    tipo: parsed.tipo,
    prioridade: parsed.prioridade,
    partida_descricao: parsed.partida_descricao,
    kickoff_at: parsed.kickoff_at,
    data_partida: parsed.data_partida,
    horario_partida: parsed.horario_partida,
    lucro_prejuizo_previsto: parsed.lucro_prejuizo_previsto,
    freebet_valor_previsto: parsed.freebet_valor_previsto,
    freebet_value: parsed.freebet_valor_previsto,
    freebet_reference_id: freebetReferenceId,
    profit_loss: 0,
    dp: parsed.dp,
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
    return { ok: false, error: insertErr?.message ?? "insert failed" };
  }

  // Sync com FreeBet PRO (fire-and-forget)
  void supa.functions.invoke("freebetpro-sync", {
    body: { procedure_id: inserted.id, action: "upsert" },
  }).catch((e: any) => {
    console.warn("[proc-bot] freebetpro-sync invoke failed (best-effort)", e?.message);
  });

  return {
    ok: true,
    procedureId: inserted.id,
    procedureNumber: parsed.procedure_number,
    parsed,
  };
}

function buildConfirmMsg(parsed: ParsedProcedure): string {
  const tipoLabel: Record<string, string> = {
    SEM_FB: "Lucro Direto",
    GANHAR_FB: "Ganhar Freebet",
    QUEIMAR_FB: "Queimar Freebet",
  };
  const eventoStr = parsed.partida_descricao
    ? ` · ${escHtml(parsed.partida_descricao)}`
    : "";
  return `✅ Procedimento ${escHtml(parsed.procedure_number)} registrado — ${tipoLabel[parsed.tipo]} · ${escHtml(parsed.platform)}${eventoStr}`;
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
  const msg = update?.message ?? update?.channel_post;
  if (!msg) {
    log("ignored", { reason: "no message/channel_post", update_id: updateId });
    return json({ ok: true, ignored: "no message" });
  }
  if (msg.via_bot) {
    log("ignored", { reason: "via_bot", update_id: updateId });
    return json({ ok: true, ignored: "via_bot" });
  }

  const text: string | undefined = msg.text ?? msg.caption;
  if (!text || !text.trim()) {
    log("ignored", { reason: "no text", update_id: updateId });
    return json({ ok: true, ignored: "no text" });
  }

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

  const supa = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // ──────────────────────────────────────────────────────────
  // 1. Detectar comando manual "REGISTRE O PROCEDIMENTO N"
  // ──────────────────────────────────────────────────────────
  const cmdNumber = detectRegisterCommand(text);
  if (cmdNumber) {
    const externalId = `bsk:${cmdNumber}`;
    log("command_detected", { number: cmdNumber, update_id: updateId });

    // Caso 1: já existe no banco → re-sync
    const { data: existing, error: lookupErr } = await supa
      .from("procedures")
      .select("id, procedure_number")
      .or(`external_id.eq.${externalId},procedure_number.eq.${cmdNumber}`)
      .order("created_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupErr) {
      log("command_lookup_error", { err: lookupErr.message });
      await tgSend(BOT_TOKEN, chatId, `❌ Erro ao consultar o banco: ${escHtml(lookupErr.message)}`, messageId);
      return json({ ok: false, error: lookupErr.message }, { status: 500 });
    }

    if (existing) {
      void supa.functions.invoke("freebetpro-sync", {
        body: { procedure_id: existing.id, action: "upsert" },
      }).catch((e: any) => {
        console.warn("[proc-bot] freebetpro-sync invoke failed (best-effort)", e?.message);
      });
      await tgSend(
        BOT_TOKEN,
        chatId,
        `🔄 ${escHtml(externalId)} já existia — re-sincronizado com o FreeBet PRO.`,
        messageId,
      );
      log("command_resynced", { procedure_id: existing.id, number: cmdNumber });
      return json({ ok: true, action: "resynced", procedure_id: existing.id });
    }

    // Caso 2: não existe, mas é reply de uma mensagem de procedimento → parsear e registrar
    const replyTo = msg.reply_to_message;
    const replyText: string | undefined = replyTo?.text ?? replyTo?.caption;
    if (replyTo && replyText && /PROCEDIMENTO/i.test(replyText)) {
      // Validar que o número do reply bate com o número do comando (para não criar lixo)
      const replyNumberMatch = replyText.match(/PROCEDIMENTO\s+#?(\d+)/i);
      if (replyNumberMatch && replyNumberMatch[1] !== cmdNumber) {
        await tgSend(
          BOT_TOKEN,
          chatId,
          `⚠️ O comando pede o procedimento <b>${escHtml(cmdNumber)}</b>, mas a mensagem respondida é do procedimento <b>${escHtml(replyNumberMatch[1])}</b>. Confira e reenvie.`,
          messageId,
        );
        return json({ ok: true, action: "command_number_mismatch" });
      }

      const result = await parseAndInsertProcedure(supa, replyText);
      if (result.ok === "missing") {
        await tgSend(
          BOT_TOKEN,
          chatId,
          `❌ Não consegui registrar o procedimento ${escHtml(cmdNumber)}. Campos ausentes na mensagem original: ${escHtml(result.missingFields.join(", "))}.`,
          messageId,
        );
        return json({ ok: true, action: "command_parse_failed", missing: result.missingFields });
      }
      if (!result.ok) {
        await tgSend(
          BOT_TOKEN,
          chatId,
          `❌ Não consegui registrar. Erro no banco: ${escHtml(result.error)}.`,
          messageId,
        );
        return json({ ok: false, error: result.error }, { status: 500 });
      }
      await tgSend(BOT_TOKEN, chatId, buildConfirmMsg(result.parsed), messageId);
      log("command_registered", { procedure_id: result.procedureId, number: cmdNumber });
      return json({ ok: true, action: "command_registered", procedure_id: result.procedureId });
    }

    // Caso 3: não existe e não é reply válido → orientar
    await tgSend(
      BOT_TOKEN,
      chatId,
      `⚠️ Procedimento <b>${escHtml(cmdNumber)}</b> não encontrado no banco. Para registrar, responda (reply) à mensagem original do procedimento e repita o comando.`,
      messageId,
    );
    log("command_not_found", { number: cmdNumber });
    return json({ ok: true, action: "command_not_found" });
  }

  // ──────────────────────────────────────────────────────────
  // 2. Fluxo normal — mensagem de procedimento postada no canal
  // ──────────────────────────────────────────────────────────
  const result = await parseAndInsertProcedure(supa, text);

  if (result.ok === "missing") {
    const errMsg = `❌ Não consegui registrar. Campos ausentes: ${escHtml(result.missingFields.join(", "))}.`;
    log("parse_failed", { update_id: updateId, missing: result.missingFields });
    await tgSend(BOT_TOKEN, chatId, errMsg, messageId);
    return json({ ok: true, action: "parse_failed", missing: result.missingFields });
  }

  if (!result.ok) {
    const errMsg = `❌ Não consegui registrar. Erro no banco: ${escHtml(result.error)}.`;
    log("insert_error", { err: result.error, update_id: updateId });
    await tgSend(BOT_TOKEN, chatId, errMsg, messageId);
    return json({ ok: false, error: result.error }, { status: 500 });
  }

  log("inserted", { procedure_id: result.procedureId, procedure_number: result.procedureNumber });
  await tgSend(BOT_TOKEN, chatId, buildConfirmMsg(result.parsed), messageId);

  return json({
    ok: true,
    action: "registered",
    procedure_id: result.procedureId,
    procedure_number: result.procedureNumber,
  });
});

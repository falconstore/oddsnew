// Edge Function: telegram-procedure-bot
//
// Recebe mensagens do Telegram via webhook, faz parse e insere
// o procedimento diretamente no banco, disparando a sync com o FreeBet PRO.
//
// Erros (insert falhou, parse falhou, lookup falhou) são gravados em
// `public.bot_logs` e NÃO enviados pro grupo do Telegram.
// Mensagens de sucesso (✅ / ⚠️ parcial) continuam sendo enviadas.
//
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json } from "../_shared/cors.ts";
import { parseMessage, ParsedProcedure, PartialParsedProcedure } from "./parser.ts";

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
// Panel logging (substitui tgSend pra erros)
// ──────────────────────────────────────────────────────────

// logToPanel usa fetch direto na REST API do Supabase (service_role).
// NÃO usa o cliente JS porque supa.from().insert() retorna { error } em vez de lançar
// exceção, fazendo o erro sumir silenciosamente no try/catch.
async function logToPanel(
  supabaseUrl: string,
  serviceRoleKey: string,
  opts: {
    level: "error" | "warning" | "info";
    event: string;
    message: string;
    procedureNumber?: string | null;
    updateId?: number | null;
    messageId?: number | null;
    rawText?: string | null;
    context?: Record<string, unknown> | null;
  },
): Promise<void> {
  const payload = {
    level: opts.level,
    event: opts.event,
    message: opts.message,
    procedure_number: opts.procedureNumber ?? null,
    update_id: opts.updateId ?? null,
    message_id: opts.messageId ?? null,
    raw_text: opts.rawText ?? null,
    context: opts.context ?? null,
  };
  console.log(JSON.stringify({ tag: "telegram-procedure-bot", event: "log_to_panel", ...payload }));
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/bot_logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[proc-bot] logToPanel HTTP error ${res.status}: ${body}`);
    }
  } catch (e: any) {
    console.error("[proc-bot] logToPanel fetch exception:", e?.message);
  }
}

// ──────────────────────────────────────────────────────────
// Detecção de comando manual
// ──────────────────────────────────────────────────────────

function detectRegisterCommand(text: string): string | null {
  const t = text.trim();
  if (t.length > 80) return null;
  if (/\n/.test(t)) return null;
  const re = /^REGISTR(?:E|A|AR)\s+(?:O\s+)?(?:PROC(?:EDIMENTO)?\s+)?#?(\d+)\s*$/i;
  const m = t.match(re);
  return m ? m[1] : null;
}

// ──────────────────────────────────────────────────────────
// Parse + Insert + Sync
// ──────────────────────────────────────────────────────────

interface InsertResult {
  ok: true;
  procedureId: string;
  procedureNumber: string;
  parsed: ParsedProcedure;
  isPartial: false;
}
interface PartialInsertResult {
  ok: true;
  procedureId: string;
  procedureNumber: string;
  parsedPartial: PartialParsedProcedure;
  isPartial: true;
}
interface InsertFailure {
  ok: false;
  error: string;
}

function buildInsertRow(
  parsed: ParsedProcedure | PartialParsedProcedure,
  rawMessage: string,
  missingFields?: string[],
): Record<string, unknown> {
  return {
    procedure_number: parsed.procedure_number,
    external_id: parsed.external_id,
    promotion_name: parsed.titulo || undefined,
    date: parsed.date,
    created_date: parsed.date,
    platform: parsed.platform ?? "—",
    category: parsed.category,
    status: "Enviado",
    tipo: parsed.tipo,
    partida_descricao: parsed.partida_descricao,
    kickoff_at: parsed.kickoff_at,
    data_partida: parsed.data_partida,
    horario_partida: parsed.horario_partida,
    lucro_prejuizo_previsto: parsed.lucro_prejuizo_previsto,
    freebet_valor_previsto: parsed.freebet_valor_previsto,
    freebet_value: parsed.freebet_valor_previsto,
    profit_loss: 0,
    dp: parsed.dp,
    freebet_reference: parsed.tipo === "QUEIMAR_FB" && parsed.ref_procedure_number
      ? parsed.ref_procedure_number
      : undefined,
    tags: [],
    is_favorite: false,
    archived: false,
    tachado: false,
    reenviado_count: 0,
    duplo_green_confirmado: parsed.is_duplo_green,
    esporte: "futebol",
    observacoes: parsed.observacoes ?? undefined,
    bot_needs_review: true,
    bot_raw_message: rawMessage,
    bot_missing_fields: missingFields && missingFields.length > 0 ? missingFields : null,
  };
}

async function parseAndInsertProcedure(
  supa: any,
  text: string,
): Promise<InsertResult | PartialInsertResult | InsertFailure | { ok: "no_number"; missingFields: string[] }> {
  const parseResult = parseMessage(text);

  if (parseResult.ok === false) {
    return { ok: "no_number", missingFields: parseResult.missingFields };
  }

  const isPartial = parseResult.ok === "partial";
  const parsed = isPartial ? parseResult.data : parseResult.data;

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

  const missingFields = isPartial ? (parseResult as any).data.missingFields : [];
  const insertRow = {
    ...buildInsertRow(parsed, text, missingFields),
    freebet_reference_id: freebetReferenceId,
  };

  const { data: inserted, error: insertErr } = await supa
    .rpc("bot_insert_procedure", { p_data: insertRow });

  if (insertErr || !inserted) {
    return { ok: false, error: insertErr?.message ?? "insert failed" };
  }

  if (!isPartial) {
    void supa.functions.invoke("freebetpro-sync", {
      body: { procedure_id: inserted.id, action: "upsert" },
    }).catch((e: any) => {
      console.warn("[proc-bot] freebetpro-sync invoke failed (best-effort)", e?.message);
    });
  }

  if (isPartial) {
    return {
      ok: true,
      procedureId: inserted.id,
      procedureNumber: parsed.procedure_number,
      parsedPartial: (parseResult as any).data,
      isPartial: true,
    };
  }

  return {
    ok: true,
    procedureId: inserted.id,
    procedureNumber: parsed.procedure_number,
    parsed: parseResult.data as ParsedProcedure,
    isPartial: false,
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
  return `✅ Procedimento ${escHtml(parsed.procedure_number)} registrado — ${tipoLabel[parsed.tipo]} · ${escHtml(parsed.platform)}${eventoStr}\n⚠️ <i>Verifique os dados no painel e confirme.</i>`;
}

function buildPartialConfirmMsg(parsed: PartialParsedProcedure): string {
  const camposFaltando = parsed.missingFields.join(", ");
  return `⚠️ Procedimento ${escHtml(parsed.procedure_number)} salvo com campos em falta: <b>${escHtml(camposFaltando)}</b>.\n📋 <i>Acesse o painel para completar e confirmar os dados.</i>`;
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
    log("ignored", { reason: "wrong chat", got: msgChatId, expected: expectedChatId, update_id: updateId });
    return json({ ok: true, ignored: "wrong chat" });
  }

  const messageId: number | undefined = msg.message_id;
  const chatId = msg.chat.id;

  log("processing", { update_id: updateId, message_id: messageId, chat_id: chatId });

  const supa = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const { data: settings } = await supa
    .from("system_settings")
    .select("bot_enabled")
    .eq("id", 1)
    .maybeSingle();

  if (settings && settings.bot_enabled === false) {
    log("ignored", { reason: "bot_disabled", update_id: updateId });
    return json({ ok: true, ignored: "bot_disabled" });
  }

  // ──────────────────────────────────────────────────────────
  // 1. Comando manual "REGISTRE O PROCEDIMENTO N"
  // ──────────────────────────────────────────────────────────
  const cmdNumber = detectRegisterCommand(text);
  if (cmdNumber) {
    const externalId = `bsk:${cmdNumber}`;
    log("command_detected", { number: cmdNumber, update_id: updateId });

    const { data: existing, error: lookupErr } = await supa
      .from("procedures")
      .select("id, procedure_number")
      .or(`external_id.eq.${externalId},procedure_number.eq.${cmdNumber}`)
      .order("created_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupErr) {
      log("command_lookup_error", { err: lookupErr.message });
      await logToPanel(SUPABASE_URL, SERVICE_ROLE, {
        level: "error",
        event: "command_lookup_error",
        message: `Erro ao consultar banco para procedimento #${cmdNumber}: ${lookupErr.message}`,
        procedureNumber: cmdNumber,
        updateId,
        messageId,
        context: { externalId, error: lookupErr.message },
      });
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

    const replyTo = msg.reply_to_message;
    const replyText: string | undefined = replyTo?.text ?? replyTo?.caption;
    if (replyTo && replyText && /PROCEDIMENTO/i.test(replyText)) {
      const replyNumberMatch = replyText.match(/PROCEDIMENTO\s+#?(\d+)/i);
      if (replyNumberMatch && replyNumberMatch[1] !== cmdNumber) {
        // Aviso de mismatch: esse é feedback de UX para o usuário — continua no grupo
        await tgSend(
          BOT_TOKEN,
          chatId,
          `⚠️ O comando pede o procedimento <b>${escHtml(cmdNumber)}</b>, mas a mensagem respondida é do procedimento <b>${escHtml(replyNumberMatch[1])}</b>. Confira e reenvie.`,
          messageId,
        );
        return json({ ok: true, action: "command_number_mismatch" });
      }

      const result = await parseAndInsertProcedure(supa, replyText);
      if (result.ok === "no_number") {
        await logToPanel(SUPABASE_URL, SERVICE_ROLE, {
          level: "warning",
          event: "command_parse_failed",
          message: `Não foi possível registrar procedimento #${cmdNumber}: campos ausentes na mensagem original (${result.missingFields.join(", ")})`,
          procedureNumber: cmdNumber,
          updateId,
          messageId,
          rawText: replyText,
          context: { missingFields: result.missingFields },
        });
        return json({ ok: true, action: "command_parse_failed", missing: result.missingFields });
      }
      if (!result.ok) {
        await logToPanel(SUPABASE_URL, SERVICE_ROLE, {
          level: "error",
          event: "command_insert_error",
          message: `Erro ao registrar procedimento #${cmdNumber} no banco: ${result.error}`,
          procedureNumber: cmdNumber,
          updateId,
          messageId,
          rawText: replyText,
          context: { error: result.error },
        });
        return json({ ok: false, error: result.error }, { status: 500 });
      }
      const replyMsg = result.isPartial
        ? buildPartialConfirmMsg(result.parsedPartial)
        : buildConfirmMsg(result.parsed);
      await tgSend(BOT_TOKEN, chatId, replyMsg, messageId);
      log("command_registered", { procedure_id: result.procedureId, number: cmdNumber, partial: result.isPartial });
      return json({ ok: true, action: "command_registered", procedure_id: result.procedureId });
    }

    // Não existe e não é reply válido → aviso de UX, vai pro grupo
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

  if (result.ok === "no_number") {
    log("ignored_no_number", { update_id: updateId, missing: result.missingFields });
    return json({ ok: true, action: "ignored_no_number" });
  }

  if (!result.ok) {
    log("insert_error", { err: result.error, update_id: updateId });
    await logToPanel(SUPABASE_URL, SERVICE_ROLE, {
      level: "error",
      event: "insert_error",
      message: `Falha ao registrar procedimento no banco: ${result.error}`,
      updateId,
      messageId,
      rawText: text,
      context: { error: result.error },
    });
    return json({ ok: false, error: result.error }, { status: 500 });
  }

  if (result.isPartial) {
    log("inserted_partial", {
      procedure_id: result.procedureId,
      procedure_number: result.procedureNumber,
      missing: result.parsedPartial.missingFields,
    });
    await tgSend(BOT_TOKEN, chatId, buildPartialConfirmMsg(result.parsedPartial), messageId);
    return json({
      ok: true,
      action: "registered_partial",
      procedure_id: result.procedureId,
      procedure_number: result.procedureNumber,
      missing: result.parsedPartial.missingFields,
    });
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

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
import { normalizePlatformName } from "../_shared/platform.ts";

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

function buildTelegramLink(chatId: number, messageId: number, chatUsername?: string): string {
  if (chatUsername) {
    return `https://t.me/${chatUsername}/${messageId}`;
  }
  // Canal privado: chatId vem como -100XXXXXXXXXX → strip "-100"
  const channelId = String(chatId).replace(/^-100/, "");
  return `https://t.me/c/${channelId}/${messageId}`;
}

function buildInsertRow(
  parsed: ParsedProcedure | PartialParsedProcedure,
  rawMessage: string,
  missingFields?: string[],
  telegramLink?: string,
): Record<string, unknown> {
  return {
    procedure_number: parsed.procedure_number,
    external_id: parsed.external_id,
    promotion_name: parsed.titulo || undefined,
    date: parsed.date,
    created_date: parsed.date,
    platform: parsed.platform ? normalizePlatformName(parsed.platform) : "—",
    category: parsed.category,
    status: parsed.tipo === "ASR" ? "Aposta Sem Risco" : "Enviada Partida em Aberto",
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
    tags: parsed.tags ?? [],
    is_favorite: false,
    archived: false,
    tachado: false,
    reenviado_count: 0,
    is_extra: parsed.is_extra,
    duplo_green_confirmado: parsed.is_duplo_green,
    esporte: "futebol",
    observacoes: parsed.observacoes ?? undefined,
    bot_needs_review: true,
    bot_raw_message: rawMessage,
    bot_missing_fields: missingFields && missingFields.length > 0 ? missingFields : null,
    telegram_link: telegramLink ?? null,
  };
}

async function parseAndInsertProcedure(
  supa: any,
  text: string,
  telegramLink?: string,
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
    ...buildInsertRow(parsed, text, missingFields, telegramLink),
    freebet_reference_id: freebetReferenceId,
  };

  const { data: inserted, error: insertErr } = await supa
    .rpc("bot_insert_procedure", { p_data: insertRow });

  if (insertErr || !inserted) {
    return { ok: false, error: insertErr?.message ?? "insert failed" };
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

// ──────────────────────────────────────────────────────────
// Sync com FreeBet PRO — awaited, erros vão pro painel
// ──────────────────────────────────────────────────────────

async function syncWithFreebetPro(
  supa: any,
  supabaseUrl: string,
  serviceRoleKey: string,
  procedureId: string,
  procedureNumber: string,
  updateId: number | null,
  messageId: number | undefined,
): Promise<void> {
  // Retry com backoff curto pra absorver falhas transientes da FreeBet PRO
  // (timeouts da rede, cold starts, rate-limit momentâneo). 3 tentativas:
  // imediata → +800ms → +2s. Só loga erro se TODAS falharem; sucesso em
  // qualquer tentativa loga ok normalmente.
  const MAX_ATTEMPTS = 3;
  const DELAYS_MS = [0, 800, 2000];
  let syncData: any = null;
  let error: any = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (DELAYS_MS[attempt] > 0) await new Promise((r) => setTimeout(r, DELAYS_MS[attempt]));
    const result = await supa.functions.invoke("freebetpro-sync", {
      body: { procedure_id: procedureId, action: "upsert" },
    });
    syncData = result.data;
    error = result.error;
    // Sucesso da edge function E sync remoto OK → para o loop
    if (!error && syncData?.ok !== false) break;
    if (attempt < MAX_ATTEMPTS - 1) {
      log("freebetpro_sync_retry", { procedureId, procedureNumber, attempt: attempt + 1, err: error?.message });
    }
  }
  try {
    if (error) {
      log("freebetpro_sync_failed", { procedureId, procedureNumber, err: error.message });
      await logToPanel(supabaseUrl, serviceRoleKey, {
        level: "error",
        event: "freebetpro_sync_failed",
        message: `Falha ao sincronizar proc #${procedureNumber} com FreeBet PRO: ${error.message ?? JSON.stringify(error)}`,
        procedureNumber,
        updateId,
        messageId,
        context: { procedure_id: procedureId, error: error.message },
      });
    } else {
      const fbId = syncData?.body?.id ?? syncData?.id ?? null;
      const skipped = syncData?.skipped ?? null;
      if (skipped) {
        log("freebetpro_sync_skipped", { procedureId, procedureNumber, reason: skipped });
        await logToPanel(supabaseUrl, serviceRoleKey, {
          level: "info",
          event: "freebetpro_sync_skipped",
          message: `Proc #${procedureNumber} não enviado ao FreeBet PRO (${skipped})`,
          procedureNumber,
          updateId,
          messageId,
          context: { procedure_id: procedureId, skipped },
        });
      } else {
        log("freebetpro_sync_ok", { procedureId, procedureNumber, fbId });
        await logToPanel(supabaseUrl, serviceRoleKey, {
          level: "info",
          event: "freebetpro_sync_ok",
          message: `Proc #${procedureNumber} sincronizado com FreeBet PRO${fbId ? ` (id interno: ${fbId})` : ""}`,
          procedureNumber,
          updateId,
          messageId,
          context: { procedure_id: procedureId, freebetpro_id: fbId },
        });
      }
    }
  } catch (e: any) {
    log("freebetpro_sync_exception", { procedureId, procedureNumber, err: e?.message });
    await logToPanel(supabaseUrl, serviceRoleKey, {
      level: "error",
      event: "freebetpro_sync_exception",
      message: `Exceção ao invocar sync FreeBet PRO para proc #${procedureNumber}: ${e?.message ?? "unknown"}`,
      procedureNumber,
      updateId,
      messageId,
      context: { procedure_id: procedureId, error: e?.message },
    });
  }
}

function buildConfirmMsg(parsed: ParsedProcedure): string {
  const tipoLabel: Record<string, string> = {
    SEM_FB: "Lucro Direto",
    GANHAR_FB: "Ganhar Freebet",
    QUEIMAR_FB: "Queimar Freebet",
    ASR: "Aposta Sem Risco",
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

  const BOT_TOKEN = Deno.env.get("TELEGRAM_PROC_BOT_TOKEN");
  const CHAT_ID = Deno.env.get("TELEGRAM_PROC_CHAT_ID");
  const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_PROC_WEBHOOK_SECRET");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // ── GET endpoints (admin debug + auto-recovery) ──
  if (req.method === "GET") {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // GET ?action=status — retorna getWebhookInfo (protegido por x-admin-secret)
    if (action === "status") {
      const adminSecret = req.headers.get("x-admin-secret");
      if (!WEBHOOK_SECRET || adminSecret !== WEBHOOK_SECRET) {
        return json({ ok: false, error: "forbidden" }, { status: 403 });
      }
      if (!BOT_TOKEN) {
        return json({ ok: false, error: "bot token not configured" }, { status: 500 });
      }
      try {
        const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
        const info = await r.json();
        return json({
          ok: true,
          expected_chat_id: CHAT_ID ?? null,
          webhook_info: info,
        });
      } catch (e: any) {
        return json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
      }
    }

    // GET ?action=register-webhook — re-registra o webhook apontando pra esta edge function.
    // Não exige admin-secret pois é idempotente e não expõe dados sensíveis.
    if (action === "register-webhook") {
      if (!BOT_TOKEN || !WEBHOOK_SECRET) {
        return json({ ok: false, error: "TELEGRAM_PROC_BOT_TOKEN ou TELEGRAM_PROC_WEBHOOK_SECRET não configurados" }, { status: 500 });
      }
      const selfUrl = `${SUPABASE_URL}/functions/v1/telegram-procedure-bot`;
      try {
        const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: selfUrl,
            secret_token: WEBHOOK_SECRET,
            allowed_updates: ["message", "channel_post", "edited_message", "edited_channel_post"],
          }),
        });
        const result = await r.json();
        await logToPanel(SUPABASE_URL, SERVICE_ROLE, {
          level: result.ok ? "info" : "error",
          event: result.ok ? "webhook_registered" : "webhook_register_failed",
          message: result.ok
            ? `Webhook re-registrado com sucesso → ${selfUrl}`
            : `Falha ao re-registrar webhook: ${result.description ?? JSON.stringify(result)}`,
          context: { selfUrl, telegram: result },
        });
        return json({ ok: result.ok, description: result.description, webhook_url: selfUrl, telegram: result });
      } catch (e: any) {
        return json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
      }
    }

    return json({ ok: false, error: "action não reconhecida" }, { status: 405 });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "method not allowed" }, { status: 405 });
  }

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
    // Loga no painel pra dar visibilidade — pode indicar tentativa de probe OU
    // que o secret no Telegram BotFather divergiu do TELEGRAM_PROC_WEBHOOK_SECRET.
    await logToPanel(SUPABASE_URL, SERVICE_ROLE, {
      level: "warning",
      event: "invalid_secret",
      message: "Webhook recebido sem secret válido — possível probe externo OU o secret do Telegram divergiu do TELEGRAM_PROC_WEBHOOK_SECRET. Re-registre o webhook se for o segundo caso.",
      context: { has_header: !!headerSecret },
    });
    return json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let update: any;
  try {
    update = await req.json();
  } catch {
    return json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const updateId = update?.update_id ?? null;
  // Suporta mensagens novas E mensagens editadas (edited_channel_post / edited_message).
  // Edições chegam sem `channel_post`/`message` no update — o bot ignorava silenciosamente.
  const isEdit = !!(update?.edited_message ?? update?.edited_channel_post) &&
    !(update?.message ?? update?.channel_post);
  const msg = update?.message ?? update?.channel_post ??
    update?.edited_message ?? update?.edited_channel_post;
  if (!msg) {
    log("ignored", { reason: "no message/channel_post", update_id: updateId });
    await logToPanel(SUPABASE_URL, SERVICE_ROLE, {
      level: "info",
      event: "ignored_no_message",
      message: "Update do Telegram sem message/channel_post/edited_* (ex: my_chat_member, callback_query). Ignorado.",
      updateId,
      context: { update_keys: Object.keys(update ?? {}) },
    });
    return json({ ok: true, ignored: "no message" });
  }
  if (msg.via_bot) {
    log("ignored", { reason: "via_bot", update_id: updateId });
    await logToPanel(SUPABASE_URL, SERVICE_ROLE, {
      level: "info",
      event: "ignored_via_bot",
      message: "Mensagem ignorada — postada via outro bot (msg.via_bot).",
      updateId,
      messageId: msg.message_id ?? null,
    });
    return json({ ok: true, ignored: "via_bot" });
  }

  const text: string | undefined = msg.text ?? msg.caption;

  // ──────────────────────────────────────────────────────────
  // Fotos: captura imagens enviadas no canal e vincula ao proc
  // ──────────────────────────────────────────────────────────
  const hasPhoto = Array.isArray(msg.photo) && msg.photo.length > 0;
  if (hasPhoto && !isEdit) {
    const msgChatIdPhoto = String(msg.chat?.id ?? "");
    if (msgChatIdPhoto !== String(CHAT_ID)) {
      return json({ ok: true, ignored: "wrong chat (photo)" });
    }
    const photoMessageId: number = msg.message_id;
    const supaPhoto = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // Dedup por update_id
    if (updateId != null) {
      const { data: dupLog } = await supaPhoto.from("bot_logs").select("id").eq("update_id", updateId).limit(1).maybeSingle();
      if (dupLog) return json({ ok: true, action: "ignored_duplicate_update" });
    }

    try {
      // Pega o maior tamanho disponível (último elemento do array)
      const largest = msg.photo[msg.photo.length - 1];
      const fileId: string = largest.file_id;

      // Obtém file_path via getFile
      const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
      const fileData = await fileRes.json();
      if (!fileData.ok || !fileData.result?.file_path) {
        throw new Error(`getFile failed: ${JSON.stringify(fileData)}`);
      }
      const filePath: string = fileData.result.file_path;

      // Baixa os bytes da imagem
      const imgRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`);
      if (!imgRes.ok) throw new Error(`Download failed: ${imgRes.status}`);
      const imgBytes = new Uint8Array(await imgRes.arrayBuffer());

      // Nome do arquivo no Storage
      const ext = filePath.split(".").pop() ?? "jpg";
      const storageName = `${Date.now()}_${photoMessageId}.${ext}`;
      const contentType = `image/${ext === "jpg" ? "jpeg" : ext}`;

      // Upload via SDK (evita problema de JWS com raw fetch)
      const { error: uploadError } = await supaPhoto.storage
        .from("procedure-images")
        .upload(storageName, imgBytes, { contentType, upsert: true });
      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      const { data: { publicUrl } } = supaPhoto.storage
        .from("procedure-images")
        .getPublicUrl(storageName);

      // ── Vincula ao procedimento ─────────────────────────────
      // Estratégia 1: Caption com número do procedimento ("PROCEDIMENTO 491" / "PROC 491")
      let procedureId: string | null = null;
      const caption: string = msg.caption ?? "";
      const captionMatch = caption.match(/PROC(?:EDIMENTO)?\s+#?(\d+)/i);
      if (captionMatch) {
        const { data: byNum } = await supaPhoto
          .from("procedures")
          .select("id")
          .eq("procedure_number", captionMatch[1])
          .order("created_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (byNum) procedureId = byNum.id;
      }

      // Estratégia 2: reply_to_message_id → telegram_link termina com /{id}
      if (!procedureId && msg.reply_to_message?.message_id) {
        const replyMsgId = msg.reply_to_message.message_id;
        const { data: byReply } = await supaPhoto
          .from("procedures")
          .select("id")
          .ilike("telegram_link", `%/${replyMsgId}`)
          .limit(1)
          .maybeSingle();
        if (byReply) procedureId = byReply.id;
      }

      // Estratégia 3: proc mais recente dos últimos 30 minutos (usa updated_date)
      if (!procedureId) {
        const cutoff = new Date(Date.now() - 30 * 60_000).toISOString();
        const { data: recent } = await supaPhoto
          .from("procedures")
          .select("id")
          .gte("updated_date", cutoff)
          .eq("archived", false)
          .order("updated_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (recent) procedureId = recent.id;
      }

      // ── Monta o card rico (imagem + legenda + links) ───────
      const captionText: string = msg.caption ?? "";
      const captionEntities: any[] = msg.caption_entities ?? [];
      const cardLinks: { label: string; url: string }[] = captionEntities
        .filter((e: any) => e.type === "text_link" || e.type === "url")
        .map((e: any) => ({
          label: captionText.slice(e.offset, e.offset + e.length).trim(),
          url: e.type === "text_link" ? e.url : captionText.slice(e.offset, e.offset + e.length).trim(),
        }))
        .filter((l: any) => l.url && l.label);

      const telegramCard = {
        image_url: publicUrl,
        caption: captionText || null,
        links: cardLinks.length > 0 ? cardLinks : null,
      };

      if (procedureId) {
        // Salva card rico (imagem + legenda + links)
        await supaPhoto.rpc("append_telegram_card", { proc_id: procedureId, card: telegramCard });
        // Mantém telegram_images para backward compat
        await supaPhoto.rpc("append_telegram_image", { proc_id: procedureId, img_url: publicUrl });
        log("photo_linked", { procedure_id: procedureId, url: publicUrl, update_id: updateId });
        await logToPanel(SUPABASE_URL, SERVICE_ROLE, {
          level: "info",
          event: "photo_linked",
          message: `Foto do Telegram vinculada ao procedimento ${procedureId}`,
          updateId,
          messageId: photoMessageId,
          context: { procedure_id: procedureId, url: publicUrl, links: cardLinks.length },
        });
      } else {
        log("photo_no_proc", { url: publicUrl, update_id: updateId });
        await logToPanel(SUPABASE_URL, SERVICE_ROLE, {
          level: "warning",
          event: "photo_no_proc",
          message: "Foto do Telegram salva mas nenhum procedimento encontrado para vincular",
          updateId,
          messageId: photoMessageId,
          context: { url: publicUrl },
        });
      }
    } catch (e: any) {
      log("photo_error", { err: e?.message, update_id: updateId });
      await logToPanel(SUPABASE_URL, SERVICE_ROLE, {
        level: "error",
        event: "photo_error",
        message: `Erro ao processar foto do Telegram: ${e?.message}`,
        updateId,
        messageId: msg.message_id ?? null,
        context: { error: e?.message },
      });
    }

    return json({ ok: true, action: "photo_processed" });
  }

  if (!text || !text.trim()) {
    log("ignored", { reason: "no text", update_id: updateId });
    await logToPanel(SUPABASE_URL, SERVICE_ROLE, {
      level: "info",
      event: "ignored_no_text",
      message: "Mensagem ignorada — sem texto nem caption (provavelmente foto/sticker/vídeo puro).",
      updateId,
      messageId: msg.message_id ?? null,
    });
    return json({ ok: true, ignored: "no text" });
  }

  const msgChatId = String(msg.chat?.id ?? "");
  const expectedChatId = String(CHAT_ID);
  if (msgChatId !== expectedChatId) {
    log("ignored", { reason: "wrong chat", got: msgChatId, expected: expectedChatId, update_id: updateId });
    // Visibilidade no painel: o grupo pode ter virado supergrupo e mudado de ID,
    // ou o bot está em outro grupo. Logado como warning pra usuário detectar rápido.
    await logToPanel(SUPABASE_URL, SERVICE_ROLE, {
      level: "warning",
      event: "ignored_wrong_chat",
      message: `Mensagem ignorada — chat_id ${msgChatId} (${msg.chat?.title ?? "sem título"}) não é o esperado ${expectedChatId}. Se o grupo virou supergrupo, atualize TELEGRAM_PROC_CHAT_ID.`,
      updateId,
      messageId: msg.message_id ?? null,
      context: { got: msgChatId, expected: expectedChatId, chat_title: msg.chat?.title ?? null, chat_type: msg.chat?.type ?? null },
    });
    return json({ ok: true, ignored: "wrong chat" });
  }

  const messageId: number | undefined = msg.message_id;
  const chatId = msg.chat.id;

  log("processing", { update_id: updateId, message_id: messageId, chat_id: chatId });

  const supa = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // Deduplicação por update_id — impede reprocessar o mesmo webhook reenviado pelo Telegram.
  // Qualquer log existente com este update_id indica que já foi processado (com sucesso ou erro).
  if (updateId != null) {
    const { data: dupLog } = await supa
      .from("bot_logs")
      .select("id")
      .eq("update_id", updateId)
      .limit(1)
      .maybeSingle();
    if (dupLog) {
      log("ignored_duplicate_update", { update_id: updateId });
      return json({ ok: true, action: "ignored_duplicate_update" });
    }
  }

  const { data: settings } = await supa
    .from("system_settings")
    .select("bot_enabled")
    .eq("id", 1)
    .maybeSingle();

  if (settings && settings.bot_enabled === false) {
    log("ignored", { reason: "bot_disabled", update_id: updateId });
    await logToPanel(SUPABASE_URL, SERVICE_ROLE, {
      level: "info",
      event: "ignored_bot_disabled",
      message: "Mensagem ignorada — bot_enabled=false em system_settings. Ative o bot para voltar a processar.",
      updateId,
      messageId: messageId ?? null,
    });
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
      return json({ ok: true, action: "lookup_error_acked" });
    }

    if (existing) {
      await syncWithFreebetPro(supa, SUPABASE_URL, SERVICE_ROLE, existing.id, cmdNumber, updateId, messageId);
      log("command_resynced", { procedure_id: existing.id, number: cmdNumber });
      await logToPanel(SUPABASE_URL, SERVICE_ROLE, {
        level: "info",
        event: "command_resynced",
        message: `Comando REGISTRE recebido — proc #${cmdNumber} já existia, ressincronizado com FreeBet PRO.`,
        procedureNumber: cmdNumber,
        updateId,
        messageId,
        context: { procedure_id: existing.id },
      });
      return json({ ok: true, action: "resynced", procedure_id: existing.id });
    }

    const replyTo = msg.reply_to_message;
    const replyText: string | undefined = replyTo?.text ?? replyTo?.caption;
    if (replyTo && replyText && /PROCEDIMENTO/i.test(replyText)) {
      const replyNumberMatch = replyText.match(/PROCEDIMENTO\s+#?(\d+)/i);
      if (replyNumberMatch && replyNumberMatch[1] !== cmdNumber) {
        await logToPanel(SUPABASE_URL, SERVICE_ROLE, {
          level: "warning",
          event: "command_number_mismatch",
          message: `Comando pede proc #${cmdNumber} mas a mensagem respondida é do proc #${replyNumberMatch[1]}`,
          procedureNumber: cmdNumber,
          updateId,
          messageId,
          context: { requested: cmdNumber, found: replyNumberMatch[1] },
        });
        return json({ ok: true, action: "command_number_mismatch" });
      }

      const replyTelegramLink = replyTo.message_id
        ? buildTelegramLink(chatId, replyTo.message_id, msg.chat?.username)
        : undefined;
      const result = await parseAndInsertProcedure(supa, replyText, replyTelegramLink);
      if (result.ok === "no_number") {
        await logToPanel(SUPABASE_URL, SERVICE_ROLE, {
          level: "warning",
          event: "command_parse_failed",
          message: `Não foi possível registrar proc #${cmdNumber}: campos ausentes (${result.missingFields.join(", ")})`,
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
          message: `Erro ao registrar proc #${cmdNumber} no banco: ${result.error}`,
          procedureNumber: cmdNumber,
          updateId,
          messageId,
          rawText: replyText,
          context: { error: result.error },
        });
        return json({ ok: true, action: "command_insert_error_acked" });
      }
      if (!result.isPartial) {
        await syncWithFreebetPro(supa, SUPABASE_URL, SERVICE_ROLE, result.procedureId, result.procedureNumber, updateId, messageId);
      } else {
        await logToPanel(SUPABASE_URL, SERVICE_ROLE, {
          level: "warning",
          event: "registered_partial",
          message: `Proc #${result.procedureNumber} registrado parcialmente — campos ausentes: ${result.parsedPartial.missingFields.join(", ")}`,
          procedureNumber: result.procedureNumber,
          updateId,
          messageId,
          context: { procedure_id: result.procedureId, missing: result.parsedPartial.missingFields },
        });
      }
      log("command_registered", { procedure_id: result.procedureId, number: cmdNumber, partial: result.isPartial });
      if (!result.isPartial) {
        // Caminho parcial já loga via "registered_partial" acima — evita duplicidade.
        await logToPanel(SUPABASE_URL, SERVICE_ROLE, {
          level: "info",
          event: "command_registered",
          message: `Comando REGISTRE recebido — proc #${cmdNumber} criado a partir da mensagem respondida.`,
          procedureNumber: cmdNumber,
          updateId,
          messageId,
          context: { procedure_id: result.procedureId },
        });
      }
      return json({ ok: true, action: "command_registered", procedure_id: result.procedureId });
    }

    await logToPanel(SUPABASE_URL, SERVICE_ROLE, {
      level: "warning",
      event: "command_not_found",
      message: `Proc #${cmdNumber} não encontrado no banco — comando REGISTRE sem reply válido`,
      procedureNumber: cmdNumber,
      updateId,
      messageId,
    });
    log("command_not_found", { number: cmdNumber });
    return json({ ok: true, action: "command_not_found" });
  }

  // ──────────────────────────────────────────────────────────
  // 2. Mensagem editada — atualiza proc existente ou cria novo
  // ──────────────────────────────────────────────────────────
  if (isEdit) {
    const editParse = parseMessage(text);
    if (editParse.ok === false) {
      log("edit_ignored_no_number", { update_id: updateId, missing: editParse.missingFields });
      return json({ ok: true, action: "edit_ignored_no_number" });
    }

    const isPartial = editParse.ok === "partial";
    const parsed = editParse.data;

    // Procura proc existente pelo external_id (ex: "bsk:175-20260512")
    const { data: existing } = await supa
      .from("procedures")
      .select("id, procedure_number")
      .eq("external_id", parsed.external_id)
      .maybeSingle();

    if (existing) {
      // Proc já existe → atualiza campos derivados do parse, preserva campos operacionais
      const editTelegramLink = messageId
        ? buildTelegramLink(chatId, messageId, msg.chat?.username)
        : undefined;
      const updateFields: Record<string, unknown> = {
        promotion_name: parsed.titulo || undefined,
        platform: parsed.platform ? normalizePlatformName(parsed.platform) : undefined,
        category: parsed.category,
        tipo: parsed.tipo,
        partida_descricao: parsed.partida_descricao,
        kickoff_at: parsed.kickoff_at,
        data_partida: parsed.data_partida,
        horario_partida: parsed.horario_partida,
        lucro_prejuizo_previsto: parsed.lucro_prejuizo_previsto,
        freebet_valor_previsto: parsed.freebet_valor_previsto,
        freebet_value: parsed.freebet_valor_previsto,
        dp: parsed.dp,
        tags: parsed.tags ?? [],
        observacoes: parsed.observacoes ?? null,
        bot_raw_message: text,
        bot_missing_fields: isPartial ? (parsed as any).missingFields : null,
        bot_needs_review: isPartial,
        ...(editTelegramLink ? { telegram_link: editTelegramLink } : {}),
      };

      // Resolve freebet_reference_id para QUEIMAR_FB
      if (parsed.tipo === "QUEIMAR_FB" && parsed.ref_procedure_number) {
        const { data: refProc } = await supa
          .from("procedures")
          .select("id")
          .eq("procedure_number", parsed.ref_procedure_number)
          .order("created_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (refProc) updateFields.freebet_reference_id = refProc.id;
      }

      await supa.from("procedures").update(updateFields).eq("id", existing.id);

      log("edit_updated", {
        procedure_id: existing.id,
        number: parsed.procedure_number,
        partial: isPartial,
        update_id: updateId,
      });

      await logToPanel(SUPABASE_URL, SERVICE_ROLE, {
        level: "info",
        event: "edit_updated",
        message: `Proc #${parsed.procedure_number} atualizado via edição da mensagem Telegram`,
        procedureNumber: parsed.procedure_number,
        updateId,
        messageId,
        context: { procedure_id: existing.id, partial: isPartial },
      });

      // Resync com FreeBet PRO apenas se parse completo
      if (!isPartial) {
        await syncWithFreebetPro(
          supa, SUPABASE_URL, SERVICE_ROLE,
          existing.id, parsed.procedure_number, updateId, messageId,
        );
      }

      return json({ ok: true, action: "edit_updated", procedure_id: existing.id });
    }

    // Proc não existe ainda → cria normalmente (ex: bot estava down na inserção original)
    log("edit_new_proc", {
      external_id: parsed.external_id,
      number: parsed.procedure_number,
      update_id: updateId,
    });
    // Cai no fluxo normal abaixo (parseAndInsertProcedure)
  }

  // ──────────────────────────────────────────────────────────
  // 3. Fluxo normal — mensagem de procedimento postada no canal
  // ──────────────────────────────────────────────────────────
  const telegramLink = messageId
    ? buildTelegramLink(chatId, messageId, msg.chat?.username)
    : undefined;
  const result = await parseAndInsertProcedure(supa, text, telegramLink);

  if (result.ok === "no_number") {
    log("ignored_no_number", { update_id: updateId, missing: result.missingFields });
    await logToPanel(SUPABASE_URL, SERVICE_ROLE, {
      level: "info",
      event: "ignored_no_number",
      message: `Mensagem do canal ignorada — não reconhecida como procedimento (${result.missingFields.join(", ")}).`,
      updateId,
      messageId: messageId ?? null,
      rawText: text,
      context: { missing: result.missingFields },
    });
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
    return json({ ok: true, action: "insert_error_acked" });
  }

  if (result.isPartial) {
    log("inserted_partial", {
      procedure_id: result.procedureId,
      procedure_number: result.procedureNumber,
      missing: result.parsedPartial.missingFields,
    });
    await logToPanel(SUPABASE_URL, SERVICE_ROLE, {
      level: "warning",
      event: "registered_partial",
      message: `Proc #${result.procedureNumber} registrado parcialmente — campos ausentes: ${result.parsedPartial.missingFields.join(", ")}`,
      procedureNumber: result.procedureNumber,
      updateId,
      messageId,
      context: { procedure_id: result.procedureId, missing: result.parsedPartial.missingFields },
    });
    return json({
      ok: true,
      action: "registered_partial",
      procedure_id: result.procedureId,
      procedure_number: result.procedureNumber,
      missing: result.parsedPartial.missingFields,
    });
  }

  log("inserted", { procedure_id: result.procedureId, procedure_number: result.procedureNumber });
  await logToPanel(SUPABASE_URL, SERVICE_ROLE, {
    level: "info",
    event: "inserted",
    message: `Proc #${result.procedureNumber} registrado a partir do canal do Telegram.`,
    procedureNumber: result.procedureNumber,
    updateId,
    messageId,
    context: { procedure_id: result.procedureId },
  });
  await syncWithFreebetPro(supa, SUPABASE_URL, SERVICE_ROLE, result.procedureId, result.procedureNumber, updateId, messageId);

  return json({
    ok: true,
    action: "registered",
    procedure_id: result.procedureId,
    procedure_number: result.procedureNumber,
  });
});

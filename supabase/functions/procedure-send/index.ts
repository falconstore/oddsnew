// Edge Function: procedure-send
//
// Dispara a sequência completa de um procedimento no grupo do Telegram, na
// ordem do padrão Shark:
//   1. GIF de atenção (file_id fixo, reaproveitado)
//   2. Texto do procedimento
//   3. Para cada entrada: foto do bilhete (com marca d'água) + legenda
//      (casa · odd · link · observação)
//   4. Calculadora: foto do print + link
//   5. Fechamento 🦈 ✅
//
// Auth: exige Authorization Bearer (sessão do admin) — chamada a partir da aba
// Envio Procedimentos. Token do bot: PROCEDURE_SEND_BOT_TOKEN (secret).
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const log = (event: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ tag: "procedure-send", event, ...data }));

interface Entrada {
  casa: string;
  odd: string;          // ex: "45.00"
  aposte: string;       // ex: "6,50"
  link: string;         // URL da partida (vai escondida em "LINK DA PARTIDA")
  observacao?: string;
  freebet?: boolean;    // entrada é aposta grátis → "🎟️ FREEBET" na legenda
  lay?: boolean;            // entrada LAY (contra) → "LAY ODD" + responsabilidade
  responsabilidade?: string; // valor exposto na lay
  printDataUrl?: string | null; // dataURL (base64) já com marca d'água
  printUrl?: string | null;     // URL pública da imagem (fluxo de revisão; alternativa ao dataURL)
}

// Escapa caracteres especiais do HTML do Telegram.
function esc(s: string): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Monta a legenda da entrada no padrão Shark:
//   CASA - <b><u>ODD X</u></b> - <b><u>APOSTE Y</u></b>
//   (linha em branco)
//   📝 observação (se houver)
//   (linha em branco)
//   🔗 LINK DA PARTIDA  (link clicável, URL escondida)
function montarLegenda(e: Entrada): string {
  const blocos: string[] = [];
  const casa = esc(e.casa).trim().toUpperCase();   // casa sempre MAIÚSCULA
  const odd = esc(e.odd).trim();
  const aposte = esc(e.aposte).trim();
  const resp = esc(e.responsabilidade ?? "").trim();
  let principal = casa;
  // LAY: "LAY ODD X" + responsabilidade. BACK: "ODD X".
  if (odd) principal += ` - <b><u>${e.lay ? "LAY " : ""}ODD ${odd}</u></b>`;
  if (aposte) principal += ` - <b><u>APOSTE ${aposte}</u></b>`;
  if (e.lay && resp) principal += ` - <b><u>RESP. ${resp}</u></b>`;
  if (e.freebet) principal += ` - 🎟️ <b>FREEBET</b>`;
  blocos.push(principal);
  if (e.observacao && e.observacao.trim()) blocos.push(`📝 ${esc(e.observacao.trim().toUpperCase())}`);
  if (e.link && e.link.trim()) {
    blocos.push(`🔗 <a href="${esc(e.link.trim())}">LINK DA PARTIDA</a>`);
  }
  // Linha em branco entre cada bloco (principal / observação / link).
  return blocos.join("\n\n");
}

// Legenda da calculadora no padrão Shark:
//   🔗 LINK DA CALCULADORA 👆   (texto clicável, URL escondida)
//   (linha em branco)
//   🟥 <observação>             (ex.: "nesse link a calculadora já vem configurada")
const CALC_OBS_DEFAULT = "nesse link a calculadora já vem configurada";
function montarLegendaCalc(calc: { link?: string; obs?: string }): string {
  const blocos: string[] = [];
  const link = (calc.link ?? "").trim();
  if (link) {
    blocos.push(`🔗 <a href="${esc(link)}">LINK DA CALCULADORA</a> 👆`);
  }
  const obs = ((calc.obs ?? "").trim() || CALC_OBS_DEFAULT).toUpperCase();
  blocos.push(`🟥 ${esc(obs)}`);
  return blocos.join("\n\n");
}

// Legenda de uma promoção (vai na foto):
//   <DESCRIÇÃO>
//   (linha em branco)
//   <CHAMADA> (ex: "PARTICIPE DA PROMOÇÃO ✅")
//   (linha em branco)
//   🔗 LINK DA PROMOÇÃO 👆
const PROMO_CHAMADA_DEFAULT = "PARTICIPE DA PROMOÇÃO ✅";
function montarLegendaPromo(p: Promocao): string {
  const blocos: string[] = [];
  const desc = (p.descricao ?? "").trim();
  if (desc) blocos.push(esc(desc.toUpperCase()));
  const chamada = ((p.chamada ?? "").trim() || PROMO_CHAMADA_DEFAULT).toUpperCase();
  blocos.push(esc(chamada));
  const link = (p.link ?? "").trim();
  if (link) blocos.push(`🔗 <a href="${esc(link)}">LINK DA PROMOÇÃO</a> 👆`);
  return blocos.join("\n\n");
}

interface SendPayload {
  action?: "send" | "delete"; // default "send"
  chatId: string | number;
  gifFileId?: string | null;     // file_id do GIF de atenção (reuso)
  texto: string;
  entradas: Entrada[];
  calc?: { printDataUrl?: string | null; printUrl?: string | null; link?: string; obs?: string } | null;
  promocoes?: Promocao[];        // promoções (imagem + descrição + link) entre o texto e as entradas
  fechamento?: string;           // default "🦈 ✅"
  draftId?: string | null;       // rascunho aprovado a "consumir" (claim-then-send, evita reenvio)
}

interface Promocao {
  descricao?: string;
  link?: string;
  chamada?: string;
  printDataUrl?: string | null;
  printUrl?: string | null;
}

// dataURL "data:image/png;base64,XXXX" → { bytes, mime }
function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  const mime = m[1];
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, mime };
}

async function tgCall(token: string, method: string, body: unknown) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    throw new Error(`${method} falhou: ${res.status} ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data;
}

// Envia foto via multipart (a partir do dataURL base64).
async function tgSendPhoto(token: string, chatId: string | number, dataUrl: string, caption?: string) {
  const parsed = dataUrlToBytes(dataUrl);
  if (!parsed) throw new Error("dataURL inválido");
  const form = new FormData();
  form.append("chat_id", String(chatId));
  if (caption) { form.append("caption", caption); form.append("parse_mode", "HTML"); }
  const ext = parsed.mime.includes("png") ? "png" : "jpg";
  form.append("photo", new Blob([parsed.bytes], { type: parsed.mime }), `bilhete.${ext}`);
  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    throw new Error(`sendPhoto falhou: ${res.status} ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data;
}

// Envia foto a partir de uma URL pública (Telegram baixa direto). Usado no
// fluxo de revisão, onde as imagens já estão no Storage.
async function tgSendPhotoUrl(token: string, chatId: string | number, url: string, caption?: string) {
  return tgCall(token, "sendPhoto", {
    chat_id: chatId,
    photo: url,
    ...(caption ? { caption, parse_mode: "HTML" } : {}),
  });
}

// Envia a foto de uma entrada/calc escolhendo a melhor fonte disponível:
// URL pública (Storage) se houver, senão o dataURL base64. Retorna o `data` da
// API do Telegram (pra capturar o message_id) ou null se não enviou foto.
async function tgSendEntryPhoto(
  token: string,
  chatId: string | number,
  src: { printUrl?: string | null; printDataUrl?: string | null },
  caption?: string,
): Promise<any | null> {
  if (src.printUrl) return await tgSendPhotoUrl(token, chatId, src.printUrl, caption);
  if (src.printDataUrl) return await tgSendPhoto(token, chatId, src.printDataUrl, caption);
  return null;
}

// Extrai o message_id de uma resposta da API do Telegram (se houver).
function msgId(data: any): number | null {
  const id = data?.result?.message_id;
  return typeof id === "number" ? id : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, { status: 405 });

  // Auth: precisa de um Bearer (sessão do admin que chama da aba).
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, { status: 401 });

  const token = Deno.env.get("PROCEDURE_SEND_BOT_TOKEN");
  if (!token) {
    log("config_error", { missing: "PROCEDURE_SEND_BOT_TOKEN" });
    return json({ error: "bot token não configurado (PROCEDURE_SEND_BOT_TOKEN)" }, { status: 500 });
  }

  let payload: SendPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "body inválido" }, { status: 400 });
  }

  // ── DELETE: apaga do grupo todas as mensagens que o procedimento gerou ──
  if (payload.action === "delete") {
    const delDraftId = payload.draftId;
    if (!delDraftId) return json({ error: "draftId obrigatório" }, { status: 400 });
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return json({ error: "config do servidor incompleta" }, { status: 500 });
    }
    const supaDel = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const { data: draft, error: readErr } = await supaDel
      .from("procedure_drafts")
      .select("sent_chat_id, sent_message_ids")
      .eq("id", delDraftId)
      .single();
    if (readErr) return json({ ok: false, error: `rascunho não encontrado: ${readErr.message}` }, { status: 404 });

    const ids: number[] = Array.isArray(draft?.sent_message_ids) ? draft.sent_message_ids : [];
    const delChatId = draft?.sent_chat_id;
    if (!delChatId || ids.length === 0) {
      return json({ ok: false, error: "não há mensagens registradas pra apagar (envio anterior à atualização?)", noMessages: true }, { status: 409 });
    }

    let apagadas = 0;
    const falhas: { id: number; error: string }[] = [];
    for (const id of ids) {
      try {
        await tgCall(token, "deleteMessage", { chat_id: delChatId, message_id: id });
        apagadas++;
      } catch (e: any) {
        // Telegram só deixa apagar msgs com < 48h e se o bot for admin c/ permissão.
        falhas.push({ id, error: e?.message ?? "erro" });
      }
    }

    await supaDel
      .from("procedure_drafts")
      .update({ deleted_from_telegram_at: new Date().toISOString() })
      .eq("id", delDraftId);

    log("deleted", { draftId: delDraftId, apagadas, falhas: falhas.length });
    return json({ ok: true, apagadas, total: ids.length, falhas });
  }

  const { chatId, gifFileId, texto, entradas = [], calc, fechamento, draftId, promocoes = [] } = payload;
  if (!chatId) return json({ error: "chatId obrigatório" }, { status: 400 });
  if (!texto?.trim()) return json({ error: "texto obrigatório" }, { status: 400 });

  // Client service_role (pro claim e pra salvar os message_id). Só criado se
  // houver draftId (envios avulsos sem rascunho não precisam de DB).
  let supa: any = null;
  if (draftId) {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      log("config_error", { missing: "SUPABASE creds (claim)" });
      return json({ error: "config do servidor incompleta" }, { status: 500 });
    }
    supa = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // CLAIM-THEN-SEND: "consome" o rascunho aprovado ANTES de disparar — marca
    // status=enviado de forma atômica só se ainda estiver 'aprovado'. Se 0
    // linhas mudarem, já foi enviado: abortamos pra não duplicar no grupo.
    const { data: claimed, error: claimErr } = await supa
      .from("procedure_drafts")
      .update({ status: "enviado", sent_at: new Date().toISOString() })
      .eq("id", draftId)
      .eq("status", "aprovado")
      .select("id");
    if (claimErr) {
      log("claim_error", { draftId, error: claimErr.message });
      return json({ ok: false, error: `falha ao reservar o rascunho: ${claimErr.message}` }, { status: 500 });
    }
    if (!claimed || claimed.length === 0) {
      log("claim_noop", { draftId });
      return json({ ok: false, error: "rascunho já foi enviado ou não está aprovado", alreadySent: true }, { status: 409 });
    }
  }

  const sent: string[] = [];
  const messageIds: number[] = [];  // ids das mensagens criadas no grupo (pra apagar depois)
  const collect = (data: any) => { const id = msgId(data); if (id != null) messageIds.push(id); };
  try {
    // 1) GIF de atenção (se houver file_id)
    if (gifFileId) {
      collect(await tgCall(token, "sendAnimation", { chat_id: chatId, animation: gifFileId }));
      sent.push("gif");
    }

    // Separador 🦈🔥 entre os blocos da sequência (texto → promoções →
    // entradas → calculadora). Disparado ANTES de cada bloco a partir do 2º.
    let jaTeveBloco = false;
    const sep = async () => {
      if (jaTeveBloco) {
        collect(await tgCall(token, "sendMessage", { chat_id: chatId, text: "🦈🔥" }));
        sent.push("sep");
      }
    };

    // 2) Texto do procedimento — sempre em MAIÚSCULA (padrão Shark).
    collect(await tgCall(token, "sendMessage", { chat_id: chatId, text: (texto ?? "").toUpperCase() }));
    sent.push("texto");
    jaTeveBloco = true;

    // 2.5) Promoções — entre o texto e as entradas. Imagem com legenda
    //      (descrição + chamada + link). Se a legenda passar do limite do
    //      Telegram (1024), manda a imagem sem legenda + o texto separado.
    const TG_CAPTION_LIMIT = 1024;
    for (let i = 0; i < promocoes.length; i++) {
      const p = promocoes[i];
      const legenda = montarLegendaPromo(p);
      const temImagem = !!(p.printUrl || p.printDataUrl);
      await sep();
      if (temImagem) {
        if (legenda.length <= TG_CAPTION_LIMIT) {
          collect(await tgSendEntryPhoto(token, chatId, p, legenda));
        } else {
          // Legenda grande: imagem sem caption + texto numa mensagem à parte.
          collect(await tgSendEntryPhoto(token, chatId, p, undefined));
          collect(await tgCall(token, "sendMessage", { chat_id: chatId, text: legenda, parse_mode: "HTML" }));
        }
      } else if (legenda) {
        // Sem imagem: só o texto (descrição + chamada + link).
        collect(await tgCall(token, "sendMessage", { chat_id: chatId, text: legenda, parse_mode: "HTML" }));
      }
      sent.push(`promo_${i + 1}`);
    }

    // 3) Entradas — foto (se houver) com legenda; separador 🦈🔥 antes de cada.
    for (let i = 0; i < entradas.length; i++) {
      const e = entradas[i];
      const caption = montarLegenda(e);
      await sep();
      const photoData = await tgSendEntryPhoto(token, chatId, e, caption);
      if (photoData) {
        collect(photoData);
      } else if (caption) {
        collect(await tgCall(token, "sendMessage", { chat_id: chatId, text: caption, parse_mode: "HTML" }));
      }
      sent.push(`entrada_${i + 1}`);
    }

    // 4) Calculadora — padrão: "🔗 LINK DA CALCULADORA 👆" + frase de orientação.
    if (calc) {
      await sep();
      const capCalc = montarLegendaCalc(calc);
      const calcData = await tgSendEntryPhoto(token, chatId, calc, capCalc);
      if (calcData) {
        collect(calcData);
      } else {
        // Sem print: manda só a legenda (link clicável + frase).
        collect(await tgCall(token, "sendMessage", { chat_id: chatId, text: capCalc, parse_mode: "HTML" }));
      }
      sent.push("calc");
    }

    // 5) Fechamento
    collect(await tgCall(token, "sendMessage", { chat_id: chatId, text: fechamento || "🦈 ✅" }));
    sent.push("fechamento");

    // Salva os message_id no draft (pra permitir "Excluir do Telegram" depois).
    if (supa && draftId) {
      const { error: saveErr } = await supa
        .from("procedure_drafts")
        .update({ sent_chat_id: chatId, sent_message_ids: messageIds })
        .eq("id", draftId);
      if (saveErr) log("save_msgids_error", { draftId, error: saveErr.message });
    }

    log("sent_ok", { chatId, count: sent.length, messageIds: messageIds.length });
    return json({ ok: true, sent });
  } catch (e: any) {
    log("send_error", { error: e?.message, sentSoFar: sent });
    return json({ ok: false, error: e?.message ?? "erro no envio", sent }, { status: 500 });
  }
});

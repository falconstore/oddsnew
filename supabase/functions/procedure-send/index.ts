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
import { corsHeaders, json } from "../_shared/cors.ts";

const log = (event: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ tag: "procedure-send", event, ...data }));

interface Entrada {
  casa: string;
  odd: string;          // ex: "45.00"
  aposte: string;       // ex: "6,50"
  link: string;         // URL da partida (vai escondida em "LINK DA PARTIDA")
  observacao?: string;
  printDataUrl?: string | null; // dataURL (base64) já com marca d'água
}

// Escapa caracteres especiais do HTML do Telegram.
function esc(s: string): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Monta a legenda da entrada no padrão Shark:
//   Casa - <b><u>ODD X</u></b> - APOSTE <b><u>Y</u></b>
//   📝 observação (se houver)
//   🔗 LINK DA PARTIDA  (link clicável, URL escondida)
function montarLegenda(e: Entrada): string {
  const linhas: string[] = [];
  const casa = esc(e.casa).trim();
  const odd = esc(e.odd).trim();
  const aposte = esc(e.aposte).trim();
  let principal = casa;
  if (odd) principal += ` - <b><u>ODD ${odd}</u></b>`;
  if (aposte) principal += ` - APOSTE <b><u>${aposte}</u></b>`;
  linhas.push(principal);
  if (e.observacao && e.observacao.trim()) linhas.push(`📝 ${esc(e.observacao.trim())}`);
  if (e.link && e.link.trim()) {
    linhas.push(`🔗 <a href="${esc(e.link.trim())}">LINK DA PARTIDA</a>`);
  }
  return linhas.join("\n");
}

interface SendPayload {
  chatId: string | number;
  gifFileId?: string | null;     // file_id do GIF de atenção (reuso)
  texto: string;
  entradas: Entrada[];
  calc?: { printDataUrl?: string | null; link?: string } | null;
  fechamento?: string;           // default "🦈 ✅"
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

  const { chatId, gifFileId, texto, entradas = [], calc, fechamento } = payload;
  if (!chatId) return json({ error: "chatId obrigatório" }, { status: 400 });
  if (!texto?.trim()) return json({ error: "texto obrigatório" }, { status: 400 });

  const sent: string[] = [];
  try {
    // 1) GIF de atenção (se houver file_id)
    if (gifFileId) {
      await tgCall(token, "sendAnimation", { chat_id: chatId, animation: gifFileId });
      sent.push("gif");
    }

    // 2) Texto do procedimento
    await tgCall(token, "sendMessage", { chat_id: chatId, text: texto });
    sent.push("texto");

    // 3) Entradas — foto (se houver) com legenda; separador 🦈🔥 entre elas.
    for (let i = 0; i < entradas.length; i++) {
      const e = entradas[i];
      const caption = montarLegenda(e);
      if (e.printDataUrl) {
        await tgSendPhoto(token, chatId, e.printDataUrl, caption);
      } else if (caption) {
        await tgCall(token, "sendMessage", { chat_id: chatId, text: caption, parse_mode: "HTML" });
      }
      sent.push(`entrada_${i + 1}`);
      // Separador entre entradas (não após a última — depois vem a calc/fecho).
      if (i < entradas.length - 1) {
        await tgCall(token, "sendMessage", { chat_id: chatId, text: "🦈🔥" });
        sent.push(`sep_${i + 1}`);
      }
    }

    // 4) Calculadora
    if (calc) {
      const capCalc = calc.link ? `🧮 <b>CALCULADORA</b>\n🔗 ${calc.link}` : `🧮 <b>CALCULADORA</b>`;
      if (calc.printDataUrl) {
        await tgSendPhoto(token, chatId, calc.printDataUrl, capCalc);
      } else if (calc.link) {
        await tgCall(token, "sendMessage", { chat_id: chatId, text: capCalc, parse_mode: "HTML" });
      }
      sent.push("calc");
    }

    // 5) Fechamento
    await tgCall(token, "sendMessage", { chat_id: chatId, text: fechamento || "🦈 ✅" });
    sent.push("fechamento");

    log("sent_ok", { chatId, count: sent.length });
    return json({ ok: true, sent });
  } catch (e: any) {
    log("send_error", { error: e?.message, sentSoFar: sent });
    return json({ ok: false, error: e?.message ?? "erro no envio", sent }, { status: 500 });
  }
});

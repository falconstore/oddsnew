// Edge Function: procedure-open-report
//
// Monta e envia ao Telegram um relatório dos procedimentos EM ABERTO
// (status "Enviada Partida em Aberto", archived=false). Lista corrida
// ordenada por número, cada linha:
//
//   <emoji da categoria> <b><a href="link">Nº</a></b> — Casa — Categoria
//
// O número é link clicável (telegram_link) e negrito (parse_mode HTML).
// Se a lista passar do limite de 4096 chars do Telegram, é fatiada em
// várias mensagens (cabeçalho só na 1ª, "(continua…)" nas seguintes).
//
// DISPARO:
//   - Botão no admin (aba Procedimentos) → POST { chatId } com a sessão.
//   - Cron horário (pg_cron) → POST {} com Bearer <secret>; usa o chat default.
//
// Auth: verify_jwt=true (config.toml) — a plataforma Supabase valida o JWT do
// app ANTES da função rodar, então basta exigir um Bearer presente. Imune à
// rotação de chaves do projeto (não comparamos a chave crua). O cron passa a
// service_role do Vault, que a plataforma também valida.
// Bot token: PROCEDURE_SEND_BOT_TOKEN (o mesmo que posta procedimentos).
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const log = (event: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ tag: "procedure-open-report", event, ...data }));

// Grupo de teste "GRUPO PRÉ ENVIO 🦈🔥" — destino padrão (cron e botão).
// Trocar para o VIP é só mudar este valor (ou passar chatId no body).
const DEFAULT_CHAT_ID = -1002197121868;

const TG_LIMIT = 3800; // folga sob o limite real de 4096 do Telegram

// Escapa caracteres especiais do HTML do Telegram.
function esc(s: string): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Title Case simples (a casa/categoria vêm com grafia inconsistente no banco:
// "PROMOÇÃO", "Promoção", "SUPERODD"...). Mantém siglas curtas em maiúscula.
function titleCase(s: string): string {
  const t = (s ?? "").trim();
  if (!t) return t;
  return t
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

// Emoji por categoria (bate o olho). Normaliza removendo acento/caixa.
function emojiCategoria(cat: string): string {
  const c = (cat ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (c.includes("superodd")) return "🔵";
  if (c.includes("super aumento") || c.includes("aumento")) return "🟢";
  if (c.includes("aposta sem risco") || c === "asr") return "🛡️";
  if (c.includes("cashback")) return "💸";
  if (c.includes("freebet")) return "🎟️";
  if (c.includes("giros")) return "🎰";
  if (c.includes("extra")) return "🔁";
  if (c.includes("promo")) return "🟢";
  return "📌";
}

// Ordena por prefixo numérico do procedure_number ("751", "751 EXTRA" → 751);
// fallback alfabético quando não há dígito.
function numKey(n: string | null): number {
  const m = (n ?? "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
}

function dataBR(): string {
  // Data de hoje em America/Sao_Paulo (UTC-3) no formato DD/MM/AAAA.
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return fmt.format(new Date());
}

// Primeiro dia do mês corrente (horário de Brasília) como "YYYY-MM-01".
// Usado pra filtrar só os procedimentos criados no mês atual.
function inicioMesBR(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const ano = partes.find((p) => p.type === "year")!.value;
  const mes = partes.find((p) => p.type === "month")!.value;
  return `${ano}-${mes}-01`;
}

interface Row {
  procedure_number: string | null;
  platform: string | null;
  category: string | null;
  telegram_link: string | null;
}

function montarLinha(r: Row): string {
  const num = (r.procedure_number ?? "?").trim();
  const casa = titleCase(r.platform ?? "—");
  const cat = titleCase(r.category ?? "—");
  const emoji = emojiCategoria(r.category ?? "");
  // Número em negrito; vira link clicável se houver telegram_link.
  const link = (r.telegram_link ?? "").trim();
  const numHtml = link
    ? `<b><a href="${esc(link)}">${esc(num)}</a></b>`
    : `<b>${esc(num)}</b>`;
  return `${emoji} ${numHtml} — ${esc(casa)} — ${esc(cat)}`;
}

// Fatiamento: agrupa linhas em mensagens ≤ TG_LIMIT. Cabeçalho só na 1ª.
function fatiar(header: string, linhas: string[]): string[] {
  if (linhas.length === 0) return [header];
  const msgs: string[] = [];
  let buf = header;
  for (const linha of linhas) {
    if ((buf + "\n" + linha).length > TG_LIMIT) {
      msgs.push(buf);
      buf = "(continua…)\n" + linha;
    } else {
      buf += "\n" + linha;
    }
  }
  if (buf) msgs.push(buf);
  return msgs;
}

async function tgSend(token: string, chatId: number | string, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    throw new Error(`sendMessage falhou: ${res.status} ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // ---- Auth: basta um Bearer presente ----
  // verify_jwt=true faz a plataforma Supabase validar o JWT do app antes de
  // chegar aqui; o cron passa a service_role do Vault (também válida). Não
  // comparamos a chave crua — imune à rotação de chaves do projeto.
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    log("unauthorized", {});
    return json({ error: "unauthorized" }, { status: 401 });
  }
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const token = Deno.env.get("PROCEDURE_SEND_BOT_TOKEN");
  if (!token) return json({ error: "PROCEDURE_SEND_BOT_TOKEN missing" }, { status: 500 });

  try {
    const body = await req.json().catch(() => ({}));
    const chatId = (body?.chatId ?? DEFAULT_CHAT_ID) as number | string;

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, {
      auth: { persistSession: false },
    });

    // "Em aberto" = status "Enviada Partida em Aberto" (case-insensitive, pega
    // a variação com "p" minúsculo) e não arquivado. Filtra só o MÊS CORRENTE
    // por created_date (mês de criação no sistema; a coluna `date` tem datas
    // de partida com erros de digitação, então não serve pra esse corte).
    const inicioMes = inicioMesBR();
    const { data, error } = await supa
      .from("procedures")
      .select("procedure_number, platform, category, telegram_link, status, archived, created_date")
      .ilike("status", "Enviada Partida em Aberto")
      .eq("archived", false)
      .gte("created_date", inicioMes);
    if (error) {
      log("query_error", { err: error.message });
      return json({ error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as (Row & { status: string; archived: boolean; created_date: string })[];
    rows.sort((a, b) => numKey(a.procedure_number) - numKey(b.procedure_number));

    const total = rows.length;
    const header =
      `🦈 <b>PROCEDIMENTOS EM ABERTO</b> — ${dataBR()}\n` +
      `📊 ${total} em aberto no mês`;

    if (total === 0) {
      await tgSend(token, chatId, `${header}\n\n✅ Nenhum procedimento em aberto no momento.`);
      log("sent_empty", { chatId });
      return json({ ok: true, total: 0, messages: 1 });
    }

    const linhas = rows.map(montarLinha);
    const msgs = fatiar(header, linhas);

    for (const m of msgs) {
      await tgSend(token, chatId, m);
    }

    log("sent", { chatId, total, messages: msgs.length });
    return json({ ok: true, total, messages: msgs.length });
  } catch (e: any) {
    log("crash", { err: e?.message, stack: e?.stack?.slice(0, 400) });
    return json({ error: e?.message ?? "internal" }, { status: 500 });
  }
});

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

// Preposições/conectores que ficam em minúsculo no meio de nomes de casas
// (ex.: "Bolsa de Aposta", "Esporte da Sorte", "Jogo de Ouro").
const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e"]);

// Title Case (a casa/categoria vêm com grafia inconsistente no banco:
// "PROMOÇÃO", "Promoção", "SUPERODD"...). Capitaliza cada palavra, mas mantém
// preposições em minúsculo — exceto quando são a 1ª palavra.
function titleCase(s: string): string {
  const t = (s ?? "").trim();
  if (!t) return t;
  return t
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) =>
      i > 0 && MINUSCULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ");
}

// Emoji por categoria (bate o olho). Normaliza removendo acento/caixa.
function emojiCategoria(cat: string): string {
  const c = (cat ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  // Tudo bolinha colorida — a cor identifica a categoria (mais fácil de bater
  // o olho que ícones variados).
  if (c.includes("superodd")) return "🔵";              // azul
  if (c.includes("super aumento") || c.includes("aumento")) return "🟢"; // verde
  if (c.includes("aposta sem risco") || c === "asr") return "🟠"; // laranja
  if (c.includes("cashback")) return "🟣";              // roxo
  if (c.includes("freebet")) return "🟡";               // amarelo
  if (c.includes("giros")) return "⚪";                 // branco
  if (c.includes("extra")) return "🔴";                 // vermelho
  if (c.includes("promo")) return "🟢";                 // verde
  return "⚫";                                          // outras
}

// Ordena por prefixo numérico do procedure_number ("751", "751 EXTRA" → 751);
// fallback alfabético quando não há dígito.
function numKey(n: string | null): number {
  const m = (n ?? "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
}

// Chave de data (só o dia, "YYYY-MM-DD") pra ordenar por data de envio. Linhas
// do mesmo dia caem na mesma chave e são desempatadas pelo número.
function dateKey(iso: string | null): string {
  return (iso ?? "").slice(0, 10) || "9999-99-99"; // sem data vai pro fim
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

// Primeiro dia do MÊS ANTERIOR (horário de Brasília) como "YYYY-MM-01".
// Início da janela do relatório: DIAS_JANELA dias atrás, como "YYYY-MM-DD"
// (UTC puro, coerente com como o created_date é gravado — meia-noite UTC do
// dia). Cobre a virada de mês naturalmente.
const DIAS_JANELA = 90;
function inicioJanelaISO(): string {
  const agora = new Date();
  const inicio = new Date(agora.getTime() - DIAS_JANELA * 24 * 60 * 60 * 1000);
  return inicio.toISOString().slice(0, 10); // YYYY-MM-DD
}

// Formata uma data ISO (created_date) como DD/MM/AAAA em horário de Brasília.
function fmtDataEnvio(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

interface Row {
  procedure_number: string | null;
  platform: string | null;
  category: string | null;
  promotion_name: string | null;
  telegram_link: string | null;
  created_date: string | null;
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
  // Data de envio (created_date) ao lado do número, DD/MM/AAAA.
  const data = fmtDataEnvio(r.created_date);
  const dataHtml = data ? ` · ${data}` : "";
  let linha = `${emoji} ${numHtml}${dataHtml} — ${esc(casa)} — ${esc(cat)}`;
  // Nome (promotion_name) numa 2ª linha indentada, em itálico — só em Promoção
  // e Super Aumento, onde o nome agrega ("Promoção da Sportybet - Missão...",
  // "Super Aumento de 30%"). Em Superodd/Freebet o nome é redundante.
  const catNorm = (r.category ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const mostraNome = catNorm.includes("promo") || catNorm.includes("aumento");
  const promo = titleCase((r.promotion_name ?? "").trim());
  if (mostraNome && promo) linha += `\n     ↳ <i>${esc(promo)}</i>`;
  return linha;
}

// Fatiamento: agrupa os blocos (cada procedimento) em mensagens ≤ TG_LIMIT,
// separando-os por uma LINHA EM BRANCO. Cabeçalho só na 1ª mensagem.
function fatiar(header: string, blocos: string[]): string[] {
  if (blocos.length === 0) return [header];
  const msgs: string[] = [];
  let buf = header;
  for (const bloco of blocos) {
    // separador: linha em branco entre cabeçalho/itens e entre itens
    if ((buf + "\n\n" + bloco).length > TG_LIMIT) {
      msgs.push(buf);
      buf = "(continua…)\n\n" + bloco;
    } else {
      buf += "\n\n" + bloco;
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
    // a variação com "p" minúsculo) e não arquivado. Filtra os últimos 90 dias
    // por created_date (mês de criação; a coluna `date` tem datas de partida
    // com erros de digitação, então não serve). A janela de 90 dias cobre a
    // virada de mês naturalmente.
    const inicioJanela = inicioJanelaISO();
    const { data, error } = await supa
      .from("procedures")
      .select("procedure_number, platform, category, promotion_name, telegram_link, status, archived, created_date")
      .ilike("status", "Enviada Partida em Aberto")
      .eq("archived", false)
      .gte("created_date", inicioJanela);
    if (error) {
      log("query_error", { err: error.message });
      return json({ error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as (Row & { status: string; archived: boolean })[];
    // Ordena por DATA de envio (mais antigos primeiro) e, no mesmo dia, por
    // número do procedimento.
    rows.sort((a, b) => {
      const da = dateKey(a.created_date);
      const db = dateKey(b.created_date);
      if (da !== db) return da < db ? -1 : 1;
      return numKey(a.procedure_number) - numKey(b.procedure_number);
    });

    const total = rows.length;
    const plural = total === 1 ? "Procedimento em Aberto" : "Procedimentos em Aberto";
    const header =
      `🦈 <b>PROCEDIMENTOS EM ABERTO</b> — ${dataBR()}\n` +
      `📊 ${total} ${plural}`;

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

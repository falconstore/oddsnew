// Edge Function: zapi-reply
// Recebe o webhook de mensagens recebidas do Z-API e conduz o funil:
//
//   1. Lead manda qualquer mensagem → responde com mensagem de boas-vindas
//      + menu de 3 botões:
//        [1] Telegram VIP   [2] App VIP Shark   [3] Os Dois
//
//   2. Lead responde com ID do botão → envia o conteúdo correspondente:
//      - Telegram: link do grupo
//      - App: login + senha + botões Android/iPhone
//      - Os Dois: telegram imediatamente, app com 3s de delay
//
// Configuração no painel Z-API:
//   Webhook de mensagens recebidas → apontar para esta função
//
// Secrets necessários (já devem estar no projeto):
//   ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   ZAPI_WEBHOOK_TOKEN  (opcional, para validar chamadas)
//
// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendZApiText, sendZApiButtonList } from "../_shared/zapi.ts";
import { corsHeaders } from "../_shared/cors.ts";

const log = (event: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ tag: "zapi-reply", event, ...data }));

// URLs dos apps — podem ser overridden por env vars
const APK_URL   = Deno.env.get("ZAPI_APK_URL")   || "https://sharkgreen.com.br/download/sharkgreen.apk";
const PWA_URL   = Deno.env.get("ZAPI_PWA_URL")   || "https://sharkgreen.com.br/app";

// Mensagem de boas-vindas aleatória (variação para parecer humano)
const WELCOME_VARIANTS = [
  "Oi, tudo bem? 😊\n\nAqui é a equipe do *Shark Green* 🦈\n\nVi que você se cadastrou no nosso trial de 7 dias — seja muito bem-vindo(a)!\n\nVocê tem acesso gratuito e completo ao sistema, sem precisar de cartão. Isso inclui:\n\n🟢 *Grupo Telegram VIP* — onde caem os sinais em tempo real\n📱 *App VIP Shark* — nosso app exclusivo com painel completo\n\nO que você gostaria de acessar agora?",
  "E aí! Que bom ter você aqui! 🎉\n\nSomos a equipe do *Shark Green* 🦈\n\nSeu acesso de *7 dias grátis* está liberado — sem cartão, sem compromisso.\n\nVocê tem direito a:\n\n📲 *App VIP Shark* — painel completo no celular\n💬 *Grupo Telegram VIP* — sinais em tempo real\n\nPor onde quer começar?",
  "Olá! Bem-vindo(a) ao trial do *Shark Green* 🦈✅\n\nSeu acesso de *7 dias gratuitos* está ativo agora mesmo — sem cartão e sem burocracia.\n\nVocê pode acessar:\n\n🔥 *Grupo VIP no Telegram* — sinais ao vivo\n🚀 *App VIP Shark* — controle total no celular\n\nEscolha o que deseja:",
];

function randomWelcome(): string {
  return WELCOME_VARIANTS[Math.floor(Math.random() * WELCOME_VARIANTS.length)];
}

const MENU_BUTTONS = [
  { id: "opt_telegram", label: "📲 Telegram VIP" },
  { id: "opt_app",      label: "📱 App VIP Shark" },
  { id: "opt_both",     label: "🎯 Os Dois" },
];

async function sendMenu(phone: string): Promise<void> {
  await sendZApiButtonList({
    phone,
    message: randomWelcome(),
    buttonList: { buttons: MENU_BUTTONS },
  });
}

function buildAppMessage(email: string, password: string): string {
  return [
    `📱 *Acesso ao App VIP Shark* 🦈`,
    ``,
    `Aqui estão suas credenciais de acesso:`,
    ``,
    `👤 *Login (e-mail):*`,
    `${email}`,
    ``,
    `🔑 *Senha inicial:*`,
    `${password}`,
    ``,
    `_Na primeira entrada você será solicitado a criar uma nova senha._`,
    ``,
    `Baixe o app agora:`,
    ``,
    `🤖 *Android:*`,
    `${APK_URL}`,
    ``,
    `🍎 *iPhone (instalar via Safari):*`,
    `${PWA_URL}`,
    ``,
    `_Pelo iPhone: abra o link no Safari → toque no ícone de compartilhar → "Adicionar à Tela de Início" ✅_`,
  ].join("\n");
}

function buildTelegramMessage(inviteLink: string): string {
  return [
    `💬 *Grupo Telegram VIP* 🦈`,
    ``,
    `Acesse agora o grupo com os sinais em tempo real:`,
    ``,
    `👉 ${inviteLink}`,
    ``,
    `_Este link é exclusivo para você — não compartilhe com ninguém fora do trial._`,
  ].join("\n");
}

// Delay helper — usamos pra enviar mensagens com intervalo (parecer mais humano)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  // Validação de token opcional
  const webhookToken = Deno.env.get("ZAPI_WEBHOOK_TOKEN");
  if (webhookToken) {
    const url = new URL(req.url);
    const provided = url.searchParams.get("token") ?? req.headers.get("x-zapi-token");
    if (provided !== webhookToken) {
      log("forbidden", { has_token: !!provided });
      return new Response("forbidden", { status: 403 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }

  // Z-API envia vários tipos de evento — só queremos mensagens recebidas
  // (fromMe = false) e não de grupos (isGroup = false)
  const fromMe  = Boolean(payload.fromMe);
  const isGroup = Boolean(payload.isGroup);
  const phone   = String(payload.phone ?? "").replace(/\D/g, "");
  const text    = String(
    (payload as any).text?.message ??
    (payload as any).buttonResponseMessage?.selectedButtonId ??
    (payload as any).listResponseMessage?.singleSelectReply?.selectedRowId ??
    ""
  ).trim();

  if (fromMe || isGroup || !phone) {
    log("ignored", { fromMe, isGroup, phone: phone.slice(0, 6) });
    return new Response(JSON.stringify({ ok: true, action: "ignored" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  log("received", { phone: phone.slice(0, 6) + "****", text: text.slice(0, 50) });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Busca estado da conversa
  const { data: stateRow } = await supabase
    .from("zapi_conversation_state")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  const step: string = stateRow?.step ?? "initial";
  const leadId: string | null = stateRow?.lead_id ?? null;

  // ── Resposta a botão selecionado ──────────────────────────────────────────
  if (step === "awaiting_choice") {
    const choice = text; // id do botão: opt_telegram | opt_app | opt_both

    // Busca dados do lead para montar mensagens
    let inviteLink: string | null = null;
    let email: string | null = null;
    let password: string | null = null;

    if (leadId) {
      const { data: lead } = await supabase
        .from("trial_leads")
        .select("invite_link, email, whatsapp")
        .eq("id", leadId)
        .maybeSingle();
      if (lead) {
        inviteLink = lead.invite_link ?? null;
        email      = lead.email ?? null;
        password   = lead.whatsapp ?? null; // senha inicial = whatsapp
      }
    }

    // Fallback se não achou o lead pelo estado — tenta pelo phone
    if (!inviteLink || !email) {
      const { data: lead } = await supabase
        .from("trial_leads")
        .select("id, invite_link, email, whatsapp")
        .eq("whatsapp", phone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lead) {
        inviteLink = lead.invite_link ?? null;
        email      = lead.email ?? null;
        password   = lead.whatsapp ?? null;
      }
    }

    if (choice === "opt_telegram" || choice === "opt_both") {
      if (inviteLink) {
        await sendZApiText({ phone, message: buildTelegramMessage(inviteLink) });
      } else {
        await sendZApiText({ phone, message: "💬 *Grupo Telegram VIP*\n\nSeu link de acesso está sendo gerado! Em instantes você recebe aqui. 🦈" });
      }
    }

    if (choice === "opt_both") {
      // Para "os dois", aguarda 4 segundos antes de enviar o segundo para não parecer robô
      await sleep(4000);
    }

    if (choice === "opt_app" || choice === "opt_both") {
      if (email && password) {
        await sendZApiText({ phone, message: buildAppMessage(email, password) });
      } else {
        await sendZApiText({ phone, message: "📱 *App VIP Shark*\n\nSuas credenciais estão sendo processadas! Em instantes você recebe aqui. 🦈" });
      }
    }

    if (choice !== "opt_telegram" && choice !== "opt_app" && choice !== "opt_both") {
      // Não reconheceu — reenvia o menu
      await sendMenu(phone);
      return new Response(JSON.stringify({ ok: true, action: "menu-resent" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Marca como concluído
    await supabase
      .from("zapi_conversation_state")
      .upsert({ phone, step: "done", lead_id: leadId, updated_at: new Date().toISOString() }, { onConflict: "phone" });

    log("choice-handled", { phone: phone.slice(0, 6) + "****", choice });
    return new Response(JSON.stringify({ ok: true, action: "choice", choice }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Se estiver em awaiting_choice mas mandou texto (não botão), ignora ───
  // Evita reenviar o menu quando o webhook chega duplicado ou o lead manda
  // texto em vez de clicar no botão.
  if (step === "awaiting_choice") {
    log("awaiting-text-ignored", { phone: phone.slice(0, 6) + "****" });
    return new Response(JSON.stringify({ ok: true, action: "awaiting-ignored" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Primeira mensagem (ou estado "done" reinicia) ─────────────────────────
  // Tenta casar o lead pelo número de WhatsApp
  let resolvedLeadId = leadId;
  if (!resolvedLeadId) {
    const { data: lead } = await supabase
      .from("trial_leads")
      .select("id")
      .eq("whatsapp", phone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lead) resolvedLeadId = lead.id;
  }

  // Envia o menu
  await sendMenu(phone);

  // Salva/atualiza estado como "awaiting_choice"
  await supabase
    .from("zapi_conversation_state")
    .upsert(
      { phone, step: "awaiting_choice", lead_id: resolvedLeadId, updated_at: new Date().toISOString() },
      { onConflict: "phone" }
    );

  log("menu-sent", { phone: phone.slice(0, 6) + "****", lead_id: resolvedLeadId });
  return new Response(JSON.stringify({ ok: true, action: "menu-sent" }), {
    headers: { "Content-Type": "application/json" },
  });
});

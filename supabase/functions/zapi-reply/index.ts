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
import { sendZApiText, sendZApiButtonList, sendZApiVideo } from "../_shared/zapi.ts";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Gera todas as variantes de lookup para um número de telefone.
 * Cobre: com/sem prefixo 55 E números BR antigos de 8 dígitos
 * (Z-API omite o "9" extra; o lead foi cadastrado com ele).
 *
 * Exemplos:
 *   "559981717256" → ["559981717256","9981717256","99981717256"]
 *   "5513981822756" → ["5513981822756","13981822756"]
 */
function buildPhoneVariants(phone: string): string[] {
  const variants = new Set<string>();
  variants.add(phone);
  if (phone.startsWith("55") && phone.length >= 12) {
    const local = phone.slice(2); // sem prefixo 55
    variants.add(local);
    // Número BR antigo de 8 dígitos (DDD 2 chars + 8 dígitos = 10 total)
    // → tenta inserir "9" após o DDD para casar com cadastros de 11 dígitos
    if (local.length === 10) {
      variants.add(local.slice(0, 2) + "9" + local.slice(2));
    }
  }
  return [...variants];
}

const log = (event: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ tag: "zapi-reply", event, ...data }));

// URLs dos apps — podem ser overridden por env vars
const APK_URL   = Deno.env.get("ZAPI_APK_URL")   || "https://sharkgreen.com.br/download/sharkgreen.apk";
const PWA_URL   = Deno.env.get("ZAPI_PWA_URL")   || "https://sharkgreen.com.br/app";

// System prompt do Claude para o modo atendimento IA no WhatsApp
const WA_AI_SYSTEM_PROMPT = `Você é Lucas, atendente humano da equipe Shark Green. Responda SEMPRE em português brasileiro informal, como um amigo que entende de apostas esportivas. Tom: parceiro, direto, sem enrolação.

REGRA ABSOLUTA: máximo 3 frases curtas por resposta. Sem listas, sem bullets. Uma ideia por vez.
NUNCA diga que é IA ou robô — você é da equipe, ponto final.

O QUE É O SHARK GREEN: plataforma de procedimentos de apostas esportivas. Os membros recebem sinais em tempo real no app com instruções passo a passo pra aproveitar promoções (freebets, bônus) nas casas de apostas parceiras. Objetivo: lucro consistente de R$ 200/dia seguindo os procedimentos.

ACESSO AO APP: login = email cadastrado, senha = número do celular (só dígitos, sem espaço ou traço).
ACESSO AO TELEGRAM: precisa baixar o Telegram e clicar no link de convite exclusivo enviado aqui no WhatsApp.
PLANOS: Mensal R$ 148,90 / Anual R$ 893,90. Link: https://lastlink.com/p/CEAEE6585/checkout-payment

DÚVIDAS COMUNS:
- Não consegue entrar no app → login = email cadastrado, senha = celular (só dígitos)
- Telegram não funciona → precisa baixar o app Telegram + clicar no link de convite que foi enviado aqui
- Não vê procedimentos → acesso pode ter expirado, orienta assinar
- Freebet não apareceu → normal até 24h após executar o procedimento
- Como sacar? → O lucro fica na conta da casa de apostas, saque direto de lá

LIMITAÇÕES IMPORTANTES — NUNCA ignore estas regras:
- NUNCA prometa reenviar, buscar ou gerar um link do Telegram — você não tem acesso ao sistema para fazer isso.
- Se o usuário não recebeu o link do Telegram, mande ele rolar essa conversa e clicar de novo no botão "📲 Telegram VIP" que apareceu antes — o sistema gera automaticamente.
- NUNCA peça email do usuário prometendo reenviar o link — você não consegue reenviar nada por aqui.
- Se não souber resolver, fale: "Passa aqui o seu email de cadastro que eu anoto e um colega entra em contato!"`;


// Botões do menu de confirmação (follow-up 10 min)
const CONFIRM_BUTTONS = [
  { id: "conf_sim",   label: "✅ SIM, deu certo!" },
  { id: "conf_nao",   label: "❌ NÃO consegui" },
  { id: "conf_ajuda", label: "🆘 Preciso de ajuda" },
];

// Variações da mensagem de sucesso (clicou conf_sim)
const SUCCESS_VARIANTS = [
  "Toooop! 🎉🦈\n\nVocê também tem acesso ao *curso completo* que chegou no seu email — é pra você começar faturar R$ 200,00 por dia de casa sem vender nada pra ninguém!\n\nDá o Start o quanto antes, tô aqui pra qualquer dúvida! 💬",
  "Arrasou! 🙌 Agora é só acompanhar os procedimentos no App ou os sinais no grupo — todo dia tem operação saindo.\n\nSeu acesso ao *curso completo* chegou no email também. Qualquer dúvida me chama aqui, guerreiro! 🦈",
  "Que ótimo! 🚀 Bem-vindo(a) de verdade ao Shark Green!\n\nO segredo é seguir os procedimentos todo dia — a galera que vai do começo ao fim é a que coloca no bolso.\n\nVerifica também o email com o acesso ao *curso*. Tô aqui sempre que precisar! 💪",
];

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

  // Extrai o texto ou o ID do botão clicado.
  // Debug log confirmou: Z-API usa buttonsResponseMessage.buttonId (não selectedButtonId).
  const p = payload as any;
  const text = String(
    // Resposta de botão confirmada: buttonsResponseMessage.buttonId
    p.buttonsResponseMessage?.buttonId ??
    p.buttonsResponseMessage?.selectedButtonId ??
    // Variações alternativas
    p.buttonResponseMessage?.buttonId ??
    p.buttonResponseMessage?.selectedButtonId ??
    // Resposta de lista
    p.listResponseMessage?.singleSelectReply?.selectedRowId ??
    p.listResponse?.singleSelectReply?.selectedRowId ??
    // Texto livre
    p.text?.message ??
    ""
  ).trim();

  // Log completo do payload para diagnóstico
  log("raw-payload", {
    phone: phone.slice(0, 6) + "****",
    type: p.type ?? p.messageType ?? "?",
    keys: Object.keys(payload).join(","),
    text_extracted: text.slice(0, 80),
    fromMe,
    isGroup,
  });

  // Salva payload bruto na tabela de debug para inspeção
  // (útil para identificar o formato exato da resposta de botão)
  try {
    const sbDebug = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    await sbDebug.from("zapi_debug_log").insert({
      phone: phone.slice(0, 6) + "****",
      payload,
    });
  } catch { /* nunca bloqueia o fluxo principal */ }

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

  // ── Follow-up: confirmação de acesso (10 min após escolha) ───────────────
  // Cada case retorna explicitamente. Texto livre NÃO retorna aqui — cai
  // no bloco de Claude AI mais abaixo.
  if (step === "awaiting_confirmation") {
    if (text === "conf_sim") {
      const msg = SUCCESS_VARIANTS[Math.floor(Math.random() * SUCCESS_VARIANTS.length)];
      await sendZApiText({ phone, message: msg });
      await supabase.from("zapi_conversation_state")
        .update({ step: "done", updated_at: new Date().toISOString() })
        .eq("phone", phone);
      return new Response(JSON.stringify({ ok: true, action: "conf-sim" }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    if (text === "conf_nao") {
      await sendZApiButtonList({
        phone,
        message: "Certo, eu vou te ajudar então! 💪\n\nClique no botão abaixo pra saber em qual precisa de ajuda 👇",
        buttonList: { buttons: [
          { id: "help_telegram", label: "📲 Telegram VIP" },
          { id: "help_app",      label: "📱 App VIP Shark" },
        ]},
      });
      await supabase.from("zapi_conversation_state")
        .update({ step: "awaiting_help_type", updated_at: new Date().toISOString() })
        .eq("phone", phone);
      return new Response(JSON.stringify({ ok: true, action: "conf-nao" }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    if (text === "conf_ajuda") {
      await sendZApiText({ phone, message: "Certo, vamos lá então! 💪🦈\n\nNão é problema — estou aqui pra te guiar até os R$ 200,00 por dia...\n\nMe conta aqui qual é a sua dúvida que eu te ajudo! 👇" });
      await supabase.from("zapi_conversation_state")
        .update({ step: "awaiting_ai", updated_at: new Date().toISOString() })
        .eq("phone", phone);
      return new Response(JSON.stringify({ ok: true, action: "conf-ajuda" }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    // Texto livre em awaiting_confirmation → não retorna, cai no bloco de Claude abaixo
    log("confirmation-freetext", { phone: phone.slice(0, 6) + "****", text: text.slice(0, 30) });
  }

  // ── Tipo de ajuda (Telegram ou App) ──────────────────────────────────────
  // Mesmo padrão: cada case retorna; texto livre cai no Claude abaixo.
  if (step === "awaiting_help_type") {
    if (text === "help_telegram") {
      const msg = [
        "📲 *Como entrar no Grupo VIP Telegram*",
        "",
        "Primeiro você vai precisar baixar o Telegram e criar uma conta — é parecido com o WhatsApp, só que melhor! 😄",
        "",
        "Aqui tem um vídeo rápido ensinando a baixar em 2 minutinhos:",
        "https://www.youtube.com/watch?v=itsTBLRVK-I",
        "",
        "Depois de criar a conta, é só clicar no *link de convite* que eu te mandei aqui e entrar no grupo VIP! 🥳",
      ].join("\n");
      await sendZApiText({ phone, message: msg });
      await supabase.from("zapi_conversation_state")
        .update({ step: "done", updated_at: new Date().toISOString() })
        .eq("phone", phone);
      return new Response(JSON.stringify({ ok: true, action: "help-telegram" }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    if (text === "help_app") {
      const msg = [
        "📱 *Como baixar o App VIP Shark*",
        "",
        "Aqui é mais simples ainda!",
        "",
        `🤖 *Android:*\nClica no link abaixo pro download:\n${APK_URL}`,
        "",
        `🍎 *iPhone:*\nAbra o link abaixo pelo *Safari* 👇\n${PWA_URL}`,
        "",
        `_Toque em compartilhar → "Adicionar à Tela de Início" e o ícone aparece na tela!_`,
        "",
        `Seu login é o *email* que você cadastrou e a *senha* é o número do seu celular (só dígitos) 🔑`,
      ].join("\n");
      await sendZApiText({ phone, message: msg });
      await supabase.from("zapi_conversation_state")
        .update({ step: "done", updated_at: new Date().toISOString() })
        .eq("phone", phone);
      return new Response(JSON.stringify({ ok: true, action: "help-app" }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    // Texto livre em awaiting_help_type → não retorna, cai no Claude abaixo
    log("help-type-freetext", { phone: phone.slice(0, 6) + "****", text: text.slice(0, 30) });
  }

  // ── Atendimento IA (Claude) — lead pediu ajuda personalizada ──────────────
  if (step === "awaiting_ai") {
    // Se lead clicou botão do menu principal, deixa cair no bloco awaiting_choice
    if (!["opt_telegram", "opt_app", "opt_both"].includes(text)) {
      const question = text.trim();
      let aiReply = "Vou verificar isso pra você! 🦈\n\nMe dá um segundo — se for urgente, pode me mandar mais detalhes aqui.";

      const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (anthropicKey && question.length > 1) {
        try {
          const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type":      "application/json",
              "x-api-key":         anthropicKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model:      "claude-haiku-4-5",
              max_tokens: 250,
              system:     WA_AI_SYSTEM_PROMPT,
              messages:   [{ role: "user", content: question }],
            }),
          });
          if (!aiRes.ok) {
            const errText = await aiRes.text();
            log("ai-http-error", { status: aiRes.status, body: errText.slice(0, 200) });
          } else {
            const aiData = await aiRes.json().catch(() => ({}));
            const content: string | undefined = aiData?.content?.[0]?.text;
            if (content) aiReply = content;
            else log("ai-empty", { aiData });
          }
        } catch (e) {
          log("ai-error", { error: String(e) });
        }
      }

      await sendZApiText({ phone, message: aiReply });
      // Permanece em awaiting_ai para continuar o diálogo
      await supabase.from("zapi_conversation_state")
        .update({ updated_at: new Date().toISOString() })
        .eq("phone", phone);

      log("ai-replied", { phone: phone.slice(0, 6) + "****" });
      return new Response(JSON.stringify({ ok: true, action: "ai-replied" }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    // Se chegou aqui é porque text é opt_*, cai no bloco abaixo
  }

  // IDs de botão válidos — usados em dois pontos abaixo
  const VALID_CHOICES = ["opt_telegram", "opt_app", "opt_both"];

  // ── Resposta a botão selecionado ──────────────────────────────────────────
  // Também aceita no estado "done" para o caso de o lead clicar em outro botão
  // do mesmo menu após já ter recebido uma opção (estado não volta pra awaiting_choice).
  if (step === "awaiting_choice" || (step === "done" && VALID_CHOICES.includes(text))) {
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

    // Fallback se não achou o lead pelo estado — tenta pelo phone (variantes)
    let resolvedLeadIdFromFallback: string | null = null;
    if (!email) {
      for (const variant of buildPhoneVariants(phone)) {
        const { data: lead } = await supabase
          .from("trial_leads")
          .select("id, invite_link, email, whatsapp")
          .eq("whatsapp", variant)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lead) {
          resolvedLeadIdFromFallback = lead.id;
          inviteLink = lead.invite_link ?? null;
          email      = lead.email ?? null;
          password   = lead.whatsapp ?? null;
          break;
        }
      }
    }
    // Propaga o lead_id encontrado para o estado (se ainda não estava salvo)
    const effectiveLeadId = leadId ?? resolvedLeadIdFromFallback;

    // ── Auto-geração do invite_link quando NULL ────────────────────────────
    // Se o lead foi encontrado mas não tem invite_link, gera agora via Telegram API.
    if (!inviteLink && effectiveLeadId) {
      const botToken  = Deno.env.get("TELEGRAM_TRIAL_BOT_TOKEN");
      const chatId    = Deno.env.get("TELEGRAM_TRIAL_CHAT_ID");
      if (botToken && chatId) {
        try {
          const tgRes = await fetch(
            `https://api.telegram.org/bot${botToken}/createChatInviteLink`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: Number(chatId), member_limit: 1 }),
            }
          );
          const tgData = await tgRes.json().catch(() => ({}));
          const generatedLink: string | undefined = tgData?.result?.invite_link;
          if (generatedLink) {
            inviteLink = generatedLink;
            // Persiste no lead para futuros usos
            await supabase
              .from("trial_leads")
              .update({ invite_link: generatedLink })
              .eq("id", effectiveLeadId);
            log("invite-link-generated", { lead_id: effectiveLeadId });
          } else {
            log("invite-link-gen-failed", { tgData });
          }
        } catch (e) {
          log("invite-link-gen-error", { error: String(e) });
        }
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

    // Vídeo de boas-vindas — enviado após as credenciais, se configurado
    const welcomeVideoUrl = Deno.env.get("ZAPI_WELCOME_VIDEO_URL") ?? "";
    if (
      welcomeVideoUrl &&
      (choice === "opt_telegram" || choice === "opt_app" || choice === "opt_both")
    ) {
      await sleep(3000);
      const videoResult = await sendZApiVideo({
        phone,
        videoUrl: welcomeVideoUrl,
        caption: "🎥 Assista esse vídeo para aproveitar ao máximo seu trial no *Shark Green* 🦈",
      });
      if (!videoResult.ok) {
        log("welcome-video-error", { phone: phone.slice(0, 6) + "****", error: videoResult.error });
      } else {
        log("welcome-video-sent", { phone: phone.slice(0, 6) + "****" });
      }
    }

    if (choice !== "opt_telegram" && choice !== "opt_app" && choice !== "opt_both") {
      // Não reconheceu o botão (texto livre ou webhook duplicado) — ignora silenciosamente.
      // NUNCA reenvia o menu aqui para evitar loops.
      log("choice-unrecognized", {
        phone: phone.slice(0, 6) + "****",
        choice: choice.slice(0, 40),
        step,
      });
      return new Response(JSON.stringify({ ok: true, action: "choice-ignored", raw_choice: choice.slice(0, 40) }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Marca como concluído + agenda follow-up de 10 minutos + cancela nudges de inatividade
    const followUpAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await supabase
      .from("zapi_conversation_state")
      .upsert({
        phone,
        step: "done",
        lead_id: leadId ?? effectiveLeadId,
        follow_up_at: followUpAt,
        follow_up_sent: false,
        nudge_at: null,      // cancela cobrança de inatividade
        nudge_count: 3,      // marca como esgotado para não reagendar
        updated_at: new Date().toISOString(),
      }, { onConflict: "phone" });

    log("choice-handled", { phone: phone.slice(0, 6) + "****", choice });
    return new Response(JSON.stringify({ ok: true, action: "choice", choice }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Botões do dia 7 (oferta de assinatura) ───────────────────────────────
  const DAY7_IDS = ["day7_mensal", "day7_trimestre", "day7_anual"];
  if (DAY7_IDS.includes(text)) {
    const checkoutUrl = Deno.env.get("ZAPI_CHECKOUT_URL") || "https://lastlink.com/p/CEAEE6585/checkout-payment";
    const planLabels: Record<string, string> = {
      day7_mensal:    "Mensal (R$ 148,90/mês)",
      day7_trimestre: "Trimestral — Melhor Plano (R$ 99/mês)",
      day7_anual:     "Anual (R$ 74,49/mês)",
    };
    const label = planLabels[text] ?? "seu plano";
    const msg = [
      `Ótima escolha! 🎉 Plano *${label}* selecionado.`,
      ``,
      `Garanta seu acesso agora clicando no link abaixo 👇`,
      ``,
      checkoutUrl,
      ``,
      `_Após o pagamento, seu acesso é mantido sem interrupção. Qualquer dúvida, é só me chamar aqui!_ 🦈`,
    ].join("\n");
    await sendZApiText({ phone, message: msg });
    log("day7-plan-selected", { phone: phone.slice(0, 6) + "****", plan: text });
    return new Response(JSON.stringify({ ok: true, action: "day7-plan", plan: text }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Botões de confirmação chegando fora de ordem (step != awaiting_confirmation) ──
  // Ex: lead clicou conf_sim (processado, step virou done) e depois conf_ajuda.
  // Ignorar silenciosamente para não disparar o catch-all abaixo.
  const CONFIRM_IDS = ["conf_sim", "conf_nao", "conf_ajuda"];
  if (CONFIRM_IDS.includes(text)) {
    log("late-confirm-ignored", { phone: phone.slice(0, 6) + "****", step, text });
    return new Response(JSON.stringify({ ok: true, action: "late-confirm-ignored" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Texto livre de quem já tem conversa ativa → Claude AI ─────────────────
  // Se o lead já passou pelo funil (qualquer step diferente de "initial") e
  // mandou texto livre que não foi capturado pelos blocos anteriores,
  // responde com o Claude em vez de reenviar o menu de boas-vindas.
  const ACTIVE_STEPS = ["done", "awaiting_choice", "awaiting_confirmation", "awaiting_help_type"];
  if (ACTIVE_STEPS.includes(step) && text.length > 0) {
    const question = text.trim();
    let aiReply = "Vou verificar isso pra você! 🦈\n\nMe dá um segundo — se for urgente, pode me mandar mais detalhes aqui.";

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (anthropicKey && question.length > 1) {
      try {
        const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type":      "application/json",
            "x-api-key":         anthropicKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model:      "claude-haiku-4-5",
            max_tokens: 250,
            system:     WA_AI_SYSTEM_PROMPT,
            messages:   [{ role: "user", content: question }],
          }),
        });
        if (!aiRes.ok) {
          const errText = await aiRes.text();
          log("ai-http-error", { status: aiRes.status, body: errText.slice(0, 200) });
        } else {
          const aiData = await aiRes.json().catch(() => ({}));
          const content: string | undefined = aiData?.content?.[0]?.text;
          if (content) aiReply = content;
          else log("ai-empty", { aiData });
        }
      } catch (e) {
        log("ai-error", { error: String(e) });
      }
    }

    await sendZApiText({ phone, message: aiReply });
    // Entra em modo awaiting_ai para continuar o diálogo
    await supabase.from("zapi_conversation_state")
      .update({ step: "awaiting_ai", updated_at: new Date().toISOString() })
      .eq("phone", phone);

    log("ai-replied-freetext", { phone: phone.slice(0, 6) + "****", step });
    return new Response(JSON.stringify({ ok: true, action: "ai-replied-freetext" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Primeira mensagem (contato novo, step = initial) ──────────────────────
  // Tenta casar o lead pelo número de WhatsApp (todas as variantes BR)
  let resolvedLeadId = leadId;
  if (!resolvedLeadId) {
    for (const variant of buildPhoneVariants(phone)) {
      const { data: lead } = await supabase
        .from("trial_leads")
        .select("id")
        .eq("whatsapp", variant)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lead) { resolvedLeadId = lead.id; break; }
    }
  }

  // Envia o menu
  await sendMenu(phone);

  // Salva/atualiza estado como "awaiting_choice" + agenda 1º nudge de inatividade em 10 min
  const nudgeAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await supabase
    .from("zapi_conversation_state")
    .upsert(
      {
        phone,
        step: "awaiting_choice",
        lead_id: resolvedLeadId,
        nudge_count: 0,
        nudge_at: nudgeAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "phone" }
    );

  log("menu-sent", { phone: phone.slice(0, 6) + "****", lead_id: resolvedLeadId });
  return new Response(JSON.stringify({ ok: true, action: "menu-sent" }), {
    headers: { "Content-Type": "application/json" },
  });
});

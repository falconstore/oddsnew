// Edge Function: trial-diagnose
// Diagnóstico do bot do Telegram + webhook + permissões no grupo.
// Protegida por JWT (chame com a sessão logada do admin).
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";

async function tg(token: string, method: string, body?: unknown) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { http: res.status, ...data };
  } catch (e) {
    return { http: 0, ok: false, error: String(e) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const botToken = Deno.env.get("TELEGRAM_TRIAL_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_TRIAL_CHAT_ID");
  const webhookSecret = Deno.env.get("TELEGRAM_TRIAL_WEBHOOK_SECRET");

  const env = {
    has_bot_token: !!botToken,
    has_chat_id: !!chatId,
    has_webhook_secret: !!webhookSecret,
    chat_id_value: chatId ?? null,
  };

  if (!botToken) {
    return json({ ok: false, env, error: "TELEGRAM_TRIAL_BOT_TOKEN ausente nos secrets" });
  }

  // 1. getMe — bot está vivo?
  const me = await tg(botToken, "getMe");

  // 2. getWebhookInfo — webhook registrado e com chat_member nas allowed_updates?
  const wh = await tg(botToken, "getWebhookInfo");
  // Importante: se allowed_updates não foi setado explicitamente, o Telegram
  // entrega APENAS os updates do conjunto "default" (que NÃO inclui chat_member).
  // Por isso, lista vazia/ausente = chat_member NÃO assinado.
  const allowedUpdates: string[] = wh?.result?.allowed_updates ?? [];
  const hasChatMember = allowedUpdates.includes("chat_member");

  // 3. getChatMember — bot é admin do grupo?
  let chatMember: any = null;
  let chatInfo: any = null;
  if (chatId && me?.result?.id) {
    chatInfo = await tg(botToken, "getChat", { chat_id: chatId });
    chatMember = await tg(botToken, "getChatMember", {
      chat_id: chatId,
      user_id: me.result.id,
    });
  }

  const expectedWebhookSuffix = "/trial-webhook";
  const webhookUrlOk = typeof wh?.result?.url === "string" &&
    wh.result.url.endsWith(expectedWebhookSuffix);

  const summary = {
    bot_alive: !!me?.ok,
    bot_username: me?.result?.username ?? null,
    webhook_registered: !!wh?.result?.url,
    webhook_url: wh?.result?.url ?? null,
    webhook_url_ok: webhookUrlOk,
    webhook_has_custom_certificate: wh?.result?.has_custom_certificate ?? null,
    webhook_pending_update_count: wh?.result?.pending_update_count ?? null,
    webhook_last_error_date: wh?.result?.last_error_date ?? null,
    webhook_last_error_message: wh?.result?.last_error_message ?? null,
    webhook_allowed_updates: allowedUpdates,
    webhook_has_chat_member_subscription: hasChatMember,
    bot_in_chat: !!chatMember?.ok,
    bot_status_in_chat: chatMember?.result?.status ?? null,
    bot_can_restrict_members:
      chatMember?.result?.can_restrict_members ??
      chatMember?.result?.status === "creator",
    chat_title: chatInfo?.result?.title ?? null,
    chat_type: chatInfo?.result?.type ?? null,
  };

  // Sugestões de correção
  const issues: string[] = [];
  if (!summary.bot_alive) issues.push("Token do bot inválido — gere um novo no @BotFather e atualize TELEGRAM_TRIAL_BOT_TOKEN.");
  if (!summary.webhook_registered) issues.push("Webhook não está registrado — rode setWebhook (passo 5 do guia).");
  if (summary.webhook_registered && !summary.webhook_url_ok) issues.push(`Webhook aponta para URL inesperada: ${summary.webhook_url}`);
  if (summary.webhook_registered && !summary.webhook_has_chat_member_subscription)
    issues.push("Webhook está registrado SEM 'chat_member' nas allowed_updates — re-rode setWebhook com allowed_updates=[\"chat_member\",\"my_chat_member\"]. Sem isso o Telegram NÃO envia updates de entrada/saída de membros.");
  // Só trata o último erro do webhook como problema ATUAL se ainda há
  // updates pendentes — caso contrário é histórico (Telegram só sobrescreve
  // last_error_message quando há um erro novo, então o campo pode ficar
  // mostrando um erro de horas atrás mesmo com tudo funcionando).
  const pendingCount = summary.webhook_pending_update_count ?? 0;
  if (summary.webhook_last_error_message && pendingCount > 0)
    issues.push(`Último erro entregando ao webhook: ${summary.webhook_last_error_message} (provavelmente segredo errado ou função fora do ar)`);
  if (chatId && !summary.bot_in_chat)
    issues.push(`Bot não consegue ler o grupo ${chatId} (não foi adicionado, ou chat_id errado).`);
  if (summary.bot_in_chat && summary.bot_status_in_chat !== "administrator" && summary.bot_status_in_chat !== "creator")
    issues.push(`Bot NÃO é administrador do grupo (status atual: ${summary.bot_status_in_chat}). Sem admin, o Telegram não envia chat_member updates. Promova o bot a admin com permissão de banir usuários.`);
  if (summary.bot_in_chat && (summary.bot_status_in_chat === "administrator" || summary.bot_status_in_chat === "creator") && !summary.bot_can_restrict_members)
    issues.push("Bot é admin mas SEM permissão 'Ban users' — habilite-a para o trial-kick funcionar.");

  return json({
    ok: issues.length === 0,
    env,
    summary,
    issues,
    raw: { me, webhook: wh, chatMember, chatInfo },
  });
});

// Edge Function: trial-check-user (DIAGNÓSTICO TEMPORÁRIO)
// Retorna o getChatMember de um user_id no chat VIP e bônus.
// Uso: GET ?user_id=5831110996
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, "content-type": "application/json", ...(init?.headers ?? {}) },
  });
}

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
  const url = new URL(req.url);
  const userId = Number(url.searchParams.get("user_id") ?? 0);
  if (!userId) return json({ error: "user_id required" }, { status: 400 });

  const botToken = Deno.env.get("TELEGRAM_TRIAL_BOT_TOKEN");
  const vipChatId = Deno.env.get("TELEGRAM_TRIAL_CHAT_ID");
  const bonusChatId = Deno.env.get("TELEGRAM_TRIAL_BONUS_CHAT_ID") ?? null;
  if (!botToken || !vipChatId) return json({ error: "missing env" }, { status: 500 });

  const vipChat = await tg(botToken, "getChat", { chat_id: vipChatId });
  const vipMember = await tg(botToken, "getChatMember", { chat_id: vipChatId, user_id: userId });
  const bonusChat = bonusChatId ? await tg(botToken, "getChat", { chat_id: bonusChatId }) : null;
  const bonusMember = bonusChatId ? await tg(botToken, "getChatMember", { chat_id: bonusChatId, user_id: userId }) : null;

  return json({
    user_id: userId,
    vip: {
      chat_title: vipChat?.result?.title ?? null,
      chat_type: vipChat?.result?.type ?? null,
      member_status: vipMember?.result?.status ?? null,
      member_until_date: vipMember?.result?.until_date ?? null,
      raw: vipMember,
    },
    bonus: bonusChatId ? {
      chat_title: bonusChat?.result?.title ?? null,
      chat_type: bonusChat?.result?.type ?? null,
      member_status: bonusMember?.result?.status ?? null,
      member_until_date: bonusMember?.result?.until_date ?? null,
      raw: bonusMember,
    } : null,
  });
});

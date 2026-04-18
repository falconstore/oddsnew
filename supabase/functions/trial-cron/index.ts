// Edge Function: trial-cron
// Roda periodicamente (via pg_cron + pg_net) para expirar trials de 7 dias.
// Faz banChatMember + unbanChatMember para remover (e permitir nova entrada paga).
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

async function tgKick(botToken: string, chatId: string, userId: number) {
  const banRes = await fetch(`https://api.telegram.org/bot${botToken}/banChatMember`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, user_id: userId, revoke_messages: false }),
  });
  const banData = await banRes.json().catch(() => ({}));
  if (!banRes.ok || !banData?.ok) {
    return { ok: false, error: banData?.description ?? "banChatMember failed" };
  }
  // unban para permitir re-entrar futuramente (cliente pago)
  const unbanRes = await fetch(`https://api.telegram.org/bot${botToken}/unbanChatMember`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, user_id: userId, only_if_banned: true }),
  });
  await unbanRes.json().catch(() => ({}));
  return { ok: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Defesa em profundidade: exige Authorization: Bearer <SERVICE_ROLE_KEY>.
  // Mesmo se a função for deployada sem --verify-jwt, callers públicos são bloqueados.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ") || auth.slice(7).trim() !== serviceKey) {
    return json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceKey,
      { auth: { persistSession: false } },
    );
    const botToken = Deno.env.get("TELEGRAM_TRIAL_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_TRIAL_CHAT_ID");
    if (!botToken || !chatId) {
      return json({ error: "Bot não configurado" }, { status: 500 });
    }

    const { data: expired, error } = await supabase
      .from("trial_leads")
      .select("id, telegram_user_id")
      .eq("status", "active")
      .lte("expires_at", new Date().toISOString())
      .limit(500);
    if (error) {
      console.error("query error", error);
      return json({ error: "query failed" }, { status: 500 });
    }

    let processed = 0, failed = 0;
    for (const lead of expired ?? []) {
      if (!lead.telegram_user_id) {
        // Sem ID → marca como expirado mesmo sem kick
        await supabase.from("trial_leads")
          .update({ status: "expired", removed_at: new Date().toISOString() })
          .eq("id", lead.id);
        processed++;
        continue;
      }
      const result = await tgKick(botToken, chatId, lead.telegram_user_id);
      if (!result.ok) {
        console.error("kick failed", lead.id, result.error);
        failed++;
        continue;
      }
      await supabase.from("trial_leads")
        .update({ status: "expired", removed_at: new Date().toISOString() })
        .eq("id", lead.id);
      processed++;
    }

    return json({ ok: true, processed, failed, total: expired?.length ?? 0 });
  } catch (err) {
    console.error("trial-cron error", err);
    return json({ error: "internal" }, { status: 500 });
  }
});

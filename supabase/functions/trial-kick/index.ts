// Edge Function: trial-kick
// Remove manualmente um lead do grupo (botão "Remover" no admin).
// Requer JWT de usuário com can_view_trial = true OU is_super_admin.
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, { status: 405 });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return json({ error: "Não autenticado" }, { status: 401 });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Cliente como usuário (valida JWT)
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return json({ error: "Sessão inválida" }, { status: 401 });
    }
    const email = userData.user.email?.toLowerCase();
    if (!email) return json({ error: "Email não encontrado" }, { status: 401 });

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: perm } = await admin
      .from("user_permissions")
      .select("can_view_trial, is_super_admin")
      .eq("user_email", email)
      .maybeSingle();
    if (!perm || (!perm.can_view_trial && !perm.is_super_admin)) {
      return json({ error: "Sem permissão" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const leadId = String(body.lead_id ?? "");
    if (!leadId) return json({ error: "lead_id obrigatório" }, { status: 400 });

    const { data: lead } = await admin
      .from("trial_leads")
      .select("id, telegram_user_id, status")
      .eq("id", leadId)
      .maybeSingle();
    if (!lead) return json({ error: "Lead não encontrado" }, { status: 404 });

    const botToken = Deno.env.get("TELEGRAM_TRIAL_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_TRIAL_CHAT_ID");
    if (!botToken || !chatId) return json({ error: "Bot não configurado" }, { status: 500 });

    if (lead.telegram_user_id) {
      const banRes = await fetch(`https://api.telegram.org/bot${botToken}/banChatMember`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, user_id: lead.telegram_user_id }),
      });
      const banData = await banRes.json().catch(() => ({}));
      if (!banRes.ok || !banData?.ok) {
        console.error("ban failed", banData);
        return json({ error: banData?.description ?? "Falha no Telegram" }, { status: 502 });
      }
      await fetch(`https://api.telegram.org/bot${botToken}/unbanChatMember`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, user_id: lead.telegram_user_id, only_if_banned: true }),
      });
    }

    await admin.from("trial_leads").update({
      status: "removed",
      removed_at: new Date().toISOString(),
    }).eq("id", leadId);

    return json({ ok: true });
  } catch (err) {
    console.error("trial-kick error", err);
    return json({ error: "internal" }, { status: 500 });
  }
});

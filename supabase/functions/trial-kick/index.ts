// Edge Function: trial-kick
// Remove manualmente um lead do grupo (botão "Remover" no admin).
// Requer JWT de usuário com can_view_trial = true OU is_super_admin.
//
// Garantias:
//  - Bana o usuário no Telegram (ban + unban -> efetivamente "expulsa" sem
//    deixar banido permanente, então admin pode reverter se quiser).
//  - REVOGA o invite link original para impedir que o mesmo link seja
//    reutilizado (Telegram aceita revogar mesmo links de 1 uso já consumidos
//    por garantia / não-op se já invalidado).
//  - Marca o lead como `removed` com timestamp para o painel e para a dedup
//    do trial-signup continuar bloqueando uma nova inscrição.
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
      .select("id, telegram_user_id, status, invite_link, bonus_invite_link")
      .eq("id", leadId)
      .maybeSingle();
    if (!lead) return json({ error: "Lead não encontrado" }, { status: 404 });

    const botToken = Deno.env.get("TELEGRAM_TRIAL_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_TRIAL_CHAT_ID");
    const bonusChatId = Deno.env.get("TELEGRAM_TRIAL_BONUS_CHAT_ID") ?? null;
    if (!botToken || !chatId) return json({ error: "Bot não configurado" }, { status: 500 });

    // 1) Expulsar do grupo VIP (se já entrou)
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
      // unban imediato para o usuário não ficar banido para sempre
      // (re-entrada futura é bloqueada pelo trial-webhook que re-kicka
      // qualquer rejoin de lead com status 'removed').
      await fetch(`https://api.telegram.org/bot${botToken}/unbanChatMember`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, user_id: lead.telegram_user_id, only_if_banned: true }),
      });

      // 1b) Expulsar TAMBÉM do grupo bônus (best-effort — não falha o
      // request mesmo se o lead nunca entrou no bônus ou o bot não é
      // admin lá). Sem isso o lead ficaria com acesso à Área do Aluno
      // mesmo depois do admin remover do VIP.
      if (bonusChatId) {
        try {
          await fetch(`https://api.telegram.org/bot${botToken}/banChatMember`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: bonusChatId, user_id: lead.telegram_user_id }),
          });
          await fetch(`https://api.telegram.org/bot${botToken}/unbanChatMember`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: bonusChatId, user_id: lead.telegram_user_id, only_if_banned: true }),
          });
        } catch (e) {
          console.warn("bonus kick failed (continuando)", e);
        }
      }
    }

    // 2) Revogar invite links (VIP + bônus) para que não possam ser reutilizados
    if (lead.invite_link) {
      try {
        await fetch(`https://api.telegram.org/bot${botToken}/revokeChatInviteLink`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, invite_link: lead.invite_link }),
        });
      } catch (e) {
        console.warn("revoke invite link failed (continuando)", e);
      }
    }
    if (bonusChatId && lead.bonus_invite_link) {
      try {
        await fetch(`https://api.telegram.org/bot${botToken}/revokeChatInviteLink`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: bonusChatId, invite_link: lead.bonus_invite_link }),
        });
      } catch (e) {
        console.warn("revoke bonus invite link failed (continuando)", e);
      }
    }

    // 3) Marcar como removed (também zera bonus_entered_at via bonus_removed_at)
    await admin.from("trial_leads").update({
      status: "removed",
      removed_at: new Date().toISOString(),
      ...(bonusChatId ? { bonus_removed_at: new Date().toISOString() } : {}),
    }).eq("id", leadId);

    return json({ ok: true });
  } catch (err) {
    console.error("trial-kick error", err);
    return json({ error: "internal" }, { status: 500 });
  }
});

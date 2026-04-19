// Edge Function: trial-purge
// Apaga DEFINITIVAMENTE um lead do banco de dados (botão "Apagar do
// banco" no admin). Diferente de `trial-kick` (que só marca como
// 'removed'), aqui o registro some — útil quando o admin quer
// reaproveitar email/whatsapp/@username para um novo trial limpo, ou
// quando criou um lead errado e quer deletar.
//
// Comportamento:
//   1) JWT obrigatório com can_view_trial OU is_super_admin.
//   2) Se o lead tinha telegram_user_id e estava no grupo, faz
//      ban+unban (mesmo padrão do trial-kick) — assim ele sai do grupo
//      antes do registro sumir.
//   3) Revoga o invite_link rastreado (se houver).
//   4) DELETE da linha em trial_leads.
//      - `previous_lead_id` em outros leads tem ON DELETE SET NULL,
//        então leads que apontavam pra este perdem só a referência.
//      - `trial_upgrade_events.lead_id` tem ON DELETE SET NULL —
//        eventos históricos ficam preservados (sem dono).
//
// Estruturado para auditoria via console.log JSON.
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
      .select("id, telegram_user_id, status, invite_link, name, email")
      .eq("id", leadId)
      .maybeSingle();
    if (!lead) return json({ error: "Lead não encontrado" }, { status: 404 });

    const botToken = Deno.env.get("TELEGRAM_TRIAL_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_TRIAL_CHAT_ID");

    // 1) Tira do grupo (best-effort) — não falha o purge se Telegram der erro
    if (botToken && chatId && lead.telegram_user_id) {
      try {
        await fetch(`https://api.telegram.org/bot${botToken}/banChatMember`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, user_id: lead.telegram_user_id }),
        });
        await fetch(`https://api.telegram.org/bot${botToken}/unbanChatMember`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, user_id: lead.telegram_user_id, only_if_banned: true }),
        });
      } catch (e) {
        console.warn("trial-purge ban failed (continuando)", e);
      }
    }

    // 2) Revoga link rastreado
    if (botToken && chatId && lead.invite_link) {
      try {
        await fetch(`https://api.telegram.org/bot${botToken}/revokeChatInviteLink`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, invite_link: lead.invite_link }),
        });
      } catch (e) {
        console.warn("trial-purge revoke failed (continuando)", e);
      }
    }

    // 3) DELETE definitivo
    const { error: delErr } = await admin
      .from("trial_leads")
      .delete()
      .eq("id", leadId);
    if (delErr) {
      console.error("trial-purge delete failed", delErr);
      return json({ error: "Falha ao apagar do banco" }, { status: 500 });
    }

    console.log(JSON.stringify({
      tag: "trial-purge",
      event: "purged",
      lead_id: leadId,
      previous_status: lead.status,
      had_telegram_user_id: !!lead.telegram_user_id,
      lead_name: lead.name,
      lead_email: lead.email,
      by_admin: email,
    }));

    return json({ ok: true, action: "purged", message: "Lead apagado do banco." });
  } catch (err) {
    console.error("trial-purge error", err);
    return json({ error: "internal" }, { status: 500 });
  }
});

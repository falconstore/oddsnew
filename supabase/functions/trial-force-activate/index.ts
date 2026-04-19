// Edge Function: trial-force-activate
// "Liberar e ativar" — usado pelo admin no /trial-admin para forçar a
// ativação de um lead que foi marcado como `blocked_repeat` (tentativa
// de 2º trial detectada via telegram_user_id).
//
// Caso de uso: cliente legítimo que pagou e por algum motivo perdeu o
// acesso, ou caso onde o admin já validou que a repetição é OK.
//
// Diferente do trial-link-manual:
//  - Aqui IGNORAMOS a checagem de repetição (esse é o ponto da função).
//  - Aceita lead em qualquer status; ativa direto pelos próximos 7 dias.
//  - Não altera nem apaga o lead anterior (`previous_lead_id` continua
//    apontando pra ele para auditoria).
//
// Protegida por JWT do admin (mesma checagem can_view_trial / is_super_admin).
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
    return { http: 0, ok: false, description: String(e) };
  }
}

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
    if (userErr || !userData.user) return json({ error: "Sessão inválida" }, { status: 401 });
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
      .select("id, status, telegram_user_id")
      .eq("id", leadId)
      .maybeSingle();
    if (!lead) return json({ error: "Lead não encontrado" }, { status: 404 });
    if (!lead.telegram_user_id) {
      return json({
        error: "Lead ainda não tem telegram_user_id. Use 'Vincular' antes.",
      }, { status: 400 });
    }

    const botToken = Deno.env.get("TELEGRAM_TRIAL_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_TRIAL_CHAT_ID");
    if (!botToken || !chatId) {
      return json({ error: "Bot do Telegram não configurado." }, { status: 500 });
    }

    // Se foi banido (re-kickado pelo webhook), precisamos desbanir antes
    // de ele conseguir voltar pro grupo. only_if_banned evita efeitos
    // colaterais se ele não estava banido.
    try {
      await tg(botToken, "unbanChatMember", {
        chat_id: chatId,
        user_id: lead.telegram_user_id,
        only_if_banned: true,
      });
    } catch (e) {
      console.warn("trial-force-activate unban failed", e);
    }

    // Confirma a presença atual no grupo. Se ele já saiu (ex: foi banido
    // e ainda não voltou), a ativação acontece mesmo assim — ele entrará
    // pelo invite_link público. Apenas logamos.
    const member = await tg(botToken, "getChatMember", {
      chat_id: chatId,
      user_id: lead.telegram_user_id,
    });
    const memberStatus: string = member?.result?.status ?? "unknown";

    const now = new Date();
    const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const { error: updErr } = await admin
      .from("trial_leads")
      .update({
        status: "active",
        entered_at: now.toISOString(),
        expires_at: expires.toISOString(),
        removed_at: null,
      })
      .eq("id", lead.id);
    if (updErr) {
      console.error("trial-force-activate update failed", updErr);
      return json({ error: "Erro ao ativar o lead." }, { status: 500 });
    }

    console.log(JSON.stringify({
      tag: "trial-force-activate",
      event: "force-activated",
      lead_id: lead.id,
      previous_status: lead.status,
      telegram_user_id: lead.telegram_user_id,
      telegram_member_status: memberStatus,
      by_admin: email,
    }));

    return json({
      ok: true,
      action: "force-activated",
      message: `Lead liberado e ativado por 7 dias.`,
      telegram_member_status: memberStatus,
    });
  } catch (err) {
    console.error("trial-force-activate error", err);
    return json({ error: "internal" }, { status: 500 });
  }
});

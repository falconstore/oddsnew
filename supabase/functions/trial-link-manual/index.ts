// Edge Function: trial-link-manual
// Recupera leads "fantasma" — pessoas que entraram no grupo durante uma janela
// em que o webhook estava fora do ar (ex: 401 do gateway pós-redeploy sem
// --no-verify-jwt). Esses updates de chat_member são descartados pelo Telegram
// após algumas tentativas e nunca mais voltam, então o lead fica preso em
// "Aguardando entrada" mesmo já estando dentro do grupo.
//
// Fluxo:
//  1) Admin clica em "Vincular ao Telegram" no card do lead
//  2) Esta função tenta resolver o @username -> user_id automaticamente via
//     getChat("@username"). Funciona quando o usuário já interagiu com o bot
//     privadamente OU dependendo da config do username (não 100% garantido).
//  3) Se não conseguir resolver, retorna erro claro pedindo o ID numérico,
//     que o admin pode obter pedindo pro usuário usar @userinfobot.
//  4) Com o user_id em mãos, chama getChatMember para confirmar que está
//     no grupo. Se sim, ativa o lead (status=active, telegram_user_id,
//     entered_at=now, expires_at=+7d). Se não, retorna mensagem informando.
//
// Protegida por JWT do admin (mesma checagem de can_view_trial / is_super_admin
// que o trial-kick).
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
    const manualUserIdRaw = body.manual_user_id;
    const manualUserId =
      manualUserIdRaw !== undefined && manualUserIdRaw !== null && manualUserIdRaw !== ""
        ? Number(manualUserIdRaw)
        : null;
    if (manualUserId !== null && (!Number.isFinite(manualUserId) || manualUserId <= 0)) {
      return json({ error: "ID numérico do Telegram inválido." }, { status: 400 });
    }
    if (!leadId) return json({ error: "lead_id obrigatório" }, { status: 400 });

    const { data: lead } = await admin
      .from("trial_leads")
      .select("id, status, telegram_username, telegram_user_id, invite_link")
      .eq("id", leadId)
      .maybeSingle();
    if (!lead) return json({ error: "Lead não encontrado" }, { status: 404 });

    if (lead.status === "active" && lead.telegram_user_id) {
      return json({
        ok: true,
        action: "already-active",
        message: "Esse lead já está ativo e vinculado.",
      });
    }

    const botToken = Deno.env.get("TELEGRAM_TRIAL_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_TRIAL_CHAT_ID");
    if (!botToken || !chatId) {
      return json({ error: "Bot do Telegram não configurado." }, { status: 500 });
    }

    // Passo 1 — descobrir o user_id numérico
    let userId: number | null = manualUserId ?? lead.telegram_user_id ?? null;
    let resolvedVia: "manual" | "existing" | "auto" | null = userId
      ? (manualUserId ? "manual" : "existing")
      : null;

    if (!userId) {
      // Tenta resolver automaticamente via getChat("@username").
      // Funciona quando o user tem username público + já interagiu com o bot
      // ou está em supergrupos onde o bot tem visibilidade. Pode falhar
      // silenciosamente — nesse caso pedimos o ID manualmente.
      const username = lead.telegram_username;
      if (!username) {
        return json({
          error: "Lead sem @username salvo. Use o ID numérico no campo 'ID manual'.",
          need_manual_id: true,
        }, { status: 400 });
      }
      const handle = `@${username}`;
      const got = await tg(botToken, "getChat", { chat_id: handle });
      if (got?.ok && got?.result?.id) {
        userId = Number(got.result.id);
        resolvedVia = "auto";
      } else {
        return json({
          error:
            `Não foi possível resolver ${handle} automaticamente. Peça para o usuário abrir uma conversa com @userinfobot e enviar /start — copie o "Id" (número) e cole no campo abaixo.`,
          need_manual_id: true,
          telegram_error: got?.description ?? null,
        }, { status: 200 });
      }
    }

    // Passo 2 — confirmar que o user está mesmo no grupo
    const member = await tg(botToken, "getChatMember", {
      chat_id: chatId,
      user_id: userId,
    });
    if (!member?.ok) {
      return json({
        error:
          `Não foi possível confirmar a presença no grupo: ${member?.description ?? "erro desconhecido"}.`,
        telegram_error: member?.description ?? null,
      }, { status: 502 });
    }
    const memberStatus: string = member?.result?.status ?? "unknown";
    const ACTIVE = new Set(["member", "restricted", "administrator", "creator"]);
    if (!ACTIVE.has(memberStatus)) {
      return json({
        ok: false,
        action: "not-in-group",
        message:
          `Esse usuário não está no grupo (status: ${memberStatus}). Peça para ele entrar via link e tentar de novo.`,
        telegram_user_id: userId,
        telegram_member_status: memberStatus,
      });
    }

    // Passo 3 — ativar o lead
    const now = new Date();
    const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const { error: updErr } = await admin
      .from("trial_leads")
      .update({
        status: "active",
        telegram_user_id: userId,
        entered_at: now.toISOString(),
        expires_at: expires.toISOString(),
      })
      .eq("id", lead.id);
    if (updErr) {
      console.error("trial-link-manual update failed", updErr);
      return json({ error: "Erro ao salvar a vinculação." }, { status: 500 });
    }

    return json({
      ok: true,
      action: "activated",
      message: `Lead vinculado e ativado por 7 dias (resolvido via ${resolvedVia}).`,
      telegram_user_id: userId,
      telegram_member_status: memberStatus,
    });
  } catch (err) {
    console.error("trial-link-manual error", err);
    return json({ error: "internal" }, { status: 500 });
  }
});

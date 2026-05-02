// Edge Function: trial-link-gc
// Revoga invite_links do Telegram com mais de 24h e zera as colunas
// no banco. Mantém a cota de "links ativos por chat por bot" do Telegram
// limpa — sem isso, depois de algum volume de cadastros, o
// `createChatInviteLink` passa a falhar e a LP para de gerar links.
//
// Pode ser chamada de duas formas:
//   1) Bearer com sessão de admin (can_view_trial OU is_super_admin) —
//      botão "Limpar links antigos" no /trial-admin.
//   2) Bearer com SUPABASE_SERVICE_ROLE_KEY OU TRIAL_CRON_SECRET — usado
//      pelo trial-cron e qualquer chamada interna server-to-server.
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { runLinkGc } from "../_shared/link-gc.ts";

function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, { status: 405 });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return json({ error: "Não autenticado" }, { status: 401 });
    }
    const presented = auth.slice(7).trim();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const trialCronSecret = Deno.env.get("TRIAL_CRON_SECRET") ?? "";

    const isServiceCall =
      constantTimeEqual(presented, serviceKey) ||
      (trialCronSecret.length > 0 && constantTimeEqual(presented, trialCronSecret));

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Para chamadas de admin (não-service), valida JWT + permissão.
    if (!isServiceCall) {
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: auth } },
        auth: { persistSession: false },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData.user) return json({ error: "Sessão inválida" }, { status: 401 });
      const email = userData.user.email?.toLowerCase();
      if (!email) return json({ error: "Email não encontrado" }, { status: 401 });

      const { data: perm } = await admin
        .from("user_permissions")
        .select("can_view_trial, is_super_admin")
        .eq("user_email", email)
        .maybeSingle();
      if (!perm || (!perm.can_view_trial && !perm.is_super_admin)) {
        return json({ error: "Sem permissão" }, { status: 403 });
      }
    }

    const botToken = Deno.env.get("TELEGRAM_TRIAL_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_TRIAL_CHAT_ID");
    const bonusChatId = Deno.env.get("TELEGRAM_TRIAL_BONUS_CHAT_ID") ?? null;
    if (!botToken || !chatId) {
      return json({ error: "Bot do Telegram não configurado" }, { status: 500 });
    }

    // Permite override da janela via body (útil pra emergência: zerar TUDO).
    // Default = 24h.
    const body = await req.json().catch(() => ({}));
    const olderThanHoursRaw = Number(body?.older_than_hours);
    const olderThanMs = Number.isFinite(olderThanHoursRaw) && olderThanHoursRaw >= 0
      ? olderThanHoursRaw * 60 * 60 * 1000
      : 24 * 60 * 60 * 1000;
    const batchSize = Number.isFinite(Number(body?.batch_size))
      ? Math.min(Math.max(1, Number(body.batch_size)), 1000)
      : 500;

    const result = await runLinkGc({
      supabase: admin,
      botToken,
      chatId,
      bonusChatId,
      batchSize,
      olderThanMs,
    });

    return json({
      ok: true,
      message: result.scanned === 0
        ? "Nada a limpar — não há links com mais de 24h."
        : `Limpos ${result.cleared_rows} leads · ${result.vip_revoked} links VIP + ${result.bonus_revoked} bônus revogados.`,
      ...result,
    });
  } catch (err) {
    console.error("trial-link-gc error", err);
    return json({ error: "Erro interno", detail: String(err) }, { status: 500 });
  }
});

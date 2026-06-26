// Edge Function: free-group-snapshot
//
// Tira um "snapshot" diário do TOTAL de inscritos do canal Grupo Free e grava
// em free_group_snapshots (1 linha por dia, UPSERT por `dia`). Esse é o único
// dado de crescimento disponível pra um CANAL do Telegram — canais não expõem
// entrada/saída individual.
//
// Auth: Bearer com service_role OU TRIAL_CRON_SECRET (mesmo padrão do trial-cron).
// Agendado via pg_cron 1x/dia.
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const log = (event: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ tag: "free-group-snapshot", event, ...data }));

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const cronSecret = Deno.env.get("TRIAL_CRON_SECRET") ?? "";
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "forbidden" }, { status: 403 });
  const presented = auth.slice(7).trim();
  if (!constantTimeEqual(presented, serviceKey) &&
      !(cronSecret.length > 0 && constantTimeEqual(presented, cronSecret))) {
    return json({ error: "forbidden" }, { status: 403 });
  }

  const botToken = Deno.env.get("TELEGRAM_TRIAL_BOT_TOKEN");
  const freeChatId = Deno.env.get("TELEGRAM_FREE_GROUP_CHAT_ID");
  if (!botToken || !freeChatId) {
    log("config_error", { has_token: !!botToken, has_chat: !!freeChatId });
    return json({ error: "bot/chat não configurado" }, { status: 500 });
  }

  try {
    // 1) Total de inscritos do canal.
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/getChatMemberCount?chat_id=${freeChatId}`,
    );
    const data = await res.json().catch(() => ({}));
    if (!data?.ok || typeof data.result !== "number") {
      log("count_failed", { telegram: data });
      return json({ ok: false, error: "getChatMemberCount falhou", telegram: data }, { status: 502 });
    }
    const total: number = data.result;

    // 2) UPSERT do snapshot de hoje (idempotente — reexecutar atualiza).
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, {
      auth: { persistSession: false },
    });
    const dia = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    const { error } = await supabase
      .from("free_group_snapshots")
      .upsert({ dia, total }, { onConflict: "dia" });
    if (error) {
      log("upsert_failed", { error: error.message });
      return json({ ok: false, error: error.message }, { status: 500 });
    }

    log("snapshot_ok", { dia, total });
    return json({ ok: true, dia, total });
  } catch (e: any) {
    log("error", { error: e?.message });
    return json({ ok: false, error: e?.message ?? "erro" }, { status: 500 });
  }
});

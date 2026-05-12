// Edge Function: freebetpro-resync-cron
//
// Roda periodicamente via pg_cron. Busca todos os procedures que:
//   - Ainda não foram sincronizados com o FreeBet PRO (freebetpro_external_id IS NULL)
//   - Não estão arquivados
//   - Têm platform preenchida (sem platform → FreeBet PRO rejeita com 422)
//   - Têm data >= FREEBETPRO_DATA_DE_CORTE
//
// Para cada um, executa o POST /procedimentos (criação). É 100% idempotente:
//   - Procedures já com freebetpro_external_id nunca são tocados (nunca reenvio)
//   - A Idempotency-Key garante que a FreeBet PRO não crie duplicatas mesmo
//     que o cron dispare duas vezes no mesmo minuto por qualquer razão.
//
// Auth: TRIAL_CRON_SECRET (env var, mesmo secret do trial-cron já existente).
// verify_jwt=false — o pg_cron não gera JWT; protegido pelo shared secret.
//
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { buildUpsertPayload, callFreebetPro } from "../_shared/freebetpro.ts";

function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

const log = (event: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ tag: "freebetpro-resync-cron", event, ...data }));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth: aceita Bearer <TRIAL_CRON_SECRET> ou Bearer <SUPABASE_SERVICE_ROLE_KEY>.
  // TRIAL_CRON_SECRET já está setado como Edge Function secret neste projeto
  // (usado pelo trial-cron). O pg_cron lê o mesmo valor do Vault.
  const cronSecret = Deno.env.get("TRIAL_CRON_SECRET") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const auth = req.headers.get("Authorization") ?? "";
  const presented = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

  const validCron = cronSecret.length > 0 && presented.length > 0 && constantTimeEqual(presented, cronSecret);
  const validService = serviceKey.length > 0 && presented.length > 0 && constantTimeEqual(presented, serviceKey);

  if (!validCron && !validService) {
    log("forbidden", { hasCronSecret: cronSecret.length > 0, hasPresented: presented.length > 0 });
    return json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceKey,
    { auth: { persistSession: false } },
  );

  const cutoff = Deno.env.get("FREEBETPRO_DATA_DE_CORTE") ?? "2026-05-03";

  try {
    // Busca procedures não-sincronizados elegíveis (até 50 por tick)
    const { data: procs, error: fetchErr } = await supabase
      .from("procedures")
      .select("*")
      .is("freebetpro_external_id", null)
      .eq("archived", false)
      .neq("platform", "")
      .not("platform", "is", null)
      .gte("date", cutoff)
      .order("date", { ascending: true })
      .limit(50);

    if (fetchErr) {
      log("query_error", { err: fetchErr.message });
      return json({ error: fetchErr.message }, { status: 500 });
    }

    log("batch_start", { count: procs?.length ?? 0, cutoff });

    if (!procs || procs.length === 0) {
      log("nothing_to_sync");
      return json({ ok: true, synced: 0, failed: 0, total: 0 });
    }

    let synced = 0, failed = 0;
    const errors: { num: string; err: string }[] = [];

    for (const proc of procs) {
      try {
        const payload = buildUpsertPayload(proc as any);

        const res = await callFreebetPro({
          method: "POST",
          path: "/procedimentos",
          body: payload,
          idempotencyKey: `${proc.id}:${proc.created_date ?? proc.date ?? ""}`,
        });

        const updates: Record<string, unknown> = {
          freebetpro_last_request_id: res.requestId,
        };

        if (res.ok) {
          updates.freebetpro_external_id = proc.id;
          updates.freebetpro_synced_at = new Date().toISOString();
          updates.freebetpro_last_error = null;
          if (res.numero != null) updates.freebetpro_numero = res.numero;
          synced++;
          log("synced", { id: proc.id, num: proc.procedure_number, fbStatus: res.status });
        } else {
          const errMsg = res.body?.error
            ? `${res.status} ${res.errorCode ?? ""} ${res.body.error.message ?? ""}`.trim()
            : `${res.status} ${JSON.stringify(res.body).slice(0, 200)}`;
          updates.freebetpro_last_error = errMsg;
          failed++;
          errors.push({ num: proc.procedure_number ?? proc.id, err: errMsg });
          log("failed", { id: proc.id, num: proc.procedure_number, status: res.status, errMsg });
        }

        await supabase.from("procedures").update(updates).eq("id", proc.id);

        // Pausa mínima entre chamadas para não saturar a API da FreeBet PRO
        await new Promise((r) => setTimeout(r, 120));
      } catch (e: any) {
        failed++;
        errors.push({ num: proc.procedure_number ?? proc.id, err: e?.message ?? "exception" });
        log("exception", { id: proc.id, num: proc.procedure_number, err: e?.message });
      }
    }

    log("batch_done", { synced, failed, total: procs.length });
    return json({ ok: true, synced, failed, total: procs.length, errors });
  } catch (e: any) {
    log("crash", { err: e?.message, stack: e?.stack?.slice(0, 500) });
    return json({ error: e?.message ?? "internal" }, { status: 500 });
  }
});

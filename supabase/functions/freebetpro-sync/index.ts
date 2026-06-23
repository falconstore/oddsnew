// Edge Function: freebetpro-sync
//
// Cliente HTTP da BetShark Pro pro endpoint público da FreeBet Pro
// (spec §8.5, aprovada em 2026-05-03). Recebe `{ procedure_id, action }`
// do app, monta o payload, assina com HMAC SHA-256 e dispara a chamada.
// Atualiza `procedures.freebetpro_*` com o resultado.
//
// AÇÕES:
//   - "upsert"   → POST /procedimentos (na 1ª sync) | PATCH /procedimentos/:external_id (atualizações)
//   - "result"   → POST /procedimentos/:id/resultado
//   - "archive"  → POST /procedimentos/:id/arquivar { arquivado: bool }
//   - "health"   → GET  /health (validação de auth)
//
// FILTRO DE CORTE (§1.3 da auditoria): só sincroniza procedures com
// `created_date >= FREEBETPRO_DATA_DE_CORTE` AND `archived=false` na ida
// inicial. Edições posteriores em rows que JÁ têm freebetpro_external_id
// continuam sincronizando (caso contrário, rows criadas depois do corte
// mas que viraram arquivadas deixariam de sincronizar o "arquivado=true").
//
// AUTH:
//   - Aceita JWT do app (verify_jwt=true) — qualquer usuário autenticado
//     do BetShark pode invocar. A função roda como service-role pra
//     atualizar a row.
//
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import {
  buildUpsertPayload,
  buildResultPayload,
  callFreebetPro,
} from "../_shared/freebetpro.ts";

const log = (event: string, data: Record<string, unknown>) => {
  console.log(JSON.stringify({ tag: "freebetpro-sync", event, ...data }));
};

type Action = "upsert" | "result" | "archive" | "delete" | "health";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    const body = await req.json().catch(() => ({}));
    const action = (body.action ?? "") as Action;

    // ---- /health (não toca em nenhum procedure) ----
    if (action === "health") {
      const res = await callFreebetPro({ method: "GET", path: "/health" });
      log("health", { status: res.status, ok: res.ok, requestId: res.requestId });
      return json({
        ok: res.ok,
        status: res.status,
        request_id: res.requestId,
        body: res.body,
      });
    }

    const procId = body.procedure_id as string | undefined;
    if (!procId) {
      return json({ ok: false, error: "procedure_id required" }, 400);
    }

    // Busca a row completa
    const { data: proc, error: fetchErr } = await supa
      .from("procedures")
      .select("*")
      .eq("id", procId)
      .single();
    if (fetchErr || !proc) {
      log("not_found", { procId, err: fetchErr?.message });
      return json({ ok: false, error: "procedure not found" }, 404);
    }

    // DATA_DE_CORTE: rows criadas antes do corte E que nunca foram
    // sincronizadas ficam fora pra sempre (passo 1.3 da auditoria).
    const cutoff = Deno.env.get("FREEBETPRO_DATA_DE_CORTE"); // YYYY-MM-DD
    const createdDate = (proc.created_date ?? proc.date) as string | null;
    const beforeCutoff = cutoff && createdDate && createdDate < cutoff;
    if (beforeCutoff && !proc.freebetpro_external_id) {
      log("skip_pre_cutoff", { procId, createdDate, cutoff });
      return json({ ok: true, skipped: "pre_cutoff" });
    }

    // ---- Validação pré-sync ----
    if (action === "upsert" && !(proc.platform as string)?.trim()) {
      const errMsg = "Plataforma não preenchida — edite o procedimento";
      log("skip_no_platform", { procId });
      await supa.from("procedures").update({ freebetpro_last_error: errMsg }).eq("id", procId);
      return json({ ok: false, error: errMsg }, 422);
    }

    // ---- Despacho por ação ----
    let res;
    if (action === "upsert") {
      const payload = buildUpsertPayload(proc as any);
      // 1ª sync → POST /procedimentos (cria); demais → PATCH /procedimentos/:external_id (atualiza).
      // FreeBet PRO retorna `created: false` em POST repetido, mas só PATCH propaga
      // alterações em campos como tachado, reenviado_*, duplo_green_*, fixture_id, etc.
      const alreadySynced = !!proc.freebetpro_external_id;
      if (alreadySynced) {
        // PATCH: o único campo que o validator deles ainda rejeita é `external_id`
        // (422 invalid_field — não pode ser alterado). Os demais (tachado_em,
        // reenviado_em, reenviado_count, duplo_green_*) já são aceitos desde 03/05.
        const PATCH_BLOCKLIST = new Set(["external_id"]);
        const patchBody: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
          if (!PATCH_BLOCKLIST.has(k)) patchBody[k] = v;
        }
        // Doc 06 §6 / §8 — flag `reenviar: true` dispara broadcast no Telegram da
        // FreeBet PRO. Só é enviado quando explicitamente solicitado pelo cliente
        // (ex.: useToggleReenviado marcando ou incrementando contador). Ausência
        // do flag = PATCH silencioso.
        if (body.reenviar === true) patchBody.reenviar = true;

        res = await callFreebetPro({
          method: "PATCH",
          path: `/procedimentos/${encodeURIComponent(proc.id)}`,
          body: patchBody,
        });

        // Fallback: se a FreeBet PRO devolveu 404, o procedimento sumiu do
        // lado deles (provavelmente apagado por op interna). Recriamos via
        // POST pra manter os dois lados em paridade — preserva o mesmo
        // external_id (= proc.id), mantendo histórico/relacionamentos.
        if (res.status === 404) {
          log("patch_404_fallback_to_post", { procId, requestId: res.requestId });
          res = await callFreebetPro({
            method: "POST",
            path: "/procedimentos",
            body: payload,
            idempotencyKey: `${proc.id}:recreate:${proc.created_date ?? ""}`,
          });
        }
      } else {
        res = await callFreebetPro({
          method: "POST",
          path: "/procedimentos",
          body: payload,
          idempotencyKey: `${proc.id}:${proc.created_date ?? ""}`,
        });
      }
    } else if (action === "result") {
      const payload = buildResultPayload({
        tipo: proc.tipo,
        resultado_lucro: proc.resultado_lucro,
        resultado_freebet_ganha: proc.resultado_freebet_ganha,
        freebet_creditada: proc.freebet_creditada,
        resultado_observacao: proc.resultado_observacao,
        duplo_green_confirmado: proc.duplo_green_confirmado,
        duplo_green_lucro: proc.duplo_green_lucro,
      });
      res = await callFreebetPro({
        method: "POST",
        path: `/procedimentos/${encodeURIComponent(proc.id)}/resultado`,
        body: payload,
      });
    } else if (action === "archive") {
      res = await callFreebetPro({
        method: "POST",
        path: `/procedimentos/${encodeURIComponent(proc.id)}/arquivar`,
        body: { arquivado: !!proc.archived },
      });
    } else if (action === "delete") {
      // Hard delete local → arquiva no FreeBet Pro (eles não têm endpoint de delete).
      // Deve ser chamado ANTES de deletar a row localmente, pra a busca acima funcionar.
      res = await callFreebetPro({
        method: "POST",
        path: `/procedimentos/${encodeURIComponent(proc.id)}/arquivar`,
        body: { arquivado: true },
      });
    } else {
      return json({ ok: false, error: "unknown action" }, 400);
    }

    log("call_done", {
      procId,
      action,
      status: res.status,
      ok: res.ok,
      requestId: res.requestId,
      errorCode: res.errorCode,
      // DEBUG: corpo completo da resposta quando NÃO ok (motivo real do 400/422)
      body: res.ok ? undefined : res.body,
    });

    // Persiste o resultado na row
    const updates: Record<string, unknown> = {
      freebetpro_last_request_id: res.requestId,
    };
    if (res.ok) {
      updates.freebetpro_external_id = proc.id; // = external_id deles
      updates.freebetpro_synced_at = res.syncedAt ?? new Date().toISOString();
      updates.freebetpro_last_error = null;
      if (res.numero != null) updates.freebetpro_numero = res.numero;
    } else {
      // Captura o motivo de forma robusta — a API pode devolver o erro em
      // formatos diferentes (error.message, error.details, message, ou cru).
      const e = res.body?.error;
      const detalhe =
        e?.message ??
        (e?.details ? JSON.stringify(e.details) : null) ??
        res.body?.message ??
        (res.body ? JSON.stringify(res.body) : "");
      const errMsg = `${res.status} ${res.errorCode ?? ""} ${detalhe ?? ""}`
        .trim()
        .slice(0, 300);
      updates.freebetpro_last_error = errMsg;
    }

    const { error: updErr } = await supa
      .from("procedures")
      .update(updates)
      .eq("id", procId);
    if (updErr) log("update_err", { procId, err: updErr.message });

    return json({
      ok: res.ok,
      status: res.status,
      request_id: res.requestId,
      synced_at: res.syncedAt,
      numero: res.numero,
      body: res.body,
    });
  } catch (e: any) {
    log("crash", { err: e?.message, stack: e?.stack?.slice(0, 500) });
    return json({ ok: false, error: e?.message ?? "internal" }, 500);
  }
});

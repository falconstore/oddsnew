// Edge Function: procedure-draft-save
//
// Gerencia o ciclo de vida dos rascunhos de procedimento (tabela
// procedure_drafts) no fluxo de REVISÃO. Concentra TODA escrita de status numa
// função service_role, em vez de depender da service_role exposta no frontend.
//
// Ações (campo "action" no body):
//   - "create":  cria um draft (status=pendente). Sobe as imagens (dataURL já
//                com marca d'água) pro bucket procedure-images em
//                drafts/{id}/... e guarda os PATHS no JSON, não o base64.
//   - "review":  aprova ou rejeita um draft (status -> aprovado | rejeitado).
//   - "sent":    marca um draft como enviado (status -> enviado, sent_at=now).
//
// Auth: exige Authorization Bearer (sessão do admin que chama da aba). O gating
// fino (quem pode revisar) é por aba no frontend.
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const log = (event: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ tag: "procedure-draft-save", event, ...data }));

const BUCKET = "procedure-images";

interface EntradaIn {
  casa: string;
  odd: string;
  aposte: string;
  link?: string;
  observacao?: string;
  freebet?: boolean;
  printDataUrl?: string | null; // base64 com marca d'água (vira image_path)
}

// dataURL "data:image/png;base64,XXXX" → { bytes, mime, ext }
function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string; ext: string } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  const mime = m[1];
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  return { bytes, mime, ext };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, { status: 405 });

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, { status: 401 });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    log("config_error", { hasUrl: !!SUPABASE_URL, hasKey: !!SERVICE_ROLE });
    return json({ error: "config do servidor incompleta" }, { status: 500 });
  }
  const supa = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "body inválido" }, { status: 400 }); }

  const action: string = body?.action ?? "create";

  // Sobe as imagens (dataURL → bucket) e devolve { entradas, calc } com os
  // image_path. Reaproveitado por create e resubmit. upsert=true sobrescreve.
  async function montarConteudo(draftId: string, entradasIn: EntradaIn[], calcIn: any) {
    const entradas: any[] = [];
    for (let i = 0; i < entradasIn.length; i++) {
      const e = entradasIn[i];
      let image_path: string | null = null;
      if (e.printDataUrl) {
        const parsed = dataUrlToBytes(e.printDataUrl);
        if (parsed) {
          const path = `drafts/${draftId}/entrada-${i + 1}.${parsed.ext}`;
          const { error: upErr } = await supa.storage
            .from(BUCKET).upload(path, parsed.bytes, { contentType: parsed.mime, upsert: true });
          if (upErr) throw new Error(`upload entrada ${i + 1}: ${upErr.message}`);
          image_path = path;
        }
      }
      entradas.push({
        casa: e.casa ?? "", odd: e.odd ?? "", aposte: e.aposte ?? "",
        link: e.link ?? "", observacao: e.observacao ?? "", freebet: !!e.freebet, image_path,
      });
    }
    let calc: any = null;
    if (calcIn && (calcIn.printDataUrl || calcIn.link)) {
      let calc_path: string | null = null;
      if (calcIn.printDataUrl) {
        const parsed = dataUrlToBytes(calcIn.printDataUrl);
        if (parsed) {
          const path = `drafts/${draftId}/calc.${parsed.ext}`;
          const { error: upErr } = await supa.storage
            .from(BUCKET).upload(path, parsed.bytes, { contentType: parsed.mime, upsert: true });
          if (upErr) throw new Error(`upload calc: ${upErr.message}`);
          calc_path = path;
        }
      }
      calc = { image_path: calc_path, link: calcIn.link ?? "", obs: calcIn.obs ?? "" };
    }
    return { entradas, calc };
  }

  try {
    // ── CREATE ───────────────────────────────────────────────────────────
    if (action === "create") {
      const texto: string = body?.texto ?? "";
      if (!texto.trim()) return json({ error: "texto obrigatório" }, { status: 400 });
      const entradasIn: EntradaIn[] = Array.isArray(body?.entradas) ? body.entradas : [];

      // 1) Insere o draft primeiro (sem imagens) pra ter o id e a pasta.
      const { data: created, error: insErr } = await supa
        .from("procedure_drafts")
        .insert({
          status: "pendente",
          template_id: body?.templateId ?? null,
          texto,
          entradas: [],
          calc: null,
          created_by_email: body?.createdByEmail ?? null,
          created_by_id: body?.createdById ?? null,
        })
        .select("id")
        .single();
      if (insErr) throw new Error(`insert draft: ${insErr.message}`);
      const draftId = created.id as string;

      // 2) Sobe imagens + monta entradas/calc finais.
      const { entradas, calc } = await montarConteudo(draftId, entradasIn, body?.calc);

      // 3) Atualiza o draft com as entradas + calc finais.
      const { error: updErr } = await supa
        .from("procedure_drafts")
        .update({ entradas, calc })
        .eq("id", draftId);
      if (updErr) throw new Error(`update draft: ${updErr.message}`);

      log("created", { draftId, entradas: entradas.length });
      return json({ ok: true, id: draftId });
    }

    // ── RESUBMIT (corrigir um rejeitado e reenviar — REABRE o mesmo) ──────
    if (action === "resubmit") {
      const id: string = body?.id;
      const texto: string = body?.texto ?? "";
      if (!id) return json({ error: "id obrigatório" }, { status: 400 });
      if (!texto.trim()) return json({ error: "texto obrigatório" }, { status: 400 });
      const entradasIn: EntradaIn[] = Array.isArray(body?.entradas) ? body.entradas : [];

      // Sobe as imagens (reusa a pasta do próprio draft, com upsert).
      const { entradas, calc } = await montarConteudo(id, entradasIn, body?.calc);

      // Reabre: volta pra pendente e limpa os dados da revisão anterior.
      // Só permite se ainda estiver 'rejeitado' (evita corrida/reabrir aprovado).
      const { data: updated, error } = await supa
        .from("procedure_drafts")
        .update({
          status: "pendente",
          texto,
          template_id: body?.templateId ?? null,
          entradas,
          calc,
          reviewed_by_email: null,
          reviewed_at: null,
          reject_reason: null,
        })
        .eq("id", id)
        .eq("status", "rejeitado")
        .select("id");
      if (error) throw new Error(`resubmit: ${error.message}`);
      if (!updated || updated.length === 0) {
        log("resubmit_noop", { id });
        return json({ ok: false, error: "este rascunho não está mais rejeitado", conflict: true }, { status: 409 });
      }
      log("resubmitted", { id, entradas: entradas.length });
      return json({ ok: true, id });
    }

    // ── REVIEW (aprovar / rejeitar) ──────────────────────────────────────
    if (action === "review") {
      const id: string = body?.id;
      const decision: string = body?.decision; // 'aprovado' | 'rejeitado'
      if (!id) return json({ error: "id obrigatório" }, { status: 400 });
      if (decision !== "aprovado" && decision !== "rejeitado") {
        return json({ error: "decision inválida" }, { status: 400 });
      }
      const { data: updated, error } = await supa
        .from("procedure_drafts")
        .update({
          status: decision,
          reviewed_by_email: body?.reviewedByEmail ?? null,
          reviewed_at: new Date().toISOString(),
          reject_reason: decision === "rejeitado" ? (body?.rejectReason ?? null) : null,
        })
        .eq("id", id)
        .eq("status", "pendente") // só revisa o que está pendente (evita corrida)
        .select("id");
      if (error) throw new Error(`review: ${error.message}`);
      if (!updated || updated.length === 0) {
        // Outro revisor já decidiu este procedimento.
        log("review_noop", { id, decision });
        return json({ ok: false, error: "este procedimento já foi revisado por outra pessoa", conflict: true }, { status: 409 });
      }
      log("reviewed", { id, decision });
      return json({ ok: true });
    }

    // ── DELETE (exclui o rascunho do sistema + imagens do Storage) ───────
    if (action === "delete") {
      const id: string = body?.id;
      if (!id) return json({ error: "id obrigatório" }, { status: 400 });

      // Remove a pasta de imagens do draft no Storage (best-effort).
      try {
        const { data: files } = await supa.storage.from(BUCKET).list(`drafts/${id}`);
        if (files && files.length) {
          const paths = files.map((f: any) => `drafts/${id}/${f.name}`);
          await supa.storage.from(BUCKET).remove(paths);
        }
      } catch (e: any) {
        log("delete_storage_warn", { id, error: e?.message });
      }

      const { error } = await supa.from("procedure_drafts").delete().eq("id", id);
      if (error) throw new Error(`delete: ${error.message}`);
      log("deleted_draft", { id });
      return json({ ok: true });
    }

    // Obs.: a transição aprovado → enviado é feita pelo procedure-send
    // (claim-then-send atômico), não aqui, pra evitar dois caminhos de escrita.

    return json({ error: "action desconhecida" }, { status: 400 });
  } catch (e: any) {
    log("error", { action, error: e?.message });
    return json({ ok: false, error: e?.message ?? "erro" }, { status: 500 });
  }
});

// Edge Function: zapi-followup
// Chamada a cada 2 minutos pelo pg_cron.
// Processa dois eventos agendados para leads que acabaram de receber credenciais:
//
//   1. +5min  → Envia vídeo de boas-vindas (se ZAPI_WELCOME_VIDEO_URL configurada)
//   2. +10min → Envia mensagem de confirmação "Deu certo entrar?"
//
// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendZApiButtonList, sendZApiVideo } from "../_shared/zapi.ts";

const log = (event: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ tag: "zapi-followup", event, ...data }));

const CONFIRM_BUTTONS = [
  { id: "conf_sim",   label: "✅ SIM, deu certo!" },
  { id: "conf_nao",   label: "❌ NÃO consegui" },
  { id: "conf_ajuda", label: "🆘 Preciso de ajuda" },
];

const CONFIRM_MESSAGES = [
  "Opa, aqui é o Lucas! 👋\n\nDeu certo entrar no *Grupo VIP Telegram* ou baixar o *App VIP Shark*? 🦈",
  "E aí! Lucas aqui da equipe Shark Green 🦈\n\nConseguiu acessar o *Telegram VIP* ou o *App VIP Shark*?",
  "Oi! Passando rapidinho — sou o Lucas do Shark Green 🦈\n\nConseguiu entrar no *Grupo VIP* ou no *App*?",
];

function randomConfirmMessage(): string {
  return CONFIRM_MESSAGES[Math.floor(Math.random() * CONFIRM_MESSAGES.length)];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const now = new Date().toISOString();
  const welcomeVideoUrl = Deno.env.get("ZAPI_WELCOME_VIDEO_URL") ?? "";

  // ── Passo 1: Vídeo de boas-vindas (+5min) ─────────────────────────────────
  let videoProcessed = 0;
  if (welcomeVideoUrl) {
    const { data: pendingVideo } = await supabase
      .from("zapi_conversation_state")
      .select("phone")
      .eq("step", "done")
      .eq("welcome_video_sent", false)
      .not("welcome_video_at", "is", null)
      .lte("welcome_video_at", now)
      .limit(2); // 2 por execução: cada vídeo pode levar até 20s (timeout) → máx 40s

    if (pendingVideo?.length) {
      log("video-processing", { count: pendingVideo.length });

      for (const row of pendingVideo) {
        try {
          // CAS guard — marca como enviado antes de tentar (evita duplo envio)
          const { count } = await supabase
            .from("zapi_conversation_state")
            .update({
              welcome_video_sent: true,
              updated_at: new Date().toISOString(),
            })
            .eq("phone", row.phone)
            .eq("welcome_video_sent", false)
            .select("phone", { count: "exact", head: true });

          if (!count) continue; // outra instância já processou

          const result = await sendZApiVideo({
            phone: row.phone,
            videoUrl: welcomeVideoUrl,
            caption: "🎥 Assista esse vídeo para aproveitar ao máximo seu trial no *Shark Green* 🦈",
          });

          if (!result.ok) {
            log("video-error", { phone: row.phone.slice(0, 6) + "****", error: result.error });
          } else {
            log("video-sent", { phone: row.phone.slice(0, 6) + "****" });
            videoProcessed++;
          }

          if (pendingVideo.length > 1) await sleep(2000);
        } catch (e) {
          log("video-exception", { phone: row.phone.slice(0, 6) + "****", error: String(e) });
        }
      }
    }
  }

  // ── Passo 2: Confirmação (+10min) ─────────────────────────────────────────
  const { data: pending, error } = await supabase
    .from("zapi_conversation_state")
    .select("phone, lead_id")
    .eq("step", "done")
    .eq("follow_up_sent", false)
    .not("follow_up_at", "is", null)
    .lte("follow_up_at", now)
    .limit(20);

  if (error) {
    log("query-error", { error: error.message });
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }

  let processed = 0;
  if (pending?.length) {
    log("confirm-processing", { count: pending.length });

    for (const row of pending) {
      try {
        // Marca como enviado primeiro (evita envio duplo em caso de retry)
        await supabase
          .from("zapi_conversation_state")
          .update({
            follow_up_sent: true,
            step: "awaiting_confirmation",
            updated_at: new Date().toISOString(),
          })
          .eq("phone", row.phone)
          .eq("follow_up_sent", false); // guarda de CAS

        const result = await sendZApiButtonList({
          phone: row.phone,
          message: randomConfirmMessage(),
          buttonList: { buttons: CONFIRM_BUTTONS },
        });

        if (!result.ok) {
          log("confirm-failed", { phone: row.phone.slice(0, 6) + "****", error: result.error });
        } else {
          log("confirm-sent", { phone: row.phone.slice(0, 6) + "****" });
          processed++;
        }

        if (pending.length > 1) await sleep(2000);
      } catch (e) {
        log("confirm-error", { phone: row.phone.slice(0, 6) + "****", error: String(e) });
      }
    }
  }

  log("done", { video_processed: videoProcessed, confirm_processed: processed });

  return new Response(JSON.stringify({ ok: true, video_processed: videoProcessed, confirm_processed: processed }), {
    headers: { "Content-Type": "application/json" },
  });
});

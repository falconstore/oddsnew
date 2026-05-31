// Edge Function: zapi-followup
// Chamada a cada 2 minutos pelo pg_cron.
// Busca leads com follow_up_at <= now(), step = 'done', follow_up_sent = false
// e envia a mensagem de confirmação de 10 min pós escolha do menu.
//
// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendZApiButtonList } from "../_shared/zapi.ts";

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

  // Busca pendentes
  const { data: pending, error } = await supabase
    .from("zapi_conversation_state")
    .select("phone, lead_id")
    .eq("step", "done")
    .eq("follow_up_sent", false)
    .not("follow_up_at", "is", null)
    .lte("follow_up_at", new Date().toISOString())
    .limit(20);

  if (error) {
    log("query-error", { error: error.message });
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }

  if (!pending || pending.length === 0) {
    log("no-pending");
    return new Response(JSON.stringify({ ok: true, processed: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  log("processing", { count: pending.length });

  let processed = 0;
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

      // Envia o menu de confirmação
      const result = await sendZApiButtonList({
        phone: row.phone,
        message: randomConfirmMessage(),
        buttonList: { buttons: CONFIRM_BUTTONS },
      });

      if (!result.ok) {
        log("send-failed", { phone: row.phone.slice(0, 6) + "****", error: result.error });
      } else {
        log("sent", { phone: row.phone.slice(0, 6) + "****" });
        processed++;
      }

      // Delay entre mensagens para não saturar a instância Z-API
      if (pending.length > 1) await sleep(2000);
    } catch (e) {
      log("error", { phone: row.phone.slice(0, 6) + "****", error: String(e) });
    }
  }

  return new Response(JSON.stringify({ ok: true, processed }), {
    headers: { "Content-Type": "application/json" },
  });
});

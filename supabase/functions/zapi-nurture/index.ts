// Edge Function: zapi-nurture
// Worker unificado chamado a cada 5 min pelo cron + gatilho especial às 23h.
//
// Responsabilidades:
//   Ponto 1 — Cobrança de inatividade: lead recebeu menu (awaiting_choice) mas não clicou
//             1ª cobrança: +10 min | 2ª: +30 min | 3ª: +2h
//   Ponto 2 — Resultado diário às 23h: envia resumo do dia pra todos leads ativos com WhatsApp
//   Ponto 3 — Nurture de 7 dias: mensagens nos dias 2, 3, 5, 6, 7 após entered_at
//
// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendZApiText, sendZApiButtonList, sendZApiImage } from "../_shared/zapi.ts";

const log = (event: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ tag: "zapi-nurture", event, ts: new Date().toISOString(), ...data }));

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── URLs configuráveis via env ─────────────────────────────────────────────
const CHECKOUT_URL = Deno.env.get("ZAPI_CHECKOUT_URL") || "https://lastlink.com/p/CEAEE6585/checkout-payment";
const DAY5_VIDEO_URL = Deno.env.get("ZAPI_DAY5_VIDEO_URL") || ""; // YouTube/Drive — configure quando tiver
const DAY7_IMAGE_URL = Deno.env.get("ZAPI_DAY7_IMAGE_URL") || ""; // URL pública da imagem dos planos

// ── Helpers ────────────────────────────────────────────────────────────────

function buildPhone55(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55")) return digits;
  return "55" + digits;
}

function daysSince(date: string): number {
  const ms = Date.now() - new Date(date).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function todayBR(): string {
  // Data de hoje no fuso de Brasília (UTC-3)
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function formatDate(dateStr: string): string {
  const [y, m, day] = dateStr.split("-");
  return `${day}/${m}`;
}

// ── Ponto 1: Mensagens de cobrança de inatividade ─────────────────────────

const NUDGE_MESSAGES = [
  // 1ª cobrança (10 min)
  "Oi! Vi que você ainda não acessou seu trial do Shark Green 🦈\n\nSeu acesso de *7 dias grátis* ainda está esperando por você — é só clicar num dos botões abaixo e começar agora! 👇",
  // 2ª cobrança (30 min)
  "Fala! Seu acesso ao *Shark Green* está liberado e o pessoal já está operando hoje 🔥\n\nNão perde tempo — clica no botão abaixo e já entra no grupo! 👇",
  // 3ª cobrança (2h)
  "Última chamada! ⏰\n\nSeu trial de *7 dias grátis* ainda está ativo, mas não quero que você perca o dia de hoje.\n\nSe precisar de ajuda pra entrar, é só me falar aqui! 👇",
];

const NUDGE_BUTTONS = [
  { id: "opt_telegram", label: "📲 Telegram VIP" },
  { id: "opt_app",      label: "📱 App VIP Shark" },
  { id: "opt_both",     label: "🎯 Os Dois" },
];

// Intervalos em minutos para cada nudge
const NUDGE_INTERVALS = [10, 30, 120];

async function processNudges(supabase: ReturnType<typeof createClient>): Promise<number> {
  const now = new Date().toISOString();

  const { data: pending } = await supabase
    .from("zapi_conversation_state")
    .select("phone, nudge_count, nudge_at")
    .eq("step", "awaiting_choice")
    .not("nudge_at", "is", null)
    .lte("nudge_at", now)
    .lt("nudge_count", 3)
    .limit(20);

  if (!pending?.length) return 0;

  let sent = 0;
  for (const row of pending) {
    try {
      const count = row.nudge_count ?? 0;
      const msg = NUDGE_MESSAGES[count] ?? NUDGE_MESSAGES[2];

      // Marca como processado imediatamente (evita duplo envio)
      const nextCount = count + 1;
      const nextInterval = NUDGE_INTERVALS[nextCount]; // undefined se for o último
      const nextNudgeAt = nextInterval
        ? new Date(Date.now() + nextInterval * 60 * 1000).toISOString()
        : null;

      await supabase.from("zapi_conversation_state")
        .update({
          nudge_count: nextCount,
          nudge_at: nextNudgeAt,
          updated_at: new Date().toISOString(),
        })
        .eq("phone", row.phone)
        .eq("nudge_count", count); // CAS guard

      await sendZApiButtonList({
        phone: row.phone,
        message: msg,
        buttonList: { buttons: NUDGE_BUTTONS },
      });

      log("nudge-sent", { phone: row.phone.slice(0, 6) + "****", nudge: nextCount });
      sent++;
      if (pending.length > 1) await sleep(1500);
    } catch (e) {
      log("nudge-error", { phone: row.phone.slice(0, 6) + "****", error: String(e) });
    }
  }
  return sent;
}

// ── Ponto 2: Resultado diário às 23h ──────────────────────────────────────

async function sendDailyResult(supabase: ReturnType<typeof createClient>): Promise<number> {
  const today = todayBR();

  log("daily-result-start", { today });

  // Busca procedimentos do dia (não arquivados, não tachados, com resultado)
  const { data: procs } = await supabase
    .from("procedures")
    .select("profit_loss, resultado_lucro, duplo_green_lucro, duplo_green_confirmado, tipo, freebet_value, resultado_freebet_ganha")
    .eq("date", today)
    .eq("archived", false)
    .eq("tachado", false);

  if (!procs?.length) {
    log("daily-result-no-procs", { today });
    return 0;
  }

  // Calcula lucro efetivo de cada proc (mesma lógica do relatório diário)
  let totalLucro = 0;
  let totalFreebets = 0;
  let valorFreebets = 0;
  let totalOperacoes = procs.length;

  for (const p of procs) {
    // lucro_efetivo: duplo_green_lucro > resultado_lucro > profit_loss
    const lucroEfetivo =
      (p.duplo_green_confirmado && p.duplo_green_lucro != null)
        ? Number(p.duplo_green_lucro)
        : (p.resultado_lucro != null ? Number(p.resultado_lucro) : Number(p.profit_loss ?? 0));
    totalLucro += lucroEfetivo;

    // Freebets ganhas (tipo GANHAR_FB com resultado)
    if (p.tipo === "GANHAR_FB" && Number(p.resultado_freebet_ganha ?? 0) > 0) {
      totalFreebets++;
      valorFreebets += Number(p.resultado_freebet_ganha);
    }
  }

  const lucro1cpf = totalLucro;
  const lucro5cpf = totalLucro * 5;

  const dateLabel = formatDate(today);
  const fbText = totalFreebets > 0
    ? `\n🎰 *Freebets:* ${totalFreebets} somando R$ ${valorFreebets.toFixed(2).replace(".", ",")}`
    : "";

  const msg = [
    `📊 *Resultado Shark Green — ${dateLabel}*`,
    ``,
    `📋 *Operações:* ${totalOperacoes}${fbText}`,
    `💰 *Lucro por CPF:* R$ ${lucro1cpf.toFixed(2).replace(".", ",")}`,
    ``,
    `_Se fossem apenas 5 CPF's, seu resultado hoje seria de *R$ ${lucro5cpf.toFixed(2).replace(".", ",")}*_ 🦈`,
    ``,
    `Bora de operações amanhã! 🚀`,
  ].join("\n");

  // Envia pra todos leads ativos com WhatsApp
  const { data: leads } = await supabase
    .from("trial_leads")
    .select("whatsapp")
    .in("status", ["active", "converted"])
    .not("whatsapp", "is", null);

  if (!leads?.length) return 0;

  let sent = 0;
  for (const lead of leads) {
    if (!lead.whatsapp) continue;
    try {
      const phone = buildPhone55(lead.whatsapp);
      await sendZApiText({ phone, message: msg });
      sent++;
      await sleep(1200); // cadência suave
    } catch (e) {
      log("daily-result-send-error", { error: String(e) });
    }
  }

  log("daily-result-done", { sent, totalLucro, totalOperacoes });
  return sent;
}

// ── Ponto 3: Nurture de 7 dias ────────────────────────────────────────────

async function processNurture(supabase: ReturnType<typeof createClient>): Promise<number> {
  // Busca leads ativos que entraram há pelo menos 1 dia
  const { data: leads } = await supabase
    .from("trial_leads")
    .select("id, whatsapp, name, email, nurture_day, entered_at, expires_at, subscription_status, status, day7_offer_sent_at, day7_nudge1_sent_at, day7_nudge2_sent_at")
    .eq("status", "active")
    .not("entered_at", "is", null)
    .not("whatsapp", "is", null);

  if (!leads?.length) return 0;

  let sent = 0;

  for (const lead of leads) {
    try {
      const days = daysSince(lead.entered_at);
      const phone = buildPhone55(lead.whatsapp);
      const nome = (lead.name ?? "").split(" ")[0] || "mano";
      const nurtureDay = lead.nurture_day ?? 0;
      const isSubscriber = lead.subscription_status === "active" || lead.status === "converted";

      // ── Dia 7: fluxo especial com múltiplos follow-ups ──────────────────
      if (days >= 7) {
        // Se já assinou, ignora
        if (isSubscriber) continue;

        const now = Date.now();

        // Oferta inicial do dia 7 (uma vez)
        if (!lead.day7_offer_sent_at && nurtureDay < 7) {
          await sendDay7Offer(supabase, lead, phone, nome);
          sent++;
          await sleep(1500);
          continue;
        }

        // +1h após oferta (se não assinou)
        if (lead.day7_offer_sent_at && !lead.day7_nudge1_sent_at) {
          const elapsed = now - new Date(lead.day7_offer_sent_at).getTime();
          if (elapsed >= 60 * 60 * 1000) { // 1h
            await sendDay7Nudge1(supabase, lead, phone, nome);
            sent++;
            await sleep(1500);
            continue;
          }
        }

        // +4h após oferta (se não assinou)
        if (lead.day7_offer_sent_at && lead.day7_nudge1_sent_at && !lead.day7_nudge2_sent_at) {
          const elapsed = now - new Date(lead.day7_offer_sent_at).getTime();
          if (elapsed >= 4 * 60 * 60 * 1000) { // 4h
            await sendDay7Nudge2(supabase, lead, phone, nome);
            sent++;
            await sleep(1500);
            continue;
          }
        }

        // 23h59: remove acesso e notifica
        if (lead.day7_nudge2_sent_at && nurtureDay < 8) {
          const now_hour = new Date(Date.now() - 3 * 60 * 60 * 1000).getUTCHours();
          if (now_hour >= 23) {
            await removeAndNotify(supabase, lead, phone, nome);
            sent++;
            await sleep(1500);
          }
        }
        continue;
      }

      // ── Dias 2, 3, 5, 6 ─────────────────────────────────────────────────
      if (days < 2 || nurtureDay >= days) continue; // já enviou para este dia

      let message: string | null = null;

      if (days === 2 && nurtureDay < 2) {
        message = `E aí, ${nome}! Tudo bem? 😊\n\nEstou passando pra saber como você está se saindo no Shark Green 🦈\n\nJá deu pra dar uma olhada nos procedimentos? Posso te ajudar em algo?`;
      } else if (days === 3 && nurtureDay < 3) {
        message = `Fala, ${nome}! 👋\n\nViu o resultado de ontem? A galera foi muito bem nas operações do dia! 📊\n\nSe tiver alguma dúvida sobre como acompanhar os procedimentos, estou aqui pra te ajudar! 🦈`;
      } else if (days === 5 && nurtureDay < 5) {
        // Dia 5: vídeo (se URL configurada) ou texto
        if (DAY5_VIDEO_URL) {
          await sendZApiText({ phone, message: `${nome}, gravei um vídeo especial pra você! 🎥\n\nMostra como aproveitar cada procedimento ao máximo e tirar os melhores resultados 🦈\n\n👉 ${DAY5_VIDEO_URL}\n\nAssiste e me conta o que achou! Se tiver dúvida, o botão abaixo te conecta comigo 👇` });
          await sleep(500);
          await sendZApiButtonList({
            phone,
            message: "Posso te ajudar com alguma coisa?",
            buttonList: { buttons: [{ id: "conf_ajuda", label: "🆘 Quero ajuda" }] },
          });
        } else {
          message = `${nome}, você está no *5º dia* do seu trial e não quero que você perca nenhum procedimento! 🦈\n\nA equipe está aqui pra te guiar. Se precisar de ajuda pra começar ou tiver qualquer dúvida, é só me chamar! 💪`;
        }
        await supabase.from("trial_leads").update({ nurture_day: 5, nurture_sent_at: new Date().toISOString() }).eq("id", lead.id);
        sent++;
        await sleep(1500);
        continue;
      } else if (days === 6 && nurtureDay < 6) {
        message = `${nome}, o prazo do seu trial grátis está chegando ao fim! ⏰\n\nAmanhã vou te enviar uma *promoção exclusiva* que preparamos especialmente pro seu perfil 🎁\n\nFique de olho aqui — vai valer muito a pena! 🦈`;
      }

      if (message) {
        await sendZApiText({ phone, message });
        await supabase.from("trial_leads")
          .update({ nurture_day: days, nurture_sent_at: new Date().toISOString() })
          .eq("id", lead.id);
        log("nurture-sent", { email: lead.email, day: days });
        sent++;
        await sleep(1500);
      }
    } catch (e) {
      log("nurture-error", { email: lead.email, error: String(e) });
    }
  }

  return sent;
}

// ── Dia 7: Oferta inicial ─────────────────────────────────────────────────

async function sendDay7Offer(supabase: ReturnType<typeof createClient>, lead: any, phone: string, nome: string) {
  const msg = [
    `${nome}, hoje é o *último dia do seu trial* no Shark Green! 🦈`,
    ``,
    `Preparamos uma *oferta exclusiva* pra você continuar tendo acesso e não parar de crescer:`,
    ``,
    `📅 *Mensal* — R$ 148,90/mês`,
    `⭐ *Melhor plano* — Trimestral R$ 297,00 (R$ 99/mês)`,
    `🏆 *Anual* — R$ 893,90 (R$ 74,49/mês)`,
    ``,
    `_Após o pagamento, seu acesso é mantido sem interrupção_ ✅`,
    ``,
    `Escolhe seu plano 👇`,
  ].join("\n");

  // Se tiver imagem dos planos, envia com imagem; senão, botões de texto
  if (DAY7_IMAGE_URL) {
    await sendZApiImage({
      phone,
      imageUrl: DAY7_IMAGE_URL,
      caption: msg,
    });
    await sleep(1000);
  }

  await sendZApiButtonList({
    phone,
    message: DAY7_IMAGE_URL ? "Escolhe seu plano 👇" : msg,
    buttonList: {
      buttons: [
        { id: "day7_mensal",    label: "📅 Mensal R$ 148,90" },
        { id: "day7_trimestre", label: "⭐ Melhor plano" },
        { id: "day7_anual",     label: "🏆 Anual R$ 893,90" },
      ],
    },
  });

  await supabase.from("trial_leads").update({
    nurture_day: 7,
    nurture_sent_at: new Date().toISOString(),
    day7_offer_sent_at: new Date().toISOString(),
  }).eq("id", lead.id);

  log("day7-offer-sent", { email: lead.email });
}

// ── Dia 7: +1h após oferta ────────────────────────────────────────────────

async function sendDay7Nudge1(supabase: ReturnType<typeof createClient>, lead: any, phone: string, nome: string) {
  const msg = `${nome}, vi que você ainda não garantiu sua assinatura 😕\n\nO Shark Green continua operando todos os dias — não deixa o dinheiro na mesa!\n\nGarante seu acesso agora 👇\n${CHECKOUT_URL}`;
  await sendZApiText({ phone, message: msg });
  await supabase.from("trial_leads").update({ day7_nudge1_sent_at: new Date().toISOString() }).eq("id", lead.id);
  log("day7-nudge1-sent", { email: lead.email });
}

// ── Dia 7: +4h após oferta ────────────────────────────────────────────────

async function sendDay7Nudge2(supabase: ReturnType<typeof createClient>, lead: any, phone: string, nome: string) {
  const msg = `${nome}, infelizmente se você não assinar hoje à meia-noite vai perder o acesso ao Shark Green 😔\n\nA galera está operando e colocando R$ 200/dia no bolso — não quero que você fique de fora!\n\nÉ só um clique pra continuar:\n${CHECKOUT_URL}`;
  await sendZApiText({ phone, message: msg });
  await supabase.from("trial_leads").update({ day7_nudge2_sent_at: new Date().toISOString() }).eq("id", lead.id);
  log("day7-nudge2-sent", { email: lead.email });
}

// ── Dia 7: Remoção às 23h59 ───────────────────────────────────────────────

async function removeAndNotify(supabase: ReturnType<typeof createClient>, lead: any, phone: string, nome: string) {
  // Remove do grupo Telegram via bot
  if (lead.telegram_user_id) {
    const botToken = Deno.env.get("TELEGRAM_TRIAL_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_TRIAL_CHAT_ID");
    if (botToken && chatId) {
      try {
        await fetch(`https://api.telegram.org/bot${botToken}/banChatMember`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: Number(chatId),
            user_id: lead.telegram_user_id,
            revoke_messages: false,
          }),
        });
        // Desbane logo após para não bloquear permanentemente
        await sleep(500);
        await fetch(`https://api.telegram.org/bot${botToken}/unbanChatMember`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: Number(chatId), user_id: lead.telegram_user_id }),
        });
      } catch (e) {
        log("telegram-remove-error", { error: String(e) });
      }
    }
  }

  // Atualiza status no banco
  await supabase.from("trial_leads").update({
    status: "expired",
    removed_at: new Date().toISOString(),
    nurture_day: 8,
  }).eq("id", lead.id);

  // Mensagem de saída com link do grupo free
  const msg = [
    `${nome}, infelizmente seu trial de 7 dias encerrou hoje 😔`,
    ``,
    `Mas não fica triste! Se ainda não for o momento certo pra você assinar, você pode continuar acompanhando nossos resultados e de alunos no *grupo free*:`,
    ``,
    `👉 https://t.me/sharkgreenfree2`,
    ``,
    `Quando você estiver pronto, é só me chamar aqui que eu te mando a oferta especial! 🦈`,
  ].join("\n");

  await sendZApiText({ phone, message: msg });
  log("day7-removed", { email: lead.email });
}

// ── Handler de botões do dia 7 (link de pagamento) ────────────────────────
// Esta lógica fica no zapi-reply — aqui só registramos a referência
// Os IDs: day7_mensal, day7_trimestre, day7_anual → zapi-reply envia o link

// ── Serve ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* sem body */ }

  const source = String(body.source ?? "cron");

  log("start", { source });

  // Gatilho específico de resultado diário (chamado às 23h)
  if (source === "daily_result") {
    const sent = await sendDailyResult(supabase);
    return new Response(JSON.stringify({ ok: true, sent_daily_result: sent }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Worker geral (cron a cada 5 min)
  const [nudges, nurture] = await Promise.all([
    processNudges(supabase),
    processNurture(supabase),
  ]);

  log("done", { nudges, nurture });

  return new Response(JSON.stringify({ ok: true, nudges, nurture }), {
    headers: { "Content-Type": "application/json" },
  });
});

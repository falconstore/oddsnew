// Edge Function: ads-signup
// Captura lead da landing /ads (tráfego pago).
// Aceita apenas nome + whatsapp (sem email/telegram obrigatório).
// Gera placeholders pra email e telegram_username.
// Persiste UTMs + fbclid pra rastreio de anúncios.
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { getClientIp, sendMetaCapiEvent } from "../_shared/meta-capi.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, { status: 405 });

  try {
    const body = await req.json().catch(() => ({}));

    const name = String(body.name ?? "").trim();
    const whatsapp = String(body.whatsapp ?? "").replace(/\D/g, "");

    // UTMs e fbclid para rastreio de anúncios
    const utm_source   = typeof body.utm_source   === "string" ? body.utm_source.slice(0, 255)   : null;
    const utm_medium   = typeof body.utm_medium   === "string" ? body.utm_medium.slice(0, 255)   : null;
    const utm_campaign = typeof body.utm_campaign === "string" ? body.utm_campaign.slice(0, 255) : null;
    const utm_content  = typeof body.utm_content  === "string" ? body.utm_content.slice(0, 255)  : null;
    const utm_term     = typeof body.utm_term     === "string" ? body.utm_term.slice(0, 255)     : null;
    const fbclid       = typeof body.fbclid       === "string" ? body.fbclid.slice(0, 512)       : null;

    // Pixel / CAPI deduplication
    const eventIdRaw = typeof body.event_id === "string" ? body.event_id.trim() : "";
    const leadEventId = eventIdRaw && eventIdRaw.length <= 128 ? eventIdRaw : null;
    const eventSourceUrl = typeof body.event_source_url === "string"
      ? body.event_source_url.slice(0, 512) : null;
    const fbp = typeof body.fbp === "string" ? body.fbp.slice(0, 256) : null;
    const fbc = typeof body.fbc === "string" ? body.fbc.slice(0, 256) : null;

    if (!name || name.length < 2) {
      return json({ error: "Informe seu nome completo." }, { status: 400 });
    }
    if (whatsapp.length < 10) {
      return json({ error: "WhatsApp inválido (mínimo 10 dígitos com DDD)." }, { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const botToken    = Deno.env.get("TELEGRAM_TRIAL_BOT_TOKEN");
    const chatId      = Deno.env.get("TELEGRAM_TRIAL_CHAT_ID");

    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Backend não configurado." }, { status: 500 });
    }
    if (!botToken || !chatId) {
      return json({ error: "Bot do Telegram não configurado. Avise o suporte." }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // Placeholders únicos para campos obrigatórios de outros fluxos
    const email            = `ads_${whatsapp}@placeholder.betshark`;
    const telegram_username = `ads_${whatsapp}`;

    // Dedup: whatsapp OU placeholder email/telegram
    const { data: existing, error: dupErr } = await supabase
      .from("trial_leads")
      .select("id")
      .or(`whatsapp.eq.${whatsapp},email.eq.${email},telegram_username.eq.${telegram_username}`)
      .limit(1);

    if (dupErr) {
      console.error("ads-signup: dup check error", dupErr);
      return json({ error: "Erro ao validar cadastro." }, { status: 500 });
    }
    if (existing && existing.length > 0) {
      return json({
        error: "Esse WhatsApp já foi cadastrado. Se precisar de ajuda, fale com o suporte.",
      }, { status: 409 });
    }

    // Cria invite link no Telegram (24h, 1 uso)
    const expireDate = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
    const tgRes = await fetch(
      `https://api.telegram.org/bot${botToken}/createChatInviteLink`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          member_limit: 1,
          expire_date: expireDate,
          name: `Ads ${whatsapp.slice(-4)}`.slice(0, 32),
          creates_join_request: false,
        }),
      },
    );
    const tgData = await tgRes.json().catch(() => ({}));
    if (!tgRes.ok || !tgData?.ok) {
      console.error("ads-signup: telegram createChatInviteLink failed", tgData);
      return json({
        error: "Não foi possível gerar o link do grupo. Tente novamente em instantes.",
      }, { status: 502 });
    }
    const inviteLink: string = tgData.result.invite_link;

    // Grupo bônus (opcional, mesma lógica do trial-signup)
    const bonusChatId = Deno.env.get("TELEGRAM_TRIAL_BONUS_CHAT_ID");
    let bonusInviteLink: string | null = null;
    if (bonusChatId) {
      try {
        const bonusRes = await fetch(
          `https://api.telegram.org/bot${botToken}/createChatInviteLink`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: bonusChatId,
              member_limit: 1,
              expire_date: expireDate,
              name: `Ads ${whatsapp.slice(-4)} bonus`.slice(0, 32),
              creates_join_request: false,
            }),
          },
        );
        const bonusData = await bonusRes.json().catch(() => ({}));
        if (bonusRes.ok && bonusData?.ok && bonusData.result?.invite_link) {
          bonusInviteLink = bonusData.result.invite_link as string;
        }
      } catch (e) {
        console.warn("ads-signup: bonus invite link error", e);
      }
    }

    // Insere o lead com cohort='ads' e UTMs
    const { data: inserted, error: insertErr } = await supabase
      .from("trial_leads")
      .insert({
        name,
        email,
        whatsapp,
        telegram_username,
        invite_link: inviteLink,
        bonus_invite_link: bonusInviteLink,
        status: "pending",
        cohort: "ads",
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term,
        fbclid,
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      const pgCode = (insertErr as { code?: string } | null)?.code;
      if (pgCode === "23505") {
        return json({ error: "Esse WhatsApp já foi cadastrado." }, { status: 409 });
      }
      console.error("ads-signup: insert error", insertErr);
      return json({ error: "Erro ao salvar cadastro." }, { status: 500 });
    }

    const botUsername = (
      Deno.env.get("TELEGRAM_TRIAL_BOT_USERNAME") ?? "sharkinhogreen_bot"
    ).replace(/^@+/, "");
    const botStartUrl = `https://t.me/${botUsername}?start=lead_${inserted.id}`;

    // CAPI: dispara Lead server-side, deduplicando com o pixel do browser
    if (leadEventId) {
      const capiPromise = sendMetaCapiEvent({
        eventName: "Lead",
        eventId: leadEventId,
        eventSourceUrl,
        source: "ads-signup",
        leadId: inserted.id,
        customData: {
          content_name: "ads-lead",
          ...(utm_campaign ? { campaign: utm_campaign } : {}),
          ...(utm_content  ? { ad_content: utm_content } : {}),
        },
        userData: {
          phone: whatsapp,
          client_ip: getClientIp(req),
          client_user_agent: req.headers.get("user-agent")?.slice(0, 512) ?? null,
          fbp,
          fbc,
        },
      }).catch((e) => {
        console.warn("ads-signup: CAPI Lead falhou", e);
      });
      // @ts-ignore — EdgeRuntime existe em Supabase Edge / Deno Deploy
      const er = (globalThis as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime;
      if (er && typeof er.waitUntil === "function") er.waitUntil(capiPromise);
    }

    return json({
      lead_id: inserted.id,
      bot_start_url: botStartUrl,
      bot_username: botUsername,
      invite_link: inviteLink,
      bonus_invite_link: bonusInviteLink,
    });
  } catch (err) {
    console.error("ads-signup unexpected", err);
    return json({ error: "Erro interno." }, { status: 500 });
  }
});

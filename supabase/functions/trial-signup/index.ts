// Edge Function: trial-signup
// Recebe os dados do formulário público, valida duplicidade,
// gera link único de convite no Telegram e cria o registro como "pending".
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { getClientIp, sendMetaCapiEvent } from "../_shared/meta-capi.ts";
import { sendZApiText, buildWelcomeMessage } from "../_shared/zapi.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, { status: 405 });

  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const whatsapp = String(body.whatsapp ?? "").replace(/\D/g, "");
    const telegram_username = String(body.telegram_username ?? "")
      .trim().toLowerCase().replace(/^@/, "");
    // event_id gerado no front (mesmo que o pixel disparou) pra Meta
    // deduplicar Lead entre browser e server. Opcional pra manter
    // backward-compat caso o pixel esteja completamente bloqueado.
    const eventIdRaw = typeof body.event_id === "string" ? body.event_id.trim() : "";
    const leadEventId = eventIdRaw && eventIdRaw.length <= 128 ? eventIdRaw : null;
    const eventSourceUrl = typeof body.event_source_url === "string"
      ? body.event_source_url.slice(0, 512) : null;
    const fbp = typeof body.fbp === "string" ? body.fbp.slice(0, 256) : null;
    const fbc = typeof body.fbc === "string" ? body.fbc.slice(0, 256) : null;
    const utm_source   = typeof body.utm_source   === "string" ? body.utm_source.slice(0, 255)   : null;
    const utm_medium   = typeof body.utm_medium   === "string" ? body.utm_medium.slice(0, 255)   : null;
    const utm_campaign = typeof body.utm_campaign === "string" ? body.utm_campaign.slice(0, 255) : null;
    const utm_content  = typeof body.utm_content  === "string" ? body.utm_content.slice(0, 255)  : null;
    const utm_term     = typeof body.utm_term     === "string" ? body.utm_term.slice(0, 255)     : null;
    const fbclid       = typeof body.fbclid       === "string" ? body.fbclid.slice(0, 512)       : null;
    const ct           = typeof body.ct           === "string" ? body.ct.slice(0, 255)           : null;
    const signup_fingerprint = typeof body.signup_fingerprint === "string"
      ? body.signup_fingerprint.slice(0, 128) : null;

    if (!name || !email || !whatsapp || !telegram_username) {
      return json({ error: "Todos os campos são obrigatórios." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "E-mail inválido." }, { status: 400 });
    }
    if (whatsapp.length < 10) {
      return json({ error: "WhatsApp inválido (mínimo 10 dígitos)." }, { status: 400 });
    }
    if (!/^[a-z0-9_]{3,32}$/.test(telegram_username)) {
      return json({ error: "@ do Telegram inválido. Use letras, números e _." }, { status: 400 });
    }

    // Extrair IP do request
    const signup_ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      null;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const botToken = Deno.env.get("TELEGRAM_TRIAL_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_TRIAL_CHAT_ID");

    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Backend não configurado." }, { status: 500 });
    }
    if (!botToken || !chatId) {
      return json({ error: "Bot do Telegram não configurado. Avise o suporte." }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // Dedup: email OU whatsapp OU telegram
    const { data: existing, error: dupErr } = await supabase
      .from("trial_leads")
      .select("id")
      .or(
        `email.eq.${email},whatsapp.eq.${whatsapp},telegram_username.eq.${telegram_username}`
      )
      .limit(1);
    if (dupErr) {
      console.error("dup check error", dupErr);
      return json({ error: "Erro ao validar cadastro." }, { status: 500 });
    }
    if (existing && existing.length > 0) {
      return json({
        error: "Você já utilizou seu trial gratuito. Para continuar, fale com o suporte para uma assinatura.",
      }, { status: 409 });
    }

    // Anti-abuso: verifica se IP ou fingerprint já consta em lead expirado/bloqueado
    if (signup_ip || signup_fingerprint) {
      const orClauses: string[] = [];
      if (signup_ip) orClauses.push(`signup_ip.eq.${signup_ip}`);
      if (signup_fingerprint) orClauses.push(`signup_fingerprint.eq.${signup_fingerprint}`);

      const { data: abuseMatch, error: abuseErr } = await supabase
        .from("trial_leads")
        .select("id")
        .in("status", ["expired", "blocked", "blocked_repeat"])
        .or(orClauses.join(","))
        .limit(1);

      if (abuseErr) {
        console.warn("trial-signup: abuse check error", abuseErr);
      } else if (abuseMatch && abuseMatch.length > 0) {
        // Salva o lead como blocked_repeat para rastreio, mas não processa
        await supabase.from("trial_leads").insert({
          name,
          email,
          whatsapp,
          telegram_username,
          status: "blocked_repeat",
          ...(signup_ip ? { signup_ip } : {}),
          ...(signup_fingerprint ? { signup_fingerprint } : {}),
          ...(utm_source   ? { utm_source }   : {}),
          ...(utm_medium   ? { utm_medium }   : {}),
          ...(utm_campaign ? { utm_campaign } : {}),
          ...(utm_content  ? { utm_content }  : {}),
          ...(utm_term     ? { utm_term }     : {}),
          ...(fbclid       ? { fbclid }       : {}),
          ...(ct           ? { ct }           : {}),
        }).catch((e: unknown) => console.warn("trial-signup: blocked_repeat insert error", e));

        return json({ error: "already_used_trial" }, { status: 409 });
      }
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
          name: `Trial ${telegram_username}`.slice(0, 32),
          creates_join_request: false,
        }),
      },
    );
    const tgData = await tgRes.json().catch(() => ({}));
    if (!tgRes.ok || !tgData?.ok) {
      console.error("telegram createChatInviteLink failed", tgData);
      return json({
        error: "Não foi possível gerar o link do grupo no momento. Tente novamente em instantes.",
      }, { status: 502 });
    }
    const inviteLink: string = tgData.result.invite_link;

    // (Opcional) Cria invite link no grupo bônus "Área do Aluno".
    // Backward-compatible: se TELEGRAM_TRIAL_BONUS_CHAT_ID não estiver setado,
    // ou se a criação falhar (ex: bot ainda não é admin no grupo bônus), o
    // fluxo continua normalmente com só o VIP — a coluna `bonus_invite_link`
    // fica null e o painel mostra "Bônus indisponível" para esse lead.
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
              name: `Trial ${telegram_username} bonus`.slice(0, 32),
              creates_join_request: false,
            }),
          },
        );
        const bonusData = await bonusRes.json().catch(() => ({}));
        if (bonusRes.ok && bonusData?.ok && bonusData.result?.invite_link) {
          bonusInviteLink = bonusData.result.invite_link as string;
        } else {
          console.warn("trial-signup: bonus createChatInviteLink failed", bonusData);
        }
      } catch (e) {
        console.warn("trial-signup: bonus invite link error", e);
      }
    }

    // Insere o lead (retorna o id pra montar o deep-link do bot)
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
        ...(signup_ip          ? { signup_ip }          : {}),
        ...(signup_fingerprint ? { signup_fingerprint } : {}),
        ...(utm_source   ? { utm_source }   : {}),
        ...(utm_medium   ? { utm_medium }   : {}),
        ...(utm_campaign ? { utm_campaign } : {}),
        ...(utm_content  ? { utm_content }  : {}),
        ...(utm_term     ? { utm_term }     : {}),
        ...(fbclid       ? { fbclid }       : {}),
        ...(ct           ? { ct }           : {}),
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      // Race condition em índice único (PostgrestError expõe `code`)
      const pgCode = (insertErr as { code?: string } | null)?.code;
      if (pgCode === "23505") {
        return json({ error: "Você já utilizou seu trial gratuito." }, { status: 409 });
      }
      console.error("insert error", insertErr);
      return json({ error: "Erro ao salvar cadastro." }, { status: 500 });
    }

    // ── Auto-cria conta no Supabase Auth para acesso ao PWA ──────────────────
    // Senha temporária = número do WhatsApp (só dígitos).
    // email_confirm:true pula o e-mail de confirmação (o lead já validou o e-mail
    // implicitamente ao preencher o formulário público).
    // needs_password_change: true → PWA detecta no login e redireciona para /set-password.
    // Se o e-mail já existir no Auth (ex: re-cadastro improvável), ignora silenciosamente.
    try {
      const { error: authErr } = await supabase.auth.admin.createUser({
        email,
        password: whatsapp,
        email_confirm: true,
        user_metadata: { name, whatsapp, needs_password_change: true },
      });
      if (authErr) {
        const msg = authErr.message?.toLowerCase() ?? "";
        if (!msg.includes("already registered") && !msg.includes("already exists")) {
          console.warn("trial-signup: auth.admin.createUser:", authErr.message);
        }
      } else {
        console.log("trial-signup: Auth user created for", email.slice(0, 4) + "***");
      }
    } catch (e) {
      console.warn("trial-signup: auth creation exception:", e);
    }

    // Deep-link do bot: força o lead a apertar Start no DM antes de receber
    // o invite_link via DM. Isso garante que o cron consiga mandar as DMs
    // de aviso (24h e 1h) — caso contrário o Telegram bloqueia (403).
    // O payload `lead_<id>` é lido pelo handler /start em trial-webhook.
    const botUsername = (
      Deno.env.get("TELEGRAM_TRIAL_BOT_USERNAME") ?? "sharkinhogreen_bot"
    ).replace(/^@+/, "");
    const botStartUrl = `https://t.me/${botUsername}?start=lead_${inserted.id}`;

    // WhatsApp de boas-vindas: DESATIVADO.
    // A página /obrigado instrui o lead a nos mandar uma mensagem diretamente,
    // o que dispara o funil interativo (menu de botões) sem precisar de uma
    // mensagem inicial proativa da nossa parte.

    // Conversions API: dispara Lead server-side em paralelo ao pixel do
    // browser, deduplicando pelo mesmo event_id. Fire-and-forget pra não
    // adicionar latência na resposta — qualquer erro fica registrado em
    // `trial_capi_events` pro admin via o helper. Em Supabase Edge usamos
    // EdgeRuntime.waitUntil quando disponível pra garantir que o runtime
    // não mata o request antes do envio terminar; fallback é só não-awaited.
    if (leadEventId) {
      const capiPromise = sendMetaCapiEvent({
        eventName: "Lead",
        eventId: leadEventId,
        eventSourceUrl,
        source: "trial-signup",
        leadId: inserted.id,
        customData: { content_name: "trial-7d" },
        userData: {
          email,
          phone: whatsapp,
          client_ip: getClientIp(req),
          client_user_agent: req.headers.get("user-agent")?.slice(0, 512) ?? null,
          fbp,
          fbc,
        },
      }).catch((e) => {
        console.warn("trial-signup: CAPI Lead falhou", e);
      });
      // @ts-ignore — EdgeRuntime existe em Supabase Edge / Deno Deploy
      const er = (globalThis as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime;
      if (er && typeof er.waitUntil === "function") er.waitUntil(capiPromise);
    }

    return json({
      lead_id: inserted.id,
      bot_start_url: botStartUrl,
      bot_username: botUsername,
      // invite_link mantido por compatibilidade / fallback se o usuário
      // ignorar o passo do bot. O bot tb manda esse mesmo link via DM.
      invite_link: inviteLink,
      // Link do grupo bônus "Área do Aluno". A LP atual ignora — só o bot
      // renderiza esse botão na DM. null quando bonus não está configurado.
      bonus_invite_link: bonusInviteLink,
    });
  } catch (err) {
    console.error("trial-signup unexpected", err);
    return json({ error: "Erro interno." }, { status: 500 });
  }
});

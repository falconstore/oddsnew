// Edge Function: trial-webhook
// Recebe webhooks do Telegram (chat_member updates) e mantém o painel
// /trial-admin sincronizado com a realidade do grupo, em todas as pontas:
//
//   • JOIN com invite_link rastreado de lead 'pending'
//        → ativa o lead (status='active', expires_at +7d).
//   • JOIN (por qualquer caminho) de usuário cujo lead já está
//        'removed' / 'blocked' / 'expired'
//        → re-kicka imediatamente. O usuário não consegue voltar.
//   • LEFT/KICKED de lead 'active'
//        → marca como 'removed' para o painel refletir a saída.
//   • Demais transições → ignoradas idempotentemente.
//
// SEGURANÇA:
//  - Valida o cabeçalho `X-Telegram-Bot-Api-Secret-Token` contra o segredo
//    `TELEGRAM_TRIAL_WEBHOOK_SECRET` (configurado no setWebhook).
//  - Valida que o `chat.id` do update bate com `TELEGRAM_TRIAL_CHAT_ID`.
//
// OBSERVABILIDADE:
//  - Cada decisão (ignored / activated / re-kicked / marked-removed) emite
//    um console.log JSON estruturado com tag [trial-webhook] para facilitar
//    busca nos logs da Edge Function. Quando um update for descartado por
//    mismatch de invite_link, loga os dois links lado a lado.
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const ACTIVE_STATUSES = new Set(["member", "restricted", "administrator", "creator"]);
const INACTIVE_STATUSES = new Set(["left", "kicked"]);
const BLOCKED_LEAD_STATUSES = new Set(["removed", "blocked", "expired", "blocked_repeat"]);

const log = (event: string, data: Record<string, unknown>) => {
  console.log(JSON.stringify({ tag: "trial-webhook", event, ...data }));
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const expectedSecret = Deno.env.get("TELEGRAM_TRIAL_WEBHOOK_SECRET");
    const expectedChatId = Deno.env.get("TELEGRAM_TRIAL_CHAT_ID");
    const bonusChatId = Deno.env.get("TELEGRAM_TRIAL_BONUS_CHAT_ID") ?? null;
    const botToken = Deno.env.get("TELEGRAM_TRIAL_BOT_TOKEN");

    if (!expectedSecret) {
      console.error("trial-webhook: TELEGRAM_TRIAL_WEBHOOK_SECRET is not configured");
      return json({ ok: false, error: "webhook secret not configured" }, { status: 500 });
    }
    const headerSecret = req.headers.get("x-telegram-bot-api-secret-token");
    if (headerSecret !== expectedSecret) {
      log("invalid-secret", { has_header: !!headerSecret });
      return json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const update = await req.json().catch(() => ({}));
    const updateId = update?.update_id ?? null;

    // ============================================================
    // Caso 0 — DM com /start (vindo do deep-link do trial-signup)
    // ============================================================
    // O fluxo público manda o lead pra t.me/<bot>?start=lead_<UUID>
    // O Telegram entrega isso como uma mensagem comum "/start lead_<UUID>".
    // Aqui resolvemos o lead, garantimos que o telegram_user_id está
    // gravado (essencial pro cron poder mandar DMs depois) e respondemos
    // com o invite_link como botão.
    if (update.message && typeof update.message.text === "string") {
      const msg = update.message;
      const text: string = msg.text.trim();
      const chatType: string | undefined = msg.chat?.type;
      const fromId: number | undefined = msg.from?.id;
      const fromUsername: string | undefined = msg.from?.username;

      if (chatType === "private" && /^\/start(\s|@|$)/i.test(text)) {
        const payload = text.replace(/^\/start(?:@\S+)?\s*/i, "").trim();
        const m = payload.match(/^lead_([0-9a-f-]{36})$/i);
        const leadId = m ? m[1] : null;

        if (!leadId || !fromId) {
          // /start sem payload válido — manda mensagem genérica
          if (botToken && fromId) {
            try {
              await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: fromId,
                  text: "Olá! Para liberar seu acesso, faça o cadastro pelo site oficial primeiro.",
                  parse_mode: "HTML",
                }),
              });
            } catch (e) { console.warn("start no-payload reply failed", e); }
          }
          log("start-no-payload", { update_id: updateId, from_id: fromId ?? null, payload });
          return json({ ok: true, action: "start-no-payload" });
        }

        const { data: lead, error: leadErr } = await supabase
          .from("trial_leads")
          .select("id, name, status, invite_link, bonus_invite_link, telegram_user_id")
          .eq("id", leadId)
          .maybeSingle();
        if (leadErr) console.error("start lookup failed", leadErr);

        if (!lead) {
          if (botToken) {
            try {
              await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: fromId,
                  text: "Cadastro não encontrado. Refaça o cadastro pelo site.",
                }),
              });
            } catch (e) { console.warn("start lead-not-found reply failed", e); }
          }
          log("start-lead-not-found", { update_id: updateId, lead_id: leadId, from_id: fromId });
          return json({ ok: true, action: "start-lead-not-found" });
        }

        // Anti-repetidor preventivo: se este Telegram já está vinculado a
        // outro lead que NÃO seja este, bloqueia.
        if (lead.telegram_user_id && lead.telegram_user_id !== fromId) {
          if (botToken) {
            try {
              await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: fromId,
                  text: "Este cadastro já está associado a outro Telegram. Entre em contato com o suporte.",
                }),
              });
            } catch (e) { console.warn("start mismatch reply failed", e); }
          }
          log("start-telegram-mismatch", {
            update_id: updateId, lead_id: leadId, lead_user_id: lead.telegram_user_id, from_id: fromId,
          });
          return json({ ok: true, action: "start-telegram-mismatch" });
        }

        // Vincula o telegram_user_id se ainda não tinha (peça-chave do anti-spam:
        // a partir daqui o cron consegue mandar DMs de 24h e 1h pra esse user).
        if (!lead.telegram_user_id) {
          await supabase
            .from("trial_leads")
            .update({
              telegram_user_id: fromId,
              telegram_username: fromUsername ? fromUsername.toLowerCase() : undefined,
            })
            .eq("id", leadId)
            .is("telegram_user_id", null);
        }

        if (BLOCKED_LEAD_STATUSES.has(lead.status)) {
          if (botToken) {
            try {
              await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: fromId,
                  text: "Seu trial já foi encerrado. Para continuar, fale com o suporte.",
                }),
              });
            } catch (e) { console.warn("start blocked reply failed", e); }
          }
          log("start-blocked", { update_id: updateId, lead_id: leadId, status: lead.status });
          return json({ ok: true, action: "start-blocked", status: lead.status });
        }

        // Manda os invite links como botões. O grupo VIP é o principal — só
        // o JOIN nele ativa o trial (Caso 1). O grupo bônus "Área do Aluno"
        // é opcional: se o lead tiver `bonus_invite_link`, mostra o segundo
        // botão. Entrar nele só seta `bonus_entered_at`, sem mexer em status.
        if (botToken && lead.invite_link) {
          const firstName = (lead.name ?? "").split(/\s+/)[0] || "tudo bem?";
          const safeName = firstName.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          const buttons: { text: string; url: string }[][] = [
            [{ text: "🚀 Entrar no grupo VIP", url: lead.invite_link }],
          ];
          if (lead.bonus_invite_link) {
            buttons.push([{
              text: "🎁 Entrar na Área do Aluno (bônus)",
              url: lead.bonus_invite_link,
            }]);
          }
          const lines = [
            `Oi, <b>${safeName}</b>! 👋`,
            ``,
            `Seu acesso ao grupo VIP da <b>SHARK 100% GREEN</b> está liberado por 7 dias.`,
          ];
          if (lead.bonus_invite_link) {
            lines.push(
              ``,
              `🎁 Como bônus, você também ganhou acesso à <b>Área do Aluno</b>.`,
              ``,
              `Toque nos botões abaixo pra entrar nos dois grupos 👇`,
            );
          } else {
            lines.push(``, `Toque no botão abaixo pra entrar agora 👇`);
          }
          try {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: fromId,
                text: lines.join("\n"),
                parse_mode: "HTML",
                reply_markup: { inline_keyboard: buttons },
              }),
            });
          } catch (e) {
            console.error("start invite reply failed", e);
          }
        }

        log("start-handled", { update_id: updateId, lead_id: leadId, from_id: fromId, status: lead.status });
        return json({ ok: true, action: "start-handled", lead_id: leadId });
      }

      // Outras mensagens privadas — ignora silenciosamente.
      log("ignored", { reason: "non-/start message", update_id: updateId, chat_type: chatType });
      return json({ ok: true, ignored: "non-/start message" });
    }

    const cmKind = update.chat_member ? "chat_member"
      : update.my_chat_member ? "my_chat_member"
      : null;
    const cm = update.chat_member ?? update.my_chat_member;
    if (!cm) {
      log("ignored", { reason: "no chat_member", update_id: updateId, keys: Object.keys(update ?? {}) });
      return json({ ok: true, ignored: "no chat_member" });
    }

    const updateChatId = String(cm.chat?.id ?? "");
    const isVipChat = !!expectedChatId && updateChatId === String(expectedChatId);
    const isBonusChat = !!bonusChatId && updateChatId === String(bonusChatId);
    if (!isVipChat && !isBonusChat) {
      log("ignored", {
        reason: "wrong chat", update_id: updateId, got_chat: updateChatId,
        expected_vip: expectedChatId ? String(expectedChatId) : null,
        expected_bonus: bonusChatId ?? null,
      });
      return json({ ok: true, ignored: "wrong chat" });
    }

    const inviteLink: string | undefined = cm.invite_link?.invite_link;
    const newStatus: string | undefined = cm.new_chat_member?.status;
    const oldStatus: string | undefined = cm.old_chat_member?.status;
    const userId: number | undefined = cm.new_chat_member?.user?.id;
    const username: string | undefined = cm.new_chat_member?.user?.username;
    // Quem disparou o evento. Quando um admin/bot externo (ex.: bot da
    // Lastlink) adiciona o usuário ao grupo via addChatMember, `from.id`
    // é diferente do `new_chat_member.user.id`. Quando o próprio usuário
    // entra clicando num invite_link, eles são iguais.
    const actorUserId: number | undefined = cm.from?.id;
    const wasAddedByOther = !!actorUserId && !!userId && actorUserId !== userId;

    log("received", {
      update_id: updateId,
      kind: cmKind,
      chat: isBonusChat ? "bonus" : "vip",
      user_id: userId ?? null,
      username: username ?? null,
      old_status: oldStatus ?? null,
      new_status: newStatus ?? null,
      invite_link: inviteLink ?? null,
      actor_user_id: actorUserId ?? null,
      added_by_other: wasAddedByOther,
    });

    if (!userId) {
      log("ignored", { reason: "no user id", update_id: updateId });
      return json({ ok: true, ignored: "no user id" });
    }

    const becameActiveTmp =
      newStatus !== undefined &&
      ACTIVE_STATUSES.has(newStatus) &&
      (!oldStatus || INACTIVE_STATUSES.has(oldStatus));
    const becameInactiveTmp =
      newStatus !== undefined &&
      INACTIVE_STATUSES.has(newStatus) &&
      oldStatus !== undefined &&
      ACTIVE_STATUSES.has(oldStatus);

    // ============================================================
    // Caso BONUS — eventos no grupo "Área do Aluno"
    // ============================================================
    // Esse grupo é OPCIONAL e não controla o trial: só registramos quando
    // o lead entrou (bonus_entered_at) e quando saiu (bonus_removed_at).
    // Anti-repetidor: se o telegram_user_id já pertence a OUTRO lead, ou
    // se o lead já está em status bloqueado/expirado, kicka do bônus e
    // revoga o link rastreado.
    // ============================================================
    if (isBonusChat && bonusChatId) {
      if (becameActiveTmp) {
        let bLead: {
          id: string; status: string; telegram_user_id: number | null;
          bonus_invite_link: string | null;
        } | null = null;
        let bFoundVia: string | null = null;

        const { data: byUserB } = await supabase
          .from("trial_leads")
          .select("id, status, telegram_user_id, bonus_invite_link")
          .eq("telegram_user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (byUserB) { bLead = byUserB; bFoundVia = "user_id"; }

        // Se o lead encontrado por user_id está em status terminal (expirado/removido/bloqueado)
        // ou convertido, tenta também o lookup por bonus_invite_link para encontrar um novo
        // cadastro pending — re-entrada legítima após trial anterior encerrado.
        // Espelha o comportamento do grupo principal (linhas 521–543).
        if (
          bLead &&
          inviteLink &&
          (BLOCKED_LEAD_STATUSES.has(bLead.status) || bLead.status === "converted")
        ) {
          const { data: byLinkFallbackB } = await supabase
            .from("trial_leads")
            .select("id, status, telegram_user_id, bonus_invite_link")
            .eq("bonus_invite_link", inviteLink)
            .neq("id", bLead.id)
            .maybeSingle();
          if (byLinkFallbackB) {
            log("bonus-lookup-fallback-to-invite-link", {
              update_id: updateId,
              old_lead_id: bLead.id,
              old_status: bLead.status,
              new_lead_id: byLinkFallbackB.id,
              new_status: byLinkFallbackB.status,
            });
            bLead = byLinkFallbackB;
            bFoundVia = "bonus_invite_link";
          }
        }

        if (!bLead && inviteLink) {
          const { data: byLinkB } = await supabase
            .from("trial_leads")
            .select("id, status, telegram_user_id, bonus_invite_link")
            .eq("bonus_invite_link", inviteLink)
            .maybeSingle();
          if (byLinkB) { bLead = byLinkB; bFoundVia = "bonus_invite_link"; }
        }

        // Fallback por telegram_username — cobre o caso em que o admin adicionou
        // manualmente e o telegram_user_id ainda não foi gravado no lead (usuário
        // ainda não interagiu com o bot via /start).
        if (!bLead && username) {
          const { data: byUsernameB } = await supabase
            .from("trial_leads")
            .select("id, status, telegram_user_id, bonus_invite_link")
            .eq("telegram_username", username.toLowerCase())
            .in("status", ["active", "converted"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (byUsernameB) {
            bLead = byUsernameB;
            bFoundVia = "telegram_username";
            log("bonus-lookup-by-username", {
              update_id: updateId,
              lead_id: byUsernameB.id,
              username,
              user_id: userId,
            });
          }
        }

        // Revoga o link bônus ANTES de ban+unban para quebrar o loop de re-entrada.
        // O Telegram reseta o member_limit durante o ciclo ban+unban; se o link
        // já estiver revogado antes, o usuário não consegue re-entrar após o unban.
        const kickFromBonus = async (linkToRevoke?: string | null) => {
          if (!botToken) return;
          try {
            if (linkToRevoke) {
              await fetch(`https://api.telegram.org/bot${botToken}/revokeChatInviteLink`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: bonusChatId, invite_link: linkToRevoke }),
              });
            }
            await fetch(`https://api.telegram.org/bot${botToken}/banChatMember`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: bonusChatId, user_id: userId }),
            });
            await fetch(`https://api.telegram.org/bot${botToken}/unbanChatMember`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: bonusChatId, user_id: userId, only_if_banned: true }),
            });
          } catch (e) { console.warn("bonus kick failed", e); }
        };

        if (!bLead) {
          if (wasAddedByOther) {
            // Admin adicionou manualmente um usuário sem lead associado.
            // Não kickamos — admin sabe o que está fazendo. Apenas registramos.
            log("bonus-admin-add-no-lead", {
              update_id: updateId, user_id: userId, username: username ?? null,
              actor_user_id: actorUserId ?? null,
            });
            return json({ ok: true, action: "bonus-admin-add-no-lead" });
          }
          // Não conseguimos identificar o lead, mas isso não é evidência de bloqueio.
          // A causa mais comum é o GC ter zerado o bonus_invite_link antes do usuário
          // entrar (link criado há >24h mas ainda não utilizado). Deixamos entrar e
          // registramos para auditoria — só kickamos quando há prova positiva de bloqueio.
          log("bonus-unidentified-allowed", {
            update_id: updateId, user_id: userId, username: username ?? null,
            invite_link: inviteLink ?? null,
          });
          return json({ ok: true, action: "bonus-unidentified-allowed" });
        }

        // Anti-repeat A: invite_link bônus pertence a um lead cujo
        // telegram_user_id é OUTRO usuário. Kicka esse intruso e revoga o link.
        if (
          bFoundVia === "bonus_invite_link" &&
          bLead.telegram_user_id &&
          bLead.telegram_user_id !== userId
        ) {
          await kickFromBonus(bLead.bonus_invite_link);
          log("bonus-repeat-kick", {
            update_id: updateId, lead_id: bLead.id,
            user_id: userId, owner_user_id: bLead.telegram_user_id,
          });
          return json({ ok: true, action: "bonus-repeat-kick", lead_id: bLead.id });
        }

        // Anti-repeat B (simétrico ao VIP, linha 517): achamos o lead pelo
        // user_id (registro mais recente daquele Telegram) MAS o invite_link
        // recebido não bate com o `bonus_invite_link` salvo nele — significa
        // que o user já tem cadastro ATIVO/PENDENTE e está entrando pelo link
        // bônus de OUTRO lead novo. Marca esse lead novo como blocked_repeat e kicka.
        // IMPORTANTE: só dispara se o lead anterior está ativo/pendente — não para
        // leads terminais (expired/removed/blocked/blocked_repeat) nem converted,
        // pois nesses casos é re-cadastro legítimo após trial anterior encerrado.
        if (
          bFoundVia === "user_id" &&
          inviteLink &&
          bLead.bonus_invite_link !== inviteLink &&
          !BLOCKED_LEAD_STATUSES.has(bLead.status) &&
          bLead.status !== "converted"
        ) {
          const { data: byLinkRepeatB } = await supabase
            .from("trial_leads")
            .select("id, status, bonus_invite_link")
            .eq("bonus_invite_link", inviteLink)
            .neq("id", bLead.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (byLinkRepeatB && byLinkRepeatB.status === "pending") {
            await supabase
              .from("trial_leads")
              .update({
                status: "blocked_repeat",
                telegram_user_id: userId,
                previous_lead_id: bLead.id,
              })
              .eq("id", byLinkRepeatB.id)
              .eq("status", "pending");

            await kickFromBonus(byLinkRepeatB.bonus_invite_link);
            log("bonus-blocked-repeat", {
              update_id: updateId,
              lead_id: byLinkRepeatB.id,
              user_id: userId,
              prev_lead_id: bLead.id,
              via: "user_id_then_bonus_invite_link",
            });
            return json({ ok: true, action: "bonus-blocked-repeat", lead_id: byLinkRepeatB.id });
          }
        }

        if (BLOCKED_LEAD_STATUSES.has(bLead.status)) {
          // Só kicka se o usuário entrou via link RASTREADO pelo bot (o
          // bonus_invite_link gerado pelo trial). Se entrou via link externo
          // — admin enviou manualmente pelo Telegram pra alguém —, o bot
          // não deve intervir mesmo se o lead estiver expired/blocked.
          const isTrackedLink =
            bFoundVia === "bonus_invite_link" ||
            (!!inviteLink && inviteLink === bLead.bonus_invite_link);
          if (!isTrackedLink) {
            log("bonus-blocked-external-link-allowed", {
              update_id: updateId,
              lead_id: bLead.id,
              status: bLead.status,
              invite_link: inviteLink ?? null,
            });
            return json({
              ok: true,
              action: "bonus-blocked-external-link-allowed",
              lead_id: bLead.id,
            });
          }
          await kickFromBonus(bLead.bonus_invite_link ?? inviteLink);
          log("bonus-blocked-kick", { update_id: updateId, lead_id: bLead.id, status: bLead.status });
          return json({ ok: true, action: "bonus-blocked-kick", lead_id: bLead.id });
        }

        const updates: Record<string, unknown> = {
          bonus_entered_at: new Date().toISOString(),
          bonus_removed_at: null,
        };
        if (!bLead.telegram_user_id) updates.telegram_user_id = userId;
        await supabase.from("trial_leads").update(updates).eq("id", bLead.id);
        log("bonus-joined", { update_id: updateId, lead_id: bLead.id, user_id: userId, found_via: bFoundVia });
        return json({ ok: true, action: "bonus-joined", lead_id: bLead.id });
      }

      if (becameInactiveTmp) {
        const { data: bLead } = await supabase
          .from("trial_leads")
          .select("id")
          .eq("telegram_user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (bLead) {
          await supabase
            .from("trial_leads")
            .update({ bonus_removed_at: new Date().toISOString() })
            .eq("id", bLead.id);
          log("bonus-left", { update_id: updateId, lead_id: bLead.id, user_id: userId });
          return json({ ok: true, action: "bonus-left", lead_id: bLead.id });
        }
        log("ignored", { reason: "bonus left no lead", update_id: updateId, user_id: userId });
        return json({ ok: true, ignored: "bonus left no lead" });
      }

      log("ignored", { reason: `bonus ${oldStatus} -> ${newStatus}`, update_id: updateId });
      return json({ ok: true, ignored: `bonus ${oldStatus} -> ${newStatus}` });
    }

    // ============================================================
    // VIP — fluxo principal (controla o trial)
    // ============================================================
    const becameActive =
      newStatus !== undefined &&
      ACTIVE_STATUSES.has(newStatus) &&
      (!oldStatus || INACTIVE_STATUSES.has(oldStatus));

    const becameInactive =
      newStatus !== undefined &&
      INACTIVE_STATUSES.has(newStatus) &&
      oldStatus !== undefined &&
      ACTIVE_STATUSES.has(oldStatus);

    // ============================================================
    // Caso 1 — usuário ENTROU no grupo
    // ============================================================
    if (becameActive) {
      // 1a) tenta achar lead já vinculado ao userId
      let lead = null as null | {
        id: string;
        status: string;
        invite_link: string | null;
        bonus_invite_link: string | null;
        expires_at: string | null;
      };
      let foundVia: string | null = null;
      const { data: byUser, error: byUserErr } = await supabase
        .from("trial_leads")
        .select("id, status, invite_link, bonus_invite_link, expires_at")
        .eq("telegram_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      log("lookup_user_id", {
        update_id: updateId,
        user_id: userId,
        result: byUserErr ? "error" : byUser ? "hit" : "miss",
        lead_id: byUser?.id ?? null,
        lead_status: byUser?.status ?? null,
        error: byUserErr?.message ?? null,
      });
      if (byUserErr) console.error("lookup by user_id failed", byUserErr);
      if (byUser) {
        lead = byUser;
        foundVia = "user_id";
      }

      // Helper: detecta lead "active" cujo prazo já expirou no banco mas o
      // cron ainda não processou (ou o evento de saída não chegou). Nesses casos
      // o lead ativo é um ciclo encerrado e NÃO deve ser tratado como referência
      // para o anti-repetidor — o lead correto é o novo pending do invite_link.
      const isLeadStaleActive = (l: typeof lead): boolean =>
        !!l &&
        l.status === "active" &&
        !!l.expires_at &&
        new Date(l.expires_at) < new Date();

      // 1b) lookup pelo invite_link rastreado.
      // Executa quando: (a) não achou lead por user_id, OU (b) achou por
      // user_id mas o lead encontrado NÃO está pending/active — isso acontece
      // quando o mesmo Telegram já teve um trial anterior (expired/removed/
      // blocked/converted) e o usuário se re-cadastrou com novo WhatsApp/email.
      // TAMBÉM executa quando o lead encontrado está em BLOCKED_LEAD_STATUSES
      // ou está "active" mas com expires_at já no passado (stale-active): nesses
      // casos o lead correto para ativar é o novo pending encontrado pelo link.
      const needInviteLinkLookup =
        !!inviteLink &&
        (!lead ||
          (lead.status !== "pending" && lead.status !== "active") ||
          BLOCKED_LEAD_STATUSES.has(lead.status) ||
          isLeadStaleActive(lead));
      if (needInviteLinkLookup) {
        const { data: byLink, error: byLinkErr } = await supabase
          .from("trial_leads")
          .select("id, status, invite_link, bonus_invite_link, expires_at")
          .eq("invite_link", inviteLink)
          .maybeSingle();
        log("lookup_invite_link", {
          update_id: updateId,
          invite_link: inviteLink,
          result: byLinkErr ? "error" : byLink ? "hit" : "miss",
          lead_id: byLink?.id ?? null,
          lead_status: byLink?.status ?? null,
          error: byLinkErr?.message ?? null,
          reason: lead ? "user_id_lead_not_actionable" : "no_user_id_match",
        });
        if (byLinkErr) console.error("lookup by invite_link failed", byLinkErr);
        if (byLink) {
          lead = byLink;
          foundVia = "invite_link";
        }
      } else if (!lead) {
        log("lookup_invite_link", {
          update_id: updateId,
          result: "skipped",
          reason: "no invite_link in update",
        });
      }

      if (!lead) {
        // Tenta diagnóstico extra: existe algum lead com esse @username pendente
        // mas com invite_link diferente do recebido? Ajuda muito a debug.
        let mismatch: { lead_id: string; saved: string | null; received: string } | null = null;
        if (username && inviteLink) {
          const { data: byUsername } = await supabase
            .from("trial_leads")
            .select("id, invite_link, status")
            .ilike("telegram_username", username)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (byUsername && byUsername.invite_link !== inviteLink) {
            mismatch = {
              lead_id: byUsername.id,
              saved: byUsername.invite_link,
              received: inviteLink,
            };
          }
        }
        log("ignored", {
          reason: "no matching lead on join",
          update_id: updateId,
          user_id: userId,
          username,
          invite_link_received: inviteLink ?? null,
          invite_link_mismatch: mismatch,
        });
        return json({ ok: true, ignored: "no matching lead on join" });
      }

      // 1b.1) ANTI-REPETIDOR (caminho principal):
      // Se achamos um lead pelo user_id (telegram_user_id é IMUTÁVEL) E o
      // invite_link recebido NESTE join aponta para OUTRO lead pending, isso
      // é uma 2ª inscrição do mesmo Telegram via novo email/WhatsApp/@.
      // Marcamos o lead NOVO como blocked_repeat (com previous_lead_id) e
      // re-kickamos antes de qualquer outra coisa.
      //
      // GUARD: só entra no bloco anti-repetidor se o lead A (encontrado por
      // user_id) NÃO estiver em estado terminal (BLOCKED_LEAD_STATUSES) E NÃO
      // for um lead "active" com expires_at já no passado (stale-active). Se
      // lead A é terminal/expirado, o usuário está fazendo uma re-inscrição
      // legítima — não é tentativa de segundo trial — e deve ser ativado
      // normalmente. Essa condição é um belt-and-suspenders: o fix em
      // needInviteLinkLookup já deve ter redirecionado foundVia para
      // "invite_link" nesses casos, mas o guard garante que mesmo que isso
      // falhe (ex.: invite_link lookup retornou null), o anti-repetidor
      // não dispara indevidamente.
      if (
        lead &&
        foundVia === "user_id" &&
        inviteLink &&
        lead.invite_link !== inviteLink
      ) {
        const leadAIsTerminalOrExpiredActive =
          BLOCKED_LEAD_STATUSES.has(lead.status) || isLeadStaleActive(lead);

        if (leadAIsTerminalOrExpiredActive) {
          // Lead A é um ciclo encerrado: não é evidência de abuso.
          // Emitir log estruturado para auditoria e deixar o fluxo normal
          // de ativação tratar o lead correto.
          log("corrected-rejoin", {
            update_id: updateId,
            event: "corrected-rejoin",
            old_lead_id: lead.id,
            old_lead_status: lead.status,
            old_lead_expires_at: lead.expires_at ?? null,
            invite_link_received: inviteLink,
            user_id: userId,
            note: "lead A is terminal/stale-active; anti-repeater skipped for legitimate rejoin",
          });
          // fall through to normal activation flow
        } else {
        const { data: byLinkRepeat, error: byLinkRepeatErr } = await supabase
          .from("trial_leads")
          .select("id, status, invite_link")
          .eq("invite_link", inviteLink)
          .neq("id", lead.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (byLinkRepeatErr) console.error("repeat lookup by invite_link failed", byLinkRepeatErr);

        if (byLinkRepeat && byLinkRepeat.status === "pending") {
          const previousLeadId = lead.id;
          const previousLeadStatus = lead.status;

          await supabase
            .from("trial_leads")
            .update({
              status: "blocked_repeat",
              telegram_user_id: userId,
              previous_lead_id: previousLeadId,
            })
            .eq("id", byLinkRepeat.id)
            .eq("status", "pending");

          if (botToken && expectedChatId) {
            // Revoga ANTES do ban+unban para quebrar o loop de re-entrada.
            if (byLinkRepeat.invite_link) {
              try {
                await fetch(
                  `https://api.telegram.org/bot${botToken}/revokeChatInviteLink`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: expectedChatId,
                      invite_link: byLinkRepeat.invite_link,
                    }),
                  },
                );
              } catch (e) {
                console.warn("repeat revoke link failed", e);
              }
            }
            try {
              await fetch(`https://api.telegram.org/bot${botToken}/banChatMember`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: expectedChatId, user_id: userId }),
              });
              await fetch(`https://api.telegram.org/bot${botToken}/unbanChatMember`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: expectedChatId,
                  user_id: userId,
                  only_if_banned: true,
                }),
              });
            } catch (e) {
              console.error("repeat re-kick failed", e);
            }
          }

          log("blocked-repeat", {
            update_id: updateId,
            lead_id: byLinkRepeat.id,
            user_id: userId,
            prev_lead_id: previousLeadId,
            prev_status: previousLeadStatus,
            via: "user_id_then_invite_link",
          });
          return json({ ok: true, action: "blocked-repeat", lead_id: byLinkRepeat.id });
        }
        } // end else (lead A is NOT terminal/stale-active)
      }

      // 1c.0) CONVERSÃO PAGA: se o lead estava bloqueado/expirado mas o
      // join atual veio por um caminho EXTERNO ao nosso sistema (ex.: o
      // bot da Lastlink adicionou o usuário, ou ele entrou por um
      // invite_link que não é nem o trial nem o bônus que geramos),
      // então é uma compra. NÃO re-kickar e marcar o lead como
      // 'converted' para que tentativas futuras de rejoin também passem.
      const usedExternalInviteLink =
        !!inviteLink &&
        inviteLink !== lead.invite_link &&
        inviteLink !== lead.bonus_invite_link;
      if (
        BLOCKED_LEAD_STATUSES.has(lead.status) &&
        (usedExternalInviteLink || wasAddedByOther)
      ) {
        await supabase
          .from("trial_leads")
          .update({
            status: "converted",
            telegram_user_id: userId,
          })
          .eq("id", lead.id);
        log("converted-paid-rejoin", {
          update_id: updateId,
          lead_id: lead.id,
          prev_status: lead.status,
          via: usedExternalInviteLink ? "external_invite_link" : "added_by_other",
          invite_link_used: inviteLink ?? null,
          actor_user_id: actorUserId ?? null,
          found_via: foundVia,
        });
        return json({ ok: true, action: "converted-paid-rejoin", lead_id: lead.id });
      }

      // 1c) Se o lead já foi removido/bloqueado/expirado → re-kick imediato
      if (BLOCKED_LEAD_STATUSES.has(lead.status)) {
        if (botToken && expectedChatId) {
          // Revoga ANTES do ban+unban para quebrar o loop de re-entrada.
          if (lead.invite_link) {
            try {
              await fetch(
                `https://api.telegram.org/bot${botToken}/revokeChatInviteLink`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: expectedChatId,
                    invite_link: lead.invite_link,
                  }),
                },
              );
            } catch (e) {
              console.warn("revoke link on re-kick failed", e);
            }
          }
          try {
            await fetch(`https://api.telegram.org/bot${botToken}/banChatMember`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: expectedChatId, user_id: userId }),
            });
            await fetch(`https://api.telegram.org/bot${botToken}/unbanChatMember`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: expectedChatId,
                user_id: userId,
                only_if_banned: true,
              }),
            });
          } catch (e) {
            console.error("re-kick failed", e);
          }
        }
        // Mantém o status de bloqueio, só atualiza telegram_user_id (caso ainda não tinha)
        await supabase
          .from("trial_leads")
          .update({ telegram_user_id: userId })
          .eq("id", lead.id)
          .is("telegram_user_id", null);
        log("re-kicked", { update_id: updateId, lead_id: lead.id, lead_status: lead.status, found_via: foundVia });
        return json({ ok: true, action: "re-kicked", lead_id: lead.id });
      }

      // 1d) Se já está active, só garante telegram_user_id e segue
      if (lead.status === "active") {
        await supabase
          .from("trial_leads")
          .update({ telegram_user_id: userId })
          .eq("id", lead.id)
          .is("telegram_user_id", null);
        log("already-active", { update_id: updateId, lead_id: lead.id, found_via: foundVia });
        return json({ ok: true, action: "already-active", lead_id: lead.id });
      }

      // 1e) Lead pending → ativa pelo prazo de 7 dias
      if (lead.status === "pending") {
        // 1e.1) Anti-repetidor: o telegram_user_id é imutável no Telegram,
        // então se ele já aparece em outro lead ATIVO ou PENDENTE,
        // bloqueamos esse 2º trial e re-kickamos na hora.
        // Leads em status terminal (expired, removed, blocked, blocked_repeat,
        // converted) representam ciclos encerrados — não são prova de abuso.
        // Apenas pulamos a checagem se foundVia === "user_id" (significa
        // que o lead encontrado JÁ é desse user_id — não há repetição).
        if (foundVia !== "user_id") {
          const { data: prev, error: prevErr } = await supabase
            .from("trial_leads")
            .select("id, status, created_at")
            .eq("telegram_user_id", userId)
            .neq("id", lead.id)
            .not("status", "in", "(expired,removed,blocked,blocked_repeat,converted)")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (prevErr) console.error("repeat check failed", prevErr);

          if (prev) {
            // Marca o lead novo como blocked_repeat + revoga + re-kicka.
            const { error: updErr } = await supabase
              .from("trial_leads")
              .update({
                status: "blocked_repeat",
                telegram_user_id: userId,
                previous_lead_id: prev.id,
              })
              .eq("id", lead.id)
              .eq("status", "pending"); // guard de concorrência
            if (updErr) console.error("block-repeat update failed", updErr);

            if (botToken && expectedChatId) {
              // Revoga ANTES do ban+unban para quebrar o loop de re-entrada.
              if (lead.invite_link) {
                try {
                  await fetch(
                    `https://api.telegram.org/bot${botToken}/revokeChatInviteLink`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: expectedChatId,
                        invite_link: lead.invite_link,
                      }),
                    },
                  );
                } catch (e) {
                  console.warn("block-repeat revoke link failed", e);
                }
              }
              try {
                await fetch(`https://api.telegram.org/bot${botToken}/banChatMember`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ chat_id: expectedChatId, user_id: userId }),
                });
                await fetch(`https://api.telegram.org/bot${botToken}/unbanChatMember`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: expectedChatId,
                    user_id: userId,
                    only_if_banned: true,
                  }),
                });
              } catch (e) {
                console.error("block-repeat re-kick failed", e);
              }
            }

            log("blocked-repeat", {
              update_id: updateId,
              lead_id: lead.id,
              user_id: userId,
              prev_lead_id: prev.id,
              prev_status: prev.status,
            });
            return json({ ok: true, action: "blocked-repeat", lead_id: lead.id });
          }
        }

        const now = new Date();
        const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const { error: updErr } = await supabase
          .from("trial_leads")
          .update({
            status: "active",
            telegram_user_id: userId,
            entered_at: now.toISOString(),
            expires_at: expires.toISOString(),
          })
          .eq("id", lead.id)
          .eq("status", "pending"); // guard de concorrência
        if (updErr) {
          console.error("activate update failed", updErr);
          return json({ ok: false, error: "update failed" }, { status: 500 });
        }
        log("activated", { update_id: updateId, lead_id: lead.id, found_via: foundVia, user_id: userId });
        return json({ ok: true, action: "activated", lead_id: lead.id });
      }

      log("ignored", { reason: `unhandled status ${lead.status}`, update_id: updateId, lead_id: lead.id });
      return json({ ok: true, ignored: `unhandled status ${lead.status}` });
    }

    // ============================================================
    // Caso 2 — usuário SAIU/foi expulso
    // ============================================================
    if (becameInactive) {
      const { data: lead } = await supabase
        .from("trial_leads")
        .select("id, status")
        .eq("telegram_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!lead) {
        log("ignored", { reason: "no lead for leaver", update_id: updateId, user_id: userId });
        return json({ ok: true, ignored: "no lead for leaver" });
      }

      // Só atualiza para 'removed' se ainda estava 'active' — preserva 'expired',
      // 'removed', 'blocked' como estão.
      if (lead.status === "active") {
        await supabase
          .from("trial_leads")
          .update({
            status: "removed",
            removed_at: new Date().toISOString(),
          })
          .eq("id", lead.id)
          .eq("status", "active");
        log("marked-removed", { update_id: updateId, lead_id: lead.id, user_id: userId });
        return json({ ok: true, action: "marked-removed", lead_id: lead.id });
      }
      log("ignored", { reason: `lead already ${lead.status}`, update_id: updateId, lead_id: lead.id });
      return json({ ok: true, ignored: `lead already ${lead.status}` });
    }

    log("ignored", {
      reason: `status transition ${oldStatus} -> ${newStatus}`,
      update_id: updateId,
      user_id: userId,
    });
    return json({ ok: true, ignored: `status ${oldStatus} -> ${newStatus}` });
  } catch (err) {
    console.error("trial-webhook error", err);
    return json({ ok: false, error: "internal" }, { status: 500 });
  }
});

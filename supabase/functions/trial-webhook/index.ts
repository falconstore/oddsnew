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
    const cmKind = update.chat_member ? "chat_member"
      : update.my_chat_member ? "my_chat_member"
      : null;
    const cm = update.chat_member ?? update.my_chat_member;
    if (!cm) {
      log("ignored", { reason: "no chat_member", update_id: updateId, keys: Object.keys(update ?? {}) });
      return json({ ok: true, ignored: "no chat_member" });
    }

    const updateChatId = String(cm.chat?.id ?? "");
    if (expectedChatId && updateChatId !== String(expectedChatId)) {
      log("ignored", { reason: "wrong chat", update_id: updateId, got_chat: updateChatId, expected_chat: String(expectedChatId) });
      return json({ ok: true, ignored: "wrong chat" });
    }

    const inviteLink: string | undefined = cm.invite_link?.invite_link;
    const newStatus: string | undefined = cm.new_chat_member?.status;
    const oldStatus: string | undefined = cm.old_chat_member?.status;
    const userId: number | undefined = cm.new_chat_member?.user?.id;
    const username: string | undefined = cm.new_chat_member?.user?.username;

    log("received", {
      update_id: updateId,
      kind: cmKind,
      user_id: userId ?? null,
      username: username ?? null,
      old_status: oldStatus ?? null,
      new_status: newStatus ?? null,
      invite_link: inviteLink ?? null,
    });

    if (!userId) {
      log("ignored", { reason: "no user id", update_id: updateId });
      return json({ ok: true, ignored: "no user id" });
    }

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
      };
      let foundVia: string | null = null;
      const { data: byUser, error: byUserErr } = await supabase
        .from("trial_leads")
        .select("id, status, invite_link")
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

      // 1b) fallback: lookup pelo invite_link rastreado
      if (!lead && inviteLink) {
        const { data: byLink, error: byLinkErr } = await supabase
          .from("trial_leads")
          .select("id, status, invite_link")
          .eq("invite_link", inviteLink)
          .maybeSingle();
        log("lookup_invite_link", {
          update_id: updateId,
          invite_link: inviteLink,
          result: byLinkErr ? "error" : byLink ? "hit" : "miss",
          lead_id: byLink?.id ?? null,
          lead_status: byLink?.status ?? null,
          error: byLinkErr?.message ?? null,
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

      // 1c) Se o lead já foi removido/bloqueado/expirado → re-kick imediato
      if (BLOCKED_LEAD_STATUSES.has(lead.status)) {
        if (botToken && expectedChatId) {
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
          // Garante que o invite_link rastreado também esteja revogado
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
        // então se ele já aparece em outro lead (qualquer status que não
        // 'pending'), bloqueamos esse 2º trial e re-kickamos na hora.
        // Apenas pulamos a checagem se foundVia === "user_id" (significa
        // que o lead encontrado JÁ é desse user_id — não há repetição).
        if (foundVia !== "user_id") {
          const { data: prev, error: prevErr } = await supabase
            .from("trial_leads")
            .select("id, status, created_at")
            .eq("telegram_user_id", userId)
            .neq("id", lead.id)
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

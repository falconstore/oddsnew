// Garbage collector dos invite_links do Telegram.
// Regra: passados 24h da criação do lead, revoga `invite_link` (VIP) e
// `bonus_invite_link` (Área do Aluno) e zera as colunas. Independe do
// status — qualquer link com mais de 24h é apagado.
//
// Por que: o Telegram tem um teto de invite_links ATIVOS por chat por bot.
// O `trial-signup` cria 1 link novo por cadastro, com `member_limit=1` e
// `expire_date = now+24h`. Links que expiram naturalmente continuam
// contando pra cota até serem REVOGADOS explicitamente. Quando esse teto
// é atingido, `createChatInviteLink` passa a falhar e ninguém consegue
// mais se cadastrar pela LP. Esse GC mantém o cofre limpo.
//
// Idempotente: links já revogados/null são pulados. Erros do Telegram
// (ex.: link que já não existe) são logados mas não interrompem o lote.
// deno-lint-ignore-file
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// Statuses onde o lead já não tem expectativa de usar o link.
// Leads "pending" ou "active" que ainda não entraram no grupo devem manter
// o link no banco — apagá-lo aqui causaria o problema de kick falso-positivo
// quando o usuário demora mais de 24h pra clicar no link.
const TERMINAL_STATUSES = new Set(["expired", "removed", "blocked", "blocked_repeat", "converted"]);

export type LinkGcParams = {
  supabase: SupabaseClient;
  botToken: string;
  chatId: string;            // VIP
  bonusChatId?: string | null;
  /** Quantos leads no máximo processar por execução (default 500). */
  batchSize?: number;
  /** Idade mínima do lead pro link ser revogado (ms, default 24h). */
  olderThanMs?: number;
};

export type LinkGcResult = {
  scanned: number;
  vip_revoked: number;
  vip_failed: number;
  bonus_revoked: number;
  bonus_failed: number;
  cleared_rows: number;
};

const log = (event: string, data: Record<string, unknown>) => {
  console.log(JSON.stringify({ tag: "trial-link-gc", event, ...data }));
};

async function revoke(botToken: string, chatId: string, link: string): Promise<boolean> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${botToken}/revokeChatInviteLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, invite_link: link }),
    });
    const data = await r.json().catch(() => ({}));
    // O Telegram retorna 400 com "INVITE_HASH_EXPIRED" / "Bad Request: invite link not found"
    // quando o link já é desconhecido pelo bot — pra nós isso conta como "ok",
    // o objetivo é só liberar a cota, e zerar a coluna do banco.
    if (r.ok && data?.ok) return true;
    const desc = String(data?.description ?? "").toLowerCase();
    if (
      desc.includes("not found") ||
      desc.includes("expired") ||
      desc.includes("invalid")
    ) {
      return true;
    }
    log("revoke-failed", { chat_id: chatId, link, status: r.status, description: data?.description ?? null });
    return false;
  } catch (e) {
    log("revoke-error", { chat_id: chatId, link, error: String(e) });
    return false;
  }
}

export async function runLinkGc(params: LinkGcParams): Promise<LinkGcResult> {
  const {
    supabase, botToken, chatId,
    bonusChatId = null,
    batchSize = 500,
    olderThanMs = TWENTY_FOUR_HOURS_MS,
  } = params;

  const cutoff = new Date(Date.now() - olderThanMs).toISOString();

  // Busca leads antigos (>24h) que ainda tenham qualquer um dos 2 links salvos.
  const { data: rows, error } = await supabase
    .from("trial_leads")
    .select("id, invite_link, bonus_invite_link, created_at, status, entered_at, bonus_entered_at")
    .lt("created_at", cutoff)
    .or("invite_link.not.is.null,bonus_invite_link.not.is.null")
    .limit(batchSize);

  if (error) {
    log("query-error", { error: error.message });
    throw new Error(`link-gc query failed: ${error.message}`);
  }

  const result: LinkGcResult = {
    scanned: rows?.length ?? 0,
    vip_revoked: 0,
    vip_failed: 0,
    bonus_revoked: 0,
    bonus_failed: 0,
    cleared_rows: 0,
  };

  for (const row of rows ?? []) {
    const updates: Record<string, unknown> = {};
    const isTerminal = TERMINAL_STATUSES.has(row.status);

    // Só revoga/limpa o invite_link VIP se o lead já entrou no grupo (entered_at
    // preenchido) OU está em status terminal. Leads pending/active que ainda não
    // entraram mantêm o link — apagá-lo causaria kick falso quando o usuário
    // demora mais de 24h para clicar.
    if (row.invite_link && (row.entered_at != null || isTerminal)) {
      const ok = await revoke(botToken, chatId, row.invite_link);
      if (ok) {
        result.vip_revoked++;
        updates.invite_link = null;
      } else {
        result.vip_failed++;
      }
    }

    // Mesma lógica para o bonus_invite_link: só apaga se o lead já entrou no
    // grupo bônus (bonus_entered_at preenchido) OU está em status terminal.
    if (row.bonus_invite_link && (row.bonus_entered_at != null || isTerminal)) {
      if (bonusChatId) {
        const ok = await revoke(botToken, bonusChatId, row.bonus_invite_link);
        if (ok) {
          result.bonus_revoked++;
          updates.bonus_invite_link = null;
        } else {
          result.bonus_failed++;
        }
      } else {
        // Bonus chat não configurado mais — limpa do banco mesmo sem revogar
        // (não tem como revogar sem o chat_id). É raro, mas evita linha presa.
        updates.bonus_invite_link = null;
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error: upErr } = await supabase
        .from("trial_leads")
        .update(updates)
        .eq("id", row.id);
      if (upErr) {
        log("update-failed", { lead_id: row.id, error: upErr.message });
      } else {
        result.cleared_rows++;
      }
    }
  }

  log("done", { ...result, cutoff, batch_size: batchSize });
  return result;
}

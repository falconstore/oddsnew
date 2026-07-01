// Edge Function: admin-users
//
// Administração de usuários da EQUIPE DO PAINEL. Exige service_role (a API
// admin do Supabase Auth não pode ser usada no frontend).
//
// ⚠️ ISOLAMENTO DO PWA: o auth.users deste projeto é COMPARTILHADO entre o
// painel admin e o app PWA (~434 usuários do PWA + a equipe). Esta função
// NUNCA lista/varre o auth.users. Toda ação:
//   1. Confirma que QUEM CHAMA é admin do painel.
//   2. Confirma que o EMAIL ALVO existe em user_permissions (é da equipe).
//      Se não existir → 403. Isso torna impossível tocar num usuário do PWA.
//   3. Só então busca esse email no Auth por email EXATO (O(1), sem paginar)
//      e age.
//
// AÇÕES (Etapa 1):
//   - "reset-password" → { email, tempPassword } define uma senha temporária
//      para um usuário DA EQUIPE. O admin repassa a senha ao usuário.
//
// Auth: Bearer do usuário logado (JWT do app).
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const log = (event: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ tag: "admin-users", event, ...data }));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, { status: 405 });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json({ error: "config do servidor incompleta" }, { status: 500 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // ── Auth: identifica o chamador pelo JWT e exige que seja admin do painel ──
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!jwt) return json({ error: "unauthorized" }, { status: 401 });

  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  const callerEmail = userData?.user?.email ?? null;
  if (userErr || !callerEmail) {
    log("bad_token", { err: userErr?.message });
    return json({ error: "unauthorized" }, { status: 401 });
  }

  // Chamador precisa ser admin do painel: super_admin OU admin_users em allowed_pages.
  const { data: callerPerm } = await admin
    .from("user_permissions")
    .select("is_super_admin, allowed_pages")
    .eq("user_email", callerEmail)
    .maybeSingle();
  const callerIsAdmin =
    !!callerPerm?.is_super_admin ||
    (Array.isArray(callerPerm?.allowed_pages) && callerPerm!.allowed_pages.includes("admin_users"));
  if (!callerIsAdmin) {
    log("forbidden_caller", { callerEmail });
    return json({ error: "forbidden" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "body inválido" }, { status: 400 });
  }
  const action = (body?.action ?? "") as string;

  try {
    // ─────────────────────────────────────────────────────────────
    // RESET-PASSWORD — senha temporária, SÓ para usuário da equipe.
    // ─────────────────────────────────────────────────────────────
    if (action === "reset-password") {
      const email = (body?.email ?? "").trim();
      const tempPassword = (body?.tempPassword ?? "").trim();
      if (!email) return json({ error: "email obrigatório" }, { status: 400 });
      if (tempPassword.length < 6) {
        return json({ error: "senha temporária deve ter ao menos 6 caracteres" }, { status: 400 });
      }

      // TRAVA ANTI-PWA #1: o email PRECISA estar em user_permissions (equipe).
      const { data: alvoPerm } = await admin
        .from("user_permissions")
        .select("user_email")
        .eq("user_email", email)
        .maybeSingle();
      if (!alvoPerm) {
        log("target_not_team", { email });
        return json({ error: "esse email não é um usuário do painel" }, { status: 403 });
      }

      // Busca pontual do id no Auth por email EXATO (sem paginar/listar).
      // Usa a admin API com filtro; se indisponível, cai pra query mínima.
      const targetUser = await acharAuthUserPorEmail(admin, email);
      if (!targetUser) {
        // Está na equipe mas nunca criou conta no Auth (adicionado só em
        // user_permissions). Não há senha pra resetar.
        log("target_no_auth", { email });
        return json({
          ok: false,
          code: "no_auth_account",
          error: "Este usuário ainda não tem conta de acesso (nunca fez o primeiro cadastro).",
        }, { status: 409 });
      }

      const { error: updErr } = await admin.auth.admin.updateUserById(targetUser.id, {
        password: tempPassword,
      });
      if (updErr) throw updErr;

      log("reset_ok", { email });
      return json({ ok: true, email });
    }

    return json({ error: "ação desconhecida" }, { status: 400 });
  } catch (e: any) {
    log("crash", { action, err: e?.message, stack: e?.stack?.slice(0, 400) });
    return json({ error: e?.message ?? "internal" }, { status: 500 });
  }
});

// Busca UM usuário do Auth por email exato, sem listar/paginar o auth.users e
// SEM efeitos colaterais (não envia email). Resolve o id por uma leitura direta
// e pontual (RPC get_auth_user_id_by_email, definida na migration), depois
// carrega o usuário por id via admin API.
async function acharAuthUserPorEmail(admin: any, email: string): Promise<any | null> {
  const alvo = email.toLowerCase();
  const { data: id, error } = await admin.rpc("get_auth_user_id_by_email", { p_email: alvo });
  if (error) throw error;
  if (!id) return null;
  const { data, error: getErr } = await admin.auth.admin.getUserById(id as string);
  if (getErr) throw getErr;
  return data?.user ?? null;
}

// Edge Function: betbra-config
//
// Admin-only endpoint to read and update BetBra integration settings
// (primarily the BETBRA_COOKIE) without needing to access the Supabase dashboard.
//
// POST body:
//   { action: "get" }                        → { ok: true, cookie_set: bool, updated_at: string|null }
//   { action: "set", cookie: string }         → { ok: true }
//
// Security: caller must be authenticated with a JWT from an admin user
// (can_view_admin = true). Service role is used internally.
//
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Authenticate the caller using their JWT (same pattern as trial-kick, trial-force-activate, etc.)
  const authHeader = req.headers.get("authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) {
    return json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  // Verify JWT using the anon client (established pattern in this codebase)
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
  const { data: userData, error: authError } = await userClient.auth.getUser();
  if (authError || !userData.user) {
    return json({ ok: false, error: "Sessão inválida" }, { status: 401 });
  }
  const email = userData.user.email?.toLowerCase();
  if (!email) {
    return json({ ok: false, error: "Email não encontrado" }, { status: 401 });
  }

  // Check admin permission keyed by user_email (established pattern in this codebase)
  const supa = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: perm } = await supa
    .from("user_permissions")
    .select("can_view_admin, is_super_admin")
    .eq("user_email", email)
    .maybeSingle();

  if (!perm || (!perm.can_view_admin && !perm.is_super_admin)) {
    return json({ ok: false, error: "Acesso negado. Apenas administradores podem gerenciar configurações." }, { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* no body */ }

  const action = body.action as string | undefined;

  // ── GET: return current cookie status ──────────────────────────────────────
  if (action === "get") {
    // Check DB config first
    const { data: dbRow } = await supa
      .from("betbra_config")
      .select("value, updated_at")
      .eq("key", "BETBRA_COOKIE")
      .maybeSingle();

    // Also check the env secret as fallback indicator
    const envCookie = Deno.env.get("BETBRA_COOKIE") ?? "";
    const cookieSet = !!(dbRow?.value || envCookie);
    const source = dbRow?.value ? "db" : (envCookie ? "env" : "none");

    return json({
      ok: true,
      cookie_set: cookieSet,
      source,
      updated_at: dbRow?.updated_at ?? null,
    });
  }

  // ── SET: save new cookie to DB ─────────────────────────────────────────────
  if (action === "set") {
    const cookie = (body.cookie as string | undefined)?.trim() ?? "";
    if (!cookie) {
      return json({ ok: false, error: "Cookie não pode ser vazio" }, { status: 400 });
    }

    const { error } = await supa
      .from("betbra_config")
      .upsert(
        { key: "BETBRA_COOKIE", value: cookie, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );

    if (error) {
      console.error("betbra-config set error:", error);
      return json({ ok: false, error: error.message }, { status: 500 });
    }

    return json({ ok: true });
  }

  return json({ ok: false, error: `Ação desconhecida: ${action}` }, { status: 400 });
});

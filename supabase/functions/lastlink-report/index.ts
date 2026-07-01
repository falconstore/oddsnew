// Edge Function: lastlink-report
//
// Gera um relatório de vendas da Lastlink com IA (Claude Opus). Recebe um
// recorte { produto?, mesInicio, mesFim }, agrega os números por mês via a RPC
// lastlink_monthly_summary (dados REAIS, status Aprovada), monta o prompt e
// pede à IA uma análise estruturada (resumo, diagnóstico, leitura mês-a-mês,
// recomendações). Salva no histórico (lastlink_ai_reports) e devolve.
//
// Auth: Bearer do admin logado (mesmo padrão do admin-users). Só admin do
// painel pode gerar (gasta IA).
// Bot/IA: ANTHROPIC_API_KEY (secret). Modelo: claude-opus-4-8.
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const log = (event: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ tag: "lastlink-report", event, ...data }));

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-opus-4-8";

// Ferramenta de saída estruturada — a IA preenche estes campos.
const TOOL_SCHEMA = {
  name: "montar_relatorio",
  description: "Monta o relatório de vendas a partir dos dados mensais fornecidos.",
  input_schema: {
    type: "object",
    properties: {
      resumo: { type: "string", description: "Visão geral do período em 2-4 frases (receita total, nº de vendas, tendência geral)." },
      diagnostico: {
        type: "array",
        description: "Pontos do diagnóstico: o que subiu/caiu e por quê, separando aquisição (novas) x retenção (renovações) x ticket médio.",
        items: { type: "string" },
      },
      achado_principal: { type: "string", description: "O achado mais importante do período, em 1-2 frases." },
      leitura_mensal: { type: "string", description: "Leitura mês a mês, apontando o mês de virada e o que mudou." },
      recomendacoes: {
        type: "array",
        description: "Ações concretas e priorizadas com base nos dados.",
        items: { type: "string" },
      },
      sinal_positivo: { type: "string", description: "Um ponto positivo real dos dados (ou string vazia se não houver)." },
    },
    required: ["resumo", "diagnostico", "achado_principal", "leitura_mensal", "recomendacoes"],
  },
};

const SYSTEM_PROMPT = `Você é um analista de dados de vendas por assinatura (SaaS/infoproduto) brasileiro.
Recebe os números REAIS de vendas de um produto, mês a mês, e escreve uma análise objetiva e acionável em português do Brasil.

Regras:
- Use SOMENTE os números fornecidos. Não invente dados nem percentuais que não consiga derivar do que foi dado.
- Separe SEMPRE três motores distintos: aquisição (vendas novas), retenção (renovações) e ticket médio. É comum um cair enquanto outro sobe — aponte isso.
- Calcule variações (%) a partir dos números dados quando ajudar a explicar.
- Seja direto e concreto. Nada de encher linguiça. Recomendações devem ser executáveis.
- Valores em R$ no formato brasileiro. Não exponha e-mails de clientes.
- Chame o produto pelo nome fornecido.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, { status: 405 });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE) return json({ error: "config do servidor incompleta" }, { status: 500 });
  if (!API_KEY) return json({ error: "ANTHROPIC_API_KEY não configurada" }, { status: 500 });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // ── Auth: exige admin do painel (via JWT do app) ──
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!jwt) return json({ error: "unauthorized" }, { status: 401 });

  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  const callerEmail = userData?.user?.email ?? null;
  if (userErr || !callerEmail) return json({ error: "unauthorized" }, { status: 401 });

  const { data: callerPerm } = await admin
    .from("user_permissions")
    .select("is_super_admin, allowed_pages")
    .eq("user_email", callerEmail)
    .maybeSingle();
  const isAdmin =
    !!callerPerm?.is_super_admin ||
    (Array.isArray(callerPerm?.allowed_pages) &&
      (callerPerm!.allowed_pages.includes("admin_users") || callerPerm!.allowed_pages.includes("lastlink_dashboard")));
  if (!isAdmin) {
    log("forbidden", { callerEmail });
    return json({ error: "forbidden" }, { status: 403 });
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "body inválido" }, { status: 400 }); }

  const produto: string | null = body?.produto ? String(body.produto) : null;
  const mesInicio: string = String(body?.mesInicio ?? "");   // "YYYY-MM-01"
  const mesFim: string = String(body?.mesFim ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(mesInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(mesFim)) {
    return json({ error: "mesInicio e mesFim obrigatórios (YYYY-MM-01)" }, { status: 400 });
  }

  try {
    // 1) Agrega os números reais (RPC).
    const { data: linhas, error: rpcErr } = await admin.rpc("lastlink_monthly_summary", {
      p_produto: produto,
      p_mes_inicio: mesInicio,
      p_mes_fim: mesFim,
    });
    if (rpcErr) throw rpcErr;
    const meses = (linhas ?? []) as any[];
    if (meses.length === 0) {
      return json({ ok: false, error: "Nenhuma venda no período/produto selecionado." }, { status: 409 });
    }

    // 2) Monta o payload pra IA (números crus, sem e-mails).
    const dadosParaIA = {
      produto: produto ?? "Todos os produtos",
      periodo: { de: mesInicio, ate: mesFim },
      meses: meses.map((m) => ({
        mes: m.mes,
        vendas: Number(m.vendas),
        novas: Number(m.novas),
        renovacoes: Number(m.renovacoes),
        receita: Number(m.receita),
        receita_novas: Number(m.receita_novas),
        receita_renov: Number(m.receita_renov),
        ticket_medio: Number(m.ticket_medio),
        clientes_unicos: Number(m.clientes_unicos),
        expiradas: Number(m.expiradas),
        canceladas: Number(m.canceladas),
        reembolsadas: Number(m.reembolsadas),
        chargebacks: Number(m.chargebacks),
      })),
    };

    // 3) Chama a IA (Opus) com tool use.
    const aiRes = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "tool", name: "montar_relatorio" },
        messages: [{
          role: "user",
          content:
            "Analise os dados mensais de vendas abaixo e monte o relatório. " +
            "Os números são reais (só vendas aprovadas). JSON:\n\n" +
            JSON.stringify(dadosParaIA, null, 2),
        }],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => "");
      log("anthropic_error", { status: aiRes.status });
      return json({ error: `IA falhou (${aiRes.status}): ${errText.slice(0, 200)}` }, { status: 502 });
    }

    const aiBody = await aiRes.json();
    const tokensIn = aiBody?.usage?.input_tokens ?? 0;
    const tokensOut = aiBody?.usage?.output_tokens ?? 0;
    const toolUse = (aiBody?.content ?? []).find((c: any) => c.type === "tool_use");
    if (!toolUse?.input) {
      return json({ error: "IA não retornou o relatório estruturado" }, { status: 502 });
    }
    const relatorio = toolUse.input;

    // 4) Salva no histórico.
    const { data: saved, error: insErr } = await admin
      .from("lastlink_ai_reports")
      .insert({
        created_by: callerEmail,
        produto,
        mes_inicio: mesInicio,
        mes_fim: mesFim,
        dados: dadosParaIA,
        relatorio,
        modelo: MODEL,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
      })
      .select("id, created_at")
      .single();
    if (insErr) log("save_error", { err: insErr.message }); // não bloqueia a resposta

    log("ok", { produto, mesInicio, mesFim, tokensIn, tokensOut });
    return json({
      ok: true,
      id: saved?.id ?? null,
      created_at: saved?.created_at ?? null,
      produto,
      periodo: { de: mesInicio, ate: mesFim },
      dados: dadosParaIA,
      relatorio,
      modelo: MODEL,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
    });
  } catch (e: any) {
    log("crash", { err: e?.message, stack: e?.stack?.slice(0, 400) });
    return json({ error: e?.message ?? "internal" }, { status: 500 });
  }
});

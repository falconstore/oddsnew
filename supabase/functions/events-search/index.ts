// Edge Function: events-search
//
// GET /functions/v1/events-search?q=flam[&sport=football]
//   → retorna até 15 fixtures (jogos) que casam com o termo, ordenados por kickoff.
//
// Cache: 12h em memória do worker (suficiente — API-Football só atualiza uma vez por dia
// por fixture, e fixture_id/kickoff são imutáveis depois de criados).
// Horizonte: hoje + 3 dias futuros (4 chamadas no warmup, depois cache).
// Janela "ao vivo": ainda relevante até kickoff + 4h (jogos em andamento aparecem na busca).
//
// Auth: usa o JWT padrão do Supabase (frontend já manda o anon + sessão).
// API_FOOTBALL_KEY vive no cofre do Supabase (Management API).

// deno-lint-ignore-file no-explicit-any

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

interface Fixture {
  nome: string;
  campeonato: string;
  data_hora: string;     // ISO UTC
  fixture_id: number;
  kickoff_at: string;    // ISO UTC (alias)
  esporte: "futebol";
  source: "api-football";
}

const TTL_MS = 12 * 60 * 60 * 1000;          // 12h
const HORIZON_DAYS = 4;                      // hoje + 3
const JANELA_AO_VIVO_MS = 4 * 60 * 60 * 1000; // 4h pós-kickoff

let cache: { data: Fixture[]; fetchedAt: number } | null = null;
let inflight: Promise<Fixture[]> | null = null;

function ymd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function fetchFixtures(): Promise<Fixture[]> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache.data;
  if (inflight) return inflight;

  const apiKey = Deno.env.get("API_FOOTBALL_KEY");
  if (!apiKey) {
    console.error("[events-search] API_FOOTBALL_KEY missing");
    return [];
  }

  inflight = (async () => {
    const todas: Fixture[] = [];
    const hoje = new Date();
    for (let i = 0; i < HORIZON_DAYS; i++) {
      const d = new Date(hoje.getTime() + i * 86400000);
      const date = ymd(d);
      try {
        const r = await fetch(
          `https://v3.football.api-sports.io/fixtures?date=${date}`,
          { headers: { "x-apisports-key": apiKey } },
        );
        if (!r.ok) {
          console.warn("[events-search] api-football non-ok", { date, status: r.status });
          continue;
        }
        const json = await r.json();
        for (const f of (json.response || [])) {
          const home = f?.teams?.home?.name;
          const away = f?.teams?.away?.name;
          const fxId = Number(f?.fixture?.id);
          const dt = f?.fixture?.date;
          if (!home || !away || !Number.isFinite(fxId) || !dt) continue;
          const iso = new Date(dt).toISOString();
          todas.push({
            nome: `${home} x ${away}`,
            campeonato: `${f.league?.name || ""}${
              f.league?.country ? ` (${f.league.country})` : ""
            }`.trim(),
            data_hora: iso,
            fixture_id: fxId,
            kickoff_at: iso,
            esporte: "futebol",
            source: "api-football",
          });
        }
      } catch (e: any) {
        console.warn("[events-search] fetch crash", { date, err: e?.message });
      }
    }
    cache = { data: todas, fetchedAt: Date.now() };
    return todas;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  if (q.length < 2) {
    return new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const todas = await fetchFixtures();
    const agora = Date.now();
    const items = todas
      .filter((f) => f.nome.toLowerCase().includes(q))
      .filter(
        (f) => new Date(f.data_hora).getTime() > agora - JANELA_AO_VIVO_MS,
      )
      .sort(
        (a, b) =>
          new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime(),
      )
      .slice(0, 15);

    return new Response(
      JSON.stringify({
        items,
        cached_at: cache?.fetchedAt ?? null,
        total_in_cache: todas.length,
      }),
      {
        status: 200,
        headers: {
          ...CORS,
          "Content-Type": "application/json",
          "Cache-Control": "private, max-age=60",
        },
      },
    );
  } catch (e: any) {
    console.error("[events-search] fatal", e);
    return new Response(
      JSON.stringify({ ok: false, error: "internal", message: e?.message }),
      {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      },
    );
  }
});

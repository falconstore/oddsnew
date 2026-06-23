// Edge Function: events-search
//
// GET /functions/v1/events-search?q=ingl[&sport=football]
//   → retorna até 15 fixtures (jogos) que casam com o termo, ordenados por kickoff.
//
// Nomes traduzidos pra PT no servidor (API devolve em inglês: "England x Spain").
// A busca casa tanto o termo em PT ("inglaterra") quanto o original em EN ("england"),
// e a exibição/storage saem em PT. Não existe API que devolva pt-BR — tradução é nossa.
//
// Cache: 12h em memória do worker. Horizonte: hoje + 14 dias (cobre janela de torneio
// tipo Copa do Mundo, onde há jogos diários). Janela "ao vivo": até kickoff + 4h.
//
// Auth: JWT padrão do Supabase. API_FOOTBALL_KEY no cofre do Supabase.

// deno-lint-ignore-file no-explicit-any

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

interface Fixture {
  nome: string;          // PT: "Inglaterra x Espanha"
  campeonato: string;    // PT no país
  data_hora: string;     // ISO UTC
  fixture_id: number;
  kickoff_at: string;    // ISO UTC (alias)
  esporte: "futebol";
  source: "api-football";
  _busca: string;        // string de match (PT + EN, normalizada) — não exibida
}

const TTL_MS = 12 * 60 * 60 * 1000;          // 12h
const HORIZON_DAYS = 15;                     // hoje + 14 (cobre torneios)
const JANELA_AO_VIVO_MS = 4 * 60 * 60 * 1000; // 4h pós-kickoff

// ---- Tradução EN→PT (espelha src/lib/traduzirEvento.ts) ----
const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const COUNTRIES_PT: Record<string, string> = {
  brazil: "Brasil", argentina: "Argentina", england: "Inglaterra", spain: "Espanha",
  germany: "Alemanha", italy: "Itália", france: "França", portugal: "Portugal",
  netherlands: "Holanda", belgium: "Bélgica", "united states": "Estados Unidos", usa: "Estados Unidos",
  mexico: "México", colombia: "Colômbia", chile: "Chile", uruguay: "Uruguai", paraguay: "Paraguai",
  peru: "Peru", ecuador: "Equador", bolivia: "Bolívia", venezuela: "Venezuela", japan: "Japão",
  "south korea": "Coreia do Sul", "saudi arabia": "Arábia Saudita", qatar: "Catar", morocco: "Marrocos",
  egypt: "Egito", nigeria: "Nigéria", cameroon: "Camarões", ghana: "Gana", senegal: "Senegal",
  "south africa": "África do Sul", australia: "Austrália", croatia: "Croácia", serbia: "Sérvia",
  switzerland: "Suíça", sweden: "Suécia", norway: "Noruega", denmark: "Dinamarca", poland: "Polônia",
  turkey: "Turquia", greece: "Grécia", austria: "Áustria", "czech republic": "República Tcheca",
  scotland: "Escócia", wales: "País de Gales", ireland: "Irlanda", russia: "Rússia", ukraine: "Ucrânia",
  canada: "Canadá", "costa rica": "Costa Rica", panama: "Panamá", honduras: "Honduras", romania: "Romênia",
  hungary: "Hungria", slovakia: "Eslováquia", slovenia: "Eslovênia", china: "China", india: "Índia",
  iran: "Irã", iraq: "Iraque", algeria: "Argélia", tunisia: "Tunísia", "ivory coast": "Costa do Marfim",
  finland: "Finlândia", iceland: "Islândia", israel: "Israel", "new zealand": "Nova Zelândia",
  world: "Mundo",
};

// Competições/ligas com nome usual em PT (só as que mudam; resto fica como vem).
const LEAGUES_PT: Record<string, string> = {
  "world cup": "Copa do Mundo",
  "friendlies": "Amistosos",
  "friendlies clubs": "Amistosos de Clubes",
  "uefa champions league": "Liga dos Campeões",
  "uefa europa league": "Liga Europa",
  "uefa europa conference league": "Liga Conferência",
  "uefa nations league": "Liga das Nações",
  "euro championship": "Eurocopa",
  "copa america": "Copa América",
  "conmebol libertadores": "Libertadores",
  "conmebol sudamericana": "Sul-Americana",
  "africa cup of nations": "Copa Africana de Nações",
  "fifa club world cup": "Mundial de Clubes",
};

function traduzirLiga(liga: string): string {
  const original = (liga || "").trim();
  if (!original) return original;
  const key = norm(original);
  if (LEAGUES_PT[key]) return LEAGUES_PT[key];
  // Eliminatórias da Copa: "World Cup - Qualification CONMEBOL" → "Copa do Mundo ..."
  if (key.startsWith("world cup")) return original.replace(/world cup/i, "Copa do Mundo");
  return original;
}

const CLUBS_PT: Record<string, string> = {
  "bayern munich": "Bayern de Munique", "bayern münchen": "Bayern de Munique", "fc bayern münchen": "Bayern de Munique",
  "internazionale": "Inter de Milão", "inter milan": "Inter de Milão",
  "ac milan": "Milan", "as roma": "Roma", "ssc napoli": "Napoli",
  "newcastle united": "Newcastle", "tottenham hotspur": "Tottenham",
  "wolverhampton wanderers": "Wolverhampton", "brighton & hove albion": "Brighton",
  "sporting cp": "Sporting", "fc porto": "Porto", "sl benfica": "Benfica",
  "psv eindhoven": "PSV", "bayer leverkusen": "Leverkusen", "borussia monchengladbach": "Mönchengladbach",
  "atletico madrid": "Atlético de Madrid",
  "red bull salzburg": "RB Salzburg", "paris saint germain": "PSG", "paris saint-germain": "PSG",
};

function traduzirNome(nome: string): string {
  const original = (nome || "").trim();
  if (!original) return original;
  const key = norm(original);
  return CLUBS_PT[key] || COUNTRIES_PT[key] || original;
}

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
          const homeEn = f?.teams?.home?.name;
          const awayEn = f?.teams?.away?.name;
          const fxId = Number(f?.fixture?.id);
          const dt = f?.fixture?.date;
          if (!homeEn || !awayEn || !Number.isFinite(fxId) || !dt) continue;
          const iso = new Date(dt).toISOString();
          const homePt = traduzirNome(homeEn);
          const awayPt = traduzirNome(awayEn);
          const ligaEn = f.league?.name || "";
          const paisEn = f.league?.country || "";
          const campeonato = `${traduzirLiga(ligaEn)}${paisEn ? ` (${traduzirNome(paisEn)})` : ""}`.trim();
          todas.push({
            nome: `${homePt} x ${awayPt}`,
            campeonato,
            data_hora: iso,
            fixture_id: fxId,
            kickoff_at: iso,
            esporte: "futebol",
            source: "api-football",
            // casa em PT E em EN (ex: "inglaterra" e "england"), + liga/país
            _busca: norm(`${homePt} ${awayPt} ${homeEn} ${awayEn} ${ligaEn} ${paisEn}`),
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
  const qRaw = (url.searchParams.get("q") || "").trim();
  const q = norm(qRaw);
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
      .filter((f) => f._busca.includes(q))
      .filter(
        (f) => new Date(f.data_hora).getTime() > agora - JANELA_AO_VIVO_MS,
      )
      .sort(
        (a, b) =>
          new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime(),
      )
      .slice(0, 15)
      // não vaza o campo interno de match
      .map(({ _busca, ...rest }) => rest);

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

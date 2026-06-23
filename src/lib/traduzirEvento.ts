// Tradução EN→PT de nomes de partidas/eventos esportivos.
//
// Por quê: as APIs de esporte (API-Sports etc.) devolvem nomes canônicos, quase
// sempre em inglês ("Brazil x Spain", "Bayern Munich"). NÃO existe API pública
// que garanta pt-BR, então a tradução é feita aqui, do nosso lado, aplicada na
// seleção do evento (grava em PT) e na exibição dos Templates (cobre dados antigos).
//
// Extensível: adicione entradas em COUNTRIES_PT / CLUBS_PT conforme aparecerem
// nomes em inglês que incomodem. Chave é normalizada (minúscula, sem acento).

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Seleções (vêm como nome do país em inglês)
const COUNTRIES_PT: Record<string, string> = {
  brazil: 'Brasil', argentina: 'Argentina', england: 'Inglaterra', spain: 'Espanha',
  germany: 'Alemanha', italy: 'Itália', france: 'França', portugal: 'Portugal',
  netherlands: 'Holanda', belgium: 'Bélgica', 'united states': 'Estados Unidos', usa: 'Estados Unidos',
  mexico: 'México', colombia: 'Colômbia', chile: 'Chile', uruguay: 'Uruguai', paraguay: 'Paraguai',
  peru: 'Peru', ecuador: 'Equador', bolivia: 'Bolívia', venezuela: 'Venezuela', japan: 'Japão',
  'south korea': 'Coreia do Sul', 'saudi arabia': 'Arábia Saudita', qatar: 'Catar', morocco: 'Marrocos',
  egypt: 'Egito', nigeria: 'Nigéria', cameroon: 'Camarões', ghana: 'Gana', senegal: 'Senegal',
  'south africa': 'África do Sul', australia: 'Austrália', croatia: 'Croácia', serbia: 'Sérvia',
  switzerland: 'Suíça', sweden: 'Suécia', norway: 'Noruega', denmark: 'Dinamarca', poland: 'Polônia',
  turkey: 'Turquia', greece: 'Grécia', austria: 'Áustria', 'czech republic': 'República Tcheca',
  scotland: 'Escócia', wales: 'País de Gales', ireland: 'Irlanda', russia: 'Rússia', ukraine: 'Ucrânia',
  canada: 'Canadá', 'costa rica': 'Costa Rica', panama: 'Panamá', honduras: 'Honduras', romania: 'Romênia',
  hungary: 'Hungria', slovakia: 'Eslováquia', slovenia: 'Eslovênia', china: 'China', india: 'Índia',
  iran: 'Irã', iraq: 'Iraque', algeria: 'Argélia', tunisia: 'Tunísia', 'ivory coast': 'Costa do Marfim',
  finland: 'Finlândia', iceland: 'Islândia', israel: 'Israel', 'new zealand': 'Nova Zelândia',
  world: 'Mundo',
};

// Clubes cujo nome usual em PT difere do canônico em inglês.
// (Times BR e a maioria dos clubes mantêm o nome — só listar os que mudam.)
const CLUBS_PT: Record<string, string> = {
  'bayern munich': 'Bayern de Munique', 'bayern münchen': 'Bayern de Munique', 'fc bayern münchen': 'Bayern de Munique',
  'internazionale': 'Inter de Milão', 'inter milan': 'Inter de Milão',
  'ac milan': 'Milan', 'as roma': 'Roma', 'ssc napoli': 'Napoli',
  'manchester united': 'Manchester United', 'newcastle united': 'Newcastle', 'tottenham hotspur': 'Tottenham',
  'wolverhampton wanderers': 'Wolverhampton', 'brighton & hove albion': 'Brighton',
  'sporting cp': 'Sporting', 'fc porto': 'Porto', 'sl benfica': 'Benfica',
  'psv eindhoven': 'PSV', 'bayer leverkusen': 'Leverkusen', 'borussia monchengladbach': 'Mönchengladbach',
  'atletico madrid': 'Atlético de Madrid', 'rb leipzig': 'RB Leipzig',
  'red bull salzburg': 'RB Salzburg', 'paris saint germain': 'PSG', 'paris saint-germain': 'PSG',
};

/** Traduz um único nome (time ou país). Mantém o original se não houver entrada. */
export function traduzirNome(nome: string): string {
  const original = nome.trim();
  if (!original) return original;
  const key = norm(original);
  return CLUBS_PT[key] || COUNTRIES_PT[key] || original;
}

/**
 * Traduz o nome de uma partida "A x B" / "A vs B" / "A - B".
 * Preserva o separador e traduz cada lado. Nomes desconhecidos ficam como estão.
 */
export function traduzirEvento(nome: string | null | undefined): string {
  if (!nome) return nome ?? '';
  const sep = nome.match(/\s+(x|vs\.?|×|-)\s+/i);
  if (!sep) return traduzirNome(nome);
  const [home, away] = nome.split(sep[0]);
  if (away === undefined) return traduzirNome(nome);
  return `${traduzirNome(home)} x ${traduzirNome(away)}`;
}

/** Traduz "Liga (Country)" → "Liga (País)" — usado no rótulo de campeonato. */
export function traduzirCampeonato(campeonato: string | null | undefined): string {
  if (!campeonato) return campeonato ?? '';
  return campeonato.replace(/\(([^)]+)\)/g, (_m, inner) => `(${traduzirNome(inner)})`);
}

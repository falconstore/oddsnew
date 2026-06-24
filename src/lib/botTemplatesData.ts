// ============================================================================
// Templates de procedimentos (compartilhado entre BotTemplates e EnvioProcedimentos)
// Extraído de BotTemplates.tsx — helpers de formatação, tipos e os TEMPLATES.
// ============================================================================

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
export function fmtDate(iso: string): string {
  if (!iso) return 'DD/MM/AAAA';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function fmtTime(t: string): string { return t || 'HH:MM'; }
function fmtVal(v: string): string { return v || '0,00'; }

export function kickoffToDateStr(iso: string | null): string {
  if (!iso) return 'DD/MM/AAAA';
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}
export function kickoffToTimeStr(iso: string | null): string {
  if (!iso) return 'HH:MM';
  return new Date(iso).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────

export interface FieldConfig {
  id: string;
  label: string;
  placeholder: string;
  type: 'text' | 'date' | 'time' | 'evento' | 'select' | 'toggle' | 'freebet_select';
  default?: () => string;
  hint?: string;
  optional?: boolean;
  uppercase?: boolean;
  showIf?: (fields: Record<string, string>) => boolean;
}

export interface TemplateConfig {
  id: string;
  name: string;
  shortName: string;
  description: string;
  color: string;
  dotColor: string;
  emoji: string;
  fields: FieldConfig[];
  generate: (f: Record<string, string>) => string;
}

interface CustomTemplate {
  id: string;
  name: string;
  text: string;
  savedAt: string;
}

const CUSTOM_TEMPLATES_KEY = 'bsk_custom_templates';
const CUSTOM_CATEGORIES_KEY = 'bsk_procedure_categories';

function loadCustomTemplates(): CustomTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomTemplates(templates: CustomTemplate[]) {
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(templates));
}

function loadCustomCategories(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_CATEGORIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomCategories(cats: string[]) {
  localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(cats));
}

// ─────────────────────────────────────────
// Giros Grátis — campos e linha de saída compartilhados
// ─────────────────────────────────────────

const GIROS_TOGGLE: FieldConfig[] = [
  { id: 'incluirGiros', label: 'Giros Grátis', placeholder: '', type: 'toggle', default: () => 'false' },
];

const GIROS_SUBFIELDS: FieldConfig[] = [
  { id: 'girosQtd', label: 'Quantidade de Giros (ex: 301)', placeholder: '301', type: 'text', showIf: (f) => f.incluirGiros === 'true' },
  { id: 'girosValor', label: 'Valor por Giro em R$ (ex: 1)', placeholder: '1', type: 'text', showIf: (f) => f.incluirGiros === 'true' },
];

function fmtGiros(f: Record<string, string>): string {
  return `🟡 RECOMPENSA: 🎁 ${f.girosQtd || 'N'} GIROS DE ${f.girosValor || '1'} REAL`;
}

function fmtRange(min: string, max: string, sep = 'A'): string {
  if (!max || !max.trim()) return fmtVal(min);
  return `${fmtVal(min)} ${sep} ${fmtVal(max)}`;
}

const PARTIDAS_OPCIONAIS: FieldConfig[] = [
  { id: 'evento2', label: 'Partida 2', placeholder: 'Ex: Real Madrid x Barcelona', type: 'evento', optional: true },
  { id: 'evento3', label: 'Partida 3', placeholder: 'Ex: Juventus x Inter de Milão', type: 'evento', optional: true },
];

export function buildPartidas(f: Record<string, string>): string[] {
  const partidas = [`${f.evento1 || 'TIME A X TIME B'} - ${f.evento1_data || 'DD/MM/AAAA'} ÀS ${f.evento1_hora || 'HH:MM'}`];
  if (f.evento2) partidas.push(`${f.evento2} - ${f.evento2_data || 'DD/MM/AAAA'} ÀS ${f.evento2_hora || 'HH:MM'}`);
  if (f.evento3) partidas.push(`${f.evento3} - ${f.evento3_data || 'DD/MM/AAAA'} ÀS ${f.evento3_hora || 'HH:MM'}`);
  return partidas;
}

// ─────────────────────────────────────────
// Definição dos templates built-in
// ─────────────────────────────────────────

export const TEMPLATES: TemplateConfig[] = [
  {
    id: 'queimar_fb',
    name: 'Queimar FreeBet',
    shortName: 'Queimar FB',
    description: 'Para girar freebet ganha em procedimento anterior.',
    color: 'bg-primary/15 text-primary border-primary/30',
    dotColor: 'bg-primary',
    emoji: '🟢',
    fields: [
      { id: 'isExtra', label: 'É EXTRA? (reenvio)', placeholder: '', type: 'toggle', default: () => 'false' },
      { id: 'incluirDG', label: 'Chance de Duplo Green', placeholder: '', type: 'toggle', default: () => 'true' },
      ...GIROS_TOGGLE,
      { id: 'num', label: 'Nº do Procedimento', placeholder: 'Ex: 130', type: 'text' },
      { id: 'dataProc', label: 'Data do Procedimento', placeholder: '', type: 'date', default: todayISO },
      { id: 'numRef', label: 'Freebet a Queimar', placeholder: '', type: 'freebet_select', hint: 'Selecione o procedimento GANHAR_FB cuja freebet será queimada aqui.' },
      { id: 'casa', label: 'Casa de Apostas', placeholder: 'Ex: Bet365', type: 'text', uppercase: true },
      { id: 'evento1', label: 'Partida', placeholder: 'Ex: Flamengo x Palmeiras', type: 'evento' },
      { id: 'lucro', label: 'Lucro Previsto (ex: 17,00)', placeholder: '17,00', type: 'text' },
      ...GIROS_SUBFIELDS,
      { id: 'categoria', label: 'Categoria', placeholder: '', type: 'select', default: () => 'Freebet' },
      ...PARTIDAS_OPCIONAIS,
    ],
    generate: (f) => {
      const refStr = f.numRef || '[NNN]';
      const linha2 = `🟢 PROCEDIMENTO REFERENTE ÀS FREEBETS — REF N° ${refStr} 🔥`;
      const partidas = buildPartidas(f);
      return [
        `🟢 PROCEDIMENTO ${f.isExtra === 'true' ? 'EXTRA ' : ''}${f.num || 'NNN'} - ${fmtDate(f.dataProc)}`,
        linha2,
        `CASA: 🏠 ${(f.casa || 'CASA').toUpperCase()}`,
        ``,
        `UTILIZAREMOS O JOGO ENTRE:`,
        ...partidas,
        ``,
        `🟥 Atenção: sempre confere data e horário da partida nos bilhetes também.`,
        `🟥 Atenção: Sempre confira se os links dos bilhetes são os mesmos da imagem.`,
        `🔴 CASO HAJA ALTERAÇÃO NAS ODDS, CHAME O SUPORTE`,
        ``,
        `🟡 LUCRO: 💵 ${fmtVal(f.lucro)} 💵`,
        ...(f.incluirGiros === 'true' ? [fmtGiros(f)] : []),
        `📋 CATEGORIA: ${f.categoria || 'Freebet'}`,
        ...(f.incluirDG !== 'false' ? [`😍 chance de duplo green 😍`] : []),
      ].join('\n');
    },
  },
  {
    id: 'ganhar_fb_promo',
    name: 'Ganhar Freebet — Promoção',
    shortName: 'Ganhar FB (Promo)',
    description: 'Promoção da casa com aposta grátis. Ex: "Super Sextou".',
    color: 'bg-muted border-border text-muted-foreground',
    dotColor: 'bg-muted-foreground',
    emoji: '🟢',
    fields: [
      { id: 'isExtra', label: 'É EXTRA? (reenvio)', placeholder: '', type: 'toggle', default: () => 'false' },
      { id: 'incluirDG', label: 'Chance de Duplo Green', placeholder: '', type: 'toggle', default: () => 'true' },
      ...GIROS_TOGGLE,
      { id: 'num', label: 'Nº do Procedimento', placeholder: 'Ex: 129', type: 'text' },
      { id: 'dataProc', label: 'Data do Procedimento', placeholder: '', type: 'date', default: todayISO },
      { id: 'casa', label: 'Casa de Apostas', placeholder: 'Ex: Sportingbet', type: 'text', uppercase: true },
      { id: 'campanha', label: 'Nome da Campanha', placeholder: 'Ex: SUPER SEXTOU', type: 'text', uppercase: true },
      { id: 'evento1', label: 'Partida 1', placeholder: 'Ex: RB Leipzig x St Pauli', type: 'evento' },
      { id: 'freebetValor', label: 'Valor da Freebet (ex: 25,00)', placeholder: '25,00', type: 'text' },
      { id: 'obsRecompensa', label: 'Observação da Recompensa (opcional)', placeholder: 'Ex: A CADA GOL DO SANTOS', type: 'text', uppercase: true, hint: 'Aparece após "EM FREEBET". Deixe vazio se não houver condição especial.' },
      ...GIROS_SUBFIELDS,
      { id: 'categoria', label: 'Categoria', placeholder: '', type: 'select', default: () => 'Freebet' },
      ...PARTIDAS_OPCIONAIS,
    ],
    generate: (f) => {
      const partidas = buildPartidas(f);
      const recompensa = `🟡 RECOMPENSA: 🎁 ${fmtVal(f.freebetValor)} EM FREEBET${f.obsRecompensa ? ` - ${f.obsRecompensa.toUpperCase()}` : ''}`;
      return [
        `🟢 PROCEDIMENTO ${f.isExtra === 'true' ? 'EXTRA ' : ''}${f.num || 'NNN'} - ${fmtDate(f.dataProc)}`,
        `🟢 PROCEDIMENTO REFERENTE A PROMOÇÃO DA ${(f.casa || 'CASA').toUpperCase()} - ${(f.campanha || 'CAMPANHA').toUpperCase()} COM APOSTA GRÁTIS 🔥`,
        ``,
        `UTILIZAREMOS A PARTIDA ENTRE:`,
        ...partidas,
        ``,
        `🟥 Atenção: sempre confere data e horário da partida nos bilhetes também.`,
        `🟥 Atenção: Sempre confira se os links dos bilhetes são os mesmos da imagem.`,
        `🔴 CASO HAJA ALTERAÇÃO NAS ODDS, UTILIZE A CALCULADORA`,
        ``,
        recompensa,
        ...(f.incluirGiros === 'true' ? [fmtGiros(f)] : []),
        `📋 CATEGORIA: ${f.categoria || 'Freebet'}`,
        ...(f.incluirDG !== 'false' ? [`😍 chance de duplo green 😍`] : []),
      ].join('\n');
    },
  },
  {
    id: 'ganhar_fb_missao',
    name: 'Ganhar Freebet — Missão',
    shortName: 'Ganhar FB (Missão)',
    description: 'Missão da casa com recompensa em freebet ao completar.',
    color: 'bg-muted border-border text-muted-foreground',
    dotColor: 'bg-muted-foreground',
    emoji: '🟢',
    fields: [
      { id: 'isExtra', label: 'É EXTRA? (reenvio)', placeholder: '', type: 'toggle', default: () => 'false' },
      { id: 'incluirDG', label: 'Chance de Duplo Green', placeholder: '', type: 'toggle', default: () => 'true' },
      ...GIROS_TOGGLE,
      { id: 'num', label: 'Nº do Procedimento', placeholder: 'Ex: 115', type: 'text' },
      { id: 'dataProc', label: 'Data do Procedimento', placeholder: '', type: 'date', default: todayISO },
      { id: 'missao', label: 'Nome da Missão', placeholder: 'Ex: LIGA DOS CAMPEÕES', type: 'text', uppercase: true },
      { id: 'casa', label: 'Casa de Apostas', placeholder: 'Ex: Betano', type: 'text', uppercase: true },
      { id: 'evento1', label: 'Partida 1', placeholder: 'Ex: Bayern x PSG', type: 'evento' },
      { id: 'freebetValor', label: 'Valor da Freebet (ex: 50,00)', placeholder: '50,00', type: 'text' },
      { id: 'obsRecompensa', label: 'Observação da Recompensa (opcional)', placeholder: 'Ex: A CADA GOL DO SANTOS', type: 'text', uppercase: true, hint: 'Aparece após "EM FREEBET". Deixe vazio se não houver condição especial.' },
      ...GIROS_SUBFIELDS,
      { id: 'categoria', label: 'Categoria', placeholder: '', type: 'select', default: () => 'Extra' },
      ...PARTIDAS_OPCIONAIS,
    ],
    generate: (f) => {
      const partidas = buildPartidas(f);
      const recompensa = `🟡 RECOMPENSA: 🎁 ${fmtVal(f.freebetValor)} EM FREEBET${f.obsRecompensa ? ` - ${f.obsRecompensa.toUpperCase()}` : ''}`;
      return [
        `🟢 PROCEDIMENTO ${f.isExtra === 'true' ? 'EXTRA ' : ''}${f.num || 'NNN'} - ${fmtDate(f.dataProc)}`,
        `🟢 PROCEDIMENTO REFERENTE À MISSÃO ${(f.missao || 'NOME DA MISSÃO').toUpperCase()} 🔥`,
        `CASA: 🏠 ${(f.casa || 'CASA').toUpperCase()}`,
        ``,
        `UTILIZAREMOS A PARTIDA ENTRE:`,
        ...partidas,
        ``,
        `🟥 atenção: sempre confere data e horário da partida nos bilhetes também.`,
        `🔴 CASO HAJA ALTERAÇÃO NAS ODDS, UTILIZE A CALCULADORA`,
        ``,
        recompensa,
        ...(f.incluirGiros === 'true' ? [fmtGiros(f)] : []),
        `📋 CATEGORIA: ${f.categoria || 'Extra'}`,
        ...(f.incluirDG !== 'false' ? [`😍 chance de duplo green para um lado 😍`] : []),
      ].join('\n');
    },
  },
  {
    id: 'superodd_dg',
    name: 'Superodd',
    shortName: 'Superodd',
    description: 'Superodd com lucro mínimo e máximo. Opção de Possível Duplo Green quando ativada. Emoji azul 🔵.',
    color: 'bg-muted border-border text-muted-foreground',
    dotColor: 'bg-muted-foreground',
    emoji: '🔵',
    fields: [
      { id: 'isExtra', label: 'É EXTRA? (reenvio)', placeholder: '', type: 'toggle', default: () => 'false' },
      { id: 'incluirDG', label: 'Chance de Duplo Green', placeholder: '', type: 'toggle', default: () => 'true' },
      ...GIROS_TOGGLE,
      { id: 'num', label: 'Nº do Procedimento', placeholder: 'Ex: 116', type: 'text' },
      { id: 'dataProc', label: 'Data do Procedimento', placeholder: '', type: 'date', default: todayISO },
      { id: 'casa', label: 'Casa de Apostas', placeholder: 'Ex: Betesporte', type: 'text', uppercase: true, hint: 'A casa aparece na linha 2 ("DA BETESPORTE") — não precisa de linha CASA: separada neste tipo.' },
      { id: 'evento1', label: 'Partida', placeholder: 'Ex: Corinthians x Vasco', type: 'evento' },
      { id: 'lucroMin', label: 'Lucro Mínimo (ex: 17,63)', placeholder: '17,63', type: 'text' },
      { id: 'lucroMax', label: 'Lucro Máximo (ex: 248,00)', placeholder: '248,00 — ou vazio para valor único', type: 'text', hint: 'Deixe vazio para exibir valor único em vez de range.' },
      { id: 'valorDG', label: 'Possível Duplo Green (ex: 210,00)', placeholder: '210,00', type: 'text', showIf: (f) => f.incluirDG !== 'false' },
      ...GIROS_SUBFIELDS,
      { id: 'categoria', label: 'Categoria', placeholder: '', type: 'select', default: () => 'Superodd' },
      ...PARTIDAS_OPCIONAIS,
    ],
    generate: (f) => [
      `🔵 PROCEDIMENTO ${f.isExtra === 'true' ? 'EXTRA ' : ''}${f.num || 'NNN'} - ${fmtDate(f.dataProc)}`,
      `🟢 PROCEDIMENTO REFERENTE A SUPERODD DA ${(f.casa || 'CASA').toUpperCase()} 🔥`,
      ``,
      `UTILIZAREMOS O JOGO ENTRE:`,
      ...buildPartidas(f),
      ``,
      `🔴 CASO HAJA ALTERAÇÃO NAS ODDS, UTILIZE CALCULADORA 🧮`,
      ``,
      `🟡 LUCRO: 💵 ${fmtRange(f.lucroMin, f.lucroMax)} 💵`,
      ...(f.incluirDG !== 'false' ? [`🟡 POSSÍVEL DUPLO GREEN - 💵 ${fmtVal(f.valorDG)}`] : []),
      ...(f.incluirGiros === 'true' ? [fmtGiros(f)] : []),
      `📋 CATEGORIA: ${f.categoria || 'Superodd'}`,
      ...(f.incluirDG !== 'false' ? [`😍 chance de duplo green 😍`] : []),
    ].join('\n'),
  },
  {
    id: 'aumento_25',
    name: 'Aumento 25%',
    shortName: 'Aumento 25%',
    description: 'Promoção de aumento de 25% da casa. Lucro em range mínimo–máximo. Quantidade de CPFs configurável.',
    color: 'bg-primary/15 text-primary border-primary/30',
    dotColor: 'bg-primary',
    emoji: '🟢',
    fields: [
      { id: 'isExtra', label: 'É EXTRA? (reenvio)', placeholder: '', type: 'toggle', default: () => 'false' },
      { id: 'incluirDG', label: 'Chance de Duplo Green', placeholder: '', type: 'toggle', default: () => 'true' },
      ...GIROS_TOGGLE,
      { id: 'num', label: 'Nº do Procedimento', placeholder: 'Ex: 141', type: 'text' },
      { id: 'dataProc', label: 'Data do Procedimento', placeholder: '', type: 'date', default: todayISO },
      { id: 'casa', label: 'Casa de Apostas', placeholder: 'Ex: BET365', type: 'text', uppercase: true },
      { id: 'cpfCount', label: 'Quantidade de CPFs necessários', placeholder: 'Ex: 1', type: 'text', default: () => '1', hint: 'Ex: 1, 2, 3... Aparece na linha 🚨SERÁ NECESSÁRIO N CPF(s)🚨' },
      { id: 'evento1', label: 'Partida', placeholder: 'Ex: Real Oviedo x Getafe', type: 'evento' },
      { id: 'lucroMin', label: 'Lucro Mínimo (ex: 17,63)', placeholder: '17,63', type: 'text' },
      { id: 'lucroMax', label: 'Lucro Máximo (ex: 248,00)', placeholder: '248,00 — ou vazio para valor único', type: 'text', hint: 'Deixe vazio para exibir valor único em vez de range.' },
      ...GIROS_SUBFIELDS,
      { id: 'categoria', label: 'Categoria', placeholder: '', type: 'select', default: () => 'Promoção' },
      ...PARTIDAS_OPCIONAIS,
    ],
    generate: (f) => {
      const cpf = (f.cpfCount || '1').trim();
      const cpfNum = parseInt(cpf, 10);
      const cpfLabel = !isNaN(cpfNum) && cpfNum > 1 ? `${cpf} CPFs` : `${cpf} CPF`;
      return [
        `🟢 PROCEDIMENTO ${f.isExtra === 'true' ? 'EXTRA ' : ''}${f.num || 'NNN'} - ${fmtDate(f.dataProc)}`,
        ``,
        `🟢 PROCEDIMENTO REFERENTE AO AUMENTO DE 25%🔥`,
        ``,
        `CASA: ${(f.casa || 'CASA').toUpperCase()}`,
        ``,
        `🚨SERÁ NECESSÁRIO ${cpfLabel} NA ${(f.casa || 'CASA').toUpperCase()}🚨`,
        ``,
        `UTILIZAREMOS A PARTIDA ENTRE:`,
        ``,
        ...buildPartidas(f),
        ``,
        `🟥 Atenção : sempre confere data e horário da partida nos bilhetes também.`,
        `🟥 Atenção: Sempre confira se os links dos bilhetes são os mesmo da imagem .`,
        `🔴 CASO HAJA ALTERAÇÃO NAS ODDS, UTILIZE A CALCULADORA!`,
        ``,
        `🟡LUCRO: 💵 ${fmtRange(f.lucroMin, f.lucroMax)}💵`,
        ``,
        ...(f.incluirGiros === 'true' ? [fmtGiros(f)] : []),
        ...(f.incluirDG !== 'false' ? [`😍 chance de duplo green😍`] : []),
      ].join('\n');
    },
  },
  {
    id: 'tentativa_dg',
    name: 'Tentativa de Duplo Green',
    shortName: 'Tentativa DG',
    description: 'Operação com objetivo de Duplo Green. Exibe o valor alvo do DG.',
    color: 'bg-primary/15 text-primary border-primary/30',
    dotColor: 'bg-primary',
    emoji: '🟢',
    fields: [
      { id: 'isExtra', label: 'É EXTRA? (reenvio)', placeholder: '', type: 'toggle', default: () => 'false' },
      ...GIROS_TOGGLE,
      { id: 'num', label: 'Nº do Procedimento', placeholder: 'Ex: 120', type: 'text' },
      { id: 'dataProc', label: 'Data do Procedimento', placeholder: '', type: 'date', default: todayISO },
      { id: 'casa', label: 'Casa de Apostas', placeholder: 'Ex: Betesporte', type: 'text', uppercase: true },
      { id: 'evento1', label: 'Partida', placeholder: 'Ex: Corinthians x Vasco', type: 'evento' },
      { id: 'valorDG', label: 'Valor Alvo Duplo Green (ex: 210,00)', placeholder: '210,00', type: 'text' },
      { id: 'lucro', label: 'Lucro Mínimo Garantido (ex: 17,00)', placeholder: '17,00', type: 'text' },
      ...GIROS_SUBFIELDS,
      { id: 'categoria', label: 'Categoria', placeholder: '', type: 'select', default: () => 'Tentativa de Duplo Green' },
      ...PARTIDAS_OPCIONAIS,
    ],
    generate: (f) => [
      `🟢 PROCEDIMENTO ${f.isExtra === 'true' ? 'EXTRA ' : ''}${f.num || 'NNN'} - ${fmtDate(f.dataProc)}`,
      ``,
      `🟢 TENTATIVA DE DUPLO GREEN NA ${(f.casa || 'CASA').toUpperCase()} 🔥`,
      ``,
      `UTILIZAREMOS O JOGO ENTRE:`,
      ...buildPartidas(f),
      ``,
      `🔴 CASO HAJA ALTERAÇÃO NAS ODDS, UTILIZE CALCULADORA 🧮`,
      ``,
      `🟡 OBJETIVO DUPLO GREEN - 💵 ${f.valorDG ? `R$ ${f.valorDG}` : 'R$ XXX,XX'}`,
      `🟡 LUCRO MÍNIMO GARANTIDO: 💵 ${f.lucro ? `R$ ${f.lucro}` : 'R$ XX,XX'}`,
      ...(f.incluirGiros === 'true' ? [fmtGiros(f)] : []),
      ``,
      `😍 chance de duplo green 😍`,
    ].join('\n'),
  },
  {
    id: 'promo_range',
    name: 'Promoção — Lucro em Range',
    shortName: 'Promoção (Range)',
    description: 'Lucro varia entre valor mínimo e máximo. Ex: R$3,25 à R$3,75.',
    color: 'bg-warning/15 text-warning border-warning/30',
    dotColor: 'bg-warning',
    emoji: '🟢',
    fields: [
      { id: 'isExtra', label: 'É EXTRA? (reenvio)', placeholder: '', type: 'toggle', default: () => 'false' },
      { id: 'incluirDG', label: 'Chance de Duplo Green', placeholder: '', type: 'toggle', default: () => 'true' },
      ...GIROS_TOGGLE,
      { id: 'num', label: 'Nº do Procedimento', placeholder: 'Ex: 117', type: 'text' },
      { id: 'dataProc', label: 'Data do Procedimento', placeholder: '', type: 'date', default: todayISO },
      { id: 'campanha', label: 'Nome da Promoção/Campanha', placeholder: 'Ex: SUPER ODDS WEEK', type: 'text', uppercase: true },
      { id: 'casa', label: 'Casa de Apostas', placeholder: 'Ex: Betfair', type: 'text', uppercase: true },
      { id: 'evento1', label: 'Partida', placeholder: 'Ex: São Paulo x Santos', type: 'evento' },
      { id: 'lucroMin', label: 'Lucro Mínimo (ex: 3,25)', placeholder: '3,25', type: 'text' },
      { id: 'lucroMax', label: 'Lucro Máximo (ex: 3,75)', placeholder: '3,75 — ou vazio para valor único', type: 'text', hint: 'Deixe vazio para exibir valor único em vez de range.' },
      ...GIROS_SUBFIELDS,
      { id: 'categoria', label: 'Categoria', placeholder: '', type: 'select', default: () => 'Promoção' },
      ...PARTIDAS_OPCIONAIS,
    ],
    generate: (f) => [
      `🟢 PROCEDIMENTO ${f.isExtra === 'true' ? 'EXTRA ' : ''}${f.num || 'NNN'} - ${fmtDate(f.dataProc)}`,
      `🟢 PROCEDIMENTO REFERENTE À PROMOÇÃO ${(f.campanha || 'CAMPANHA').toUpperCase()} COM APOSTA GRÁTIS 🔥`,
      `CASA: 🏠 ${(f.casa || 'CASA').toUpperCase()}`,
      ``,
      `UTILIZAREMOS A PARTIDA ENTRE:`,
      ...buildPartidas(f),
      ``,
      `🔴 CASO HAJA ALTERAÇÃO NAS ODDS, UTILIZE A CALCULADORA 👆`,
      ``,
      `🟡 LUCRO: 💵 ${fmtRange(f.lucroMin, f.lucroMax, 'À')} 💵`,
      ...(f.incluirGiros === 'true' ? [fmtGiros(f)] : []),
      `📋 CATEGORIA: ${f.categoria || 'Promoção'}`,
      ...(f.incluirDG !== 'false' ? [`😍 chance de duplo green 😍`] : []),
    ].join('\n'),
  },
  {
    id: 'aposta_protegida',
    name: 'Aposta Protegida',
    shortName: 'Aposta Protegida',
    description: 'Promoção OU lucra cash OU ganha freebet (cenários excludentes). Opção 2 vai para observações.',
    color: 'bg-warning/15 text-warning border-warning/30',
    dotColor: 'bg-warning',
    emoji: '🟢',
    fields: [
      { id: 'isExtra', label: 'É EXTRA? (reenvio)', placeholder: '', type: 'toggle', default: () => 'false' },
      { id: 'incluirDG', label: 'Chance de Duplo Green', placeholder: '', type: 'toggle', default: () => 'true' },
      ...GIROS_TOGGLE,
      { id: 'num', label: 'Nº do Procedimento', placeholder: 'Ex: 138', type: 'text' },
      { id: 'dataProc', label: 'Data do Procedimento', placeholder: '', type: 'date', default: todayISO },
      { id: 'casa', label: 'Casa de Apostas', placeholder: 'Ex: Sportingbet', type: 'text', uppercase: true },
      { id: 'campanha', label: 'Nome da Campanha', placeholder: 'Ex: APOSTA PROTEGIDA', type: 'text', uppercase: true },
      { id: 'evento1', label: 'Partida', placeholder: 'Ex: Bahia x Cruzeiro', type: 'evento' },
      { id: 'lucro1', label: 'Opção 1 — Lucro cash se ganhar (ex: 2,00)', placeholder: '2,00', type: 'text' },
      { id: 'free1', label: 'Opção 1 — Freebet se ganhar fora (ex: 10,00)', placeholder: '10,00', type: 'text' },
      ...GIROS_SUBFIELDS,
      { id: 'categoria', label: 'Categoria', placeholder: '', type: 'select', default: () => 'Promoção' },
      { id: 'obs', label: 'Opção 2 (opcional) — vai para observações', placeholder: 'Ex: LUCRO DE 16,00 / FORA FREE DE 100,00', type: 'text', hint: 'Se houver uma segunda opção de valor, registre aqui. Fica salvo no campo Observações do procedimento.' },
      ...PARTIDAS_OPCIONAIS,
    ],
    generate: (f) => {
      const lines = [
        `🟢 PROCEDIMENTO ${f.isExtra === 'true' ? 'EXTRA ' : ''}${f.num || 'NNN'} - ${fmtDate(f.dataProc)}`,
        `🟢 PROCEDIMENTO REFERENTE A PROMOÇÃO DA ${(f.casa || 'CASA').toUpperCase()} - ${(f.campanha || 'CAMPANHA').toUpperCase()} COM APOSTA GRÁTIS 🔥`,
        `CASA: 🏠 ${(f.casa || 'CASA').toUpperCase()}`,
        ``,
        `UTILIZAREMOS A PARTIDA ENTRE:`,
        ...buildPartidas(f),
        ``,
        `🟥 Atenção: sempre confere data e horário da partida nos bilhetes também.`,
        `🔴 CASO HAJA ALTERAÇÃO NAS ODDS, UTILIZE A CALCULADORA`,
        ``,
        `🟡 LUCRO: 💵 ${fmtVal(f.lucro1)}`,
        `🟡 RECOMPENSA: 🎁 ${fmtVal(f.free1)} EM FREEBET`,
      ];
      if (f.incluirGiros === 'true') lines.push(fmtGiros(f));
      if (f.obs && f.obs.trim()) {
        lines.push(`📝 OBS: OPÇÃO 2 — ${f.obs.trim().toUpperCase()}`);
      }
      lines.push(`📋 CATEGORIA: ${f.categoria || 'Promoção'}`);
      if (f.incluirDG !== 'false') lines.push(`😍 chance de duplo green 😍`);
      return lines.join('\n');
    },
  },
  {
    id: 'superodd_bolsa',
    name: 'Superodd — Bolsa de Aposta',
    shortName: 'Bolsa',
    description: 'Super Odd via Bolsa de Aposta (Smarkets, Betfair Exchange etc). Lucro em range com "OU ANULA".',
    color: 'bg-muted border-border text-muted-foreground',
    dotColor: 'bg-muted-foreground',
    emoji: '🟢',
    fields: [
      { id: 'isExtra', label: 'É EXTRA? (reenvio)', placeholder: '', type: 'toggle', default: () => 'false' },
      { id: 'incluirDG', label: 'Chance de Duplo Green', placeholder: '', type: 'toggle', default: () => 'true' },
      ...GIROS_TOGGLE,
      { id: 'num', label: 'Nº do Procedimento', placeholder: 'Ex: 140', type: 'text' },
      { id: 'dataProc', label: 'Data do Procedimento', placeholder: '', type: 'date', default: todayISO },
      { id: 'valorTotal', label: 'Valor total a utilizar (ex: 100,00)', placeholder: '100,00', type: 'text' },
      { id: 'lucroMin', label: 'Lucro mínimo (ex: 8,00)', placeholder: '8,00', type: 'text' },
      { id: 'lucroMax', label: 'Lucro máximo (ex: 20,00)', placeholder: '20,00 — ou vazio para valor único', type: 'text', hint: 'Deixe vazio para valor único. "OU ANULA" é adicionado automaticamente.' },
      { id: 'evento1', label: 'Partida', placeholder: 'Ex: Corinthians x Vasco', type: 'evento' },
      ...GIROS_SUBFIELDS,
      { id: 'categoria', label: 'Categoria', placeholder: '', type: 'select', default: () => 'Superodd' },
      ...PARTIDAS_OPCIONAIS,
    ],
    generate: (f) => [
      `🟢 PROCEDIMENTO ${f.isExtra === 'true' ? 'EXTRA ' : ''}${f.num || 'NNN'} - ${fmtDate(f.dataProc)}`,
      ``,
      `🟢 PROCEDIMENTO REFERENTE A SUPER ODD DA BOLSA 🦈🔥`,
      ``,
      `🟢PLATAFORMAS`,
      ``,
      `( BOLSA DE APOSTA ) - UTILIZARÁ AO TODO ( 💵 ${fmtVal(f.valorTotal)} )`,
      ``,
      `UTILIZAREMOS O JOGO ENTRE:`,
      ...buildPartidas(f),
      ``,
      `🟥 Atenção : sempre confere data e horário da partida nos bilhetes também.`,
      `🟥 Atenção: Sempre confira se os links dos bilhetes são os mesmos da imagem .`,
      ``,
      `🟡 LUCRO : 💵 ${fmtRange(f.lucroMin, f.lucroMax, 'À')} OU ANULA 💵`,
      ...(f.incluirGiros === 'true' ? [fmtGiros(f)] : []),
      `📋 CATEGORIA: ${f.categoria || 'Superodd'}`,
      ...(f.incluirDG !== 'false' ? [`😍 chance de duplo green 😍`] : []),
    ].join('\n'),
  },
  {
    id: 'tentativa_dg',
    name: 'Tentativa Duplo Green',
    shortName: 'Tentativa DG',
    description: 'Procedimento cash sem freebet com objetivo de Duplo Green. Usa CASA: separado.',
    color: 'bg-muted border-border text-muted-foreground',
    dotColor: 'bg-muted-foreground',
    emoji: '🟡',
    fields: [
      { id: 'isExtra', label: 'É EXTRA? (reenvio)', placeholder: '', type: 'toggle', default: () => 'false' },
      { id: 'incluirDG', label: 'Chance de Duplo Green', placeholder: '', type: 'toggle', default: () => 'true' },
      ...GIROS_TOGGLE,
      { id: 'num', label: 'Nº do Procedimento', placeholder: 'Ex: 139', type: 'text' },
      { id: 'dataProc', label: 'Data do Procedimento', placeholder: '', type: 'date', default: todayISO },
      { id: 'casa', label: 'Casa de Apostas', placeholder: 'Ex: Betano', type: 'text', uppercase: true },
      { id: 'evento1', label: 'Partida', placeholder: 'Ex: Manchester City x Brentford', type: 'evento' },
      { id: 'valorDG', label: 'Objetivo Duplo Green (ex: 706,64)', placeholder: '706,64', type: 'text' },
      ...GIROS_SUBFIELDS,
      { id: 'categoria', label: 'Categoria', placeholder: '', type: 'select', default: () => 'Superodd' },
      ...PARTIDAS_OPCIONAIS,
    ],
    generate: (f) => [
      `🟢 PROCEDIMENTO ${f.isExtra === 'true' ? 'EXTRA ' : ''}${f.num || 'NNN'} - ${fmtDate(f.dataProc)}`,
      ``,
      `PROCEDIMENTO REFERENTE : TENTATIVA DUPLO GREEN`,
      ``,
      `CASA: ${(f.casa || 'CASA').toUpperCase()}`,
      ``,
      `UTILIZAREMOS O JOGO ENTRE:`,
      ...buildPartidas(f),
      ``,
      `🔴 CASO HAJA ALTERAÇÃO NAS ODDS, UTILIZE CALCULADORA 🎲`,
      ``,
      `🟡 OBJETIVO DUPLO GREEN - 🟩 ${fmtVal(f.valorDG)}`,
      ...(f.incluirGiros === 'true' ? [fmtGiros(f)] : []),
      `📋 CATEGORIA: ${f.categoria || 'Superodd'}`,
      ...(f.incluirDG !== 'false' ? [`😍 chance de duplo green 😍`] : []),
    ].join('\n'),
  },
];

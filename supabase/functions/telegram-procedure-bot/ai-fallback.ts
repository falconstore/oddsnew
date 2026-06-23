// Fallback de IA pro parser do bot Telegram.
//
// Quando o parser de regex (parser.ts) FALHA (no_number) ou volta PARCIAL,
// e a mensagem PARECE um procedimento, chamamos a IA (Claude Haiku — barato)
// pra extrair os campos do texto livre. A IA NÃO escreve regex e NÃO mexe em
// código: ela só resolve o caso atual e devolve os campos estruturados.
//
// O resultado sai no MESMO formato que o parser (ParsedProcedure), pra reusar
// todo o pipeline de insert/sync que já existe no index.ts.
//
// A chave da API vem do secret ANTHROPIC_API_KEY (nunca commitada).
// deno-lint-ignore-file
import { ParsedProcedure, ProcedureTipo } from "./parser.ts";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
// Haiku: barato e suficiente pra extração estruturada de texto curto.
const MODEL = "claude-haiku-4-5";

export interface AiFallbackResult {
  ok: boolean;
  data?: ParsedProcedure;
  reason?: string;       // explicação da IA sobre por que o formato fugiu do padrão
  model: string;
  tokensIn: number;
  tokensOut: number;
  error?: string;
}

/**
 * Detecta um AVISO/RESULTADO curto (não é procedimento a registrar).
 * Ex: "PROC. 120 — LUCRO: 1022,00 ✅", "PROC. 88 EXTRA — LUCRO: 77,00 + 20,00 FREEBET".
 * Padrão: poucas linhas, começa com PROC./PROCEDIMENTO + número, tem LUCRO/FREEBET,
 * e NÃO tem nenhum sinal operacional (partida "Time x Time", "CASA", data ÀS hora).
 * Filtro barato pra NÃO gastar IA nesses casos. Em dúvida, retorna false (deixa a IA decidir).
 */
function looksLikeAviso(text: string): boolean {
  const t = text.trim();
  // Avisos são curtos — procedimentos reais têm várias linhas de instrução.
  const lineCount = t.split(/\r?\n/).filter((l) => l.trim()).length;
  if (lineCount > 3) return false;
  // Precisa parecer um resumo de proc com lucro/freebet
  if (!/^\s*(?:🟢|🔵|🟡)?\s*PROC(?:EDIMENTO|\.)?\s+#?\d+/i.test(t)) return false;
  if (!/\b(LUCRO|FREEBET)\b/i.test(t)) return false;
  // Se tiver QUALQUER sinal operacional, NÃO é aviso (deixa seguir pro fluxo normal)
  const hasPartida = /\b\S+\s+x\s+\S+/i.test(t);          // "Time x Time"
  const hasCasa = /\bCASA\b/i.test(t);
  const hasHorario = /\b\d{1,2}:\d{2}\b/.test(t) || /\b[àa]s\b/i.test(t);
  return !hasPartida && !hasCasa && !hasHorario;
}

/**
 * Heurística barata (sem IA): a mensagem PARECE uma tentativa de procedimento?
 * Evita gastar IA com conversa solta do grupo ("bom dia") E com avisos de
 * resultado ("PROC. 120 — LUCRO: 1022,00 ✅").
 * Gatilho: começa com 🟢/🔵, OU contém "PROCEDIMENTO", OU tem número + (CASA ou LUCRO).
 * MAS: se for claramente um AVISO de resultado, retorna false (não aciona IA).
 */
export function looksLikeProcedure(text: string): boolean {
  const t = text.trim();
  // Avisos de resultado nunca acionam a IA — economiza chamadas.
  if (looksLikeAviso(t)) return false;
  if (/^\s*[🟢🔵]/u.test(t)) return true;
  if (/\bPROCEDIMENTO\b/i.test(t)) return true;
  const hasNumber = /\b\d{1,5}\b/.test(t);
  const hasCasaOrLucro = /\bCASA\b/i.test(t) || /\bLUCRO\b/i.test(t) || /\bFREEBET\b/i.test(t);
  return hasNumber && hasCasaOrLucro;
}

// Schema dos campos que a IA deve extrair. Espelha o ParsedProcedure, mas só os
// campos que dá pra inferir do texto. O resto (external_id, tags etc.) é derivado
// no código depois.
const TOOL_SCHEMA = {
  name: "extrair_procedimento",
  description:
    "Extrai os campos estruturados de uma mensagem de procedimento de apostas esportivas do grupo VIP.",
  input_schema: {
    type: "object",
    properties: {
      eh_procedimento: {
        type: "boolean",
        description:
          "true se a mensagem é de fato um procedimento de aposta. false se for conversa, aviso ou qualquer coisa que NÃO seja um procedimento a registrar.",
      },
      procedure_number: {
        type: "string",
        description: "Número do procedimento (só os dígitos, ex: '115').",
      },
      titulo: {
        type: "string",
        description:
          "Descrição curta/limpa do procedimento (ex: 'Promoção da Bet365', 'Superodd'). Sem emojis.",
      },
      date: {
        type: "string",
        description: "Data de referência do procedimento em formato YYYY-MM-DD.",
      },
      platform: {
        type: "string",
        description: "Casa de apostas (ex: 'Bet365', 'Betano', 'Sportingbet').",
      },
      category: {
        type: "string",
        enum: ["Superodd", "Extra", "Freebet", "Promoção"],
        description: "Categoria do procedimento.",
      },
      tipo: {
        type: "string",
        enum: ["SEM_FB", "GANHAR_FB", "QUEIMAR_FB", "ASR", "TENTATIVA_DG"],
        description:
          "Tipo: SEM_FB=lucro direto; GANHAR_FB=ganha freebet; QUEIMAR_FB=queima freebet de outro proc; ASR=aposta sem risco (lucro + recompensa em freebet); TENTATIVA_DG=tentativa duplo green.",
      },
      partida_descricao: {
        type: ["string", "null"],
        description: "Partida no formato 'Time A x Time B'. null se não houver.",
      },
      data_partida: {
        type: ["string", "null"],
        description: "Data da partida em YYYY-MM-DD. null se não houver.",
      },
      horario_partida: {
        type: ["string", "null"],
        description: "Horário da partida em HH:MM (24h, fuso de Brasília). null se não houver.",
      },
      lucro_prejuizo_previsto: {
        type: ["number", "null"],
        description:
          "Lucro previsto em reais (número, ex: 15.0). Se for 'OBJETIVO DUPLO GREEN' use 0. null se não aplicável.",
      },
      freebet_valor_previsto: {
        type: ["number", "null"],
        description: "Valor de freebet em reais (ex: 50.0). null se não aplicável.",
      },
      ref_procedure_number: {
        type: ["string", "null"],
        description:
          "Para QUEIMAR_FB: número do procedimento de referência cuja freebet será queimada. null caso contrário.",
      },
      is_duplo_green: {
        type: "boolean",
        description: "true se a mensagem menciona 'chance de duplo green' ou 'objetivo duplo green'.",
      },
      is_extra: {
        type: "boolean",
        description: "true se é um procedimento EXTRA / reenvio.",
      },
      observacoes: {
        type: ["string", "null"],
        description: "Observação/OBS extra, se houver. null caso contrário.",
      },
      motivo_fora_do_padrao: {
        type: "string",
        description:
          "Explique em 1 frase curta por que esta mensagem fugiu do formato padrão (ex: 'usou GANHO em vez de LUCRO:', 'sem emoji no início', 'casa na mesma linha do título'). Isso guia o ajuste futuro do regex.",
      },
    },
    required: ["eh_procedimento", "tipo", "category", "motivo_fora_do_padrao"],
  },
};

const SYSTEM_PROMPT =
  `Você extrai dados estruturados de mensagens de procedimentos de apostas esportivas de um grupo VIP brasileiro.\n` +
  `As mensagens seguem (na maioria das vezes) um template, mas às vezes são editadas manualmente e fogem do formato.\n` +
  `Sua tarefa: ler o texto livre e preencher os campos via a ferramenta extrair_procedimento.\n\n` +
  `MUITO IMPORTANTE — distinguir PROCEDIMENTO de AVISO/RESULTADO:\n` +
  `- Um PROCEDIMENTO de verdade é uma INSTRUÇÃO para apostar: traz detalhes operacionais como a PARTIDA (Time A x Time B), a CASA de apostas, e/ou DATA/HORÁRIO do jogo. É o que deve ser registrado.\n` +
  `- Um AVISO/RESULTADO é só um resumo curto de resultado já fechado, tipo "PROC. 120 — LUCRO: 1022,00 ✅" ou "PROC. 88 EXTRA — LUCRO: 77,00 + 20,00 FREEBET". Ele NÃO traz partida, NEM casa, NEM data — é só número + lucro. ISSO NÃO É UM PROCEDIMENTO A REGISTRAR.\n` +
  `- REGRA PRÁTICA: se a mensagem NÃO tem partida (Time x Time) E NÃO tem casa de apostas E NÃO tem data/horário de jogo — é um AVISO. Marque eh_procedimento=false.\n` +
  `- Conversa, dúvida, bom dia, etc. também → eh_procedimento=false.\n\n` +
  `Demais regras:\n` +
  `- Valores monetários em formato brasileiro (1.234,56) → converta pra número (1234.56).\n` +
  `- Datas → YYYY-MM-DD. Horários → HH:MM em 24h (fuso de Brasília).\n` +
  `- Não invente dados: se um campo não está no texto, use null. NUNCA preencha casa com '<UNKNOWN>' ou placeholder — use null.\n` +
  `- NÃO traduza nomes de times: mantenha exatamente como vieram (ex: 'Athletic Club' continua 'Athletic Club').`;

function toIso(date: string, time: string | null): string | null {
  if (!time) return null;
  try {
    return new Date(`${date}T${time}:00-03:00`).toISOString();
  } catch {
    return null;
  }
}

/**
 * Chama a IA pra extrair os campos do procedimento de um texto que o regex não
 * conseguiu. Retorna no formato ParsedProcedure (compatível com o pipeline).
 */
export async function aiExtractProcedure(
  apiKey: string,
  text: string,
  fallbackDate: string,
): Promise<AiFallbackResult> {
  const base: Omit<AiFallbackResult, "ok"> = {
    model: MODEL,
    tokensIn: 0,
    tokensOut: 0,
  };

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "tool", name: "extrair_procedimento" },
        messages: [{ role: "user", content: text }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { ...base, ok: false, error: `anthropic ${res.status}: ${errText.slice(0, 300)}` };
    }

    const body = await res.json();
    const tokensIn = body?.usage?.input_tokens ?? 0;
    const tokensOut = body?.usage?.output_tokens ?? 0;

    // Extrai o tool_use block
    const toolUse = (body?.content ?? []).find((c: any) => c.type === "tool_use");
    if (!toolUse?.input) {
      return { ...base, ok: false, tokensIn, tokensOut, error: "sem tool_use na resposta" };
    }

    const ai = toolUse.input;
    const reason: string = ai.motivo_fora_do_padrao ?? "";

    // Não é procedimento → não cria nada
    if (ai.eh_procedimento === false) {
      return { ...base, ok: false, tokensIn, tokensOut, reason, error: "ia_classificou_nao_procedimento" };
    }

    // Sem número não dá pra criar registro útil
    const procedureNumber: string | null = ai.procedure_number ? String(ai.procedure_number).replace(/\D/g, "") : null;
    if (!procedureNumber) {
      return { ...base, ok: false, tokensIn, tokensOut, reason, error: "ia_sem_numero" };
    }

    const date: string = /^\d{4}-\d{2}-\d{2}$/.test(ai.date) ? ai.date : fallbackDate;
    const dataPartida: string | null =
      ai.data_partida && /^\d{4}-\d{2}-\d{2}$/.test(ai.data_partida) ? ai.data_partida : null;
    const horario: string | null =
      ai.horario_partida && /^\d{1,2}:\d{2}$/.test(ai.horario_partida) ? ai.horario_partida : null;

    // ── Defesa anti-aviso (camada 2) ──
    // Um AVISO de resultado ("PROC. 120 — LUCRO: 1022,00 ✅") não tem partida,
    // nem casa, nem data/horário de jogo — é só número + lucro. Se a IA marcou
    // como procedimento mas TODOS esses sinais estão ausentes, é falso-positivo:
    // tratamos como aviso e NÃO criamos registro. (Placeholders de casa como
    // "<UNKNOWN>"/"-" contam como ausência.)
    const platformRaw = (ai.platform ?? "").toString().trim();
    const hasPlatform = platformRaw.length > 0 &&
      !/^(-+|—|<?unknown>?|n\/?a|null|desconhecid[oa])$/i.test(platformRaw);
    const hasPartida = !!(ai.partida_descricao && /\sx\s/i.test(String(ai.partida_descricao)));
    const hasDataJogo = !!dataPartida || !!horario;
    if (!hasPartida && !hasPlatform && !hasDataJogo) {
      return {
        ...base,
        ok: false,
        tokensIn,
        tokensOut,
        reason: reason || "mensagem sem partida, casa ou data — tratada como aviso/resultado, não procedimento",
        error: "descartado_como_aviso",
      };
    }
    const isExtra = !!ai.is_extra;
    const tipo: ProcedureTipo = ai.tipo ?? "SEM_FB";
    const isDG = !!ai.is_duplo_green;

    const parsed: ParsedProcedure = {
      procedure_number: procedureNumber,
      external_id: `bsk:${procedureNumber}${isExtra ? "-extra" : ""}-${date.replace(/-/g, "")}`,
      titulo: (ai.titulo ?? "").toString().slice(0, 200),
      date,
      platform: (ai.platform ?? "—").toString(),
      category: ai.category ?? "Promoção",
      tipo,
      prioridade: isDG ? "ALTA" : "MEDIA",
      partida_descricao: ai.partida_descricao ?? null,
      kickoff_at: dataPartida ? toIso(dataPartida, horario) : null,
      data_partida: dataPartida,
      horario_partida: horario,
      lucro_prejuizo_previsto:
        typeof ai.lucro_prejuizo_previsto === "number" ? ai.lucro_prejuizo_previsto : null,
      freebet_valor_previsto:
        typeof ai.freebet_valor_previsto === "number" ? ai.freebet_valor_previsto : null,
      ref_procedure_number: ai.ref_procedure_number ? String(ai.ref_procedure_number).replace(/\D/g, "") : null,
      is_duplo_green: false, // confirmação de DG é sempre manual no painel
      is_extra: isExtra,
      dp: false,
      tags: isDG ? ["Chance DG"] : [],
      observacoes: ai.observacoes ?? null,
    };

    return { ...base, ok: true, data: parsed, reason, tokensIn, tokensOut };
  } catch (e: any) {
    return { ...base, ok: false, error: `exceção: ${e?.message ?? String(e)}` };
  }
}

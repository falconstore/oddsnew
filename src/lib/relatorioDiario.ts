import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Procedure } from '@/types/procedures';

export interface RelatorioLine {
  procedure: Procedure;
  valor: number;
  rotulo: string;
}

export interface RelatorioDiario {
  date: Date;
  superOdd: RelatorioLine[];
  lucroFreebets: RelatorioLine[];
  duploGreen: RelatorioLine[];
  totalDia: number;
  totalProcedures: number;
}

const isDuploGreen = (p: Procedure) => p.duplo_green_confirmado === true;

function lucroEfetivo(p: Procedure): number {
  if (isDuploGreen(p) && p.duplo_green_lucro != null) return Number(p.duplo_green_lucro);
  if (p.resultado_lucro != null && Number(p.resultado_lucro) !== 0) return Number(p.resultado_lucro);
  return Number(p.profit_loss ?? 0);
}

function lucroComFreebet(p: Procedure): number {
  if (p.resultado_lucro != null && Number(p.resultado_lucro) !== 0) return Number(p.resultado_lucro);
  return Number(p.freebet_value ?? p.freebet_valor_previsto ?? 0);
}

export function buildRelatorioDiario(
  procedures: Procedure[],
  targetDate: Date = new Date()
): RelatorioDiario {
  const dayKey = format(targetDate, 'yyyy-MM-dd');
  const dayProcs = procedures.filter(
    (p) => !p.archived && p.date === dayKey
  );

  const superOdd: RelatorioLine[] = dayProcs
    .filter((p) => !isDuploGreen(p) && p.tipo !== 'QUEIMAR_FB' && lucroEfetivo(p) > 0)
    .map((p) => ({ procedure: p, valor: lucroEfetivo(p), rotulo: p.platform || '' }));

  const lucroFreebets: RelatorioLine[] = dayProcs
    .filter((p) => p.tipo === 'QUEIMAR_FB' && !isDuploGreen(p))
    .map((p) => ({ procedure: p, valor: lucroComFreebet(p), rotulo: p.platform || '' }));

  const duploGreen: RelatorioLine[] = dayProcs
    .filter(isDuploGreen)
    .map((p) => ({
      procedure: p,
      valor: lucroEfetivo(p),
      rotulo: p.partida_descricao || p.promotion_name || '',
    }));

  const sumLines = (lines: RelatorioLine[]) =>
    lines.reduce((s, l) => s + (Number.isFinite(l.valor) ? l.valor : 0), 0);

  const totalDia = sumLines(superOdd) + sumLines(lucroFreebets) + sumLines(duploGreen);

  return {
    date: targetDate,
    superOdd,
    lucroFreebets,
    duploGreen,
    totalDia,
    totalProcedures: superOdd.length + lucroFreebets.length + duploGreen.length,
  };
}

const fmtMoney = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatRelatorioText(
  data: RelatorioDiario,
  freebetsPendentes: string
): string {
  const dataStr = format(data.date, 'dd/MM/yyyy', { locale: ptBR });
  const lines: string[] = [];

  lines.push(`💵📊 Relatório Diário de Lucros ( ${dataStr} )`);
  lines.push('');

  lines.push('💵 SUPER ODD / LUCRO DIRETO :');
  if (data.superOdd.length === 0) {
    lines.push('—');
  } else {
    for (const l of data.superOdd) {
      lines.push(`${fmtMoney(l.valor)} ${l.rotulo}`.trim());
    }
  }
  lines.push('');

  lines.push('🩶 LUCROS COM FREEBETS :');
  if (data.lucroFreebets.length === 0) {
    lines.push('—');
  } else {
    for (const l of data.lucroFreebets) {
      lines.push(`${fmtMoney(l.valor)} ${l.rotulo}`.trim());
    }
  }
  lines.push('');

  lines.push('🎯 DUPLO GREEN :');
  if (data.duploGreen.length === 0) {
    lines.push('—');
  } else {
    for (const l of data.duploGreen) {
      const evento = l.rotulo ? ` ( ${l.rotulo} )` : '';
      lines.push(`${fmtMoney(l.valor)}${evento}`);
    }
  }
  lines.push('');

  lines.push('⏳ FREEBETS PENDENTES DE CONVERSÃO :');
  lines.push(freebetsPendentes.trim() || '—');
  lines.push('');

  lines.push(`📅 LUCRO TOTAL DO DIA = R$ ${fmtMoney(data.totalDia)}`);

  return lines.join('\n');
}

import { Procedure } from '@/types/procedures';

// Combina data_partida (YYYY-MM-DD) + horario_partida (HH:MM:SS|HH:MM) num Date.
export function parseKickoff(proc: Pick<Procedure, 'data_partida' | 'horario_partida'>): Date | null {
  if (!proc.data_partida) return null;
  const time = proc.horario_partida || '00:00:00';
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  const dt = new Date(`${proc.data_partida}T${normalizedTime}`);
  return isNaN(dt.getTime()) ? null : dt;
}

export type GameTimeBucket = 'live' | 'upcoming' | 'ended' | 'none';

export function getGameTimeBucket(
  proc: Pick<Procedure, 'data_partida' | 'horario_partida'>,
  now: Date = new Date(),
): GameTimeBucket {
  const kickoff = parseKickoff(proc);
  if (!kickoff) return 'none';
  const diffMin = (now.getTime() - kickoff.getTime()) / 60000;
  if (diffMin < 0) return 'upcoming';
  if (diffMin <= 150) return 'live';   // janela de 0..150min = "ao vivo"
  return 'ended';
}

// Botão "Conferir" aparece após kickoff + 150min (regra do FreeBet Pro §8.4) E
// também em procedimentos sem partida agendada (legado ou casos sem horário) — a
// FreeBet Pro pediu que o modal "Definir Resultados" possa ser usado em qualquer
// procedimento, não só nos com kickoff conhecido.
export function canCheckResult(
  proc: Pick<Procedure, 'data_partida' | 'horario_partida'>,
  now: Date = new Date(),
): boolean {
  const bucket = getGameTimeBucket(proc, now);
  return bucket === 'ended' || bucket === 'none';
}

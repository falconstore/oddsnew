import { Procedure } from '@/types/procedures';

// Combina data_partida (YYYY-MM-DD) + horario_partida (HH:MM:SS|HH:MM) num Date.
// Prefere `kickoff_at` (ISO timezone-aware, paridade FULL com FreeBet PRO) quando
// disponível — ele é a fonte de verdade quando o procedimento foi vinculado ao
// fixture da API-Football.
export function parseKickoff(
  proc: Pick<Procedure, 'data_partida' | 'horario_partida'> & { kickoff_at?: string | null },
): Date | null {
  if (proc.kickoff_at) {
    const dt = new Date(proc.kickoff_at);
    if (!isNaN(dt.getTime())) return dt;
  }
  if (!proc.data_partida) return null;
  const time = proc.horario_partida || '00:00:00';
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  const dt = new Date(`${proc.data_partida}T${normalizedTime}`);
  return isNaN(dt.getTime()) ? null : dt;
}

export type GameTimeBucket = 'live' | 'upcoming' | 'ended' | 'none';

// Janela "ao vivo" — usada pelo filtro de bucket, pelo KickoffBadge e
// pelo cron `auto_update_procedure_statuses` no banco. 150min cobre os
// ~115min de uma partida de futebol + acréscimos com folga.
export const LIVE_WINDOW_MIN = 150;

export function getGameTimeBucket(
  proc: Pick<Procedure, 'data_partida' | 'horario_partida'> & { kickoff_at?: string | null },
  now: Date = new Date(),
): GameTimeBucket {
  const kickoff = parseKickoff(proc);
  if (!kickoff) return 'none';
  const diffMin = (now.getTime() - kickoff.getTime()) / 60000;
  if (diffMin < 0) return 'upcoming';
  if (diffMin <= LIVE_WINDOW_MIN) return 'live';   // janela de 0..150min = "ao vivo"
  return 'ended';
}

// Botão "Conferir" aparece após kickoff + 150min (regra do FreeBet Pro §8.4) E
// também em procedimentos sem partida agendada (legado ou casos sem horário) — a
// FreeBet Pro pediu que o modal "Definir Resultados" possa ser usado em qualquer
// procedimento, não só nos com kickoff conhecido.
export function canCheckResult(
  proc: Pick<Procedure, 'data_partida' | 'horario_partida'> & { kickoff_at?: string | null },
  now: Date = new Date(),
): boolean {
  const bucket = getGameTimeBucket(proc, now);
  return bucket === 'ended' || bucket === 'none';
}

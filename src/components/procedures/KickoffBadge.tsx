// Badge AO VIVO/ENCERRADO baseado em kickoff (paridade FULL FreeBet PRO doc 02 §badges).
// Janela LIVE = [kickoff, kickoff+150min] — mesma janela usada por
// `getGameTimeBucket` (filtros, canCheckResult, FilaConferencia) e pelo
// cron `auto_update_procedure_statuses` no banco. Manter aqui igual evita
// que um procedimento apareça AO VIVO no badge mas ENCERRADO em todo o
// resto do sistema (ex.: pós-jogo entre 150-240min). 150min cobre os ~115min
// de uma partida de futebol + acréscimos com folga.
// Não mostra nada se status == Concluído/Lucro Direto.
import { Radio, CheckCircle2 } from 'lucide-react';
import { Procedure } from '@/types/procedures';
import { parseKickoff, LIVE_WINDOW_MIN } from '@/lib/procedureGameTime';

interface Props {
  procedure: Pick<Procedure, 'data_partida' | 'horario_partida' | 'status'> & { kickoff_at?: string | null };
  now?: Date;
  variant?: 'inline' | 'pill';
}

export function KickoffBadge({ procedure, now = new Date(), variant = 'pill' }: Props) {
  const concluido = procedure.status === 'Concluído' || procedure.status === 'Lucro Direto';
  if (concluido) return null;
  const kickoff = parseKickoff(procedure);
  if (!kickoff) return null;
  const diffMin = (now.getTime() - kickoff.getTime()) / 60000;
  if (diffMin < 0) return null; // upcoming → sem badge
  const isLive = diffMin <= LIVE_WINDOW_MIN;
  const base = variant === 'inline'
    ? 'inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider'
    : 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border';
  if (isLive) {
    return (
      <span
        data-testid={`badge-live-${procedure.status}`}
        className={`${base} ${variant === 'pill' ? 'bg-red-500/15 text-red-400 border-red-500/30' : 'text-red-400'}`}
      >
        <Radio className="w-2.5 h-2.5 animate-pulse" /> Ao Vivo
      </span>
    );
  }
  return (
    <span
      data-testid={`badge-ended-${procedure.status}`}
      className={`${base} ${variant === 'pill' ? 'bg-slate-500/15 text-slate-400 border-slate-500/30' : 'text-slate-400'}`}
    >
      <CheckCircle2 className="w-2.5 h-2.5" /> Encerrado
    </span>
  );
}

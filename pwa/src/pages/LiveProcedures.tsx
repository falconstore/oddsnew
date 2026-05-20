import { useNavigate, NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { differenceInMinutes, isFuture, parseISO, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronRight, Clock, Zap, Star, TrendingUp, User } from 'lucide-react'
import { useProceduresToday } from '@/hooks/useProcedures'
import { Procedure } from '@/lib/supabase'

function isLiveProc(p: Procedure) {
  if (!p.kickoff_at || p.tachado || p.archived) return false
  const k = parseISO(p.kickoff_at)
  return !isFuture(k) && differenceInMinutes(new Date(), k) < 240
}

function minutesLive(kickoff: string) {
  return differenceInMinutes(new Date(), parseISO(kickoff))
}

function tipoIcon(tipo: string | null) {
  if (tipo === 'GANHAR_FB' || tipo === 'QUEIMAR_FB') return <Zap size={13} />
  if (tipo?.includes('DG') || tipo === 'TENTATIVA_DG') return <Star size={13} />
  return <TrendingUp size={13} />
}

function statusColor(status: string | null) {
  switch (status) {
    case 'Concluído': case 'Lucro Direto':           return 'hsl(145 80% 48%)'
    case 'Enviado': case 'Enviada Partida em Aberto':
    case 'Aguardando Resultado':                      return '#facc15'
    case 'Falta Girar Freebet': case 'Freebet Pendente': return '#fb923c'
    default:                                          return 'rgba(255,255,255,0.4)'
  }
}

function LiveCard({ p, onClick }: { p: Procedure; onClick: () => void }) {
  const mins = minutesLive(p.kickoff_at!)
  const elapsed = mins < 90 ? `${mins}'` : `+${mins - 90}'`
  const sc = statusColor(p.status)

  return (
    <motion.button onClick={onClick}
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="w-full text-left p-4 rounded-2xl flex items-center gap-3 active:scale-[0.98] transition-transform"
      style={{
        background: 'rgba(239,68,68,0.06)',
        border: '1px solid rgba(239,68,68,0.2)',
      }}>

      {/* Live time badge */}
      <div className="flex flex-col items-center justify-center flex-shrink-0"
        style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
        <span className="text-[10px] font-black" style={{ color: '#ef4444' }}>{elapsed}</span>
        <span className="text-[8px] font-semibold" style={{ color: 'rgba(239,68,68,0.7)' }}>AO VIVO</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {/* Pulsing live dot */}
          <span className="flex items-center gap-1.5 text-[10px] font-bold"
            style={{ color: '#ef4444' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            AO VIVO
          </span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: `${sc}1a`, color: sc }}>
            {p.status}
          </span>
        </div>
        <p className="text-sm font-semibold text-white leading-snug"
           style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {p.promotion_name || p.platform || `#${p.procedure_number}`}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span style={{ color: sc }}>{tipoIcon(p.tipo)}</span>
          {p.platform && <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.38)' }}>{p.platform}</span>}
          {p.kickoff_at && (
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
              · {format(parseISO(p.kickoff_at), 'HH:mm')}
            </span>
          )}
          {Number(p.profit_loss ?? 0) !== 0 && (
            <span className="text-[11px] font-semibold font-mono"
                  style={{ color: 'rgba(255,255,255,0.38)' }}>
              · pot. R${Math.abs(Number(p.profit_loss)).toFixed(0)}
            </span>
          )}
        </div>
      </div>

      <ChevronRight size={15} style={{ color: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
    </motion.button>
  )
}

export function LiveProcedures() {
  const navigate = useNavigate()
  const { data: procs = [], isLoading } = useProceduresToday()
  const live = procs.filter(isLiveProc)

  return (
    <div className="page-content no-scrollbar px-4">

      {/* Header */}
      <div className="pt-2 mb-5 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span className="w-2 h-2 rounded-full bg-red-500 -ml-4" />
            <h1 className="text-xl font-bold text-white">Jogos Ao Vivo</h1>
            {live.length > 0 && (
              <div className="flex items-center justify-center px-2.5 py-1 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <span className="text-sm font-black" style={{ color: '#ef4444' }}>{live.length}</span>
              </div>
            )}
          </div>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Procedimentos com partida em andamento
          </p>
        </div>
        <NavLink to="/perfil"
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <User size={18} style={{ color: 'rgba(255,255,255,0.7)' }} />
        </NavLink>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }} />
          ))}
        </div>
      ) : live.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <Clock size={28} style={{ color: 'rgba(239,68,68,0.5)' }} />
          </div>
          <div className="text-center">
            <p className="font-semibold text-white mb-1">Nenhum jogo ao vivo</p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Procedimentos ativos aparecerão aqui quando as partidas começarem
            </p>
          </div>
        </div>
      ) : (
        <AnimatePresence>
          <div className="flex flex-col gap-2.5">
            {live.map(p => (
              <LiveCard key={p.id} p={p} onClick={() => navigate(`/procedimentos/${p.id}`)} />
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* Info footer */}
      <div className="mt-6 px-3 py-3 rounded-xl flex items-start gap-2"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <Clock size={13} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0, marginTop: 1 }} />
        <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Janela ao vivo: da hora do kickoff até 4h após o início da partida
        </p>
      </div>
    </div>
  )
}

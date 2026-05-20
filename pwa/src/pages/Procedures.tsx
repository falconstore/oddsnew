import { useState } from 'react'
import { useNavigate, NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Clock, TrendingUp, Zap, Star, ChevronRight, User, CheckCircle2, Circle } from 'lucide-react'
import { format, parseISO, differenceInMinutes, isFuture } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useProceduresList } from '@/hooks/useProcedures'
import { useProcedureChecks, useToggleProcedureCheck } from '@/hooks/useProcedureChecks'
import { useAuth } from '@/hooks/useAuth'
import { Procedure } from '@/lib/supabase'

type Filter = 'all' | 'active' | 'done'

const FILTER_LABELS: { key: Filter; label: string }[] = [
  { key: 'all',    label: 'Todos' },
  { key: 'active', label: 'Ativos' },
  { key: 'done',   label: 'Concluídos' },
]

function statusMeta(status: string | null) {
  switch (status) {
    case 'Concluído':
    case 'Lucro Direto':         return { color: 'hsl(145 80% 48%)', bg: 'rgba(30,222,107,0.12)' }
    case 'Enviado':
    case 'Enviada Partida em Aberto':
    case 'Aguardando Resultado': return { color: '#facc15', bg: 'rgba(250,204,21,0.12)' }
    case 'Falta Girar Freebet':
    case 'Freebet Pendente':     return { color: '#fb923c', bg: 'rgba(251,146,60,0.12)' }
    default:                     return { color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.06)' }
  }
}

function tipoIcon(tipo: string | null) {
  if (tipo === 'GANHAR_FB' || tipo === 'QUEIMAR_FB') return <Zap size={11} />
  if (tipo?.includes('DG') || tipo === 'TENTATIVA_DG') return <Star size={11} />
  return <TrendingUp size={11} />
}

function tipoLabel(tipo: string | null) {
  switch (tipo) {
    case 'SUPER_ODD':   return 'SUPER ODD'
    case 'GANHAR_FB':   return 'GANHAR FB'
    case 'QUEIMAR_FB':  return 'QUEIMAR FB'
    case 'ASR':         return 'ASR'
    case 'SEM_FB':      return 'SEM FB'
    case 'TENTATIVA_DG':return 'TENTATIVA DG'
    default:            return tipo ?? null
  }
}

function tipoColor(tipo: string | null): { color: string; bg: string } {
  switch (tipo) {
    case 'GANHAR_FB':  return { color: '#fb923c', bg: 'rgba(251,146,60,0.15)' }
    case 'QUEIMAR_FB': return { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' }
    case 'SUPER_ODD':  return { color: '#38bdf8', bg: 'rgba(56,189,248,0.15)' }
    case 'ASR':        return { color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' }
    case 'TENTATIVA_DG': return { color: '#c084fc', bg: 'rgba(192,132,252,0.15)' }
    default:           return { color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.08)' }
  }
}

function lucroEfetivo(p: Procedure) {
  return Number(p.duplo_green_lucro ?? p.resultado_lucro ?? p.profit_loss ?? 0)
}

function FreebetSubcard({ tipo, value }: { tipo: string; value: number }) {
  const isGanhar = tipo === 'GANHAR_FB'
  return (
    <div className="flex flex-col items-center justify-center flex-shrink-0 px-2 py-1.5 rounded-xl"
         style={{
           minWidth: 52,
           background: isGanhar ? 'rgba(30,222,107,0.18)' : 'rgba(245,158,11,0.18)',
           border: `1px solid ${isGanhar ? 'rgba(30,222,107,0.35)' : 'rgba(245,158,11,0.35)'}`,
         }}>
      <span className="text-[9px] font-bold uppercase tracking-wide"
            style={{ color: isGanhar ? 'hsl(145 80% 60%)' : '#f59e0b' }}>
        Freebet
      </span>
      <span className="text-[13px] font-black font-mono text-white leading-tight">
        {value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  )
}

function ProcedureCard({
  p, onClick, isChecked, onToggleCheck,
}: { p: Procedure; onClick: () => void; isChecked: boolean; onToggleCheck: (e: React.MouseEvent) => void }) {
  const sm = statusMeta(p.status)
  const lucro = lucroEfetivo(p)
  const kickoff = p.kickoff_at ? parseISO(p.kickoff_at) : null
  const isLive = kickoff && !isFuture(kickoff) && differenceInMinutes(new Date(), kickoff) < 240
  const hasLucro = p.status === 'Concluído' || p.status === 'Lucro Direto'
  const hasFb = (p.tipo === 'GANHAR_FB' || p.tipo === 'QUEIMAR_FB') && Number(p.freebet_value ?? 0) > 0

  return (
    <button onClick={onClick}
      className="glass px-4 pt-3 pb-4 text-left w-full active:scale-[0.98] transition-transform"
      style={{ opacity: p.tachado ? 0.4 : 1 }}>

      {/* Header row: #ID + status + live */}
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-[11px] font-black font-mono px-2 py-0.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.55)' }}>
          #{p.procedure_number}
        </span>
        <span className="text-xs font-semibold" style={{ color: sm.color }}>
          {p.status}
        </span>
        {isLive && (
          <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />AO VIVO
          </span>
        )}
      </div>

      {/* Main row: icon + content + right */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
             style={{ background: sm.bg }}>
          <span style={{ color: sm.color }}>{tipoIcon(p.tipo)}</span>
        </div>

        <div className="flex-1 min-w-0">
          {/* Title */}
          <p className="text-sm font-medium text-white leading-snug"
             style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {p.promotion_name || p.platform || `Operação #${p.procedure_number}`}
          </p>

          {/* Tag row: tipo · DG */}
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {p.tipo && (() => { const tc = tipoColor(p.tipo); return (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                    style={{ background: tc.bg, color: tc.color }}>
                {tipoLabel(p.tipo)}
              </span>
            )})()}
            {p.duplo_green_confirmado && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5"
                    style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>
                <Star size={9} />2x GREEN
              </span>
            )}
          </div>

          {/* Platform / date / kickoff */}
          <p className="text-[11px] mt-1 truncate" style={{ color: 'rgba(255,255,255,0.28)' }}>
            {p.platform && <span>{p.platform} · </span>}
            {format(parseISO(p.date), 'dd/MM', { locale: ptBR })}
            {kickoff && <span> · {format(kickoff, 'HH:mm')}</span>}
          </p>
        </div>

        {/* Right: freebet subcard OR lucro/pot/chevron */}
        {hasFb ? (
          <FreebetSubcard tipo={p.tipo!} value={Number(p.freebet_value)} />
        ) : (
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {hasLucro ? (
              <span className="text-sm font-bold font-mono"
                    style={{ color: lucro >= 0 ? 'hsl(145 80% 48%)' : '#f87171' }}>
                {lucro >= 0 ? '+' : ''}R${lucro.toFixed(0)}
              </span>
            ) : Number(p.profit_loss ?? 0) !== 0 ? (
              <span className="text-xs font-semibold font-mono"
                    style={{ color: 'rgba(255,255,255,0.35)' }}>
                pot. R${Math.abs(Number(p.profit_loss)).toFixed(0)}
              </span>
            ) : null}
            <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.25)' }} />
          </div>
        )}
      </div>

      {/* Check row — "Realizei esta operação" */}
      <div className="flex items-center justify-between mt-3 pt-2.5"
           style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Realizei esta operação?
        </span>
        <button
          onClick={onToggleCheck}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg active:scale-95 transition-all"
          style={{
            background: isChecked ? 'rgba(30,222,107,0.15)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${isChecked ? 'rgba(30,222,107,0.4)' : 'rgba(255,255,255,0.1)'}`,
          }}>
          {isChecked
            ? <CheckCircle2 size={14} style={{ color: 'hsl(145 80% 52%)' }} />
            : <Circle size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />}
          <span className="text-[11px] font-semibold"
                style={{ color: isChecked ? 'hsl(145 80% 52%)' : 'rgba(255,255,255,0.35)' }}>
            {isChecked ? 'Sim!' : 'Marcar'}
          </span>
        </button>
      </div>
    </button>
  )
}

export function Procedures() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const { data: procedures = [], isLoading } = useProceduresList(filter)
  const { user } = useAuth()
  const { data: checks = new Set<string>() } = useProcedureChecks(user?.email ?? null)
  const toggleCheck = useToggleProcedureCheck(user?.email ?? null)

  const filtered = procedures.filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      p.promotion_name?.toLowerCase().includes(q) ||
      p.platform?.toLowerCase().includes(q) ||
      p.status?.toLowerCase().includes(q) ||
      String(p.procedure_number).includes(q)
    )
  })

  return (
    <div className="page-content no-scrollbar px-4">
      <div className="flex items-start justify-between pt-2 mb-4">
        <div>
          <h1 className="text-xl font-bold text-white mb-1">Procedimentos</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Todos os procedimentos em tempo real
          </p>
        </div>
        <NavLink to="/perfil"
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <User size={18} style={{ color: 'rgba(255,255,255,0.7)' }} />
        </NavLink>
      </div>

      {/* Search */}
      <div className="glass flex items-center gap-3 px-4 py-3 mb-4">
        <Search size={16} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Buscar procedimento..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-sm text-white outline-none placeholder-white/30"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {FILTER_LABELS.map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 flex-1"
            style={{
              background: filter === key ? 'rgba(30,222,107,0.15)' : 'rgba(255,255,255,0.05)',
              color: filter === key ? 'hsl(145 80% 48%)' : 'rgba(255,255,255,0.45)',
              border: filter === key ? '1px solid rgba(30,222,107,0.3)' : '1px solid transparent',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="glass p-4 h-20 animate-pulse rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-2xl mb-2">📋</p>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {search ? 'Nenhum resultado encontrado' : 'Nenhum procedimento aqui'}
          </p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="flex flex-col gap-2">
            {filtered.map((p, idx) => (
              <motion.div key={p.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03, duration: 0.2 }}>
                <ProcedureCard p={p}
                  onClick={() => navigate(`/procedimentos/${p.id}`)}
                  isChecked={checks.has(p.id)}
                  onToggleCheck={e => { e.stopPropagation(); toggleCheck.mutate({ procedureId: p.id, checked: !checks.has(p.id) }) }}
                />
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  )
}

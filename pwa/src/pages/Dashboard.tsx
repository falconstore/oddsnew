import { useState } from 'react'
import { format, parseISO, differenceInMinutes, isFuture, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, Zap, BarChart2, Clock, ChevronRight, Users, X, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useProceduresToday } from '@/hooks/useProcedures'
import { useTodayStats, useLast30DaysStats } from '@/hooks/useStats'
import { Procedure } from '@/lib/supabase'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

// Persiste numCpfs no localStorage
function useCpfCount() {
  const [count, setCount] = useState<number>(() => {
    const saved = localStorage.getItem('pwa_num_cpfs')
    return saved ? Number(saved) : 1
  })
  function update(n: number) {
    const v = Math.max(1, Math.min(500, n))
    setCount(v)
    localStorage.setItem('pwa_num_cpfs', String(v))
  }
  return [count, update] as const
}

function statusColor(status: string | null) {
  switch (status) {
    case 'Concluído':
    case 'Lucro Direto':       return 'hsl(145 80% 48%)'
    case 'Enviado':
    case 'Enviada Partida em Aberto':
    case 'Aguardando Resultado': return '#facc15'
    case 'Falta Girar Freebet':
    case 'Freebet Pendente':   return '#fb923c'
    default:                   return 'rgba(255,255,255,0.4)'
  }
}

function ActiveCard({ p, onClick }: { p: Procedure; onClick: () => void }) {
  const kickoff = p.kickoff_at ? parseISO(p.kickoff_at) : null
  const isLive = kickoff && !isFuture(kickoff) && differenceInMinutes(new Date(), kickoff) < 240
  const upcoming = kickoff && isFuture(kickoff)

  return (
    <button onClick={onClick}
      className="glass p-4 text-left w-full flex items-start justify-between gap-3 active:scale-[0.98] transition-transform">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="pill text-xs"
                style={{ background: `${statusColor(p.status)}20`, color: statusColor(p.status), border: `1px solid ${statusColor(p.status)}40` }}>
            {p.status}
          </span>
          {isLive && (
            <span className="pill" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block mr-1" />AO VIVO
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-white truncate">
          {p.promotion_name || p.platform || `#${p.procedure_number}`}
        </p>
        {p.platform && <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{p.platform}</p>}
        {kickoff && (
          <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
            <Clock size={10} />
            {upcoming
              ? `Kickoff em ${formatDistanceToNow(kickoff, { locale: ptBR })}`
              : isLive ? 'Em andamento' : 'Encerrado'}
          </p>
        )}
      </div>
      <ChevronRight size={16} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
    </button>
  )
}

function CalendarHeatmap({ stats }: { stats: { date: string; lucro: number }[] }) {
  const max = Math.max(...stats.map(s => Math.abs(s.lucro)), 1)
  return (
    <div className="flex gap-1 flex-wrap">
      {stats.map(s => {
        const ratio = Math.abs(s.lucro) / max
        const color = s.lucro === 0
          ? 'rgba(255,255,255,0.06)'
          : s.lucro > 0
            ? `rgba(30,222,107,${0.1 + ratio * 0.7})`
            : `rgba(248,113,113,${0.1 + ratio * 0.7})`
        return (
          <div key={s.date} title={`${format(parseISO(s.date), 'dd/MM')}: R$${s.lucro.toFixed(0)}`}
               className="w-7 h-7 rounded-md flex-shrink-0"
               style={{ background: color, border: '1px solid rgba(255,255,255,0.06)' }} />
        )
      })}
    </div>
  )
}

// Modal para selecionar número de CPFs
function CpfModal({ current, onConfirm, onClose }: { current: number; onConfirm: (n: number) => void; onClose: () => void }) {
  const [val, setVal] = useState(String(current))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const n = parseInt(val, 10)
    if (!isNaN(n) && n >= 1) { onConfirm(n); onClose() }
  }

  const presets = [1, 2, 5, 10, 20, 50]

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div className="relative w-full max-w-sm mx-auto rounded-t-3xl p-6 pb-8"
        style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)' }}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}>

        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-white text-base">Quantos CPFs você tem?</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.08)' }}>
            <X size={14} style={{ color: 'rgba(255,255,255,0.6)' }} />
          </button>
        </div>

        <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
          O lucro por CPF é calculado multiplicando o lucro bruto do dia pelo número de CPFs operados.
        </p>

        {/* Presets */}
        <div className="flex flex-wrap gap-2 mb-4">
          {presets.map(n => (
            <button key={n} onClick={() => setVal(String(n))}
              className="px-3 py-1.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: val === String(n) ? 'rgba(30,222,107,0.2)' : 'rgba(255,255,255,0.06)',
                color: val === String(n) ? 'hsl(145 80% 48%)' : 'rgba(255,255,255,0.5)',
                border: val === String(n) ? '1px solid rgba(30,222,107,0.4)' : '1px solid transparent',
              }}>
              {n}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="glass flex-1 flex items-center px-4 py-3">
            <input
              type="number"
              min={1}
              max={500}
              value={val}
              onChange={e => setVal(e.target.value)}
              className="w-full bg-transparent text-white text-sm outline-none"
              placeholder="Outro número..."
            />
          </div>
          <button type="submit"
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'hsl(145 80% 48%)' }}>
            <Check size={16} style={{ color: '#0b1120' }} />
          </button>
        </form>
      </motion.div>
    </motion.div>
  )
}

export function Dashboard() {
  const { lead } = useAuth()
  const navigate = useNavigate()
  const { data: stats } = useTodayStats()
  const { data: allStats = [] } = useLast30DaysStats()
  const { data: procedures = [] } = useProceduresToday()
  const [numCpfs, setNumCpfs] = useCpfCount()
  const [showCpfModal, setShowCpfModal] = useState(false)

  const activeProcs = procedures.filter(p =>
    !p.tachado && ['Enviado','Enviada Partida em Aberto','Aguardando Resultado','Falta Girar Freebet','Freebet Pendente'].includes(p.status ?? '')
  )

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Bom dia'
    if (h < 18) return 'Boa tarde'
    return 'Boa noite'
  })()

  const firstName = lead?.name?.split(' ')[0] ?? 'Trader'
  const lucroBruto = stats?.lucroBruto ?? 0
  const lucroPorCpf = lucroBruto * numCpfs

  return (
    <div className="page-content no-scrollbar px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pt-2">
        <div>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
          <h1 className="text-xl font-bold text-white mt-0.5">{greeting}, {firstName} 👋</h1>
        </div>
        <img src="/logo.png" alt="Shark" className="w-10 h-10 rounded-xl" />
      </div>

      {/* KPI grid — 2×2 + linha CPF */}
      <div className="grid grid-cols-2 gap-3 mb-5">

        {/* Operações */}
        <div className="glass p-4 flex flex-col gap-1.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(103,232,249,0.12)' }}>
            <BarChart2 size={15} style={{ color: '#67e8f9' }} />
          </div>
          <p className="text-xl font-bold text-white leading-none mt-0.5">{stats?.totalOperacoes ?? 0}</p>
          <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Operações hoje</p>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <span className="text-[10px]" style={{ color: 'rgba(30,222,107,0.8)' }}>
              ✓ {stats?.operacoesEncerradas ?? 0} enc.
            </span>
            <span className="text-[10px]" style={{ color: '#facc15' }}>
              ◷ {stats?.operacoesAbertas ?? 0} ab.
            </span>
          </div>
        </div>

        {/* Freebets */}
        <div className="glass p-4 flex flex-col gap-1.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(167,139,250,0.12)' }}>
            <Zap size={15} style={{ color: '#a78bfa' }} />
          </div>
          <p className="text-xl font-bold text-white leading-none mt-0.5">{stats?.totalFreebets ?? 0}</p>
          <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Freebets</p>
          {(stats?.totalFreebetsValor ?? 0) > 0 && (
            <span className="text-[10px] font-semibold" style={{ color: '#c4b5fd' }}>
              R${(stats?.totalFreebetsValor ?? 0).toFixed(2)} em FB
            </span>
          )}
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {stats?.totalSemFb ?? 0} sem freebet
          </span>
        </div>

        {/* Lucro Bruto */}
        <div className="glass p-4 flex flex-col gap-1.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
               style={{ background: lucroBruto >= 0 ? 'rgba(30,222,107,0.12)' : 'rgba(248,113,113,0.12)' }}>
            <TrendingUp size={15} style={{ color: lucroBruto >= 0 ? 'hsl(145 80% 48%)' : '#f87171' }} />
          </div>
          <p className="text-xl font-bold leading-none mt-0.5"
             style={{ color: lucroBruto >= 0 ? 'hsl(145 80% 48%)' : '#f87171' }}>
            {lucroBruto >= 0 ? '+' : ''}R${lucroBruto.toFixed(2)}
          </p>
          <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Lucro bruto</p>
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>resultado real do dia</span>
        </div>

        {/* Lucro por CPF — toca para editar */}
        <button onClick={() => setShowCpfModal(true)}
          className="glass p-4 flex flex-col gap-1.5 text-left active:scale-[0.97] transition-transform">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(251,146,60,0.12)' }}>
            <Users size={15} style={{ color: '#fb923c' }} />
          </div>
          <p className="text-xl font-bold leading-none mt-0.5"
             style={{ color: lucroPorCpf >= 0 ? '#fb923c' : '#f87171' }}>
            {lucroPorCpf >= 0 ? '+' : ''}R${lucroPorCpf.toFixed(2)}
          </p>
          <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Por CPF</p>
          <span className="text-[10px] flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
            <Users size={9} /> {numCpfs} CPF{numCpfs !== 1 ? 's' : ''} · toque p/ alterar
          </span>
        </button>
      </div>

      {/* Active procedures */}
      {activeProcs.length > 0 && (
        <section className="mb-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Ativos agora · {activeProcs.length}
          </h2>
          <div className="flex flex-col gap-2">
            {activeProcs.slice(0, 5).map(p => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <ActiveCard p={p} onClick={() => navigate(`/sinais/${p.id}`)} />
              </motion.div>
            ))}
          </div>
          {activeProcs.length > 5 && (
            <button onClick={() => navigate('/sinais')}
              className="w-full mt-2 py-3 text-sm font-medium rounded-xl text-center transition-all active:scale-95"
              style={{ background: 'rgba(30,222,107,0.08)', color: 'hsl(145 80% 48%)', border: '1px solid rgba(30,222,107,0.2)' }}>
              Ver todos os {activeProcs.length} ativos
            </button>
          )}
        </section>
      )}

      {/* Evolution chart */}
      {allStats.length > 0 && (
        <section className="mb-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Evolução — 30 dias
          </h2>
          <div className="glass p-3">
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={allStats} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(145 80% 48%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(145 80% 48%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'rgba(11,17,32,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                  labelFormatter={(v: string) => format(parseISO(v), 'dd/MM', { locale: ptBR })}
                  formatter={(v: number) => [`R$${Number(v).toFixed(2)}`, 'Lucro']}
                />
                <Area type="monotone" dataKey="lucro" stroke="hsl(145 80% 48%)" strokeWidth={2} fill="url(#greenGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Calendar heatmap */}
      {allStats.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Calendário
          </h2>
          <div className="glass p-4">
            <CalendarHeatmap stats={allStats} />
            <div className="flex items-center gap-3 mt-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(30,222,107,0.6)' }} />
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Lucro</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(248,113,113,0.6)' }} />
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Prejuízo</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Modal CPF */}
      <AnimatePresence>
        {showCpfModal && (
          <CpfModal
            current={numCpfs}
            onConfirm={setNumCpfs}
            onClose={() => setShowCpfModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

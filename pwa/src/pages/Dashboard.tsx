import { useState, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, Zap, BarChart2, Users, Minus, Plus, User } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { usePeriodStats, useLast90DaysStats, PERIODS, PeriodKey, DayPoint } from '@/hooks/useStats'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, TooltipProps,
} from 'recharts'

// ─── CPF count (localStorage) ───────────────────────────────────────────────
function useCpfCount() {
  const [count, setCount] = useState<number>(() => {
    const s = localStorage.getItem('pwa_num_cpfs')
    return s ? Number(s) : 1
  })
  function update(n: number) {
    const v = Math.max(1, Math.min(999, n))
    setCount(v)
    localStorage.setItem('pwa_num_cpfs', String(v))
  }
  return [count, update] as const
}

// ─── helpers ────────────────────────────────────────────────────────────────
function fmtR(v: number) {
  return `${v >= 0 ? '+' : ''}R$${Math.abs(v).toFixed(2)}`
}

// ─── Period selector ─────────────────────────────────────────────────────────
function PeriodSelector({ active, onChange }: { active: PeriodKey; onChange: (p: PeriodKey) => void }) {
  return (
    <div className="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar pb-0.5">
      {PERIODS.map(({ key, label }) => (
        <button key={key} onClick={() => onChange(key)}
          className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
          style={{
            background: active === key ? 'rgba(30,222,107,0.18)' : 'rgba(255,255,255,0.06)',
            color:      active === key ? 'hsl(145 80% 48%)'       : 'rgba(255,255,255,0.45)',
            border:     active === key ? '1px solid rgba(30,222,107,0.35)' : '1px solid transparent',
          }}>
          {label}
        </button>
      ))}
    </div>
  )
}

// ─── Custom chart tooltip ────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const val = payload[0].value ?? 0
  const pos = val >= 0
  return (
    <div className="px-3 py-2 rounded-xl text-xs" style={{
      background: 'rgba(11,17,32,0.97)',
      border: `1px solid ${pos ? 'rgba(30,222,107,0.3)' : 'rgba(248,113,113,0.3)'}`,
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      pointerEvents: 'none',
    }}>
      <p className="font-semibold text-white mb-0.5">
        {label ? format(parseISO(label), "dd 'de' MMM", { locale: ptBR }) : ''}
      </p>
      <p className="font-bold" style={{ color: pos ? 'hsl(145 80% 55%)' : '#f87171' }}>
        {fmtR(val)}
      </p>
    </div>
  )
}

// ─── Evolution chart ─────────────────────────────────────────────────────────
function EvolutionChart({ data }: { data: DayPoint[] }) {
  const hasData = data.some(d => d.lucro !== 0)
  if (!hasData) return (
    <div className="glass p-4 flex items-center justify-center h-36 mb-4"
      style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>Sem dados no período</p>
    </div>
  )

  const allPos = data.every(d => d.lucro >= 0)
  const allNeg = data.every(d => d.lucro <= 0)

  return (
    <div className="glass p-3 mb-4" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
      <ResponsiveContainer width="100%" height={150}>
        <AreaChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="gradPos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(145 80% 48%)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="hsl(145 80% 48%)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gradNeg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f87171" stopOpacity={0.05} />
              <stop offset="100%" stopColor="#f87171" stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.25)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `R$${v}`}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: 'rgba(255,255,255,0.12)', strokeWidth: 1, strokeDasharray: '4 4' }}
          />
          <Area
            type="monotone"
            dataKey="lucro"
            stroke={allNeg ? '#f87171' : 'hsl(145 80% 48%)'}
            strokeWidth={2}
            fill={allNeg ? 'url(#gradNeg)' : 'url(#gradPos)'}
            dot={false}
            activeDot={{
              r: 5,
              fill: allNeg ? '#f87171' : 'hsl(145 80% 48%)',
              stroke: '#0b1120',
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Calendar heatmap ─────────────────────────────────────────────────────────
function CalendarHeatmap({ data }: { data: DayPoint[] }) {
  const [selected, setSelected] = useState<DayPoint | null>(null)
  const last30 = data.slice(-30)
  const max = Math.max(...last30.map(s => Math.abs(s.lucro)), 1)

  function cellLabel(lucro: number) {
    if (lucro === 0) return ''
    const abs = Math.abs(lucro)
    const sign = lucro > 0 ? '+' : '-'
    if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}k`
    if (abs >= 100)  return `${sign}${Math.round(abs)}`
    return `${sign}${abs.toFixed(0)}`
  }

  return (
    <div className="glass p-4 mb-5" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="grid gap-1 mb-3" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {last30.map(s => {
          const ratio   = Math.abs(s.lucro) / max
          const pos     = s.lucro >= 0
          const isEmpty = s.lucro === 0
          const isSel   = selected?.date === s.date
          const bg      = isEmpty
            ? 'rgba(255,255,255,0.05)'
            : pos ? `rgba(30,222,107,${0.12 + ratio * 0.7})` : `rgba(248,113,113,${0.12 + ratio * 0.7})`
          const label = cellLabel(s.lucro)
          return (
            <button key={s.date}
              onClick={() => setSelected(isSel ? null : s)}
              className="rounded-lg flex flex-col items-center justify-center transition-transform active:scale-90"
              style={{
                aspectRatio: '1 / 1.1',
                background: bg,
                border: isSel
                  ? `2px solid ${pos ? 'hsl(145 80% 55%)' : '#f87171'}`
                  : '1px solid rgba(255,255,255,0.06)',
              }}>
              {label ? (
                <span className="font-bold leading-none"
                  style={{
                    fontSize: label.length > 4 ? 9 : 11,
                    color: 'rgba(255,255,255,0.92)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                  {label}
                </span>
              ) : (
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)' }}>·</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected day detail */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between py-2.5 px-3 rounded-xl mb-3"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <p className="text-xs font-semibold text-white">
                  {format(parseISO(selected.date), "EEEE, dd 'de' MMM", { locale: ptBR })}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {selected.total} operaç{selected.total !== 1 ? 'ões' : 'ão'}
                </p>
              </div>
              <span className="text-base font-black"
                style={{ color: selected.lucro >= 0 ? 'hsl(145 80% 55%)' : '#f87171', fontVariantNumeric: 'tabular-nums' }}>
                {fmtR(selected.lucro)}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(30,222,107,0.6)' }} />
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Lucro</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(248,113,113,0.6)' }} />
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Prejuízo</span>
        </div>
        <span className="text-[10px] ml-auto" style={{ color: 'rgba(255,255,255,0.25)' }}>
          toque para ver detalhes
        </span>
      </div>
    </div>
  )
}

// ─── CPF Calculator ───────────────────────────────────────────────────────────
function CpfCalculator({ lucroBruto, period }: { lucroBruto: number; period: PeriodKey }) {
  const [numCpfs, setNumCpfs] = useCpfCount()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const resultado = lucroBruto * numCpfs
  const positivo  = resultado >= 0

  const periodLabel = PERIODS.find(p => p.key === period)?.label ?? 'Hoje'

  function startEdit() {
    setDraft(String(numCpfs))
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 30)
  }
  function commitEdit() {
    const n = parseInt(draft, 10)
    if (!isNaN(n) && n >= 1) setNumCpfs(n)
    setEditing(false)
  }

  return (
    <div className="glass p-4 mb-4"
      style={{ border: '1px solid rgba(251,146,60,0.2)', background: 'rgba(251,146,60,0.03)' }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(251,146,60,0.15)' }}>
          <Users size={12} style={{ color: '#fb923c' }} />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#fb923c' }}>
          Calculadora por CPF
        </span>
      </div>

      {/* Result */}
      <motion.p key={resultado}
        initial={{ scale: 0.95, opacity: 0.5 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="text-3xl font-black leading-none mb-1"
        style={{ color: positivo ? 'hsl(145 80% 55%)' : '#f87171', fontVariantNumeric: 'tabular-nums' }}>
        {positivo ? '+' : ''}R${resultado.toFixed(2)}
      </motion.p>
      <p className="text-[11px] mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
        Esse seria o resultado de <span className="font-semibold text-white">{periodLabel}</span> com{' '}
        <span className="font-semibold text-white">{numCpfs} CPF{numCpfs !== 1 ? 's' : ''}</span> escolhidos
      </p>

      {/* Formula row */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex flex-col items-center flex-shrink-0">
          <span className="text-xs font-bold font-mono" style={{ color: lucroBruto >= 0 ? 'hsl(145 80% 48%)' : '#f87171', fontVariantNumeric: 'tabular-nums' }}>
            {fmtR(lucroBruto)}
          </span>
          <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.28)' }}>{periodLabel}</span>
        </div>

        <span className="text-base font-light flex-shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>×</span>

        {/* Stepper */}
        <div className="flex items-center flex-1 rounded-[12px] overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <button onClick={() => setNumCpfs(numCpfs - 1)}
            className="flex items-center justify-center active:bg-white/10 transition-colors flex-shrink-0"
            style={{ width: 38, height: 42 }}>
            <Minus size={13} style={{ color: 'rgba(255,255,255,0.5)' }} />
          </button>
          <div className="flex-1 flex flex-col items-center justify-center" style={{ height: 42 }}>
            {editing ? (
              <input ref={inputRef} type="number" min={1} max={999} value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit() }}
                className="w-full text-center bg-transparent text-white font-bold text-sm outline-none"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              />
            ) : (
              <button onClick={startEdit} className="flex flex-col items-center">
                <span className="font-bold text-white text-sm leading-none" style={{ fontVariantNumeric: 'tabular-nums' }}>{numCpfs}</span>
                <span className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.28)' }}>CPFs</span>
              </button>
            )}
          </div>
          <button onClick={() => setNumCpfs(numCpfs + 1)}
            className="flex items-center justify-center active:bg-white/10 transition-colors flex-shrink-0"
            style={{ width: 38, height: 42 }}>
            <Plus size={13} style={{ color: 'rgba(255,255,255,0.5)' }} />
          </button>
        </div>

        <span className="text-base font-light flex-shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>=</span>

        <div className="flex flex-col items-end flex-shrink-0">
          <motion.span key={resultado}
            initial={{ y: -3, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="text-sm font-black font-mono whitespace-nowrap"
            style={{ color: positivo ? 'hsl(145 80% 55%)' : '#f87171', fontVariantNumeric: 'tabular-nums' }}>
            {positivo ? '+' : ''}R${resultado.toFixed(2)}
          </motion.span>
          <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.28)' }}>total</span>
        </div>
      </div>

      {/* Presets */}
      <div className="flex gap-1.5">
        {[1,2,5,10,20,50].map(n => (
          <button key={n} onClick={() => setNumCpfs(n)}
            className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95"
            style={{
              background: numCpfs === n ? 'rgba(251,146,60,0.22)' : 'rgba(255,255,255,0.05)',
              color:      numCpfs === n ? '#fb923c'                 : 'rgba(255,255,255,0.35)',
              border:     numCpfs === n ? '1px solid rgba(251,146,60,0.4)' : '1px solid transparent',
            }}>
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function Dashboard() {
  const { lead }    = useAuth()
  const [period, setPeriod] = useState<PeriodKey>('today')

  const { data: stats }        = usePeriodStats(period)
  const { data: allStats = [] } = useLast90DaysStats()
  const h = new Date().getHours()
  const greeting = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  const lucroBruto = stats?.lucroBruto ?? 0

  // Hype titles — rotate by day of week so it changes every dia sem precisar do nome real
  const HYPE_TITLES = ['Jogador', 'Trader', 'Craque', 'Guerreiro', 'Vencedor', 'Monstro', 'Caro']
  const HYPE_MOTTOS = [
    'Hoje é dia de green! 🟢',
    'Partiu procedimento! 🎯',
    'Semana de lucro! 💰',
    'Bora operar forte! 🦈',
    'Hoje tem resultado! ⚡',
    'Final de semana de green! 🏆',
    'Domingo de lucro! 🟢',
  ]
  const dow = new Date().getDay() // 0 = domingo
  const firstName = lead?.name?.split(' ')[0] ?? HYPE_TITLES[dow % HYPE_TITLES.length]
  const motto = HYPE_MOTTOS[dow]

  // Slice chart data to match selected period
  const chartDays = period === '90d' ? 90 : period === '30d' ? 30 : 7
  const chartData = allStats.slice(-chartDays)
  const chartLabel = period === '90d' ? '90 dias' : period === '30d' ? '30 dias' : period === '7d' ? '7 dias' : period === 'yesterday' ? 'últimos 7 dias' : 'últimos 7 dias'

  return (
    <div className="page-content no-scrollbar px-4">

      {/* Header */}
      <div className="flex items-center justify-between mb-5 pt-2">
        <div>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
          <h1 className="text-xl font-bold text-white mt-0.5">{greeting}, {firstName}! 👋</h1>
          <p className="text-xs font-semibold mt-0.5" style={{ color: 'hsl(145 80% 52%)' }}>{motto}</p>
        </div>
        <NavLink to="/perfil"
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <User size={18} style={{ color: 'rgba(255,255,255,0.7)' }} />
        </NavLink>
      </div>

      {/* Period selector */}
      <PeriodSelector active={period} onChange={setPeriod} />

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">

        {/* Operações */}
        <div className="glass px-3 py-3 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <BarChart2 size={12} style={{ color: '#67e8f9' }} />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.38)' }}>Operações</span>
          </div>
          <p className="text-2xl font-black text-white leading-none">{stats?.totalOperacoes ?? 0}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px]" style={{ color: 'rgba(30,222,107,0.85)' }}>✓ {stats?.operacoesEncerradas ?? 0}</span>
            <span className="text-[10px]" style={{ color: '#facc15' }}>◷ {stats?.operacoesAbertas ?? 0}</span>
          </div>
          {(stats?.potencialFreebet ?? 0) > 0 && (
            <span className="text-[10px] font-semibold mt-1 px-1.5 py-0.5 rounded-md w-fit"
              style={{ background: 'rgba(250,204,21,0.1)', color: '#facc15' }}>
              ⚡ R${stats!.potencialFreebet.toFixed(0)} potencial
            </span>
          )}
        </div>

        {/* Freebets */}
        <div className="glass px-3 py-3 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Zap size={12} style={{ color: '#a78bfa' }} />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.38)' }}>Freebets</span>
          </div>
          <p className="text-2xl font-black text-white leading-none">{stats?.totalFreebets ?? 0}</p>
          {(stats?.totalFreebetsValor ?? 0) > 0 ? (
            <span className="text-[10px] font-semibold mt-0.5" style={{ color: '#c4b5fd' }}>
              R${(stats?.totalFreebetsValor ?? 0).toFixed(2)} em FB
            </span>
          ) : <span className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>}
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
            {stats?.totalSemFb ?? 0} sem freebet
          </span>
        </div>

        {/* Lucro bruto — full width */}
        <div className="col-span-2 glass px-3 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: lucroBruto >= 0 ? 'rgba(30,222,107,0.12)' : 'rgba(248,113,113,0.12)' }}>
            <TrendingUp size={15} style={{ color: lucroBruto >= 0 ? 'hsl(145 80% 48%)' : '#f87171' }} />
          </div>
          <div>
            <p className="text-xl font-black leading-none"
              style={{ color: lucroBruto >= 0 ? 'hsl(145 80% 48%)' : '#f87171', fontVariantNumeric: 'tabular-nums' }}>
              {fmtR(lucroBruto)}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.32)' }}>
              Lucro bruto · {PERIODS.find(p => p.key === period)?.label}
            </p>
          </div>
        </div>
      </div>

      {/* Calculator */}
      <CpfCalculator lucroBruto={lucroBruto} period={period} />

      {/* Chart */}
      {allStats.length > 0 && (
        <section className="mb-1">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
            Evolução — {chartLabel}
          </h2>
          <EvolutionChart data={chartData} />
        </section>
      )}

      {/* Calendar */}
      {allStats.length > 0 && (
        <section className="mb-1">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
            Calendário — últimos 30 dias
          </h2>
          <CalendarHeatmap data={allStats} />
        </section>
      )}

    </div>
  )
}

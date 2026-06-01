import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { motion } from 'framer-motion'
import { Star, TrendingUp, BarChart2, User } from 'lucide-react'
import { NavLink as RNavLink } from 'react-router-dom'
import { supabase, Procedure } from '@/lib/supabase'

// ─── Data hook ───────────────────────────────────────────────────────────────
function useDuploGreenProcedures() {
  return useQuery<Procedure[]>({
    queryKey: ['procedures', 'duplo-green'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('procedures')
        .select('*')
        .eq('duplo_green_confirmado', true)
        .eq('archived', false)
        .order('date', { ascending: false })
        .order('procedure_number', { ascending: false })
      if (error) throw error
      return (data ?? []) as Procedure[]
    },
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function lucroEfetivo(p: Procedure): number {
  if (p.duplo_green_confirmado && p.duplo_green_lucro != null) return Number(p.duplo_green_lucro)
  if (p.resultado_lucro != null && p.resultado_lucro !== 0) return Number(p.resultado_lucro)
  if (p.profit_loss != null && p.profit_loss !== 0) return Number(p.profit_loss)
  return Number(p.lucro_prejuizo_previsto ?? 0)
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string; icon: any; color: string
}) {
  return (
    <div className="glass px-3 py-3 flex flex-col gap-1"
         style={{ border: '1px solid rgba(167,139,250,0.15)' }}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon size={11} style={{ color }} />
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.38)' }}>
          {label}
        </span>
      </div>
      <p className="text-2xl font-black leading-none" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{sub}</p>}
    </div>
  )
}

// ─── DG Card ────────────────────────────────────────────────────────────────
function DgCard({ p, idx }: { p: Procedure; idx: number }) {
  const lucro = lucroEfetivo(p)
  const pos = lucro >= 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.04, duration: 0.22 }}
      className="glass px-4 pt-3.5 pb-3"
      style={{ border: '1px solid rgba(167,139,250,0.2)', background: 'rgba(167,139,250,0.04)' }}>

      {/* Header row */}
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-[11px] font-black font-mono px-2 py-0.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.55)' }}>
          #{p.procedure_number}
        </span>
        <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md"
              style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>
          <Star size={9} fill="#a78bfa" />2× GREEN
        </span>
        {p.status && (
          <span className="text-[10px] ml-auto" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {p.status}
          </span>
        )}
      </div>

      {/* Main row */}
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
             style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.25)' }}>
          <Star size={18} style={{ color: '#a78bfa' }} fill="rgba(167,139,250,0.4)" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-snug"
             style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {p.promotion_name || p.platform || `Operação #${p.procedure_number}`}
          </p>
          <p className="text-[11px] mt-1 truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {p.platform && <span>{p.platform} · </span>}
            {format(parseISO(p.date), "dd/MM/yyyy", { locale: ptBR })}
          </p>
        </div>

        {/* Lucro */}
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          <span className="text-base font-black font-mono"
                style={{ color: pos ? 'hsl(145 80% 52%)' : '#f87171', fontVariantNumeric: 'tabular-nums' }}>
            {pos ? '+' : ''}R${Math.abs(lucro).toFixed(0)}
          </span>
          {p.duplo_green_lucro !== null && (
            <span className="text-[9px]" style={{ color: 'rgba(167,139,250,0.7)' }}>lucro DG</span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────
export function DuploGreen() {
  const { data: procs = [], isLoading } = useDuploGreenProcedures()

  const total = procs.length
  const lucroTotal = procs.reduce((sum, p) => sum + lucroEfetivo(p), 0)
  const media = total > 0 ? lucroTotal / total : 0

  return (
    <div className="page-content no-scrollbar px-4">

      {/* Header */}
      <div className="flex items-center justify-between pt-2 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Star size={18} style={{ color: '#a78bfa' }} fill="rgba(167,139,250,0.5)" />
            <h1 className="text-xl font-bold text-white">Duplo Green</h1>
          </div>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Todos os 2× Green confirmados
          </p>
        </div>
        <RNavLink to="/perfil"
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <User size={18} style={{ color: 'rgba(255,255,255,0.7)' }} />
        </RNavLink>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <KpiCard label="Total DG" value={String(total)} icon={Star} color="#a78bfa" />
        <KpiCard
          label="Lucro total"
          value={`${lucroTotal >= 0 ? '+' : ''}R$${Math.abs(lucroTotal).toFixed(0)}`}
          icon={TrendingUp}
          color={lucroTotal >= 0 ? 'hsl(145 80% 52%)' : '#f87171'}
        />
        <KpiCard
          label="Média/DG"
          value={`${media >= 0 ? '+' : ''}R$${Math.abs(media).toFixed(0)}`}
          icon={BarChart2}
          color="#67e8f9"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-24 rounded-2xl animate-pulse"
                 style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.1)' }} />
          ))}
        </div>
      ) : procs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
               style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)' }}>
            <Star size={28} style={{ color: 'rgba(167,139,250,0.5)' }} />
          </div>
          <div>
            <p className="font-semibold text-white mb-1">Nenhum Duplo Green ainda</p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Os 2× Green confirmados aparecem aqui
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {procs.map((p, idx) => (
            <DgCard key={p.id} p={p} idx={idx} />
          ))}
        </div>
      )}

      <div className="pb-4" />
    </div>
  )
}

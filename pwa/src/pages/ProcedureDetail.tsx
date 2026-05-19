import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Clock, TrendingUp, Zap, Star, ExternalLink } from 'lucide-react'
import { format, parseISO, differenceInMinutes, isFuture } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useProcedureById } from '@/hooks/useProcedures'

function Row({ label, value, accent }: { label: string; value: string | null; accent?: string }) {
  if (!value) return null
  return (
    <div className="flex items-center justify-between py-3"
         style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color: accent ?? '#fff' }}>{value}</span>
    </div>
  )
}

export function ProcedureDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: p, isLoading } = useProcedureById(id ?? '')

  if (isLoading) {
    return (
      <div className="page-content no-scrollbar px-4">
        <div className="flex items-center gap-3 pt-2 mb-6">
          <button onClick={() => navigate(-1)} className="w-10 h-10 glass rounded-xl flex items-center justify-center active:scale-95">
            <ArrowLeft size={18} style={{ color: 'rgba(255,255,255,0.7)' }} />
          </button>
        </div>
        <div className="glass p-6 animate-pulse h-64 rounded-2xl" />
      </div>
    )
  }

  if (!p) {
    return (
      <div className="page-content no-scrollbar px-4 flex items-center justify-center">
        <p style={{ color: 'rgba(255,255,255,0.4)' }}>Procedimento não encontrado</p>
      </div>
    )
  }

  const kickoff = p.kickoff_at ? parseISO(p.kickoff_at) : null
  const isLive = kickoff && !isFuture(kickoff) && differenceInMinutes(new Date(), kickoff) < 240
  const lucro = Number(p.duplo_green_lucro ?? p.resultado_lucro ?? p.profit_loss ?? 0)
  const hasResult = p.status === 'Concluído' || p.status === 'Lucro Direto'

  const statusColor = (() => {
    switch (p.status) {
      case 'Concluído':
      case 'Lucro Direto': return 'hsl(145 80% 48%)'
      case 'Enviado':
      case 'Enviada Partida em Aberto':
      case 'Aguardando Resultado': return '#facc15'
      case 'Falta Girar Freebet':
      case 'Freebet Pendente': return '#fb923c'
      default: return 'rgba(255,255,255,0.5)'
    }
  })()

  return (
    <div className="page-content no-scrollbar px-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2 mb-5">
        <button onClick={() => navigate(-1)}
          className="w-10 h-10 glass rounded-xl flex items-center justify-center active:scale-95 flex-shrink-0">
          <ArrowLeft size={18} style={{ color: 'rgba(255,255,255,0.7)' }} />
        </button>
        <div className="min-w-0">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Operação #{p.procedure_number}</p>
          <h1 className="text-base font-bold text-white truncate">
            {p.promotion_name || p.platform || `Operação #${p.procedure_number}`}
          </h1>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>

        {/* Status badge */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <span className="pill text-sm"
                style={{ background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}40` }}>
            {p.status}
          </span>
          {isLive && (
            <span className="pill" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> AO VIVO
            </span>
          )}
          {p.duplo_green_confirmado && (
            <span className="pill" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' }}>
              <Star size={10} /> DUPLO GREEN
            </span>
          )}
        </div>

        {/* Result highlight */}
        {hasResult && (
          <div className="glass p-5 text-center mb-5 glow-green">
            <p className="text-xs font-medium uppercase tracking-widest mb-1"
               style={{ color: 'rgba(255,255,255,0.45)' }}>Resultado</p>
            <p className="text-4xl font-bold font-mono"
               style={{ color: lucro >= 0 ? 'hsl(145 80% 48%)' : '#f87171' }}>
              {lucro >= 0 ? '+' : ''}R${lucro.toFixed(2)}
            </p>
          </div>
        )}

        {/* Details card */}
        <div className="glass px-4 py-1 mb-5">
          <Row label="Casa / Plataforma" value={p.platform} />
          <Row label="Promoção" value={p.promotion_name} />
          <Row label="Tipo" value={p.tipo} />
          <Row label="Esporte" value={p.esporte} />
          <Row label="Data" value={format(parseISO(p.date), "dd/MM/yyyy", { locale: ptBR })} />
          {kickoff && (
            <Row label="Kickoff" value={format(kickoff, "dd/MM/yyyy · HH:mm", { locale: ptBR })} />
          )}
          {p.freebet_value && p.freebet_value > 0 && (
            <Row label="Valor Freebet" value={`R$${Number(p.freebet_value).toFixed(2)}`} accent="#facc15" />
          )}
          {p.freebet_creditada && p.tipo === 'GANHAR_FB' && (
            <Row label="FB Creditada"
              value={p.freebet_creditada === 'SIM' ? '✅ Creditada' : p.freebet_creditada === 'AGUARDANDO' ? '⏳ Aguardando' : '❌ Não'}
              accent={p.freebet_creditada === 'SIM' ? 'hsl(145 80% 48%)' : p.freebet_creditada === 'AGUARDANDO' ? '#facc15' : '#f87171'}
            />
          )}
          {p.duplo_green_lucro && p.duplo_green_lucro > 0 && (
            <Row label="Lucro DG" value={`R$${Number(p.duplo_green_lucro).toFixed(2)}`} accent="#a78bfa" />
          )}
        </div>

      </motion.div>
    </div>
  )
}

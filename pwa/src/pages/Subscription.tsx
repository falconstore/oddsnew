import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CreditCard, Crown, Calendar, CheckCircle, XCircle, Clock, ChevronLeft, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────
type LastlinkEvent = {
  id: number
  received_at: string
  event_type: string | null
  order_id: string | null
  payload: Record<string, any> | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  active:    { label: 'Ativa',          color: 'hsl(145 80% 52%)', bg: 'rgba(30,222,107,0.1)',  icon: CheckCircle },
  pending:   { label: 'Pendente',       color: '#facc15',           bg: 'rgba(250,204,21,0.1)', icon: Clock },
  canceled:  { label: 'Cancelada',      color: '#f87171',           bg: 'rgba(248,113,113,0.1)', icon: XCircle },
  expired:   { label: 'Expirada',       color: '#f87171',           bg: 'rgba(248,113,113,0.1)', icon: XCircle },
  refunded:  { label: 'Reembolsada',    color: '#fb923c',           bg: 'rgba(251,146,60,0.1)', icon: RefreshCw },
  refund_requested: { label: 'Reembolso solicitado', color: '#fb923c', bg: 'rgba(251,146,60,0.1)', icon: RefreshCw },
  chargeback: { label: 'Chargeback',    color: '#f87171',           bg: 'rgba(248,113,113,0.1)', icon: XCircle },
  access_ended: { label: 'Acesso encerrado', color: '#f87171',      bg: 'rgba(248,113,113,0.1)', icon: XCircle },
}

const EVENT_LABELS: Record<string, string> = {
  Purchase_Order_Confirmed: '✅ Pagamento confirmado',
  Purchase_Order_Pending:   '⏳ Pagamento pendente',
  Purchase_Order_Expired:   '⌛ Pedido expirado',
  Subscription_Canceled:    '❌ Assinatura cancelada',
  Subscription_Renewed:     '🔄 Assinatura renovada',
  Refund_Requested:         '↩️ Reembolso solicitado',
  Refund_Completed:         '💸 Reembolso concluído',
  Chargeback:               '⚠️ Chargeback',
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  try { return format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) } catch { return '—' }
}

function fmtDateShort(iso: string | null) {
  if (!iso) return '—'
  try { return format(parseISO(iso), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) } catch { return '—' }
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string | null }) {
  const s = STATUS_STYLE[status ?? ''] ?? { label: status ?? 'Desconhecido', color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.05)', icon: Clock }
  const Icon = s.icon
  return (
    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
          style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}30` }}>
      <Icon size={12} /> {s.label}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function Subscription() {
  const { lead, status } = useAuth()
  const navigate = useNavigate()

  const { data: events = [], isLoading } = useQuery<LastlinkEvent[]>({
    queryKey: ['lastlink_events', lead?.id],
    enabled: !!lead?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lastlink_events')
        .select('id, received_at, event_type, order_id, payload')
        .eq('matched_lead', lead!.id)
        .order('received_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return (data ?? []) as LastlinkEvent[]
    },
  })

  const isSubscriber = status === 'active_subscriber'
  const isTrial = status === 'active_trial'

  const subStatus = lead?.subscription_status
  const subStyle = STATUS_STYLE[subStatus ?? ''] ?? null

  // Try to extract order amount from first confirmed event
  const confirmedEvent = events.find(e => e.event_type === 'Purchase_Order_Confirmed')
  const orderValue: number | null = confirmedEvent?.payload?.['order_value']
    ?? confirmedEvent?.payload?.['amount'] ?? null
  const planName: string | null = confirmedEvent?.payload?.['product_name']
    ?? confirmedEvent?.payload?.['plan_name'] ?? null

  // Extra lead fields (may exist depending on schema)
  const nextBillingAt = (lead as any)?.next_billing_at as string | null
  const paidCount = events.filter(e => e.event_type === 'Purchase_Order_Confirmed').length

  return (
    <div className="page-content no-scrollbar px-4">

      {/* Header */}
      <div className="flex items-center gap-3 pt-2 mb-5">
        <button onClick={() => navigate('/perfil')}
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <ChevronLeft size={18} style={{ color: 'rgba(255,255,255,0.7)' }} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Minha Assinatura</h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Histórico e status do plano
          </p>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3">

        {/* Plan card */}
        <div className="glass p-4" style={{ border: isSubscriber ? '1px solid rgba(167,139,250,0.25)' : '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: isSubscriber ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.05)', border: isSubscriber ? '1px solid rgba(167,139,250,0.3)' : '1px solid rgba(255,255,255,0.1)' }}>
              {isSubscriber ? <Crown size={20} style={{ color: '#a78bfa' }} /> : <CreditCard size={20} style={{ color: 'rgba(255,255,255,0.4)' }} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-sm">
                {isSubscriber ? (planName ?? 'Shark Green Pro') : isTrial ? 'Trial Gratuito' : 'Sem plano ativo'}
              </p>
              <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {lead?.email ?? '—'}
              </p>
            </div>
            {subStatus && <StatusBadge status={subStatus} />}
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-2">
            {lead?.paid_at && (
              <div className="rounded-xl p-2.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  <Calendar size={9} className="inline mr-1" />Membro desde
                </p>
                <p className="text-xs font-semibold text-white">{fmtDateShort(lead.paid_at)}</p>
              </div>
            )}
            {nextBillingAt && (
              <div className="rounded-xl p-2.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  <RefreshCw size={9} className="inline mr-1" />Próx. cobrança
                </p>
                <p className="text-xs font-semibold text-white">{fmtDateShort(nextBillingAt)}</p>
              </div>
            )}
            {orderValue !== null && (
              <div className="rounded-xl p-2.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  <CreditCard size={9} className="inline mr-1" />Valor do plano
                </p>
                <p className="text-xs font-semibold text-white">R${Number(orderValue).toFixed(2)}</p>
              </div>
            )}
            {paidCount > 0 && (
              <div className="rounded-xl p-2.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  <CheckCircle size={9} className="inline mr-1" />Pagamentos realizados
                </p>
                <p className="text-xs font-semibold text-white">{paidCount}×</p>
              </div>
            )}
          </div>
        </div>

        {/* Upgrade CTA for non-subscribers */}
        {!isSubscriber && (
          <a href="https://sharkgreen.com.br"
             className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-95"
             style={{ background: 'hsl(145 80% 48%)', color: '#0b1120' }}>
            <Crown size={16} /> Assinar e liberar tudo
          </a>
        )}

        {/* Events timeline */}
        {(isLoading || events.length > 0) && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2.5"
               style={{ color: 'rgba(255,255,255,0.35)' }}>
              Histórico de eventos
            </p>
            <div className="flex flex-col gap-2">
              {isLoading ? (
                [1,2,3].map(i => (
                  <div key={i} className="h-14 rounded-2xl animate-pulse"
                       style={{ background: 'rgba(255,255,255,0.04)' }} />
                ))
              ) : (
                events.map(ev => (
                  <div key={ev.id} className="glass px-4 py-3 flex items-center gap-3"
                       style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {EVENT_LABELS[ev.event_type ?? ''] ?? ev.event_type ?? 'Evento'}
                      </p>
                      {ev.order_id && (
                        <p className="text-[10px] mt-0.5 truncate font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          #{ev.order_id}
                        </p>
                      )}
                    </div>
                    <p className="text-[10px] flex-shrink-0 text-right" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {fmtDate(ev.received_at)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {!isLoading && events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <CreditCard size={32} style={{ color: 'rgba(255,255,255,0.15)' }} />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Nenhum evento de pagamento encontrado
            </p>
          </div>
        )}

      </motion.div>
      <div className="pb-4" />
    </div>
  )
}

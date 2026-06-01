import { motion } from 'framer-motion'
import { Zap, BarChart2, Package, Check, ChevronRight, Star, TrendingUp, Shield } from 'lucide-react'

const CHECKOUT_URL = 'https://lastlink.com/p/C528F8D0D/checkout-payment'

const PLANS = [
  {
    id: 'anual',
    badge: '⭐ MELHOR ESCOLHA',
    badgeColor: 'rgba(251,191,36,0.2)',
    badgeText: '#fbbf24',
    title: 'Anual',
    price: 'R$ 202,60',
    priceSub: '/mês',
    priceNote: 'em até 12x',
    total: 'R$ 1.997,00 à vista',
    saving: 'Economia de R$ 967/ano',
    border: 'rgba(251,191,36,0.4)',
    glow: 'rgba(251,191,36,0.08)',
    highlight: true,
  },
  {
    id: 'trimestral',
    badge: 'TRIMESTRAL',
    badgeColor: 'rgba(30,222,107,0.15)',
    badgeText: 'hsl(145 80% 48%)',
    title: 'Trimestral',
    price: 'R$ 213,88',
    priceSub: '/mês',
    priceNote: 'em até 3x',
    total: 'R$ 597,00 à vista',
    saving: null,
    border: 'rgba(30,222,107,0.25)',
    glow: 'rgba(30,222,107,0.04)',
    highlight: false,
  },
  {
    id: 'mensal',
    badge: 'MENSAL',
    badgeColor: 'rgba(148,163,184,0.1)',
    badgeText: 'rgba(255,255,255,0.5)',
    title: 'Mensal',
    price: 'R$ 247,00',
    priceSub: '/mês',
    priceNote: 'à vista',
    total: null,
    saving: null,
    border: 'rgba(255,255,255,0.08)',
    glow: 'transparent',
    highlight: false,
  },
]

const FEATURES = [
  {
    icon: BarChart2,
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.1)',
    title: 'Monitor de Odds',
    desc: 'Acompanhe movimentações de odds em tempo real e detecte oportunidades antes do mercado.',
  },
  {
    icon: TrendingUp,
    color: 'hsl(145 80% 48%)',
    bg: 'rgba(30,222,107,0.1)',
    title: 'FreeBet Pro',
    desc: 'Gerencie seus procedimentos, freebets e resultados com a plataforma mais completa do mercado.',
  },
  {
    icon: Shield,
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.1)',
    title: 'Suporte prioritário',
    desc: 'Acesso ao suporte premium e grupo exclusivo de assinantes Combo Pro.',
  },
  {
    icon: Zap,
    color: '#fb923c',
    bg: 'rgba(251,146,60,0.1)',
    title: 'Alertas instantâneos',
    desc: 'Notificações push para os melhores momentos de entrada — nunca perca uma oportunidade.',
  },
]

const INCLUDES = [
  'Monitor de Odds completo',
  'FreeBet Pro (gestão de freebets)',
  'Dashboard de resultados',
  'Procedimentos ao vivo',
  'Alertas push em tempo real',
  'Suporte VIP prioritário',
  'Grupo exclusivo de assinantes',
  'Atualizações contínuas',
]

export function Ferramentas() {
  function handleCheckout(planId: string) {
    const url = `${CHECKOUT_URL}?plan=${planId}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="h-full overflow-y-auto px-4 pt-6 pb-28"
      style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(30,222,107,0.15)', border: '1px solid rgba(30,222,107,0.3)' }}>
            <Package size={14} style={{ color: 'hsl(145 80% 48%)' }} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: 'hsl(145 80% 48%)' }}>
            Combo Pro
          </span>
        </div>
        <h1 className="text-2xl font-black text-white leading-tight">
          Ferramentas que<br />
          <span style={{
            background: 'linear-gradient(135deg, hsl(145 80% 55%) 0%, #60a5fa 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>multiplicam seus lucros</span>
        </h1>
        <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
          FreeBet Pro + Monitor de Odds em um único plano com desconto especial
        </p>
      </motion.div>

      {/* Feature cards */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid grid-cols-2 gap-2.5 mb-6"
      >
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.12 + i * 0.06 }}
            className="rounded-2xl p-3.5"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2"
              style={{ background: f.bg }}>
              <f.icon size={15} style={{ color: f.color }} />
            </div>
            <p className="text-xs font-bold text-white mb-1">{f.title}</p>
            <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {f.desc}
            </p>
          </motion.div>
        ))}
      </motion.div>

      {/* What's included */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
        className="rounded-2xl p-4 mb-6"
        style={{
          background: 'rgba(30,222,107,0.04)',
          border: '1px solid rgba(30,222,107,0.15)',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Star size={13} style={{ color: 'hsl(145 80% 48%)' }} />
          <span className="text-xs font-bold" style={{ color: 'hsl(145 80% 48%)' }}>
            O que está incluso
          </span>
        </div>
        <div className="grid grid-cols-2 gap-y-2 gap-x-3">
          {INCLUDES.map(item => (
            <div key={item} className="flex items-start gap-1.5">
              <Check size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'hsl(145 80% 48%)' }} />
              <span className="text-[10px] leading-snug" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {item}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Pricing plans */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.32 }}
        className="mb-2"
      >
        <p className="text-xs font-bold text-white mb-3">Escolha seu plano</p>
        <div className="space-y-3">
          {PLANS.map((plan, i) => (
            <motion.button
              key={plan.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.36 + i * 0.08 }}
              onClick={() => handleCheckout(plan.id)}
              className="w-full text-left rounded-2xl p-4 transition-all active:scale-[0.98]"
              style={{
                background: plan.highlight
                  ? `linear-gradient(135deg, rgba(251,191,36,0.06) 0%, rgba(251,191,36,0.02) 100%)`
                  : plan.glow,
                border: `1px solid ${plan.border}`,
                boxShadow: plan.highlight ? '0 0 24px rgba(251,191,36,0.08)' : 'none',
              }}
            >
              {/* Badge */}
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                  style={{ background: plan.badgeColor, color: plan.badgeText }}>
                  {plan.badge}
                </span>
                {plan.highlight && (
                  <Star size={12} fill="#fbbf24" style={{ color: '#fbbf24' }} />
                )}
              </div>

              {/* Price row */}
              <div className="flex items-end justify-between">
                <div>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-2xl font-black text-white">{plan.price}</span>
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {plan.priceSub}
                    </span>
                  </div>
                  <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {plan.priceNote}
                    {plan.total && ` · ${plan.total}`}
                  </p>
                  {plan.saving && (
                    <p className="text-[10px] font-semibold mt-1" style={{ color: '#fbbf24' }}>
                      {plan.saving}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-center w-9 h-9 rounded-xl"
                  style={{
                    background: plan.highlight
                      ? 'rgba(251,191,36,0.15)'
                      : 'rgba(255,255,255,0.06)',
                  }}>
                  <ChevronRight size={16}
                    style={{ color: plan.highlight ? '#fbbf24' : 'rgba(255,255,255,0.4)' }} />
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Footer note */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.6 }}
        className="text-center text-[10px] mt-5"
        style={{ color: 'rgba(255,255,255,0.25)' }}
      >
        Pagamento seguro via Lastlink · Cancele quando quiser
      </motion.p>
    </div>
  )
}

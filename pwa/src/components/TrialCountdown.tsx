import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Clock, Zap, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const CHECKOUT_URL = 'https://lastlink.com/p/CEAEE6585/checkout-payment'

function getDismissKey(type: 'trial_warn' | 'expired') {
  const today = new Date().toISOString().slice(0, 10)
  return `sg-popup-${type}-${today}`
}

function useCountdown(targetDate: Date | null) {
  const [diff, setDiff] = useState(targetDate ? targetDate.getTime() - Date.now() : 0)

  useEffect(() => {
    if (!targetDate) return
    const iv = setInterval(() => setDiff(targetDate.getTime() - Date.now()), 1000)
    return () => clearInterval(iv)
  }, [targetDate])

  if (!targetDate || diff <= 0) return { d: 0, h: 0, m: 0, s: 0, expired: true }

  const total = Math.max(0, diff)
  const s = Math.floor((total / 1000) % 60)
  const m = Math.floor((total / 1000 / 60) % 60)
  const h = Math.floor((total / 1000 / 60 / 60) % 24)
  const d = Math.floor(total / 1000 / 60 / 60 / 24)
  return { d, h, m, s, expired: false }
}

function TimeBox({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg tabular-nums"
        style={{ background: 'rgba(30,222,107,0.12)', border: '1px solid rgba(30,222,107,0.3)', color: 'hsl(145 80% 55%)' }}
      >
        {String(value).padStart(2, '0')}
      </div>
      <span className="text-[9px] mt-1 uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</span>
    </div>
  )
}

export function TrialCountdown() {
  const { status, lead } = useAuth()
  const [visible, setVisible] = useState(false)
  const [type, setType] = useState<'trial_warn' | 'expired' | null>(null)

  const expiresAt = lead?.expires_at ? new Date(lead.expires_at) : null
  const { d, h, m, s, expired: cdExpired } = useCountdown(expiresAt)

  useEffect(() => {
    if (status === 'loading' || status === 'active_subscriber') return

    if (status === 'expired') {
      const key = getDismissKey('expired')
      if (!localStorage.getItem(key)) {
        setType('expired')
        setVisible(true)
      }
      return
    }

    if (status === 'active_trial' && expiresAt) {
      const hoursLeft = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)
      if (hoursLeft <= 48) {
        const key = getDismissKey('trial_warn')
        if (!localStorage.getItem(key)) {
          setType('trial_warn')
          setVisible(true)
        }
      }
    }
  }, [status])

  function dismiss() {
    if (type) localStorage.setItem(getDismissKey(type), '1')
    setVisible(false)
  }

  if (!visible || !type) return null

  const isExpired = type === 'expired' || cdExpired

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
            onClick={dismiss}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', bounce: 0.25, duration: 0.4 }}
            className="absolute z-50 left-4 right-4"
            style={{ bottom: 'calc(72px + env(safe-area-inset-bottom, 0px) + 12px)' }}
          >
            <div
              className="rounded-3xl p-5 relative overflow-hidden"
              style={{
                background: 'linear-gradient(160deg, rgba(10,18,35,0.98), rgba(5,12,25,0.99))',
                border: isExpired ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(30,222,107,0.3)',
                boxShadow: isExpired
                  ? '0 8px 40px rgba(239,68,68,0.2)'
                  : '0 8px 40px rgba(30,222,107,0.15)',
              }}
            >
              {/* Glow bg */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: isExpired
                    ? 'radial-gradient(ellipse at 50% 0%, rgba(239,68,68,0.08) 0%, transparent 70%)'
                    : 'radial-gradient(ellipse at 50% 0%, rgba(30,222,107,0.07) 0%, transparent 70%)',
                }}
              />

              {/* Fechar */}
              <button
                onClick={dismiss}
                className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <X size={13} style={{ color: 'rgba(255,255,255,0.5)' }} />
              </button>

              {isExpired ? (
                /* ── EXPIRADO ─────────────────────────────── */
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">🦈</span>
                    <div>
                      <p className="font-bold text-sm text-white leading-tight">Trial encerrado</p>
                      <p className="text-[11px]" style={{ color: 'rgba(239,68,68,0.8)' }}>Seu acesso expirou</p>
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    Você viu o potencial durante os 7 dias — agora é hora de transformar isso em renda real todo mês! 💰
                  </p>

                  <div className="space-y-2 mb-4">
                    {[
                      'Procedimentos diários em tempo real',
                      'Grupo VIP Telegram incluído',
                      '7 dias de garantia total',
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <ShieldCheck size={12} style={{ color: 'hsl(145 80% 48%)', flexShrink: 0 }} />
                        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.65)' }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                /* ── TRIAL EXPIRANDO ──────────────────────── */
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <Clock size={18} style={{ color: 'hsl(145 80% 55%)' }} />
                    <div>
                      <p className="font-bold text-sm text-white leading-tight">Seu trial está acabando!</p>
                      <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Não perca o acesso</p>
                    </div>
                  </div>

                  {/* Countdown */}
                  <div className="flex justify-center gap-3 mb-4">
                    {d > 0 && <TimeBox value={d} label="dias" />}
                    <TimeBox value={h} label="horas" />
                    <TimeBox value={m} label="min" />
                    <TimeBox value={s} label="seg" />
                  </div>

                  <p className="text-xs text-center leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    Assine agora e continue recebendo os procedimentos — sem perder nenhum green! 🔥
                  </p>
                </>
              )}

              {/* CTA */}
              <a
                href={CHECKOUT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, hsl(145 80% 38%), hsl(145 80% 28%))',
                  color: 'white',
                  boxShadow: '0 4px 20px rgba(30,222,107,0.3)',
                  border: '1px solid rgba(30,222,107,0.4)',
                }}
              >
                <Zap size={15} />
                {isExpired ? 'Reativar acesso agora' : 'Garantir minha assinatura'}
              </a>

              <p className="text-center text-[10px] mt-2.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
                A partir de R$ 148,90 · 7 dias de garantia
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

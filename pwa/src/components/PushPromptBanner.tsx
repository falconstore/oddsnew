import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, BellOff, X, Zap } from 'lucide-react'
import { usePushNotifications } from '@/hooks/usePushNotifications'

const STORAGE_KEY = 'push_prompt_v1'
const DELAY_MS = 3000

export function PushPromptBanner() {
  const push = usePushNotifications()
  const [visible, setVisible] = useState(false)
  const [activating, setActivating] = useState(false)

  useEffect(() => {
    // Só mostra se: suportado + não ativado + não negado + ainda não exibido
    if (!push.isSupported) return
    if (push.state === 'loading') return
    if (push.state === 'subscribed') return
    if (push.state === 'denied') return
    if (push.state === 'unsupported') return
    if (localStorage.getItem(STORAGE_KEY)) return

    const timer = setTimeout(() => setVisible(true), DELAY_MS)
    return () => clearTimeout(timer)
  }, [push.state, push.isSupported])

  // Se o usuário ativou de fora (ex: Perfil), fecha o banner
  useEffect(() => {
    if (push.state === 'subscribed' && visible) {
      setVisible(false)
    }
  }, [push.state, visible])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  async function handleActivate() {
    setActivating(true)
    await push.subscribe()
    setActivating(false)
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop translúcido */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.45)' }}
            onClick={dismiss}
          />

          {/* Bottom sheet */}
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-1"
            style={{ maxWidth: 480, margin: '0 auto' }}
          >
            <div className="rounded-2xl overflow-hidden"
                 style={{ background: '#111827', border: '1px solid rgba(30,222,107,0.25)', boxShadow: '0 -8px 40px rgba(0,0,0,0.6)' }}>

              {/* Handle bar */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
              </div>

              <div className="px-5 pt-3 pb-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{ rotate: [0, -15, 15, -10, 10, 0] }}
                      transition={{ delay: 0.5, duration: 0.7 }}
                      className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(30,222,107,0.12)', border: '1px solid rgba(30,222,107,0.25)' }}
                    >
                      <Bell size={22} style={{ color: 'hsl(145 80% 48%)' }} />
                    </motion.div>
                    <div>
                      <h3 className="font-bold text-white text-base leading-tight">Ativar notificações</h3>
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        Não perde nenhum procedimento
                      </p>
                    </div>
                  </div>
                  <button onClick={dismiss} className="p-1 -mr-1 rounded-lg transition-colors"
                          style={{ color: 'rgba(255,255,255,0.3)' }}>
                    <X size={18} />
                  </button>
                </div>

                {/* Benefits */}
                <div className="rounded-xl p-3 mb-4 flex flex-col gap-2.5"
                     style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  {[
                    { icon: '🦈', text: 'Novo procedimento disponível' },
                    { icon: '⚡', text: 'Alertas de freebet e duplo green' },
                    { icon: '📊', text: 'Resultado e resumo do dia' },
                  ].map(({ icon, text }) => (
                    <div key={text} className="flex items-center gap-2.5">
                      <span className="text-base flex-shrink-0">{icon}</span>
                      <span className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>{text}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                {push.state === 'denied' ? (
                  <div className="rounded-xl p-3 text-center"
                       style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
                    <BellOff size={16} className="mx-auto mb-1.5" style={{ color: '#f87171' }} />
                    <p className="text-xs" style={{ color: '#f87171' }}>
                      Notificações bloqueadas. Ative nas configurações do Chrome e volte em Perfil.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleActivate}
                      disabled={activating}
                      className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-60"
                      style={{ background: 'hsl(145 80% 48%)', color: '#0b1120' }}
                    >
                      {activating ? (
                        <span className="flex gap-1">
                          {[0,1,2].map(i => (
                            <span key={i} className="w-1.5 h-1.5 rounded-full bg-current animate-bounce"
                                  style={{ animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </span>
                      ) : (
                        <>
                          <Zap size={15} />
                          Ativar agora — é de graça!
                        </>
                      )}
                    </button>
                    <button
                      onClick={dismiss}
                      className="w-full text-center text-xs py-2 transition-colors"
                      style={{ color: 'rgba(255,255,255,0.3)' }}
                    >
                      Agora não
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

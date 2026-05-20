import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, Eye, EyeOff, ShieldCheck, Bell, BellOff, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usePushNotifications } from '@/hooks/usePushNotifications'

type Step = 'password' | 'push'

export function SetPassword() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('password')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const push = usePushNotifications()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { setError('Senha precisa ter pelo menos 6 caracteres.'); return }
    if (password !== confirm) { setError('As senhas não coincidem.'); return }
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.updateUser({
      password,
      data: { needs_password_change: false },
    })
    setLoading(false)
    if (err) {
      setError('Erro ao salvar senha. Tente novamente.')
    } else {
      // Check if push is supported and not already set
      if (push.isSupported && push.state !== 'subscribed') {
        setStep('push')
      } else {
        navigate('/', { replace: true })
      }
    }
  }

  async function handleEnablePush() {
    await push.subscribe()
    navigate('/', { replace: true })
  }

  function handleSkipPush() {
    navigate('/', { replace: true })
  }

  return (
    <div className="app-shell flex flex-col items-center justify-center min-h-dvh px-6"
         style={{ background: '#0b1120' }}>

      <AnimatePresence mode="wait">

        {/* ── Passo 1: Definir senha ── */}
        {step === 'password' && (
          <motion.div key="password" className="w-full max-w-sm"
            initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}>

            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                   style={{ background: 'rgba(30,222,107,0.12)', border: '1px solid rgba(30,222,107,0.25)' }}>
                <ShieldCheck size={28} style={{ color: 'hsl(145 80% 48%)' }} />
              </div>
              <h1 className="text-xl font-bold text-white mb-2">Defina sua senha</h1>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Por segurança, crie uma senha própria para acessar o Shark Green.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="glass p-4 flex items-center gap-3">
                <Lock size={18} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Nova senha (mín. 6 caracteres)"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="flex-1 bg-transparent text-white text-sm outline-none placeholder-white/30"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPw(v => !v)} className="flex-shrink-0">
                  {showPw
                    ? <EyeOff size={16} style={{ color: 'rgba(255,255,255,0.3)' }} />
                    : <Eye size={16} style={{ color: 'rgba(255,255,255,0.3)' }} />}
                </button>
              </div>

              <div className="glass p-4 flex items-center gap-3">
                <Lock size={18} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Confirmar senha"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  className="flex-1 bg-transparent text-white text-sm outline-none placeholder-white/30"
                  autoComplete="new-password"
                />
              </div>

              {error && (
                <p className="text-xs text-center px-2" style={{ color: '#f87171' }}>{error}</p>
              )}

              <button type="submit" disabled={loading || !password || !confirm}
                className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50 mt-1"
                style={{ background: 'hsl(145 80% 48%)', color: '#0b1120' }}>
                {loading ? (
                  <span className="flex gap-1">
                    {[0,1,2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-current animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </span>
                ) : 'Salvar senha e continuar'}
              </button>
            </form>

            <button onClick={() => navigate('/', { replace: true })}
              className="w-full text-center text-xs py-3 mt-1 transition-colors"
              style={{ color: 'rgba(255,255,255,0.3)' }}>
              Agora não, entrar assim mesmo
            </button>

          </motion.div>
        )}

        {/* ── Passo 2: Ativar push ── */}
        {step === 'push' && (
          <motion.div key="push" className="w-full max-w-sm"
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.3 }}>

            <div className="text-center mb-8">
              {/* Animated bell icon */}
              <motion.div
                animate={{ rotate: [0, -15, 15, -10, 10, 0] }}
                transition={{ delay: 0.4, duration: 0.7 }}
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: 'rgba(30,222,107,0.12)', border: '1px solid rgba(30,222,107,0.25)' }}>
                <Bell size={28} style={{ color: 'hsl(145 80% 48%)' }} />
              </motion.div>
              <h1 className="text-xl font-bold text-white mb-2">Ativar notificações</h1>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Receba alertas de procedimentos e resultados em tempo real — mesmo com o app fechado.
              </p>
            </div>

            {/* Benefits list */}
            <div className="glass p-4 mb-4 flex flex-col gap-3">
              {[
                { icon: '🦈', text: 'Novo procedimento disponível' },
                { icon: '📊', text: 'Resultado do dia' },
                { icon: '⚡', text: 'Alertas de freebets e duplo green' },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <span className="text-lg">{icon}</span>
                  <p className="text-sm text-white" style={{ opacity: 0.85 }}>{text}</p>
                </div>
              ))}
            </div>

            {push.state === 'denied' ? (
              <div className="glass p-4 mb-3 text-center"
                   style={{ border: '1px solid rgba(248,113,113,0.2)' }}>
                <BellOff size={18} className="mx-auto mb-2" style={{ color: '#f87171' }} />
                <p className="text-xs" style={{ color: '#f87171' }}>
                  Notificações bloqueadas no browser. Ative nas configurações do Chrome e volte em Perfil.
                </p>
              </div>
            ) : (
              <button
                onClick={handleEnablePush}
                disabled={push.state === 'loading'}
                className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-60 mb-3"
                style={{ background: 'hsl(145 80% 48%)', color: '#0b1120' }}>
                {push.state === 'loading' ? (
                  <span className="flex gap-1">
                    {[0,1,2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-current animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </span>
                ) : (
                  <>
                    <Bell size={16} />
                    Ativar notificações
                  </>
                )}
              </button>
            )}

            <button onClick={handleSkipPush}
              className="w-full flex items-center justify-center gap-1 text-xs py-3 transition-colors"
              style={{ color: 'rgba(255,255,255,0.3)' }}>
              Agora não <ChevronRight size={12} />
            </button>

          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}

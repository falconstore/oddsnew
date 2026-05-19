import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, ArrowRight, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { LoadingScreen } from '@/components/LoadingScreen'

export function Login() {
  const { status } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  if (status === 'loading') return <LoadingScreen />
  if (status !== 'unauthenticated') return <Navigate to="/" replace />

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    const redirectUrl = `${window.location.origin}/auth/callback`
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: redirectUrl, shouldCreateUser: true },
    })
    setLoading(false)
    if (err) {
      setError('Erro ao enviar o link. Tente novamente.')
    } else {
      setSent(true)
    }
  }

  return (
    <div className="app-shell flex flex-col items-center justify-center min-h-dvh px-6 bg-glow"
         style={{ background: '#0b1120' }}>
      <motion.div className="w-full max-w-sm"
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

        <div className="text-center mb-10">
          <img src="/logo.png" alt="Shark Green" className="w-20 h-20 rounded-2xl mx-auto mb-5 shadow-2xl glow-green" />
          <h1 className="text-2xl font-bold text-gradient mb-1">Shark Green</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Acesse seus sinais de apostas
          </p>
        </div>

        {!sent ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="glass p-4 flex items-center gap-3">
              <Mail size={18} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
              <input
                type="email"
                placeholder="Seu e-mail cadastrado"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="flex-1 bg-transparent text-white text-sm outline-none placeholder-white/30"
                autoComplete="email"
                inputMode="email"
              />
            </div>

            {error && (
              <p className="text-xs text-center px-2" style={{ color: '#f87171' }}>{error}</p>
            )}

            <button type="submit" disabled={loading || !email.trim()}
              className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50"
              style={{ background: 'hsl(145 80% 48%)', color: '#0b1120' }}>
              {loading ? (
                <span className="flex gap-1">
                  {[0,1,2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-current animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </span>
              ) : (
                <>Receber link de acesso <ArrowRight size={16} /></>
              )}
            </button>

            <p className="text-center text-xs px-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Enviaremos um link mágico para o e-mail do seu cadastro
            </p>
          </form>
        ) : (
          <motion.div className="glass p-6 text-center"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <CheckCircle size={40} className="mx-auto mb-4" style={{ color: 'hsl(145 80% 48%)' }} />
            <h3 className="font-bold text-white mb-2">Verifique seu e-mail!</h3>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Enviamos um link para <span className="text-white font-medium">{email}</span>.
              Clique no link para entrar no app.
            </p>
            <button onClick={() => { setSent(false); setEmail('') }}
              className="mt-4 text-xs underline" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Usar outro e-mail
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}

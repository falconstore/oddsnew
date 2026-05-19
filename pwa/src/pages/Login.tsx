import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, ArrowRight, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { LoadingScreen } from '@/components/LoadingScreen'

type Mode = 'login' | 'forgot'

export function Login() {
  const { status } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  if (status === 'loading') return <LoadingScreen />
  if (status !== 'unauthenticated') return <Navigate to="/" replace />

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    setLoading(false)
    if (err) {
      if (err.message?.includes('Invalid login credentials')) {
        setError('E-mail ou senha incorretos.')
      } else {
        setError('Erro ao entrar. Tente novamente.')
      }
    }
    // Se ok, onAuthStateChange no useAuth redireciona automaticamente
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    const redirectUrl = `${window.location.origin}/auth/callback`
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: redirectUrl, shouldCreateUser: false },
    })
    setLoading(false)
    if (err) {
      setError('E-mail não encontrado ou erro ao enviar.')
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
            {mode === 'login' ? 'Acesse seus sinais de apostas' : 'Recuperar acesso'}
          </p>
        </div>

        {/* --- LOGIN --- */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <div className="glass p-4 flex items-center gap-3">
              <Mail size={18} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
              <input
                type="email"
                placeholder="Seu e-mail"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="flex-1 bg-transparent text-white text-sm outline-none placeholder-white/30"
                autoComplete="email"
                inputMode="email"
              />
            </div>

            <div className="glass p-4 flex items-center gap-3">
              <Lock size={18} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="Senha"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="flex-1 bg-transparent text-white text-sm outline-none placeholder-white/30"
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPw(v => !v)} className="flex-shrink-0">
                {showPw
                  ? <EyeOff size={16} style={{ color: 'rgba(255,255,255,0.3)' }} />
                  : <Eye size={16} style={{ color: 'rgba(255,255,255,0.3)' }} />}
              </button>
            </div>

            {error && (
              <p className="text-xs text-center px-2" style={{ color: '#f87171' }}>{error}</p>
            )}

            <button type="submit" disabled={loading || !email.trim() || !password}
              className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50 mt-1"
              style={{ background: 'hsl(145 80% 48%)', color: '#0b1120' }}>
              {loading ? (
                <span className="flex gap-1">
                  {[0,1,2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-current animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </span>
              ) : (
                <>Entrar <ArrowRight size={16} /></>
              )}
            </button>

            <button type="button" onClick={() => { setMode('forgot'); setError('') }}
              className="text-center text-xs py-2 transition-colors"
              style={{ color: 'rgba(255,255,255,0.35)' }}>
              Esqueci minha senha
            </button>
          </form>
        )}

        {/* --- FORGOT --- */}
        {mode === 'forgot' && !sent && (
          <form onSubmit={handleForgot} className="flex flex-col gap-3">
            <p className="text-xs text-center px-2 mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Digite seu e-mail e enviaremos um link para você entrar e redefinir sua senha.
            </p>
            <div className="glass p-4 flex items-center gap-3">
              <Mail size={18} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
              <input
                type="email"
                placeholder="Seu e-mail"
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
              ) : 'Enviar link de acesso'}
            </button>

            <button type="button" onClick={() => { setMode('login'); setError('') }}
              className="text-center text-xs py-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
              ← Voltar ao login
            </button>
          </form>
        )}

        {mode === 'forgot' && sent && (
          <motion.div className="glass p-6 text-center"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <CheckCircle size={40} className="mx-auto mb-4" style={{ color: 'hsl(145 80% 48%)' }} />
            <h3 className="font-bold text-white mb-2">Verifique seu e-mail!</h3>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Enviamos um link para <span className="text-white font-medium">{email}</span>.
              Clique para entrar.
            </p>
            <button onClick={() => { setSent(false); setMode('login') }}
              className="mt-4 text-xs underline" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Voltar ao login
            </button>
          </motion.div>
        )}

      </motion.div>
    </div>
  )
}

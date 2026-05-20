import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export function SetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
      navigate('/', { replace: true })
    }
  }

  function handleSkip() {
    navigate('/', { replace: true })
  }

  return (
    <div className="app-shell flex flex-col items-center justify-center min-h-dvh px-6"
         style={{ background: '#0b1120' }}>
      <motion.div className="w-full max-w-sm"
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

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
            ) : 'Salvar senha e entrar'}
          </button>
        </form>

        <button onClick={handleSkip}
          className="w-full text-center text-xs py-3 mt-1 transition-colors"
          style={{ color: 'rgba(255,255,255,0.3)' }}>
          Agora não, entrar assim mesmo
        </button>

      </motion.div>
    </div>
  )
}

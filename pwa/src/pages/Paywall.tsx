import { motion } from 'framer-motion'
import { Lock, Zap, TrendingUp, ShieldCheck } from 'lucide-react'
import { signOut } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'

const PERKS = [
  { icon: TrendingUp, text: 'Procedimentos em tempo real' },
  { icon: Zap,        text: 'Alertas de kickoff e duplo green' },
  { icon: ShieldCheck, text: 'Suporte exclusivo pelo Telegram' },
]

export function Paywall() {
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell flex flex-col items-center justify-center min-h-dvh px-6 bg-glow"
         style={{ background: '#0b1120' }}>
      <motion.div className="w-full max-w-sm"
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
               style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)' }}>
            <Lock size={26} style={{ color: '#f87171' }} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Acesso encerrado</h1>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Seu período de trial expirou ou você não possui assinatura ativa.
          </p>
        </div>

        <div className="glass p-5 mb-6 flex flex-col gap-3">
          {PERKS.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                   style={{ background: 'rgba(30,222,107,0.1)' }}>
                <Icon size={15} style={{ color: 'hsl(145 80% 48%)' }} />
              </div>
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{text}</span>
            </div>
          ))}
        </div>

        <a href="https://sharkgreen.com.br"
           className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-semibold text-sm mb-3 transition-all active:scale-95"
           style={{ background: 'hsl(145 80% 48%)', color: '#0b1120' }}>
          Assinar agora
        </a>

        <button onClick={handleLogout}
          className="w-full py-3 rounded-2xl text-sm font-medium transition-all active:scale-95"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}>
          Sair
        </button>
      </motion.div>
    </div>
  )
}

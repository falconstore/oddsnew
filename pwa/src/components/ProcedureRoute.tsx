import { motion } from 'framer-motion'
import { Lock, Crown } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { LoadingScreen } from '@/components/LoadingScreen'

function TrialLockedScreen() {
  return (
    <div className="page-content no-scrollbar px-4 flex flex-col items-center justify-center min-h-full">
      <motion.div className="flex flex-col items-center text-center max-w-xs"
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5"
          style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)' }}>
          <Lock size={32} style={{ color: '#f87171' }} />
        </div>

        <h2 className="text-xl font-bold text-white mb-2">Trial expirado</h2>
        <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Seu período de teste gratuito de 7 dias encerrou.
          Assine para continuar acessando procedimentos e operações ao vivo.
        </p>

        <a href="https://sharkgreen.com.br"
          className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-semibold text-sm mb-3 transition-all active:scale-95"
          style={{ background: 'hsl(145 80% 48%)', color: '#0b1120' }}>
          <Crown size={16} /> Assinar agora
        </a>

        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Dúvidas? Fale conosco no Telegram
        </p>
      </motion.div>
    </div>
  )
}

export function ProcedureRoute({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()

  if (status === 'loading') return <LoadingScreen />
  if (status === 'expired') return <TrialLockedScreen />

  return <>{children}</>
}

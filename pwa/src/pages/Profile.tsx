import { motion } from 'framer-motion'
import { User, LogOut, Clock, Crown, Send, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAuth, signOut } from '@/hooks/useAuth'

function InfoRow({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="flex items-center gap-3 py-3.5"
         style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
           style={{ background: 'rgba(255,255,255,0.05)' }}>
        <Icon size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
        <p className="text-sm font-medium text-white truncate">{value}</p>
      </div>
    </div>
  )
}

export function Profile() {
  const { lead, status, user } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const isSubscriber = status === 'active_subscriber'
  const isTrial = status === 'active_trial'

  const trialExpires = lead?.trial_expires_at ? parseISO(lead.trial_expires_at) : null
  const daysLeft = trialExpires ? differenceInDays(trialExpires, new Date()) : null

  const telegramUsername = lead?.telegram_username
  const telegramLink = telegramUsername
    ? `https://t.me/${telegramUsername.replace('@', '')}`
    : 'https://t.me/sharkgreen'

  return (
    <div className="page-content no-scrollbar px-4">
      <div className="pt-2 mb-5">
        <h1 className="text-xl font-bold text-white">Perfil</h1>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">

        {/* Avatar + name */}
        <div className="glass p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
               style={{ background: 'rgba(30,222,107,0.12)', border: '1px solid rgba(30,222,107,0.25)' }}>
            <User size={24} style={{ color: 'hsl(145 80% 48%)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-base truncate">{lead?.name ?? user?.email ?? '—'}</p>
            <p className="text-xs truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{user?.email}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              {isSubscriber ? (
                <span className="pill" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' }}>
                  <Crown size={9} /> ASSINANTE
                </span>
              ) : isTrial ? (
                <span className="pill" style={{ background: 'rgba(30,222,107,0.12)', color: 'hsl(145 80% 48%)', border: '1px solid rgba(30,222,107,0.25)' }}>
                  TRIAL ATIVO
                </span>
              ) : (
                <span className="pill" style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>
                  EXPIRADO
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Trial expiry warning */}
        {isTrial && daysLeft !== null && (
          <div className="glass p-4 flex items-center gap-3"
               style={{ border: `1px solid ${daysLeft <= 2 ? 'rgba(248,113,113,0.3)' : 'rgba(250,204,21,0.2)'}` }}>
            <AlertCircle size={16} style={{ color: daysLeft <= 2 ? '#f87171' : '#facc15', flexShrink: 0 }} />
            <div>
              <p className="text-sm font-semibold text-white">
                {daysLeft <= 0 ? 'Trial encerra hoje!' : `Trial encerra em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}`}
              </p>
              {trialExpires && (
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {format(trialExpires, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="glass px-4 py-1">
          {lead?.whatsapp && <InfoRow label="WhatsApp" value={lead.whatsapp} icon={User} />}
          {lead?.telegram_username && <InfoRow label="Telegram" value={lead.telegram_username} icon={Send} />}
          {trialExpires && (
            <InfoRow
              label={isSubscriber ? "Assinante desde" : "Trial expira em"}
              value={isSubscriber
                ? format(parseISO(lead?.subscribed_at ?? ''), "dd/MM/yyyy", { locale: ptBR })
                : format(trialExpires, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              icon={Clock}
            />
          )}
        </div>

        {/* Telegram — only for subscribers */}
        {isSubscriber && (
          <a href={telegramLink} target="_blank" rel="noreferrer"
             className="glass flex items-center gap-3 p-4 active:scale-[0.98] transition-transform"
             style={{ border: '1px solid rgba(30,222,107,0.2)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                 style={{ background: 'rgba(30,222,107,0.12)' }}>
              <Send size={18} style={{ color: 'hsl(145 80% 48%)' }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Grupo Telegram</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>Acesse o grupo exclusivo de assinantes</p>
            </div>
          </a>
        )}

        {/* Upgrade CTA — only for trial */}
        {isTrial && (
          <a href="https://sharkgreen.com.br"
             className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-95"
             style={{ background: 'hsl(145 80% 48%)', color: '#0b1120' }}>
            <Crown size={16} /> Assinar e liberar tudo
          </a>
        )}

        {/* Logout */}
        <button onClick={handleLogout}
          className="glass flex items-center gap-3 p-4 w-full text-left active:scale-[0.98] transition-transform"
          style={{ border: '1px solid rgba(248,113,113,0.15)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
               style={{ background: 'rgba(248,113,113,0.08)' }}>
            <LogOut size={16} style={{ color: '#f87171' }} />
          </div>
          <span className="text-sm font-medium" style={{ color: '#f87171' }}>Sair da conta</span>
        </button>

      </motion.div>
    </div>
  )
}

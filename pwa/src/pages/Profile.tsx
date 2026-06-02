import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, LogOut, Clock, Crown, Send, AlertCircle, Bell, BellOff, CreditCard, ChevronRight, X, Settings, Lock, CheckCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAuth, signOut } from '@/hooks/useAuth'
import { usePushNotifications } from '@/hooks/usePushNotifications'

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

const PUSH_LABELS: Record<string, { label: string; sub: string; color: string }> = {
  subscribed:   { label: 'Notificações ativas',    sub: 'Toque para desativar',  color: 'hsl(145 80% 48%)' },
  unsubscribed: { label: 'Ativar notificações',    sub: 'Fique por dentro dos resultados', color: 'rgba(255,255,255,0.6)' },
  denied:       { label: 'Notificações bloqueadas', sub: 'Ative nas configurações do browser', color: '#f87171' },
  loading:      { label: 'Carregando...',           sub: '',                       color: 'rgba(255,255,255,0.4)' },
  unsupported:  { label: 'Não suportado',           sub: 'Use Chrome/Edge para ativar notificações', color: 'rgba(255,255,255,0.3)' },
}

export function Profile() {
  const { lead, status, user } = useAuth()
  const navigate = useNavigate()
  const push = usePushNotifications()
  const [showDeniedHelp, setShowDeniedHelp] = useState(false)

  async function handleLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const isSubscriber = status === 'active_subscriber'
  const isTrial = status === 'active_trial'

  const trialExpires = lead?.expires_at ? parseISO(lead.expires_at) : null
  const daysLeft = trialExpires ? differenceInDays(trialExpires, new Date()) : null

  const telegramUsername = lead?.telegram_username
  const telegramLink = telegramUsername
    ? `https://t.me/${telegramUsername.replace('@', '')}`
    : 'https://t.me/sharkgreen'

  const pushInfo = PUSH_LABELS[push.state] ?? PUSH_LABELS.unsupported
  const canTogglePush = push.state === 'subscribed' || push.state === 'unsubscribed'

  function handlePushClick() {
    if (push.state === 'denied') { setShowDeniedHelp(true); return }
    if (canTogglePush) push.toggle()
  }

  const [showChangePw, setShowChangePw] = useState(false)
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwDone, setPwDone] = useState(false)

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPw.length < 6) { setPwError('Mínimo 6 caracteres.'); return }
    if (newPw !== confirmPw) { setPwError('As senhas não coincidem.'); return }
    setPwLoading(true); setPwError('')
    const { supabase: sb } = await import('@/lib/supabase')
    const { error: err } = await sb.auth.updateUser({ password: newPw, data: { needs_password_change: false } })
    setPwLoading(false)
    if (err) { setPwError('Erro ao salvar. Tente novamente.'); return }
    setPwDone(true)
    setTimeout(() => { setShowChangePw(false); setPwDone(false); setNewPw(''); setConfirmPw('') }, 2000)
  }

  const [refreshDone, setRefreshDone] = useState(false)
  async function handleRefresh() {
    setRefreshDone(false)
    await push.refresh()
    setRefreshDone(true)
    setTimeout(() => setRefreshDone(false), 3000)
  }

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
              value={isSubscriber && lead?.paid_at
                ? format(parseISO(lead.paid_at), "dd/MM/yyyy", { locale: ptBR })
                : format(trialExpires, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              icon={Clock}
            />
          )}
        </div>

        {/* Subscription detail link */}
        <button onClick={() => navigate('/assinatura')}
          className="glass flex items-center gap-3 p-4 w-full text-left active:scale-[0.98] transition-transform"
          style={{ border: '1px solid rgba(167,139,250,0.15)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
               style={{ background: 'rgba(167,139,250,0.1)' }}>
            <CreditCard size={18} style={{ color: '#a78bfa' }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Minha Assinatura</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Status, histórico e faturas</p>
          </div>
          <ChevronRight size={16} style={{ color: 'rgba(255,255,255,0.3)' }} />
        </button>

        {/* Trocar senha */}
        <button onClick={() => { setShowChangePw(true); setPwError(''); setPwDone(false) }}
          className="glass flex items-center gap-3 p-4 w-full text-left active:scale-[0.98] transition-transform"
          style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
               style={{ background: 'rgba(255,255,255,0.05)' }}>
            <Lock size={18} style={{ color: 'rgba(255,255,255,0.5)' }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Trocar senha</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Defina uma senha pessoal para sua conta</p>
          </div>
          <ChevronRight size={16} style={{ color: 'rgba(255,255,255,0.3)' }} />
        </button>

        {/* Push notifications toggle */}
        {push.state !== 'unsupported' && (
          <div className="flex flex-col gap-2">
            <button
              onClick={handlePushClick}
              disabled={push.state === 'loading'}
              className="glass flex items-center gap-3 p-4 w-full text-left transition-all active:scale-[0.98] disabled:opacity-60"
              style={{ border: `1px solid ${push.state === 'subscribed' ? 'rgba(30,222,107,0.2)' : push.state === 'denied' ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.08)'}` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ background: push.state === 'subscribed' ? 'rgba(30,222,107,0.1)' : push.state === 'denied' ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.05)' }}>
                {push.state === 'subscribed'
                  ? <Bell size={18} style={{ color: 'hsl(145 80% 48%)' }} />
                  : push.state === 'denied'
                  ? <Settings size={18} style={{ color: '#f87171' }} />
                  : <BellOff size={18} style={{ color: 'rgba(255,255,255,0.4)' }} />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: push.state === 'denied' ? '#f87171' : 'white' }}>{pushInfo.label}</p>
                {pushInfo.sub && (
                  <p className="text-xs mt-0.5" style={{ color: push.state === 'denied' ? 'rgba(248,113,113,0.7)' : 'rgba(255,255,255,0.4)' }}>
                    {push.state === 'denied' ? 'Toque para ver como desbloquear' : pushInfo.sub}
                  </p>
                )}
              </div>
              {push.state === 'denied' && (
                <ChevronRight size={16} style={{ color: '#f87171', opacity: 0.7 }} />
              )}
              {/* Toggle pill */}
              {(push.state === 'subscribed' || push.state === 'unsubscribed') && (
                <div className="w-11 h-6 rounded-full relative flex-shrink-0 transition-all"
                     style={{ background: push.state === 'subscribed' ? 'hsl(145 80% 48%)' : 'rgba(255,255,255,0.15)' }}>
                  <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                       style={{ left: push.state === 'subscribed' ? '22px' : '2px' }} />
                </div>
              )}
            </button>

            {/* Refresh subscription — shown when subscribed, helps fix stale FCM tokens */}
            {push.state === 'subscribed' && (
              <button
                onClick={handleRefresh}
                disabled={push.refreshing}
                className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs transition-all active:scale-[0.97] disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: refreshDone ? 'hsl(145 80% 48%)' : 'rgba(255,255,255,0.35)' }}>
                {push.refreshing ? (
                  <>
                    <div className="w-3 h-3 rounded-full border border-white/30 border-t-white/80 animate-spin" />
                    Atualizando inscrição...
                  </>
                ) : refreshDone ? (
                  <>✓ Inscrição atualizada — aguarde o próximo envio</>
                ) : (
                  <>↻ Notificações não chegando? Toque aqui para atualizar</>
                )}
              </button>
            )}
          </div>
        )}

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

      {/* Modal: trocar senha */}
      <AnimatePresence>
        {showChangePw && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowChangePw(false)}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.7)' }}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-6"
              style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Lock size={18} style={{ color: 'hsl(145 80% 48%)' }} />
                  <h2 className="text-base font-bold text-white">Trocar senha</h2>
                </div>
                <button onClick={() => setShowChangePw(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <X size={16} style={{ color: 'rgba(255,255,255,0.6)' }} />
                </button>
              </div>

              {pwDone ? (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-3 py-6">
                  <CheckCircle size={40} style={{ color: 'hsl(145 80% 48%)' }} />
                  <p className="text-white font-semibold">Senha alterada com sucesso!</p>
                </motion.div>
              ) : (
                <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
                  <div className="glass p-4 flex items-center gap-3">
                    <Lock size={16} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
                    <input
                      type={showPw ? 'text' : 'password'}
                      placeholder="Nova senha (mín. 6 caracteres)"
                      value={newPw}
                      onChange={e => setNewPw(e.target.value)}
                      required
                      className="flex-1 bg-transparent text-white text-sm outline-none placeholder-white/30"
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)} className="flex-shrink-0 p-1">
                      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>{showPw ? 'ocultar' : 'ver'}</span>
                    </button>
                  </div>
                  <div className="glass p-4 flex items-center gap-3">
                    <Lock size={16} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
                    <input
                      type={showPw ? 'text' : 'password'}
                      placeholder="Confirmar nova senha"
                      value={confirmPw}
                      onChange={e => setConfirmPw(e.target.value)}
                      required
                      className="flex-1 bg-transparent text-white text-sm outline-none placeholder-white/30"
                      autoComplete="new-password"
                    />
                  </div>
                  {pwError && (
                    <p className="text-xs text-center px-2" style={{ color: '#f87171' }}>{pwError}</p>
                  )}
                  <button type="submit" disabled={pwLoading || !newPw || !confirmPw}
                    className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50 mt-1"
                    style={{ background: 'hsl(145 80% 48%)', color: '#0b1120' }}>
                    {pwLoading ? (
                      <span className="flex gap-1">
                        {[0,1,2].map(i => (
                          <span key={i} className="w-1.5 h-1.5 rounded-full bg-current animate-bounce"
                                style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </span>
                    ) : 'Salvar nova senha'}
                  </button>
                </form>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modal: como desbloquear notificações */}
      <AnimatePresence>
        {showDeniedHelp && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowDeniedHelp(false)}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.7)' }}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-6"
              style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)' }}>

              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Settings size={18} style={{ color: '#f87171' }} />
                  <h2 className="text-base font-bold text-white">Como ativar notificações</h2>
                </div>
                <button onClick={() => setShowDeniedHelp(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <X size={16} style={{ color: 'rgba(255,255,255,0.6)' }} />
                </button>
              </div>

              {/* Steps */}
              <div className="flex flex-col gap-3 mb-6">
                {[
                  { n: 1, text: 'Na barra de endereço do Chrome, toque no ícone 🔒 ou nos três pontos ⋮' },
                  { n: 2, text: 'Toque em "Configurações do site" ou "Permissões"' },
                  { n: 3, text: 'Encontre "Notificações" e mude para Permitir' },
                  { n: 4, text: 'Volte aqui e toque no card de notificações novamente' },
                ].map(({ n, text }) => (
                  <div key={n} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                         style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)' }}>
                      <span className="text-xs font-bold" style={{ color: '#f87171' }}>{n}</span>
                    </div>
                    <p className="text-sm text-white leading-relaxed" style={{ opacity: 0.85 }}>{text}</p>
                  </div>
                ))}
              </div>

              <p className="text-xs text-center mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
                No iPhone (Safari), vá em Ajustes → Safari → Notificações
              </p>

              <button
                onClick={() => setShowDeniedHelp(false)}
                className="w-full py-3.5 rounded-2xl font-semibold text-sm"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}>
                Entendi
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, MessageCircle, Loader2, ChevronDown, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  ts?: number
}

const SUPABASE_URL = 'https://wspsuempnswljkphatur.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzcHN1ZW1wbnN3bGprcGhhdHVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNTc1NTEsImV4cCI6MjA3NTkzMzU1MX0.zgEcoHFulNHrSxyHOZTbCCtDKfqjppHLRh1junsmsoA'

const AGENTS = [
  { name: 'Lucas Shark',    initials: 'LS', color: 'hsl(145 80% 38%)' },
  { name: 'Cleisson Shark', initials: 'CS', color: 'hsl(210 80% 42%)' },
]

// Persistência em localStorage para manter histórico entre sessões
const SESSION_KEY = 'sg-chat-v2'

function getOrCreateSession(): { id: string; agentIndex: number } {
  const raw = localStorage.getItem(SESSION_KEY)
  if (raw) {
    try { return JSON.parse(raw) } catch {}
  }
  const id = crypto.randomUUID()
  const agentIndex = Math.random() < 0.5 ? 0 : 1
  localStorage.setItem(SESSION_KEY, JSON.stringify({ id, agentIndex }))
  return { id, agentIndex }
}

const QUICK_REPLIES = [
  'Como funciona o Shark Green?',
  'O que é freebet e como queimar?',
  'Como executo um procedimento?',
]

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map(i => (
        <motion.span key={i} className="w-2 h-2 rounded-full"
          style={{ background: 'hsl(145 80% 48%)' }}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.15, 0.8] }}
          transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }} />
      ))}
    </div>
  )
}

function AgentAvatar({ agent, size = 36 }: { agent: typeof AGENTS[0]; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold flex-shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.33,
        background: `${agent.color}22`,
        border: `1.5px solid ${agent.color}55`,
        color: agent.color,
      }}
    >
      {agent.initials}
    </div>
  )
}

const WELCOME_ID = '__welcome__'

function makeWelcome(agentName: string): Message {
  return {
    id: WELCOME_ID,
    role: 'assistant',
    content: `Olá! 👋 Sou o **${agentName}**, seu atendente aqui no Shark Green. Posso te ajudar com dúvidas sobre procedimentos, como usar o app, ou qualquer outra coisa. O que você precisa?`,
    ts: Date.now(),
  }
}

export function SupportChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [hasUnread, setHasUnread] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const session = useRef(getOrCreateSession())
  const agent = AGENTS[session.current.agentIndex]
  const { user, status, lead } = useAuth()

  const trialDaysLeft = (() => {
    if (!lead?.expires_at) return null
    const diff = new Date(lead.expires_at).getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  })()
  const initialized = useRef(false)

  const scrollBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
  }, [])

  // Carrega histórico do banco ao abrir pela primeira vez
  useEffect(() => {
    if (!open || initialized.current || !user?.email) return
    initialized.current = true
    setLoadingHistory(true)

    ;(async () => {
      try {
        const { data } = await supabase
          .from('pwa_chat_messages')
          .select('id, role, content, created_at')
          .eq('session_id', session.current.id)
          .order('created_at', { ascending: true })
          .limit(40)
        if (data && data.length > 0) {
          setMessages(data.map((m: any) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            ts: new Date(m.created_at).getTime(),
          })))
        } else {
          setMessages([makeWelcome(agent.name)])
        }
      } catch {
        setMessages([makeWelcome(agent.name)])
      } finally {
        setLoadingHistory(false)
      }
    })()
  }, [open, user?.email])

  useEffect(() => {
    if (open) {
      setHasUnread(false)
      setTimeout(() => inputRef.current?.focus(), 350)
      scrollBottom()
    }
  }, [open])

  useEffect(() => { if (open) scrollBottom() }, [messages, open])

  async function send(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || loading || !user?.email) return
    if (!text) setInput('')
    const ta = inputRef.current
    if (ta) ta.style.height = 'auto'

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: msg, ts: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    scrollBottom()

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      const token = authSession?.access_token ?? ANON_KEY

      const res = await fetch(`${SUPABASE_URL}/functions/v1/pwa-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          message: msg,
          session_id: session.current.id,
          user_email: user.email,
          user_status: status,
          agent_name: agent.name,
          trial_days_left: trialDaysLeft,
        }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply ?? 'Desculpe, não consegui responder. Tente novamente!',
        ts: Date.now(),
      }])
    } catch {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Ops, problema de conexão. Tenta de novo! 🦈',
        ts: Date.now(),
      }])
    } finally {
      setLoading(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  function renderContent(text: string) {
    // Quebra por [PRINT:N] para exibir imagens reais de depoimentos
    const segments = text.split(/(\[PRINT:\d+\])/)
    return segments.map((seg, i) => {
      const match = seg.match(/^\[PRINT:(\d+)\]$/)
      if (match) {
        const n = match[1]
        return (
          <div key={i} className="mt-2 mb-1">
            <img
              src={`/proof${n}.png`}
              alt="Print de resultado de membro"
              className="rounded-xl max-w-full"
              style={{ maxHeight: 320, objectFit: 'contain' }}
            />
          </div>
        )
      }
      // Dentro de cada segmento de texto, processa **bold**
      const parts = seg.split(/(\*\*[^*]+\*\*)/)
      return parts.map((part, j) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={`${i}-${j}`} className="font-semibold">{part.slice(2, -2)}</strong>
          : <span key={`${i}-${j}`}>{part}</span>
      )
    })
  }

  // Mostra chips só se a única mensagem for a de boas-vindas (sem histórico)
  const showQuickReplies = messages.length === 1 && messages[0]?.id === WELCOME_ID && !loading

  return (
    <>
      {/* FAB */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="fab"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', bounce: 0.4 }}
            onClick={() => setOpen(true)}
            className="absolute z-50 flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full shadow-2xl"
            style={{
              bottom: 84,
              right: 16,
              background: 'linear-gradient(135deg, #ffffff, #e8fdf0)',
              border: '1px solid rgba(30,222,107,0.5)',
              boxShadow: '0 4px 28px rgba(0,0,0,0.45), 0 0 16px rgba(30,222,107,0.2)',
            }}
          >
            <MessageCircle size={16} style={{ color: 'hsl(145 80% 30%)' }} />
            <span className="text-xs font-bold" style={{ color: 'hsl(145 80% 25%)' }}>Precisa de ajuda?</span>
            {hasUnread && (
              <>
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 animate-ping" />
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500" />
              </>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Painel full-screen mobile */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', bounce: 0.1, duration: 0.38 }}
            className="absolute z-50 flex flex-col"
            style={{ inset: 0, background: 'rgba(8, 14, 22, 0.99)', backdropFilter: 'blur(24px)' }}
          >
            {/* Header */}
            <div
              className="flex items-center gap-3 px-4 flex-shrink-0"
              style={{
                paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
                paddingBottom: 12,
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                background: 'rgba(20,222,107,0.04)',
              }}
            >
              <AgentAvatar agent={agent} size={40} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white leading-tight">{agent.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <p className="text-[11px] text-green-400">Online · atendente Shark Green</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <ChevronDown size={18} style={{ color: 'rgba(255,255,255,0.6)' }} />
              </button>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ overscrollBehavior: 'contain' }}>

              {/* Loading histórico */}
              {loadingHistory && (
                <div className="flex justify-center py-4">
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    <Clock size={12} />
                    <span>Carregando histórico...</span>
                  </div>
                </div>
              )}

              {messages.map((m, idx) => (
                <div key={m.id}>
                  <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} gap-2.5 items-end`}>
                    {m.role === 'assistant' && <AgentAvatar agent={agent} size={28} />}
                    <div
                      className="max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
                      style={{
                        background: m.role === 'user'
                          ? 'linear-gradient(135deg, hsl(145 80% 32%), hsl(145 80% 22%))'
                          : 'rgba(255,255,255,0.07)',
                        color: 'rgba(255,255,255,0.92)',
                        borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        border: m.role === 'assistant' ? '1px solid rgba(255,255,255,0.08)' : 'none',
                      }}
                    >
                      {renderContent(m.content)}
                    </div>
                  </div>

                  {/* Chips de perguntas rápidas logo abaixo da mensagem de boas-vindas */}
                  {m.id === WELCOME_ID && showQuickReplies && (
                    <div className="flex flex-col gap-2 mt-3 ml-10">
                      {QUICK_REPLIES.map(q => (
                        <button
                          key={q}
                          onClick={() => send(q)}
                          className="text-left text-xs px-3.5 py-2 rounded-xl transition-all active:scale-95"
                          style={{
                            background: 'rgba(30,222,107,0.08)',
                            border: '1px solid rgba(30,222,107,0.25)',
                            color: 'hsl(145 80% 60%)',
                          }}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex justify-start gap-2.5 items-end">
                  <AgentAvatar agent={agent} size={28} />
                  <div className="rounded-2xl" style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '18px 18px 18px 4px',
                  }}>
                    <TypingDots />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div
              className="flex items-end gap-2.5 px-4 pt-3 flex-shrink-0"
              style={{
                paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 68px)',
                borderTop: '1px solid rgba(255,255,255,0.07)',
                background: 'rgba(8,14,22,0.95)',
              }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Digite sua dúvida..."
                rows={1}
                className="flex-1 resize-none text-sm rounded-2xl px-4 py-3 outline-none"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'white',
                  maxHeight: 100,
                  lineHeight: 1.5,
                }}
                onInput={e => {
                  const t = e.currentTarget
                  t.style.height = 'auto'
                  t.style.height = Math.min(t.scrollHeight, 100) + 'px'
                }}
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 active:scale-90 transition-all"
                style={{
                  background: input.trim() && !loading
                    ? 'linear-gradient(135deg, hsl(145 80% 40%), hsl(145 80% 30%))'
                    : 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: input.trim() && !loading ? '0 2px 12px rgba(30,222,107,0.3)' : 'none',
                }}
              >
                {loading
                  ? <Loader2 size={17} className="animate-spin" style={{ color: 'hsl(145 80% 55%)' }} />
                  : <Send size={17} style={{ color: input.trim() ? 'white' : 'rgba(255,255,255,0.25)' }} />
                }
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

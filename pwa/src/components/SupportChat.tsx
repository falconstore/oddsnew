import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, MessageCircle, Loader2, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const SUPABASE_URL = 'https://wspsuempnswljkphatur.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzcHN1ZW1wbnN3bGprcGhhdHVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNTc1NTEsImV4cCI6MjA3NTkzMzU1MX0.zgEcoHFulNHrSxyHOZTbCCtDKfqjppHLRh1junsmsoA'

const AGENTS = [
  { name: 'Lucas Shark',    initials: 'LS', color: 'hsl(145 80% 38%)' },
  { name: 'Cleisson Shark', initials: 'CS', color: 'hsl(210 80% 42%)' },
]

function getOrCreateSession(): { id: string; agentIndex: number } {
  const key = 'sg-chat-session'
  const raw = sessionStorage.getItem(key)
  if (raw) {
    try { return JSON.parse(raw) } catch {}
  }
  const id = crypto.randomUUID()
  const agentIndex = Math.random() < 0.5 ? 0 : 1
  sessionStorage.setItem(key, JSON.stringify({ id, agentIndex }))
  return { id, agentIndex }
}

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

export function SupportChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasUnread, setHasUnread] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const session = useRef(getOrCreateSession())
  const agent = AGENTS[session.current.agentIndex]
  const { user, status } = useAuth()

  const scrollBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
  }, [])

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `Olá! 👋 Sou o **${agent.name}**, seu atendente aqui no Shark Green. Posso te ajudar com dúvidas sobre procedimentos, como usar o app, ou qualquer outra coisa. O que você precisa?`,
      }])
    }
    if (open) {
      setHasUnread(false)
      setTimeout(() => inputRef.current?.focus(), 350)
    }
  }, [open])

  useEffect(() => { if (open) scrollBottom() }, [messages, open])

  async function send() {
    if (!input.trim() || loading || !user?.email) return
    const text = input.trim()
    setInput('')
    const ta = inputRef.current
    if (ta) { ta.style.height = 'auto' }
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    scrollBottom()

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      const token = authSession?.access_token ?? ANON_KEY

      const res = await fetch(`${SUPABASE_URL}/functions/v1/pwa-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: text,
          session_id: session.current.id,
          user_email: user.email,
          user_status: status,
          agent_name: agent.name,
        }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply ?? 'Desculpe, não consegui responder. Tente novamente!',
      }])
    } catch {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Ops, houve um problema de conexão. Tente novamente em instantes! 🦈',
      }])
    } finally {
      setLoading(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  function renderContent(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*)/)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
      }
      return <span key={i}>{part}</span>
    })
  }

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
            className="fixed z-50 flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full shadow-2xl"
            style={{
              bottom: 84,
              right: 16,
              background: 'linear-gradient(135deg, hsl(145 80% 36%), hsl(145 80% 26%))',
              border: '1px solid rgba(30,222,107,0.4)',
              boxShadow: '0 4px 24px rgba(30,222,107,0.35)',
            }}
          >
            <MessageCircle size={16} className="text-white" />
            <span className="text-xs font-bold text-white">Precisa de ajuda?</span>
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
            className="fixed z-50 flex flex-col"
            style={{
              inset: 0,
              background: 'rgba(8, 14, 22, 0.99)',
              backdropFilter: 'blur(24px)',
            }}
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
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} gap-2.5 items-end`}>
                  {m.role === 'assistant' && (
                    <AgentAvatar agent={agent} size={28} />
                  )}
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
              ))}

              {loading && (
                <div className="flex justify-start gap-2.5 items-end">
                  <AgentAvatar agent={agent} size={28} />
                  <div
                    className="rounded-2xl"
                    style={{
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '18px 18px 18px 4px',
                    }}
                  >
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
                onClick={send}
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

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, MessageCircle, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const SUPABASE_URL = 'https://wspsuempnswljkphatur.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzcHN1ZW1wbnN3bGprcGhhdHVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNTc1NTEsImV4cCI6MjA3NTkzMzU1MX0.zgEcoHFulNHrSxyHOZTbCCtDKfqjppHLRh1junsmsoA'

function getOrCreateSessionId(): string {
  const key = 'sg-chat-session'
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(key, id)
  }
  return id
}

function SharkIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M2 12 C4 6 10 3 16 5 C20 6.5 22 9 22 12 C22 15 20 17.5 17 19 L19 22 L14 19 C12 19.5 10 19.5 8 19 C4.5 17.5 2 15 2 12Z"
        fill="hsl(145 80% 48%)" opacity="0.9"/>
      <circle cx="16" cy="10" r="1.5" fill="white" opacity="0.9"/>
      <path d="M6 12 C7 10 9 9 11 10" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.6"/>
    </svg>
  )
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map(i => (
        <motion.span key={i} className="w-1.5 h-1.5 rounded-full"
          style={{ background: 'hsl(145 80% 48%)' }}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
          transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }} />
      ))}
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
  const sessionId = useRef(getOrCreateSessionId())
  const { user, status } = useAuth()

  const scrollBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
  }, [])

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: 'Olá! 👋 Sou o **Shark IA**, seu assistente virtual. Posso ajudar com dúvidas sobre procedimentos, como usar o app, ou qualquer outra coisa. O que você precisa?',
      }])
    }
    if (open) {
      setHasUnread(false)
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [open])

  useEffect(() => { if (open) scrollBottom() }, [messages, open])

  async function send() {
    if (!input.trim() || loading || !user?.email) return
    const text = input.trim()
    setInput('')
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    scrollBottom()

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ANON_KEY

      const res = await fetch(`${SUPABASE_URL}/functions/v1/pwa-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: text,
          session_id: sessionId.current,
          user_email: user.email,
          user_status: status,
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

  // Render inline markdown-like: **bold**
  function renderContent(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*)/)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>
      }
      return <span key={i}>{part}</span>
    })
  }

  return (
    <>
      {/* FAB — balão flutuante */}
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
              background: 'linear-gradient(135deg, hsl(145 80% 38%), hsl(145 80% 28%))',
              border: '1px solid rgba(30,222,107,0.4)',
              boxShadow: '0 4px 24px rgba(30,222,107,0.35)',
            }}
          >
            <SharkIcon size={18} />
            <span className="text-xs font-bold text-white">Precisa de ajuda?</span>
            {hasUnread && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 animate-ping" />
            )}
            {hasUnread && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500" />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Painel de chat */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }}
            className="fixed z-50 flex flex-col"
            style={{
              bottom: 80,
              left: 8,
              right: 8,
              height: '70dvh',
              maxHeight: 520,
              background: 'rgba(10, 18, 28, 0.98)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(30,222,107,0.2)',
              borderRadius: 20,
              boxShadow: '0 8px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(30,222,107,0.08)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-2.5 px-4 py-3 flex-shrink-0"
                 style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(30,222,107,0.05)' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                   style={{ background: 'rgba(30,222,107,0.15)', border: '1px solid rgba(30,222,107,0.3)' }}>
                <SharkIcon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white leading-tight">Shark IA</p>
                <p className="text-[10px]" style={{ color: 'hsl(145 80% 48%)' }}>● Online · assistente virtual</p>
              </div>
              <button onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                style={{ background: 'rgba(255,255,255,0.07)' }}>
                <X size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />
              </button>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto no-scrollbar px-3 py-3 space-y-2">
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
                  {m.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                         style={{ background: 'rgba(30,222,107,0.15)' }}>
                      <SharkIcon size={13} />
                    </div>
                  )}
                  <div className="max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed"
                       style={{
                         background: m.role === 'user'
                           ? 'linear-gradient(135deg, hsl(145 80% 32%), hsl(145 80% 24%))'
                           : 'rgba(255,255,255,0.06)',
                         color: 'rgba(255,255,255,0.9)',
                         borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                         border: m.role === 'assistant' ? '1px solid rgba(255,255,255,0.07)' : 'none',
                       }}>
                    {renderContent(m.content)}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                       style={{ background: 'rgba(30,222,107,0.15)' }}>
                    <SharkIcon size={13} />
                  </div>
                  <div className="rounded-2xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px 16px 16px 4px' }}>
                    <TypingDots />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="flex items-end gap-2 px-3 pb-3 pt-2 flex-shrink-0"
                 style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Digite sua dúvida..."
                rows={1}
                className="flex-1 resize-none text-xs rounded-xl px-3 py-2.5 outline-none no-scrollbar"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'white',
                  maxHeight: 80,
                  lineHeight: 1.5,
                }}
                onInput={e => {
                  const t = e.currentTarget
                  t.style.height = 'auto'
                  t.style.height = Math.min(t.scrollHeight, 80) + 'px'
                }}
              />
              <button
                onClick={send}
                disabled={!input.trim() || loading}
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 active:scale-90 transition-all"
                style={{
                  background: input.trim() && !loading ? 'hsl(145 80% 38%)' : 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}>
                {loading
                  ? <Loader2 size={15} className="animate-spin" style={{ color: 'hsl(145 80% 48%)' }} />
                  : <Send size={15} style={{ color: input.trim() ? 'white' : 'rgba(255,255,255,0.3)' }} />
                }
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

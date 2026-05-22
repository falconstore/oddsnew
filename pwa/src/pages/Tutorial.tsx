import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PlayCircle, ChevronDown, BookOpen, Lock } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

// ── Configuração das aulas ────────────────────────────────────────────────────
// Adicione novas aulas aqui. videoUrl aceita:
//   - URL de embed do YouTube:  'https://www.youtube.com/embed/SEU_ID'
//   - URL de embed do Vimeo:    'https://player.vimeo.com/video/SEU_ID'
//   - Arquivo mp4 local:        '/app/aulas/aula1.mp4'
// Deixe videoUrl vazio ('') para exibir a aula como "Em breve"
// ─────────────────────────────────────────────────────────────────────────────
const AULAS: {
  titulo: string
  descricao: string
  duracao?: string
  videoUrl: string
  soAssinante?: boolean
}[] = [
  {
    titulo: 'Aula 1 — Introdução ao Shark Green',
    descricao: 'Entenda como funciona o sistema, o que são procedimentos e como acompanhar os sinais em tempo real.',
    duracao: '',
    videoUrl: '',
  },
  {
    titulo: 'Aula 2 — Como executar um procedimento',
    descricao: 'Passo a passo para executar um procedimento na casa de apostas e maximizar seus resultados.',
    duracao: '',
    videoUrl: '',
  },
  {
    titulo: 'Aula 3 — Freebets e como aproveitá-las',
    descricao: 'Aprenda a identificar e usar freebets para aumentar o lucro sem arriscar capital próprio.',
    duracao: '',
    videoUrl: '',
    soAssinante: true,
  },
]
// ─────────────────────────────────────────────────────────────────────────────

function VideoPlayer({ url }: { url: string }) {
  const isMp4 = /\.(mp4|webm|ogg)(\?|$)/i.test(url)
  if (isMp4) {
    return (
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className="w-full rounded-xl bg-black"
        style={{ maxHeight: 260, display: 'block' }}
      />
    )
  }
  return (
    <div className="w-full rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
      <iframe
        src={url}
        title="Aula"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        className="w-full h-full border-0"
      />
    </div>
  )
}

export function Tutorial() {
  const [aberto, setAberto] = useState<number | null>(null)
  const { status } = useAuth()
  const isSubscriber = status === 'active_subscriber'

  function toggle(i: number) {
    const aula = AULAS[i]
    if (aula.soAssinante && !isSubscriber) return
    setAberto(prev => prev === i ? null : i)
  }

  return (
    <div className="h-full overflow-y-auto no-scrollbar bg-[#070e1a]">
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 pt-5 pb-3"
           style={{ background: 'rgba(7,14,26,0.95)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
               style={{ background: 'rgba(30,222,107,0.12)', border: '1px solid rgba(30,222,107,0.2)' }}>
            <BookOpen size={16} style={{ color: 'hsl(145 80% 48%)' }} />
          </div>
          <div>
            <h1 className="font-bold text-white text-base leading-tight">Tutorial</h1>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {AULAS.length} aula{AULAS.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Lista de aulas */}
      <div className="px-4 pt-4 pb-24 space-y-3">
        {AULAS.map((aula, i) => {
          const isOpen = aberto === i
          const bloqueada = aula.soAssinante && !isSubscriber
          const semVideo = !aula.videoUrl

          return (
            <motion.div
              key={i}
              layout
              className="rounded-2xl overflow-hidden"
              style={{
                border: isOpen
                  ? '1px solid rgba(30,222,107,0.25)'
                  : '1px solid rgba(255,255,255,0.07)',
                background: isOpen ? 'rgba(30,222,107,0.04)' : 'rgba(255,255,255,0.03)',
              }}
            >
              {/* Cabeçalho da aula */}
              <button
                onClick={() => toggle(i)}
                className="w-full flex items-start gap-3 px-4 py-4 text-left"
                disabled={bloqueada || semVideo}
              >
                {/* Número / ícone */}
                <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center mt-0.5"
                     style={{
                       background: bloqueada
                         ? 'rgba(255,255,255,0.05)'
                         : isOpen
                           ? 'rgba(30,222,107,0.15)'
                           : 'rgba(30,222,107,0.08)',
                       border: `1px solid ${bloqueada ? 'rgba(255,255,255,0.1)' : isOpen ? 'rgba(30,222,107,0.3)' : 'rgba(30,222,107,0.15)'}`,
                     }}>
                  {bloqueada ? (
                    <Lock size={15} style={{ color: 'rgba(255,255,255,0.3)' }} />
                  ) : semVideo ? (
                    <span className="text-[11px] font-bold" style={{ color: 'rgba(255,255,255,0.25)' }}>{i + 1}</span>
                  ) : (
                    <PlayCircle size={17} style={{ color: isOpen ? 'hsl(145 80% 48%)' : 'rgba(30,222,107,0.6)' }} />
                  )}
                </div>

                {/* Texto */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-snug"
                     style={{ color: bloqueada ? 'rgba(255,255,255,0.3)' : semVideo ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.9)' }}>
                    {aula.titulo}
                  </p>
                  <p className="text-[11px] mt-0.5 leading-relaxed line-clamp-2"
                     style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {aula.descricao}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {aula.duracao && (
                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{aula.duracao}</span>
                    )}
                    {bloqueada && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                            style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
                        Assinantes
                      </span>
                    )}
                    {semVideo && !bloqueada && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        Em breve
                      </span>
                    )}
                  </div>
                </div>

                {/* Chevron */}
                {!bloqueada && !semVideo && (
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex-shrink-0 mt-1"
                  >
                    <ChevronDown size={16} style={{ color: isOpen ? 'hsl(145 80% 48%)' : 'rgba(255,255,255,0.25)' }} />
                  </motion.div>
                )}
              </button>

              {/* Player expandido */}
              <AnimatePresence initial={false}>
                {isOpen && aula.videoUrl && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div className="px-4 pb-4">
                      <VideoPlayer url={aula.videoUrl} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

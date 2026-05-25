import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PlayCircle, ChevronDown, BookOpen, Lock, Layers } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

type Aula = {
  titulo: string
  descricao: string
  duracao?: string
  videoUrl: string
  soAssinante?: boolean
  isShort?: boolean
}

type Modulo = {
  titulo: string
  descricao: string
  icon?: string
  aulas: Aula[]
}

const MODULOS: Modulo[] = [
  {
    titulo: 'Módulo 1 — Procedimentos',
    descricao: 'Como ler e executar cada tipo de procedimento do Shark Green',
    icon: '🎯',
    aulas: [
      {
        titulo: 'Aula 1 — Leitura do Procedimento',
        descricao: 'Entenda como interpretar cada campo do procedimento: plataforma, tipo, status e o que fazer em cada etapa.',
        videoUrl: 'https://www.youtube.com/embed/POxz_UJM9ec',
      },
      {
        titulo: 'Aula 2 — Procedimento para Ganhar uma Freebet',
        descricao: 'Passo a passo para executar um procedimento do tipo GANHAR FB e garantir freebets nas casas de apostas.',
        videoUrl: 'https://www.youtube.com/embed/_PuI-OERb8s',
      },
      {
        titulo: 'Aula 3 — Procedimento de Apostas Sem Risco (ASR)',
        descricao: 'Como executar corretamente os procedimentos ASR, aproveitando promoções de aposta grátis sem arriscar capital.',
        videoUrl: 'https://www.youtube.com/embed/aBVgBaL9AKM',
      },
      {
        titulo: 'Aula 4 — Procedimento para Ganhar Giros Grátis',
        descricao: 'Veja como aproveitar promoções de giros grátis e converter em lucro garantido.',
        videoUrl: 'https://www.youtube.com/embed/JYH8erPlplM',
      },
      {
        titulo: 'Aula 5 — Super Odds e Lucros Diretos',
        descricao: 'Como executar procedimentos do tipo SUPER ODD e Lucro Direto para resultados rápidos.',
        videoUrl: 'https://www.youtube.com/embed/5qHDxRfswmE',
        isShort: true,
      },
    ],
  },
  {
    titulo: 'Módulo 2 — Casas de Apostas',
    descricao: 'Como acessar, sacar e operar nas principais casas parceiras',
    icon: '🏦',
    aulas: [
      {
        titulo: 'Acessar Bet365 Sem Derrubar',
        descricao: 'Como entrar na Bet365 sem cair no bloqueio — técnica passo a passo.',
        videoUrl: 'https://www.youtube.com/embed/aFyhBwSFcIA',
      },
      {
        titulo: 'Saque Bet365 Sem Facial',
        descricao: 'Como realizar saques na Bet365 sem precisar passar pela verificação facial.',
        videoUrl: 'https://www.youtube.com/embed/z-4_y2VFDII',
        isShort: true,
      },
      {
        titulo: 'Como Funciona a BetBra',
        descricao: 'Apresentação da BetBra — nossa parceira com a menor taxa do mercado (2,25%).',
        videoUrl: 'https://www.youtube.com/embed/2v7tjg7B2i8',
      },
      {
        titulo: 'Saque Betano Sem Facial',
        descricao: 'Como sacar na Betano sem verificação facial — rápido e direto.',
        videoUrl: 'https://www.youtube.com/embed/nTMCvgLBA8w',
        isShort: true,
      },
    ],
  },
  {
    titulo: 'Módulo 3 — LD Player',
    descricao: 'Emulador Android para operar com múltiplos CPFs no computador',
    icon: '💻',
    aulas: [
      {
        titulo: 'Download do LD Player',
        descricao: 'Como baixar e instalar o emulador LD Player para iniciar sua operação.',
        videoUrl: 'https://www.youtube.com/embed/mxaVPJw8Yho',
      },
      {
        titulo: 'Configurando Instância no LD Player',
        descricao: 'Como criar e configurar instâncias separadas para cada CPF no LD Player.',
        videoUrl: 'https://www.youtube.com/embed/2hzRNW-83Xs',
      },
      {
        titulo: 'Instalando e Configurando o App',
        descricao: 'Como instalar o app Shark Green dentro do LD Player e configurar corretamente.',
        videoUrl: 'https://www.youtube.com/embed/5WTmKtn2v4g',
      },
    ],
  },
  {
    titulo: 'Módulo 4 — Dolphin Anty',
    descricao: 'Navegador anti-detecção para operar com múltiplos perfis no browser',
    icon: '🐬',
    aulas: [
      {
        titulo: 'Download e Instalação do Dolphin Anty',
        descricao: 'Como baixar e instalar o Dolphin Anty para criar perfis de navegação isolados.',
        videoUrl: 'https://www.youtube.com/embed/dDqeCutizGM',
      },
      {
        titulo: 'Configurando o Dolphin para Operação',
        descricao: 'Como configurar os perfis do Dolphin Anty prontos para executar procedimentos.',
        videoUrl: 'https://www.youtube.com/embed/W_VszeigrqM',
      },
    ],
  },
]

const totalAulas = MODULOS.reduce((acc, m) => acc + m.aulas.length, 0)

function VideoPlayer({ url, isShort }: { url: string; isShort?: boolean }) {
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
  if (isShort) {
    return (
      <div className="flex justify-center">
        <div className="rounded-xl overflow-hidden" style={{ width: '56%', aspectRatio: '9/16' }}>
          <iframe
            src={url}
            title="Aula"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="w-full h-full border-0"
          />
        </div>
      </div>
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
  const [moduloAberto, setModuloAberto] = useState<number | null>(0)
  const [aulaAberta, setAulaAberta] = useState<{ mod: number; aula: number } | null>(null)
  const { status } = useAuth()
  const isSubscriber = status === 'active_subscriber'

  function toggleModulo(i: number) {
    setModuloAberto(prev => prev === i ? null : i)
    setAulaAberta(null)
  }

  function toggleAula(modIdx: number, aulaIdx: number) {
    const aula = MODULOS[modIdx].aulas[aulaIdx]
    if (aula.soAssinante && !isSubscriber) return
    if (!aula.videoUrl) return
    setAulaAberta(prev =>
      prev?.mod === modIdx && prev?.aula === aulaIdx ? null : { mod: modIdx, aula: aulaIdx }
    )
  }

  return (
    <div className="h-full overflow-y-auto no-scrollbar bg-[#070e1a]">
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-4 pt-5 pb-3"
        style={{ background: 'rgba(7,14,26,0.95)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(30,222,107,0.12)', border: '1px solid rgba(30,222,107,0.2)' }}
          >
            <BookOpen size={16} style={{ color: 'hsl(145 80% 48%)' }} />
          </div>
          <div>
            <h1 className="font-bold text-white text-base leading-tight">Tutorial</h1>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {MODULOS.length} módulos · {totalAulas} aulas
            </p>
          </div>
        </div>
      </div>

      {/* Módulos */}
      <div className="px-4 pt-4 pb-24 space-y-3">
        {MODULOS.map((modulo, modIdx) => {
          const isModOpen = moduloAberto === modIdx

          return (
            <motion.div
              key={modIdx}
              layout
              className="rounded-2xl overflow-hidden"
              style={{
                border: isModOpen
                  ? '1px solid rgba(30,222,107,0.3)'
                  : '1px solid rgba(255,255,255,0.08)',
                background: isModOpen ? 'rgba(30,222,107,0.03)' : 'rgba(255,255,255,0.03)',
              }}
            >
              {/* Cabeçalho do módulo */}
              <button
                onClick={() => toggleModulo(modIdx)}
                className="w-full flex items-center gap-3 px-4 py-4 text-left"
              >
                {/* Ícone do módulo */}
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                  style={{
                    background: isModOpen ? 'rgba(30,222,107,0.15)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${isModOpen ? 'rgba(30,222,107,0.3)' : 'rgba(255,255,255,0.1)'}`,
                  }}
                >
                  {modulo.icon}
                </div>

                {/* Texto */}
                <div className="flex-1 min-w-0">
                  <p
                    className="font-bold text-sm leading-tight"
                    style={{ color: isModOpen ? 'hsl(145 80% 55%)' : 'rgba(255,255,255,0.9)' }}
                  >
                    {modulo.titulo}
                  </p>
                  <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {modulo.descricao}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Layers size={10} style={{ color: 'rgba(255,255,255,0.3)' }} />
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {modulo.aulas.length} aula{modulo.aulas.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Chevron */}
                <motion.div
                  animate={{ rotate: isModOpen ? 180 : 0 }}
                  transition={{ duration: 0.22 }}
                  className="flex-shrink-0"
                >
                  <ChevronDown size={18} style={{ color: isModOpen ? 'hsl(145 80% 48%)' : 'rgba(255,255,255,0.25)' }} />
                </motion.div>
              </button>

              {/* Aulas dentro do módulo */}
              <AnimatePresence initial={false}>
                {isModOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div
                      className="mx-4 mb-4 space-y-2 pt-0"
                      style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      {modulo.aulas.map((aula, aulaIdx) => {
                        const isAulaOpen = aulaAberta?.mod === modIdx && aulaAberta?.aula === aulaIdx
                        const bloqueada = aula.soAssinante && !isSubscriber
                        const semVideo = !aula.videoUrl

                        return (
                          <motion.div
                            key={aulaIdx}
                            layout
                            className="rounded-xl overflow-hidden mt-2"
                            style={{
                              border: isAulaOpen
                                ? '1px solid rgba(30,222,107,0.2)'
                                : '1px solid rgba(255,255,255,0.06)',
                              background: isAulaOpen ? 'rgba(30,222,107,0.04)' : 'rgba(255,255,255,0.03)',
                            }}
                          >
                            {/* Cabeçalho da aula */}
                            <button
                              onClick={() => toggleAula(modIdx, aulaIdx)}
                              className="w-full flex items-start gap-3 px-3 py-3 text-left"
                              disabled={bloqueada || semVideo}
                            >
                              {/* Ícone play / lock */}
                              <div
                                className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
                                style={{
                                  background: bloqueada
                                    ? 'rgba(255,255,255,0.04)'
                                    : isAulaOpen
                                      ? 'rgba(30,222,107,0.15)'
                                      : 'rgba(30,222,107,0.08)',
                                  border: `1px solid ${bloqueada ? 'rgba(255,255,255,0.08)' : isAulaOpen ? 'rgba(30,222,107,0.3)' : 'rgba(30,222,107,0.15)'}`,
                                }}
                              >
                                {bloqueada ? (
                                  <Lock size={13} style={{ color: 'rgba(255,255,255,0.25)' }} />
                                ) : semVideo ? (
                                  <span className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.2)' }}>
                                    {aulaIdx + 1}
                                  </span>
                                ) : (
                                  <PlayCircle size={15} style={{ color: isAulaOpen ? 'hsl(145 80% 48%)' : 'rgba(30,222,107,0.6)' }} />
                                )}
                              </div>

                              {/* Texto */}
                              <div className="flex-1 min-w-0">
                                <p
                                  className="font-semibold text-xs leading-snug"
                                  style={{ color: bloqueada ? 'rgba(255,255,255,0.3)' : semVideo ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.88)' }}
                                >
                                  {aula.titulo}
                                </p>
                                <p className="text-[10px] mt-0.5 leading-relaxed line-clamp-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                  {aula.descricao}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  {aula.duracao && (
                                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                                      {aula.duracao}
                                    </span>
                                  )}
                                  {aula.isShort && (
                                    <span
                                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                                      style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
                                    >
                                      SHORT
                                    </span>
                                  )}
                                  {bloqueada && (
                                    <span
                                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                                      style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}
                                    >
                                      Assinantes
                                    </span>
                                  )}
                                  {semVideo && !bloqueada && (
                                    <span
                                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                                      style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}
                                    >
                                      Em breve
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Chevron aula */}
                              {!bloqueada && !semVideo && (
                                <motion.div
                                  animate={{ rotate: isAulaOpen ? 180 : 0 }}
                                  transition={{ duration: 0.18 }}
                                  className="flex-shrink-0 mt-1"
                                >
                                  <ChevronDown size={14} style={{ color: isAulaOpen ? 'hsl(145 80% 48%)' : 'rgba(255,255,255,0.2)' }} />
                                </motion.div>
                              )}
                            </button>

                            {/* Player */}
                            <AnimatePresence initial={false}>
                              {isAulaOpen && aula.videoUrl && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                                  style={{ overflow: 'hidden' }}
                                >
                                  <div className="px-3 pb-3">
                                    <VideoPlayer url={aula.videoUrl} isShort={aula.isShort} />
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        )
                      })}
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

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, ExternalLink, KeyRound, Download, Share2, Plus, Smartphone, ChevronDown } from 'lucide-react';

// ── Configuração fácil ──────────────────────────────────────────────────────
// Cole aqui a URL de embed da VSL (ex: YouTube, Vimeo, Panda Video…)
// Deixe vazio para ocultar o player até ter a URL.
const VSL_EMBED_URL = '';

// URL do APK Android — deixe vazio para ocultar o botão de download
const APK_DOWNLOAD_URL = '';

// URL do PWA para o guia iOS — deixe vazio para ocultar a seção
const PWA_URL = '';

const SUPABASE_URL = import.meta.env.VITE_MAIN_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_MAIN_SUPABASE_ANON_KEY as string;
const PIXEL_ID = '1672225667108236';
const PIXEL_SCRIPT_SRC = 'https://connect.facebook.net/en_US/fbevents.js';
const PIXEL_SCRIPT_DATA_ATTR = 'data-obrigado-pixel';

const SESSION_KEY = 'trial_success';

interface TrialSuccess {
  botStartUrl: string;
  inviteLink: string;
  leadEventId?: string;
  email?: string;
  initialPassword?: string;
}

interface FbqStub {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: FbqStub;
  loaded: boolean;
  version: string;
}

type Track4YouFn = (eventName: string, params?: Record<string, unknown>) => void;

declare global {
  interface Window {
    fbq?: FbqStub;
    _fbq?: FbqStub;
    t4y?: Track4YouFn;
    track4you?: Track4YouFn;
    T4Y?: { track?: Track4YouFn } | Track4YouFn;
  }
}

function makeEventId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fallback */
  }
  return `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function initPixel() {
  if (typeof window === 'undefined') return;
  if (typeof window.fbq === 'function') return;
  try {
    const stub = function (...args: unknown[]) {
      if ((stub as unknown as FbqStub).callMethod) {
        (stub as unknown as FbqStub).callMethod!.apply(stub, args);
      } else {
        (stub as unknown as FbqStub).queue.push(args);
      }
    } as unknown as FbqStub;
    stub.queue = [];
    stub.loaded = true;
    stub.version = '2.0';
    stub.push = stub;
    window.fbq = stub;
    if (!window._fbq) window._fbq = stub;
    const script = document.createElement('script');
    script.async = true;
    script.src = PIXEL_SCRIPT_SRC;
    script.setAttribute(PIXEL_SCRIPT_DATA_ATTR, '1');
    const first = document.getElementsByTagName('script')[0];
    first?.parentNode?.insertBefore(script, first);
    window.fbq('init', PIXEL_ID);
  } catch {
    /* adblock / pixel indisponível */
  }
}

function trackPixelLead(savedEventId?: string) {
  if (typeof window === 'undefined') return;
  const eventId = makeEventId();

  try {
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'Lead', { content_name: 'trial-7d' }, { eventID: eventId });
    }
  } catch {
    /* adblock / pixel não carregado — ignora */
  }

  if (SUPABASE_URL && SUPABASE_ANON) {
    fetch(`${SUPABASE_URL}/functions/v1/trial-pixel-track`, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON,
      },
      body: JSON.stringify({
        event_name: 'Lead',
        event_id: eventId,
        event_source_url: typeof window !== 'undefined' ? window.location.href : null,
        source: 'trial-obrigado',
        fbp: readCookie('_fbp'),
        fbc: readCookie('_fbc'),
        custom_data: savedEventId ? { lead_event_id: savedEventId } : undefined,
      }),
    }).catch(() => {});
  }
}

function trackT4Y(eventName: string, params: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  try {
    const w = window;
    if (typeof w.t4y === 'function') {
      w.t4y(eventName, params);
    } else if (typeof w.track4you === 'function') {
      w.track4you(eventName, params);
    } else if (typeof w.T4Y === 'function') {
      (w.T4Y as Track4YouFn)(eventName, params);
    } else if (w.T4Y && typeof (w.T4Y as { track?: Track4YouFn }).track === 'function') {
      (w.T4Y as { track: Track4YouFn }).track(eventName, params);
    }
    try {
      window.dispatchEvent(
        new CustomEvent('t4y:event', { detail: { name: eventName, params } }),
      );
    } catch {
      /* ignora */
    }
  } catch {
    /* nunca propaga */
  }
}

export default function TrialObrigado() {
  const navigate = useNavigate();

  let trialData: TrialSuccess | null = null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      trialData = JSON.parse(raw) as TrialSuccess;
    }
  } catch {
    /* sessionStorage indisponível */
  }

  useEffect(() => {
    if (!trialData?.botStartUrl) {
      navigate('/', { replace: true });
      return;
    }

    document.title = 'Obrigado — Shark 100% Green';

    initPixel();

    const run = () => trackPixelLead(trialData?.leadEventId);
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(run, { timeout: 1500 });
    } else {
      setTimeout(run, 500);
    }
  }, []);

  if (!trialData?.botStartUrl) return null;

  const { botStartUrl, inviteLink, email, initialPassword } = trialData;

  const handleBotClick = () => {
    trackT4Y('cta_telegram', {
      button: 'bot_start_obrigado',
      destination: 'trial_bot',
      url: botStartUrl,
    });
  };

  return (
    <div
      className="min-h-screen text-white flex flex-col items-center"
      style={{ backgroundColor: 'hsl(150 30% 4%)', minHeight: '100svh' }}
      data-testid="page-obrigado"
    >
      {/* Glow de fundo */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-emerald-500/12 blur-[160px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-emerald-400/8 blur-[140px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-emerald-500/20 bg-[hsl(150_35%_3%/0.92)] backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-center">
          <SharkLogo />
        </div>
      </header>

      {/* Conteúdo principal */}
      <main className="relative z-10 w-full max-w-3xl mx-auto px-4 pt-10 pb-20 flex flex-col items-center gap-8">

        {/* Badge de confirmação */}
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-sm font-semibold"
          data-testid="badge-success"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Cadastro confirmado · Acesso liberado
        </div>

        {/* Headline */}
        <h1
          className="text-center text-[1.55rem] sm:text-[1.9rem] md:text-[2.25rem] font-bold leading-[1.3] tracking-tight max-w-2xl"
          data-testid="text-obrigado-headline"
        >
          Comece por Aqui e Aprenda a Fazer{' '}
          <span className="bg-gradient-to-r from-emerald-300 via-green-400 to-emerald-500 bg-clip-text text-transparent whitespace-nowrap">
            R$&nbsp;200 no dia
          </span>{' '}
          sem dor de cabeça e sem vender nada pra ninguém...
        </h1>

        {/* Bloco VSL */}
        {VSL_EMBED_URL ? (
          <div
            className="w-full rounded-2xl overflow-hidden border border-emerald-500/25 shadow-2xl shadow-emerald-500/10"
            style={{ aspectRatio: '16/9' }}
            data-testid="block-vsl"
          >
            <iframe
              src={VSL_EMBED_URL}
              title="VSL — Shark 100% Green"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              className="w-full h-full border-0"
            />
          </div>
        ) : (
          <div
            className="w-full rounded-2xl border-2 border-dashed border-emerald-500/30 bg-emerald-500/5 flex flex-col items-center justify-center gap-3 py-16 px-8 text-center"
            style={{ aspectRatio: '16/9' }}
            data-testid="block-vsl-placeholder"
          >
            <div className="text-emerald-400/60 text-4xl">▶</div>
            <p className="text-white/40 text-sm">
              VSL em breve — cole a URL em <code className="bg-white/10 px-1 rounded text-xs">VSL_EMBED_URL</code> no topo do arquivo
            </p>
          </div>
        )}

        {/* Card de credenciais do PWA */}
        {email && (
          <div
            className="w-full max-w-md rounded-2xl border border-emerald-500/25 bg-white/3 backdrop-blur-sm px-6 py-5 space-y-4"
            data-testid="card-credentials"
          >
            <div className="flex items-center gap-2 text-emerald-300">
              <KeyRound className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-semibold uppercase tracking-wide">Acesse o App</span>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">E-mail</p>
                <p className="text-white font-mono text-sm break-all" data-testid="text-credential-email">{email}</p>
              </div>
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Senha inicial</p>
                <p className="text-white font-mono text-sm tracking-widest" data-testid="text-credential-password">{initialPassword}</p>
              </div>
            </div>
            <p className="text-[11px] text-white/45 leading-relaxed border-t border-white/8 pt-3">
              Na primeira entrada, você será solicitado a criar uma nova senha.
            </p>
          </div>
        )}

        {/* Blocos de instalação (Android + iOS) */}
        {email && (APK_DOWNLOAD_URL || PWA_URL) && (
          <div className="w-full max-w-md flex flex-col sm:flex-row gap-3" data-testid="block-install">

            {/* Android APK */}
            {APK_DOWNLOAD_URL && (
              <a
                href={APK_DOWNLOAD_URL}
                download
                onClick={() => trackT4Y('cta_apk_download', { url: APK_DOWNLOAD_URL })}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-4 font-bold text-sm text-black bg-gradient-to-r from-emerald-400 to-green-500 shadow-lg shadow-emerald-500/30 transition-transform hover:scale-[1.02] active:scale-[0.98]"
                data-testid="link-apk-download"
              >
                <Download className="w-4 h-4 flex-shrink-0" />
                📲 Baixar o App (Android)
              </a>
            )}

            {/* iOS guia */}
            {PWA_URL && <IosInstallAccordion pwaUrl={PWA_URL} />}

          </div>
        )}

        {/* Botão pulsante */}
        <a
          href={botStartUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleBotClick}
          className="pulse-glow-btn relative w-full max-w-md flex items-center justify-center gap-2 rounded-xl px-4 py-5 font-extrabold text-sm sm:text-base md:text-lg uppercase tracking-wide text-black bg-gradient-to-r from-emerald-400 to-green-500 shadow-xl shadow-emerald-500/40 transition-transform hover:scale-[1.02] active:scale-[0.98]"
          data-testid="link-bot-start-obrigado"
        >
          <Send className="w-5 h-5 flex-shrink-0" />
          ACESSAR GRUPO + CURSO GRÁTIS
        </a>

        {/* Instrução rápida */}
        <p className="text-white/55 text-sm text-center max-w-sm">
          Clique no botão acima, abra o bot no Telegram e toque em <strong className="text-white">Iniciar</strong> — o link do grupo VIP chega em segundos.
        </p>

        {/* Fallback colapsável */}
        <details
          className="w-full max-w-md rounded-xl border border-emerald-500/20 bg-white/3 px-4 py-3"
          data-testid="details-fallback"
        >
          <summary className="text-xs text-white/45 cursor-pointer select-none hover:text-white/65 transition-colors">
            Não conseguiu abrir o bot? Acesse diretamente o grupo VIP
          </summary>
          <div className="mt-3 space-y-2">
            <a
              href={inviteLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-emerald-300 underline underline-offset-2 break-all hover:text-emerald-200"
              data-testid="link-invite-fallback-obrigado"
              onClick={() =>
                trackT4Y('cta_telegram', {
                  button: 'invite_fallback_obrigado',
                  destination: 'vip_invite',
                  url: inviteLink,
                })
              }
            >
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
              {inviteLink}
            </a>
            <p className="text-[10px] text-white/35">
              Atenção: pelo link direto você não recebe os avisos automáticos do bot durante o trial.
            </p>
          </div>
        </details>

      </main>

      {/* Meta Pixel noscript fallback */}
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=Lead&noscript=1`}
          alt=""
        />
      </noscript>

      {/* Estilos da animação pulse-glow */}
      <style>{`
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 18px 2px rgba(52, 211, 153, 0.55), 0 0 40px 6px rgba(52, 211, 153, 0.20);
          }
          50% {
            box-shadow: 0 0 32px 8px rgba(52, 211, 153, 0.80), 0 0 70px 18px rgba(52, 211, 153, 0.35);
          }
        }
        .pulse-glow-btn {
          animation: pulse-glow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

function IosInstallAccordion({ pwaUrl }: { pwaUrl: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex-1 rounded-xl border border-emerald-500/20 bg-white/3 overflow-hidden" data-testid="accordion-ios-install">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-4 text-sm font-semibold text-white/80 hover:text-white transition-colors"
        aria-expanded={open}
        data-testid="button-ios-install-toggle"
      >
        <span className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          Instalar no iPhone
        </span>
        <ChevronDown className={`w-4 h-4 text-white/40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/8 pt-3">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 text-emerald-300 text-xs font-bold">1</div>
            <div>
              <p className="text-xs font-semibold text-white/80">Abra o link no Safari</p>
              <a
                href={pwaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-emerald-400 underline underline-offset-2 break-all hover:text-emerald-300"
                data-testid="link-pwa-safari"
              >
                {pwaUrl}
              </a>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 text-emerald-300 text-xs font-bold">2</div>
            <div>
              <p className="text-xs font-semibold text-white/80">Toque no ícone de compartilhar</p>
              <p className="text-[11px] text-white/45 flex items-center gap-1 mt-0.5">
                <Share2 className="w-3 h-3 text-white/40" /> Ícone de caixa com seta (barra inferior)
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 text-emerald-300 text-xs font-bold">3</div>
            <div>
              <p className="text-xs font-semibold text-white/80">Toque em "Adicionar à Tela de Início"</p>
              <p className="text-[11px] text-white/45 flex items-center gap-1 mt-0.5">
                <Plus className="w-3 h-3 text-white/40" /> Role a lista de opções até encontrar
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SharkLogo() {
  return (
    <div className="flex items-center gap-2.5" data-testid="logo-shark-obrigado">
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="sharkGradOb" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <path
          d="M4 26 C4 26 8 10 16 6 C16 6 13 16 20 20 C20 20 14 22 12 26 Z"
          fill="url(#sharkGradOb)"
        />
        <path
          d="M12 26 C12 26 14 18 22 18 C26 18 28 22 28 26 Z"
          fill="url(#sharkGradOb)"
          opacity="0.7"
        />
        <path
          d="M2 26 L30 26"
          stroke="url(#sharkGradOb)"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.5"
        />
      </svg>
      <span className="font-extrabold text-lg tracking-tight leading-none">
        SHARK{' '}
        <span className="bg-gradient-to-r from-emerald-300 to-green-400 bg-clip-text text-transparent">
          GREEN
        </span>
      </span>
    </div>
  );
}

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';

// ── Configuração ──────────────────────────────────────────────────────────────
const VSL_EMBED_URL = '/vsl.mp4';

// Número WhatsApp da equipe (55 + DDD + número, só dígitos)
const ZAPI_WHATSAPP_NUMBER = '5545988407803';

// Mensagem pré-programada que abre no WhatsApp do lead
const WHATSAPP_PREFILL = encodeURIComponent(
  'Me cadastrei no trial e quero usar meus 7 dias e baixar o app 🦈',
);

const PIXEL_ID = '1672225667108236';
const PIXEL_SCRIPT_SRC = 'https://connect.facebook.net/en_US/fbevents.js';
const PIXEL_SCRIPT_DATA_ATTR = 'data-obrigado-pixel';
const SUPABASE_URL = import.meta.env.VITE_MAIN_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_MAIN_SUPABASE_ANON_KEY as string;
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
    adscala_sendConversion?: (pedidoId: string | number, valor: number) => void;
    multiads_sendConversion?: (pedidoId: string | number, valor: number) => void;
  }
}

function makeEventId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch { /* fallback */ }
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
  } catch { /* adblock */ }
}

function trackPixelLead(savedEventId?: string) {
  if (typeof window === 'undefined') return;
  const eventId = makeEventId();
  try {
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'Lead', { content_name: 'trial-7d' }, { eventID: eventId });
    }
  } catch { /* adblock */ }

  if (SUPABASE_URL && SUPABASE_ANON) {
    fetch(`${SUPABASE_URL}/functions/v1/trial-pixel-track`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
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
    if (typeof w.t4y === 'function') w.t4y(eventName, params);
    else if (typeof w.track4you === 'function') w.track4you(eventName, params);
    else if (typeof w.T4Y === 'function') (w.T4Y as Track4YouFn)(eventName, params);
    else if (w.T4Y && typeof (w.T4Y as { track?: Track4YouFn }).track === 'function')
      (w.T4Y as { track: Track4YouFn }).track(eventName, params);
    try {
      window.dispatchEvent(new CustomEvent('t4y:event', { detail: { name: eventName, params } }));
    } catch { /* ignora */ }
  } catch { /* nunca propaga */ }
}

export default function TrialObrigado() {
  const navigate = useNavigate();

  let trialData: TrialSuccess | null = null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) trialData = JSON.parse(raw) as TrialSuccess;
  } catch { /* sessionStorage indisponível */ }

  // Preview mode — permite visualizar a página sem sessão ativa
  const isPreview = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === '1';
  if (isPreview && !trialData) {
    trialData = { botStartUrl: 'https://t.me/sharkbot?start=preview', inviteLink: '#', email: 'seuemail@gmail.com', initialPassword: '5545988407803' };
  }

  useEffect(() => {
    if (!trialData?.botStartUrl) {
      navigate('/', { replace: true });
      return;
    }
    document.title = 'Obrigado — Shark 100% Green';
    initPixel();
    const run = () => {
      trackPixelLead(trialData?.leadEventId);
      // AdScala: dispara conversão server-side quando lead confirma cadastro
      try {
        const pedidoId = trialData?.leadEventId ?? Date.now();
        window.adscala_sendConversion?.(pedidoId, 0);
        window.multiads_sendConversion?.(pedidoId, 0);
      } catch { /* nunca propaga — adblock ou cookie bloqueado */ }
    };
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(run, { timeout: 1500 });
    } else {
      setTimeout(run, 500);
    }
  }, []);

  if (!trialData?.botStartUrl) return null;

  const waUrl = `https://wa.me/${ZAPI_WHATSAPP_NUMBER}?text=${WHATSAPP_PREFILL}`;

  const handleWaClick = () => {
    trackT4Y('cta_whatsapp', {
      button: 'whatsapp_obrigado',
      destination: 'zapi_funil',
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

        {/* VSL */}
        {VSL_EMBED_URL ? (
          <div
            className="w-full rounded-2xl overflow-hidden border border-emerald-500/25 shadow-2xl shadow-emerald-500/10"
            style={{ aspectRatio: '16/9' }}
            data-testid="block-vsl"
          >
            {VSL_EMBED_URL.match(/\.(mp4|webm|ogg)(\?|$)/i) ? (
              <video
                src={VSL_EMBED_URL}
                controls
                playsInline
                preload="metadata"
                className="w-full h-full object-contain bg-black"
                style={{ display: 'block' }}
              />
            ) : (
              <iframe
                src={VSL_EMBED_URL}
                title="VSL — Shark 100% Green"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0"
              />
            )}
          </div>
        ) : (
          <div
            className="w-full rounded-2xl border-2 border-dashed border-emerald-500/30 bg-emerald-500/5 flex flex-col items-center justify-center gap-3 py-16 px-8 text-center"
            style={{ aspectRatio: '16/9' }}
            data-testid="block-vsl-placeholder"
          >
            <div className="text-emerald-400/60 text-4xl">▶</div>
            <p className="text-white/40 text-sm">
              VSL em breve — cole a URL em <code className="bg-white/10 px-1 rounded text-xs">VSL_EMBED_URL</code>
            </p>
          </div>
        )}

        {/* Instrução */}
        <p className="text-white/70 text-base text-center max-w-sm leading-relaxed">
          👇 Clique no botão abaixo para receber seu acesso direto no WhatsApp
        </p>

        {/* Botão WhatsApp — único CTA */}
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleWaClick}
          className="pulse-glow-btn relative w-full max-w-md flex items-center justify-center gap-3 rounded-xl px-6 py-5 font-extrabold text-base sm:text-lg uppercase tracking-wide text-black bg-gradient-to-r from-emerald-400 to-green-500 shadow-xl shadow-emerald-500/40 transition-transform hover:scale-[1.02] active:scale-[0.98]"
          data-testid="link-whatsapp-obrigado"
        >
          {/* WhatsApp icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-6 h-6 flex-shrink-0"
            aria-hidden="true"
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Quero meu acesso agora
        </a>

        {/* Sub-texto explicativo */}
        <p className="text-white/45 text-sm text-center max-w-xs leading-relaxed">
          Você receberá o link do Telegram VIP e/ou as instruções do App diretamente no seu WhatsApp 📲
        </p>

      </main>

      {/* Meta Pixel noscript */}
      <noscript>
        <img
          height="1" width="1" style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=Lead&noscript=1`}
          alt=""
        />
      </noscript>

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

function SharkLogo() {
  return (
    <div className="flex items-center gap-2.5" data-testid="logo-shark-obrigado">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="sharkGradOb" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <path d="M4 26 C4 26 8 10 16 6 C16 6 13 16 20 20 C20 20 14 22 12 26 Z" fill="url(#sharkGradOb)" />
        <path d="M12 26 C12 26 14 18 22 18 C26 18 28 22 28 26 Z" fill="url(#sharkGradOb)" opacity="0.7" />
        <path d="M2 26 L30 26" stroke="url(#sharkGradOb)" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      </svg>
      <span className="font-extrabold text-lg tracking-tight leading-none">
        SHARK{' '}
        <span className="bg-gradient-to-r from-emerald-300 to-green-400 bg-clip-text text-transparent">GREEN</span>
      </span>
    </div>
  );
}

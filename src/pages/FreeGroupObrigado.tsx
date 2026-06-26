import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send } from 'lucide-react';

const FREE_GROUPS_URL = 'https://t.me/sharkgreenfree2';
const PIXEL_ID = '1672225667108236';
const PIXEL_SCRIPT_SRC = 'https://connect.facebook.net/en_US/fbevents.js';

const SUPABASE_URL  = import.meta.env.VITE_MAIN_SUPABASE_URL  as string | undefined;
const SUPABASE_ANON = import.meta.env.VITE_MAIN_SUPABASE_ANON_KEY as string | undefined;

export const FREE_GROUP_SESSION_KEY = 'free_group_success';

export interface FreeGroupSuccess {
  name: string;
  eventId: string;
  /** id do lead em trial_leads — usado pro deep-link do bot (?start=free_<id>). */
  leadId?: string | null;
}

// Username do bot do trial (mesmo bot do Grupo Free). Deep-link manda a pessoa
// pro bot, que captura o telegram_user_id real e dá o botão do grupo.
const BOT_USERNAME = 'sharkinhogreen_bot';

interface FbqStub {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: FbqStub;
  loaded: boolean;
  version: string;
}

declare global {
  interface Window {
    fbq?: FbqStub;
    _fbq?: FbqStub;
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
  if (typeof window === 'undefined' || typeof window.fbq === 'function') return;
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
    const first = document.getElementsByTagName('script')[0];
    first?.parentNode?.insertBefore(script, first);
    window.fbq('init', PIXEL_ID);
  } catch { /* adblock */ }
}

function fireConversion(eventId: string) {
  // 1. Meta Pixel — CompleteRegistration (evento de conversão principal)
  try {
    if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
      window.fbq('track', 'CompleteRegistration', { content_name: 'free-group' }, { eventID: eventId });
    }
  } catch { /* adblock */ }

  // 2. CAPI server-side (deduplicado com mesmo eventId)
  if (SUPABASE_URL && SUPABASE_ANON) {
    fetch(`${SUPABASE_URL}/functions/v1/trial-pixel-track`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
      body: JSON.stringify({
        event_name: 'CompleteRegistration',
        event_id: eventId,
        event_source_url: typeof window !== 'undefined' ? window.location.href : null,
        source: 'free-group-obrigado',
        fbp: readCookie('_fbp'),
        fbc: readCookie('_fbc'),
        custom_data: { content_name: 'free-group' },
      }),
    }).catch(() => {});
  }

  // 3. track4you / AdScala
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('t4y:event', {
          detail: { name: 'CompleteRegistration', params: { destination: 'free_group' } },
        }),
      );
    }
  } catch { /* noop */ }
}

export default function FreeGroupObrigado() {
  const navigate = useNavigate();
  const firedRef = useRef(false);

  let successData: FreeGroupSuccess | null = null;
  try {
    const raw = sessionStorage.getItem(FREE_GROUP_SESSION_KEY);
    if (raw) successData = JSON.parse(raw) as FreeGroupSuccess;
  } catch { /* sessionStorage indisponível */ }

  const firstName = successData?.name?.split(' ')[0] ?? '';
  // Se temos o leadId, manda pro BOT (captura telegram_user_id real + vincula).
  // Sem leadId (fallback), vai direto pro grupo.
  const ctaUrl = successData?.leadId
    ? `https://t.me/${BOT_USERNAME}?start=free_${successData.leadId}`
    : FREE_GROUPS_URL;

  useEffect(() => {
    if (!successData) {
      navigate('/', { replace: true });
      return;
    }

    document.title = 'Acesso liberado! Entre no Grupo Free — Shark Green';

    initPixel();

    if (!firedRef.current) {
      firedRef.current = true;
      const eventId = successData.eventId ?? makeEventId();
      const run = () => fireConversion(eventId);
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(run, { timeout: 1500 });
      } else {
        setTimeout(run, 400);
      }
    }
  }, []);

  if (!successData) return null;

  return (
    <div
      className="min-h-screen text-white flex flex-col items-center"
      style={{ backgroundColor: 'hsl(150 30% 4%)', minHeight: '100svh' }}
      data-testid="page-free-group-obrigado"
    >
      {/* Glows */}
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

      <main className="relative z-10 w-full max-w-lg mx-auto px-4 pt-10 pb-20 flex flex-col items-center gap-7">

        {/* Ícone de sucesso animado */}
        <div className="w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-400/50 flex items-center justify-center shadow-[0_0_40px_rgba(52,211,153,0.3)]">
          <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-sm font-semibold"
          data-testid="badge-free-group-success"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Cadastro confirmado · Acesso liberado
        </div>

        {/* Headline */}
        <h1
          className="text-center text-[1.6rem] sm:text-[2rem] md:text-[2.3rem] font-extrabold leading-[1.25] tracking-tight"
          data-testid="text-free-group-obrigado-headline"
        >
          {firstName ? `${firstName}, seu` : 'Seu'} acesso ao{' '}
          <span className="bg-gradient-to-r from-emerald-300 via-green-400 to-emerald-500 bg-clip-text text-transparent">
            Grupo Free
          </span>{' '}
          está pronto!
        </h1>

        {/* Subtítulo com prova social */}
        <p className="text-center text-white/65 text-base leading-relaxed max-w-sm">
          Mais de <strong className="text-emerald-300">2.300 membros</strong> já estão acompanhando os sinais ao vivo e lucrando com Promoções Esportivas Bonificadas.
        </p>

        {/* Instrução */}
        <div className="w-full rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-6 py-4 text-center space-y-1">
          <p className="text-white/80 text-sm leading-relaxed">
            Clique no botão abaixo, toque em{' '}
            <strong className="text-emerald-300">"Iniciar"</strong>{' '}
            no nosso assistente e depois no botão{' '}
            <strong className="text-emerald-300">"Entrar no Grupo Free"</strong>.
          </p>
        </div>

        {/* CTA principal */}
        <a
          href={ctaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="pulse-glow-btn w-full flex items-center justify-center gap-3 rounded-xl px-4 py-5 font-extrabold text-base sm:text-lg uppercase tracking-wide text-black bg-gradient-to-r from-emerald-400 to-green-500 shadow-xl shadow-emerald-500/40 transition-transform hover:scale-[1.02] active:scale-[0.98]"
          data-testid="link-free-group-telegram"
        >
          <Send className="w-5 h-5 flex-shrink-0" />
          ENTRAR NO GRUPO FREE AGORA
        </a>

        <p className="text-white/40 text-xs text-center">
          O acesso é 100% gratuito e abre direto no Telegram
        </p>

        {/* Prova social — números */}
        <div className="w-full grid grid-cols-3 gap-3">
          {[
            { value: '+2.300', label: 'membros ativos' },
            { value: '100%', label: 'gratuito' },
            { value: 'R$200', label: 'lucro médio/dia' },
          ].map(({ value, label }) => (
            <div
              key={label}
              className="rounded-xl border border-emerald-500/15 bg-white/3 px-3 py-4 text-center"
            >
              <p className="text-emerald-300 font-extrabold text-lg leading-none">{value}</p>
              <p className="text-white/45 text-[11px] mt-1 uppercase tracking-wide">{label}</p>
            </div>
          ))}
        </div>

        {/* Suporte */}
        <p className="text-white/35 text-xs text-center">
          Algum problema?{' '}
          <a
            href="https://t.me/SuporteSharkGreen_financeiro"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400/70 underline underline-offset-2 hover:text-emerald-300 transition-colors"
            data-testid="link-free-group-suporte"
          >
            Fale com o suporte
          </a>
        </p>

      </main>

      {/* noscript */}
      <noscript>
        <img
          height="1" width="1" style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=CompleteRegistration&noscript=1`}
          alt=""
        />
      </noscript>

      <style>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 18px 2px rgba(52,211,153,.55), 0 0 40px 6px rgba(52,211,153,.20); }
          50%       { box-shadow: 0 0 32px 8px rgba(52,211,153,.80), 0 0 70px 18px rgba(52,211,153,.35); }
        }
        .pulse-glow-btn { animation: pulse-glow 2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

function SharkLogo() {
  return (
    <div className="flex items-center gap-2.5" data-testid="logo-shark-free-obrigado">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="sharkGradFreeOb" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <path d="M4 26 C4 26 8 10 16 6 C16 6 13 16 20 20 C20 20 14 22 12 26 Z" fill="url(#sharkGradFreeOb)" />
        <path d="M12 26 C12 26 14 18 22 18 C26 18 28 22 28 26 Z" fill="url(#sharkGradFreeOb)" opacity="0.7" />
        <path d="M2 26 L30 26" stroke="url(#sharkGradFreeOb)" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      </svg>
      <span className="font-extrabold text-lg tracking-tight leading-none">
        SHARK{' '}
        <span className="bg-gradient-to-r from-emerald-300 to-green-400 bg-clip-text text-transparent">GREEN</span>
      </span>
    </div>
  );
}

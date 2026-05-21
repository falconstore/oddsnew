import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, ExternalLink, KeyRound, Download, Share2, Plus, Smartphone, ChevronDown } from 'lucide-react';

// URL do APK Android — deixe vazio para ocultar o botão de download
const APK_DOWNLOAD_URL = '';

// URL do PWA para o guia iOS — deixe vazio para ocultar a seção
const PWA_URL = '';

const SUPABASE_URL  = import.meta.env.VITE_MAIN_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_MAIN_SUPABASE_ANON_KEY as string;
const PIXEL_ID = '1672225667108236';
const PIXEL_SCRIPT_SRC = 'https://connect.facebook.net/en_US/fbevents.js';
const PIXEL_SCRIPT_DATA_ATTR = 'data-ads-obrigado-pixel';
const ADS_SESSION_KEY = 'ads_success';

interface AdsSuccess {
  botStartUrl: string;
  inviteLink: string;
  leadEventId?: string;
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

function trackPixelLead(eventId: string) {
  if (typeof window === 'undefined') return;
  try {
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'Lead', { content_name: 'ads-lead' }, { eventID: eventId });
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
        source: 'ads-obrigado',
        fbp: readCookie('_fbp'),
        fbc: readCookie('_fbc'),
      }),
    }).catch(() => {});
  }
}

export default function AdsObrigado() {
  const navigate = useNavigate();

  let adsData: AdsSuccess | null = null;
  try {
    const raw = sessionStorage.getItem(ADS_SESSION_KEY);
    if (raw) adsData = JSON.parse(raw) as AdsSuccess;
  } catch { /* sessionStorage indisponível */ }

  useEffect(() => {
    if (!adsData?.botStartUrl) {
      navigate('/ads', { replace: true });
      return;
    }

    document.title = 'Parabéns! Acesso liberado — Shark 100% Green';

    initPixel();

    // Reutiliza o mesmo leadEventId gerado no submit (AdsLanding) para que a
    // Meta possa deduplificar: o ads-signup já disparou CAPI Lead com esse ID,
    // e o pixel do browser também. Usar o mesmo ID aqui garante que não haja
    // dupla contagem — a Meta ignora events com o mesmo event_id numa janela
    // de deduplicação de ~48h.
    const eventId = adsData?.leadEventId ?? makeEventId();
    const run = () => trackPixelLead(eventId);
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(run, { timeout: 1500 });
    } else {
      setTimeout(run, 500);
    }
  }, []);

  if (!adsData?.botStartUrl) return null;

  const { botStartUrl, inviteLink, initialPassword } = adsData;

  return (
    <div
      className="min-h-screen text-white flex flex-col items-center"
      style={{ backgroundColor: 'hsl(150 30% 4%)', minHeight: '100svh' }}
      data-testid="page-ads-obrigado"
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

      <main className="relative z-10 w-full max-w-3xl mx-auto px-4 pt-10 pb-20 flex flex-col items-center gap-8">

        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-sm font-semibold"
          data-testid="badge-ads-success"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Cadastro confirmado · Acesso liberado
        </div>

        {/* Headline */}
        <h1
          className="text-center text-[1.55rem] sm:text-[1.9rem] md:text-[2.25rem] font-bold leading-[1.3] tracking-tight max-w-2xl"
          data-testid="text-ads-obrigado-headline"
        >
          Seu acesso grátis está pronto!{' '}
          <span className="bg-gradient-to-r from-emerald-300 via-green-400 to-emerald-500 bg-clip-text text-transparent">
            Clique abaixo para entrar
          </span>
        </h1>

        {/* Instrução */}
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-6 py-5 text-center max-w-md w-full space-y-2">
          <p className="text-white/80 text-sm leading-relaxed">
            <strong className="text-white">Passo 1:</strong> Clique no botão abaixo<br />
            <strong className="text-white">Passo 2:</strong> Abra o bot no Telegram e toque em <strong className="text-emerald-300">Iniciar</strong><br />
            <strong className="text-white">Passo 3:</strong> Receba o link do grupo VIP em segundos
          </p>
        </div>

        {/* Card de credenciais do PWA */}
        {initialPassword && (
          <div
            className="w-full max-w-md rounded-2xl border border-emerald-500/25 bg-white/3 backdrop-blur-sm px-6 py-5 space-y-4"
            data-testid="card-ads-credentials"
          >
            <div className="flex items-center gap-2 text-emerald-300">
              <KeyRound className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-semibold uppercase tracking-wide">Acesse o App</span>
            </div>
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Senha inicial</p>
              <p className="text-white font-mono text-sm tracking-widest" data-testid="text-ads-credential-password">{initialPassword}</p>
            </div>
            <p className="text-[11px] text-white/45 leading-relaxed border-t border-white/8 pt-3">
              Na primeira entrada, você será solicitado a criar uma nova senha.
            </p>
          </div>
        )}

        {/* Blocos de instalação (Android + iOS) */}
        {initialPassword && (APK_DOWNLOAD_URL || PWA_URL) && (
          <div className="w-full max-w-md flex flex-col sm:flex-row gap-3" data-testid="block-ads-install">
            {APK_DOWNLOAD_URL && (
              <a
                href={APK_DOWNLOAD_URL}
                download
                className="flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-4 font-bold text-sm text-black bg-gradient-to-r from-emerald-400 to-green-500 shadow-lg shadow-emerald-500/30 transition-transform hover:scale-[1.02] active:scale-[0.98]"
                data-testid="link-ads-apk-download"
              >
                <Download className="w-4 h-4 flex-shrink-0" />
                📲 Baixar o App (Android)
              </a>
            )}
            {PWA_URL && <IosInstallAccordion pwaUrl={PWA_URL} />}
          </div>
        )}

        {/* Botão pulsante */}
        <a
          href={botStartUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="pulse-glow-btn relative w-full max-w-md flex items-center justify-center gap-2 rounded-xl px-4 py-5 font-extrabold text-sm sm:text-base md:text-lg uppercase tracking-wide text-black bg-gradient-to-r from-emerald-400 to-green-500 shadow-xl shadow-emerald-500/40 transition-transform hover:scale-[1.02] active:scale-[0.98]"
          data-testid="link-ads-bot-start"
        >
          <Send className="w-5 h-5 flex-shrink-0" />
          ACESSAR GRUPO VIP AGORA
        </a>

        <p className="text-white/50 text-sm text-center max-w-sm">
          Clique no botão, abra o bot no Telegram e toque em <strong className="text-white">Iniciar</strong> — o link chega em segundos.
        </p>

        {/* Fallback */}
        <details
          className="w-full max-w-md rounded-xl border border-emerald-500/20 bg-white/3 px-4 py-3"
          data-testid="details-ads-fallback"
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
              data-testid="link-ads-invite-fallback"
            >
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
              {inviteLink}
            </a>
            <p className="text-[10px] text-white/35">
              Pelo link direto você não recebe os avisos automáticos do bot.
            </p>
          </div>
        </details>

      </main>

      {/* noscript fallback */}
      <noscript>
        <img
          height="1" width="1" style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=Lead&noscript=1`}
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

function IosInstallAccordion({ pwaUrl }: { pwaUrl: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex-1 rounded-xl border border-emerald-500/20 bg-white/3 overflow-hidden" data-testid="accordion-ads-ios-install">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-4 text-sm font-semibold text-white/80 hover:text-white transition-colors"
        aria-expanded={open}
        data-testid="button-ads-ios-install-toggle"
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
              <a href={pwaUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-emerald-400 underline underline-offset-2 break-all hover:text-emerald-300" data-testid="link-ads-pwa-safari">{pwaUrl}</a>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 text-emerald-300 text-xs font-bold">2</div>
            <div>
              <p className="text-xs font-semibold text-white/80">Toque no ícone de compartilhar</p>
              <p className="text-[11px] text-white/45 flex items-center gap-1 mt-0.5"><Share2 className="w-3 h-3 text-white/40" /> Ícone de caixa com seta (barra inferior)</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 text-emerald-300 text-xs font-bold">3</div>
            <div>
              <p className="text-xs font-semibold text-white/80">Toque em "Adicionar à Tela de Início"</p>
              <p className="text-[11px] text-white/45 flex items-center gap-1 mt-0.5"><Plus className="w-3 h-3 text-white/40" /> Role a lista de opções até encontrar</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SharkLogo() {
  return (
    <div className="flex items-center gap-2.5" data-testid="logo-shark-ads-obrigado">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="sharkGradAdsOb" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <path d="M4 26 C4 26 8 10 16 6 C16 6 13 16 20 20 C20 20 14 22 12 26 Z" fill="url(#sharkGradAdsOb)" />
        <path d="M12 26 C12 26 14 18 22 18 C26 18 28 22 28 26 Z" fill="url(#sharkGradAdsOb)" opacity="0.7" />
        <path d="M2 26 L30 26" stroke="url(#sharkGradAdsOb)" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      </svg>
      <span className="font-extrabold text-lg tracking-tight leading-none">
        SHARK{' '}
        <span className="bg-gradient-to-r from-emerald-300 to-green-400 bg-clip-text text-transparent">GREEN</span>
      </span>
    </div>
  );
}

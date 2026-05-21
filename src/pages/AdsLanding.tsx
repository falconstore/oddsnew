import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Send, Shield, Clock, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SUPABASE_URL  = import.meta.env.VITE_MAIN_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_MAIN_SUPABASE_ANON_KEY as string;
const PIXEL_ID = '1672225667108236';
const ADS_SESSION_KEY = 'ads_success';
const ADS_UTM_KEY = 'ads_utm_params';

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

interface UtmParams {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  fbclid: string | null;
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

function readUtmParams(): UtmParams {
  const p = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  return {
    utm_source:   p.get('utm_source'),
    utm_medium:   p.get('utm_medium'),
    utm_campaign: p.get('utm_campaign'),
    utm_content:  p.get('utm_content'),
    utm_term:     p.get('utm_term'),
    fbclid:       p.get('fbclid'),
  };
}

function trackPixelLead(eventId: string) {
  if (typeof window === 'undefined') return;
  try {
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'Lead', { content_name: 'ads-lead' }, { eventID: eventId });
    }
  } catch { /* adblock */ }
}

const fmtWhatsapp = (raw: string) => {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return d;
};

export default function AdsLanding() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [nameError, setNameError] = useState('');
  const [waError, setWaError] = useState('');
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [utmParams, setUtmParams] = useState<UtmParams>({
    utm_source: null, utm_medium: null, utm_campaign: null,
    utm_content: null, utm_term: null, fbclid: null,
  });
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'Acesso VIP — Shark 100% Green';

    // Captura e persiste UTMs ao montar (antes do redirect)
    const params = readUtmParams();
    setUtmParams(params);
    try {
      sessionStorage.setItem(ADS_UTM_KEY, JSON.stringify(params));
    } catch { /* sessionStorage indisponível */ }

    // Foca no primeiro campo
    setTimeout(() => nameRef.current?.focus(), 300);
  }, []);

  const validate = () => {
    let ok = true;
    setNameError('');
    setWaError('');
    setServerError('');
    if (name.trim().length < 2) {
      setNameError('Informe seu nome completo');
      ok = false;
    }
    if (whatsapp.replace(/\D/g, '').length < 10) {
      setWaError('WhatsApp inválido — inclua o DDD (ex: 11 91234-5678)');
      ok = false;
    }
    return ok;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setServerError('');

    const eventId = makeEventId();

    // Pixel browser — Lead (antes do await pra não ser bloqueado pelo adblock)
    trackPixelLead(eventId);

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ads-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
        body: JSON.stringify({
          name: name.trim(),
          whatsapp: whatsapp.replace(/\D/g, ''),
          event_id: eventId,
          event_source_url: window.location.href,
          fbp: readCookie('_fbp'),
          fbc: readCookie('_fbc'),
          ...utmParams,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setServerError(data?.error ?? 'Erro ao processar cadastro. Tente novamente.');
        setLoading(false);
        return;
      }

      // Persiste dados para a página de obrigado
      try {
        sessionStorage.setItem(ADS_SESSION_KEY, JSON.stringify({
          botStartUrl: data.bot_start_url,
          inviteLink: data.invite_link,
          leadEventId: eventId,
          initialPassword: whatsapp.replace(/\D/g, ''),
        }));
      } catch { /* fallback */ }

      navigate('/ads/obrigado');
    } catch {
      setServerError('Erro de conexão. Verifique sua internet e tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen text-white flex flex-col"
      style={{ backgroundColor: 'hsl(150 30% 4%)', minHeight: '100svh' }}
      data-testid="page-ads-landing"
    >
      {/* Glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-emerald-500/12 blur-[160px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-emerald-400/8 blur-[140px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-emerald-500/20 bg-[hsl(150_35%_3%/0.92)] backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <SharkLogo />
          <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/50 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Vagas limitadas
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 w-full max-w-xl mx-auto px-4 pt-10 pb-20 flex flex-col gap-8">

        {/* Social proof mini-bar */}
        <div className="flex items-center justify-center gap-4 flex-wrap text-xs text-white/60">
          {['+500 alunos', 'R$200/dia', '7 dias grátis'].map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              {t}
            </span>
          ))}
        </div>

        {/* Headline */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-sm font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Acesso VIP · 7 Dias Grátis
          </div>
          <h1
            className="text-[1.65rem] sm:text-[2rem] font-bold leading-[1.28] tracking-tight"
            data-testid="text-ads-headline"
          >
            Nossos alunos estão lucrando{' '}
            <span className="bg-gradient-to-r from-emerald-300 via-green-400 to-emerald-500 bg-clip-text text-transparent">
              +R$200 por dia
            </span>{' '}
            com Promoções Esportivas
          </h1>
          <p className="text-white/65 text-sm leading-relaxed max-w-sm mx-auto">
            Entre no grupo VIP por <strong className="text-white">7 dias completamente grátis</strong>,
            sem cartão de crédito. Acesso imediato pelo Telegram.
          </p>
        </div>

        {/* Stars */}
        <div className="flex justify-center gap-0.5">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
          ))}
        </div>

        {/* Formulário */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-emerald-500/25 bg-white/4 backdrop-blur-sm p-6 sm:p-8 space-y-5 shadow-2xl shadow-emerald-500/10"
          data-testid="form-ads"
          noValidate
        >
          <h2 className="text-lg font-bold text-center">
            Preencha para garantir sua vaga gratuita
          </h2>

          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="ads-name" className="text-sm font-medium text-white/80">
              Seu nome completo
            </Label>
            <Input
              id="ads-name"
              ref={nameRef}
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(''); }}
              placeholder="Ex: João Silva"
              autoComplete="name"
              className="bg-white/6 border-white/15 h-12 text-sm placeholder:text-white/35 focus:border-emerald-500/60"
              data-testid="input-ads-name"
            />
            {nameError && (
              <p className="text-xs text-red-400 flex items-center gap-1" data-testid="error-ads-name">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />{nameError}
              </p>
            )}
          </div>

          {/* WhatsApp */}
          <div className="space-y-1.5">
            <Label htmlFor="ads-whatsapp" className="text-sm font-medium text-white/80">
              WhatsApp (com DDD)
            </Label>
            <Input
              id="ads-whatsapp"
              type="tel"
              inputMode="numeric"
              value={whatsapp}
              onChange={(e) => { setWhatsapp(fmtWhatsapp(e.target.value)); setWaError(''); }}
              placeholder="(11) 91234-5678"
              autoComplete="tel"
              className="bg-white/6 border-white/15 h-12 text-sm placeholder:text-white/35 focus:border-emerald-500/60"
              data-testid="input-ads-whatsapp"
            />
            {waError && (
              <p className="text-xs text-red-400 flex items-center gap-1" data-testid="error-ads-whatsapp">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />{waError}
              </p>
            )}
          </div>

          {serverError && (
            <div
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex items-start gap-2"
              data-testid="error-ads-server"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {serverError}
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-14 text-base font-extrabold uppercase tracking-wide text-black bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 shadow-xl shadow-emerald-500/30 disabled:opacity-60"
            data-testid="button-ads-submit"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Gerando acesso…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                QUERO MEU ACESSO GRÁTIS
              </span>
            )}
          </Button>

          {/* Microcopy */}
          <div className="flex flex-col items-center gap-2 text-[11px] text-white/45">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-emerald-500/60" /> Sem cartão</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-emerald-500/60" /> Acesso em segundos</span>
            </div>
            <span>Não enviamos spam. Seus dados são protegidos.</span>
          </div>
        </form>

        {/* Prova social rápida */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { n: '+500', l: 'Alunos ativos' },
            { n: 'R$200', l: 'Lucro/dia médio' },
            { n: '7 dias', l: 'Grátis pra testar' },
          ].map(({ n, l }) => (
            <div key={l} className="rounded-xl border border-emerald-500/15 bg-white/3 p-3 text-center">
              <p className="text-lg font-black text-emerald-300 leading-none">{n}</p>
              <p className="text-[10px] text-white/50 mt-1">{l}</p>
            </div>
          ))}
        </div>

      </main>

      {/* Meta Pixel noscript fallback */}
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
      `}</style>
    </div>
  );
}

function SharkLogo() {
  return (
    <div className="flex items-center gap-2.5" data-testid="logo-shark-ads">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="sharkGradAds" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <path d="M4 26 C4 26 8 10 16 6 C16 6 13 16 20 20 C20 20 14 22 12 26 Z" fill="url(#sharkGradAds)" />
        <path d="M12 26 C12 26 14 18 22 18 C26 18 28 22 28 26 Z" fill="url(#sharkGradAds)" opacity="0.7" />
        <path d="M2 26 L30 26" stroke="url(#sharkGradAds)" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      </svg>
      <span className="font-extrabold text-lg tracking-tight leading-none">
        SHARK{' '}
        <span className="bg-gradient-to-r from-emerald-300 to-green-400 bg-clip-text text-transparent">GREEN</span>
      </span>
    </div>
  );
}

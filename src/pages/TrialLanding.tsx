import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import {
  CheckCircle2, AlertCircle, Clock,
  Star, ChevronDown, MessageCircle, Target, TrendingUp, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import proof1 from '@assets/WhatsApp_Image_2026-05-07_at_20.43.24_(3)_1778197516426.jpeg';
import proof2 from '@assets/WhatsApp_Image_2026-05-07_at_20.43.24_(2)_1778197516427.jpeg';
import proof3 from '@assets/WhatsApp_Image_2026-05-07_at_20.43.24_(1)_1778197516427.jpeg';
import proof4 from '@assets/WhatsApp_Image_2026-05-07_at_20.43.24_1778197516427.jpeg';
import proof5 from '@assets/WhatsApp_Image_2026-05-03_at_05.16.04_1777796184266-CnYvy8Lp_1778197516428.jpeg';
import proof6 from '@assets/WhatsApp_Image_2026-05-03_at_05.16.03_1777796184266-Cu4xMMoY_1778197516428.jpeg';
import proof7 from '@assets/WhatsApp_Image_2026-05-03_at_05.16.04_(1)_1777796184266-Bv3rf_1778197516428.jpeg';
import proof8 from '@assets/WhatsApp_Image_2026-05-04_at_18.43.57_1778197516429.jpeg';

const HERO_WEBP_URL = '/images/hero.webp';

// Cliente Supabase dedicado para inserção de leads do Grupo Free (sem edge function).
const _sbLeads = createClient(
  import.meta.env.VITE_PROCEDURES_SUPABASE_URL as string,
  import.meta.env.VITE_PROCEDURES_SUPABASE_ANON_KEY as string,
  { auth: { persistSession: false } },
);

const FREE_GROUPS_URL = 'https://t.me/sharkgreenfree2';
const SUPPORT_URL = 'https://t.me/SuporteSharkGreen_financeiro';

const PIXEL_ID = '1672225667108236';
const PIXEL_SCRIPT_SRC = 'https://connect.facebook.net/en_US/fbevents.js';
const PIXEL_SCRIPT_DATA_ATTR = 'data-trial-pixel';

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
    adscala_sendConversion?: (opts: { trackingCode: string; pedidoId: string; valor: number }) => void;
    multiads_sendConversion?: (opts: { trackingCode: string; pedidoId: string; valor: number }) => void;
  }
}

function makeEventId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fallback abaixo */
  }
  return `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

interface UtmParams {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  fbclid: string | null;
  ct: string | null;
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
    ct:           p.get('ct'),
  };
}

const TRIAL_UTM_KEY = 'trial_utm_params';

type PixelEventName = 'PageView' | 'Lead' | 'InitiateCheckout' | 'ViewContent';

function trackPixel(
  event: PixelEventName,
  params?: Record<string, unknown>,
  eventId?: string,
) {
  if (typeof window === 'undefined') return;
  try {
    if (typeof window.fbq === 'function') {
      if (eventId) {
        window.fbq('track', event, params ?? {}, { eventID: eventId });
      } else {
        window.fbq('track', event, params);
      }
    }
  } catch {
    /* adblock / pixel não carregado — ignora */
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
      /* CustomEvent indisponível — ignora */
    }
  } catch {
    /* nunca propaga */
  }
}

function trackCapi(
  eventName: 'PageView' | 'ViewContent',
  eventId: string,
  customData?: Record<string, unknown>,
) {
  if (!SUPABASE_URL || !SUPABASE_ANON) return;
  try {
    fetch(`${SUPABASE_URL}/functions/v1/trial-pixel-track`, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON,
      },
      body: JSON.stringify({
        event_name: eventName,
        event_id: eventId,
        event_source_url: typeof window !== 'undefined' ? window.location.href : null,
        source: 'trial-landing-hero',
        fbp: readCookie('_fbp'),
        fbc: readCookie('_fbc'),
        custom_data: customData,
      }),
    }).catch(() => {});
  } catch {
    /* noop */
  }
}

type TrackEvent = 'view' | 'cta_free_group' | 'cta_free_group_modal_open' | 'cta_free_group_submitted' | 'cta_checkout';

function track(event_type: TrackEvent, meta: Record<string, unknown> = {}) {
  if (!SUPABASE_URL || !SUPABASE_ANON) return;
  try {
    fetch(`${SUPABASE_URL}/functions/v1/trial-upgrade-track`, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON,
      },
      body: JSON.stringify({
        event_type,
        lead_id: null,
        source: 'trial-landing-hero',
        meta,
      }),
    }).catch(() => {});
  } catch {
    /* noop */
  }
}

const fmtWhatsapp = (raw: string) => {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return d;
};

const modalSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome completo'),
  whatsapp: z.string().refine(v => v.replace(/\D/g, '').length >= 10, 'WhatsApp inválido (mín. 10 dígitos com DDD)'),
});

const FAQ_ITEMS = [
  {
    q: 'Funciona de verdade? Não é mais um grupo de palpite?',
    a: 'Não. O Shark 100% Green usa um método matemático de sinais antecipados — não palpites. Cada operação passa por filtro de valor, leitura de mercado e checagem de viabilidade antes de chegar pra você.',
  },
  {
    q: 'Não entendo nada de apostas esportivas. Consigo usar?',
    a: 'Sim. O procedimento chega mastigado: qual casa, quanto colocar, qual odd mínima e qual prazo. Em média 3 minutos de execução. Se você sabe mexer em um app de banco, consegue operar aqui.',
  },
  {
    q: 'É realmente gratuito? Tem algum custo?',
    a: 'Sim, o Grupo Free é 100% gratuito, sem cartão e sem mensalidade. Você recebe os sinais e o passo a passo pelo grupo no Telegram. Se quiser acesso ao grupo VIP com cobertura completa e suporte individualizado, existe o plano pago — mas sem nenhuma obrigação.',
  },
  {
    q: 'Vou conseguir executar sozinho, sem ajuda?',
    a: 'Sim. Em até 15 minutos após entrar no grupo você já recebe o passo-a-passo de onboarding, o glossário de termos e o suporte do grupo. Nunca ficou ninguém perdido nos primeiros dias.',
  },
  {
    q: 'E se o site da bookmaker travar na hora da operação?',
    a: 'Esse é exatamente o diferencial do método. As operações chegam com antecedência suficiente pra você entrar com calma, antes do mercado se mover. Você não fica dependente de velocidade de internet ou site rápido.',
  },
  {
    q: 'Posso confiar em quem criou isso?',
    a: 'O método tem histórico documentado e membros com resultados reais — você verá os prints de comprovação na própria página. O Grupo Free existe exatamente para você validar o método antes de qualquer decisão.',
  },
];

const TICKER_ITEMS = [
  'Lucas M. fez R$312 em 5 dias — São Paulo/SP',
  'Carla S.: R$487 na primeira semana, sem experiência',
  'Rafael O.: R$219 em 4 dias — Curitiba/PR',
  'Ana P.: R$380 em 7 dias — Rio de Janeiro/RJ',
  'Rodrigo T.: primeiro green na manhã do primeiro dia',
  '+500 alunos ativos em todo o Brasil',
  'Grupo Free · acesso imediato · sem cartão',
  'Fernanda G.: R$290 trabalhando 1h por dia',
  'Marcos V.: sacou R$430 via PIX na primeira semana',
  'Juliana C.: zero experiência → R$260 em 6 dias',
  'Thiago B.: operou no intervalo do almoço e saiu positivo',
  'Beatriz L.: R$195 no segundo dia — Fortaleza/CE',
];

export default function TrialLanding() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [ctaInView, setCtaInView] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const ctaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.title = 'Shark 100% Green — Grupo Free de Sinais';
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      'content',
      'Entre no Grupo Free Shark 100% Green: +500 alunos lucrando R$200/dia com promoções esportivas. 100% gratuito. Acesso imediato.',
    );
  }, []);

  useEffect(() => {
    const SESSION_KEY = 'trial-landing:view-tracked';
    const run = () => {
      try {
        if (sessionStorage.getItem(SESSION_KEY)) return;
        sessionStorage.setItem(SESSION_KEY, '1');
      } catch {
        /* sessionStorage indisponível */
      }
      track('view', { page: 'trial-landing' });
    };
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(run, { timeout: 2000 });
    } else {
      setTimeout(run, 2000);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const CLARITY_ID = 'wn6p12ffga';
    const SCRIPT_ATTR = 'data-clarity-trial';
    if (document.querySelector(`script[${SCRIPT_ATTR}]`)) return;

    (function(c: Window & typeof globalThis, l: Document, a: string, r: string, i: string) {
      (c as any)[a] = (c as any)[a] || function() { ((c as any)[a].q = (c as any)[a].q || []).push(arguments); };
      const t = l.createElement(r) as HTMLScriptElement;
      t.async = true;
      t.src = 'https://www.clarity.ms/tag/' + i;
      t.setAttribute(SCRIPT_ATTR, '1');
      const y = l.getElementsByTagName(r)[0];
      y.parentNode!.insertBefore(t, y);
    })(window, document, 'clarity', 'script', CLARITY_ID);

    return () => {
      const s = document.querySelector(`script[${SCRIPT_ATTR}]`);
      if (s) s.remove();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initStub = (): FbqStub => {
      const stub = function (...args: unknown[]) {
        if (stub.callMethod) {
          stub.callMethod.apply(stub, args);
        } else {
          stub.queue.push(args);
        }
      } as unknown as FbqStub;
      stub.queue = [];
      stub.loaded = true;
      stub.version = '2.0';
      stub.push = stub;
      return stub;
    };

    if (typeof window.fbq !== 'function') {
      const stub = initStub();
      window.fbq = stub;
      if (!window._fbq) window._fbq = stub;
      const script = document.createElement('script');
      script.async = true;
      script.src = PIXEL_SCRIPT_SRC;
      script.setAttribute(PIXEL_SCRIPT_DATA_ATTR, '1');
      const first = document.getElementsByTagName('script')[0];
      first?.parentNode?.insertBefore(script, first);
      window.fbq('init', PIXEL_ID);
    }
    const pageviewEventId = makeEventId();
    window.fbq?.('track', 'PageView', {}, { eventID: pageviewEventId });
    const runCapi = () => trackCapi('PageView', pageviewEventId);
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(runCapi, { timeout: 2000 });
    } else {
      setTimeout(runCapi, 2000);
    }

    return () => {
      document
        .querySelectorAll(`script[${PIXEL_SCRIPT_DATA_ATTR}]`)
        .forEach((el) => el.parentNode?.removeChild(el));
      try {
        delete window.fbq;
        delete window._fbq;
      } catch {
        window.fbq = undefined;
        window._fbq = undefined;
      }
    };
  }, []);

  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setCtaInView(entry.isIntersecting),
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const openFreeGroupModal = (where: string) => {
    track('cta_free_group_modal_open', { button: where });
    setShowModal(true);
  };

  return (
    <div
      className="min-h-screen text-white relative"
      style={{
        backgroundColor: 'hsl(150 30% 4%)',
        backgroundImage: `url(${HERO_WEBP_URL})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        backgroundAttachment: 'fixed',
        minHeight: '100svh',
      }}
      data-testid="bg-shark-wallpaper"
    >
      {/* Overlays */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, hsl(150 35% 3% / 0.72) 0%, hsl(150 35% 3% / 0.60) 20%, hsl(150 35% 3% / 0.68) 45%, hsl(150 35% 3% / 0.88) 70%, hsl(150 35% 3% / 0.97) 88%, hsl(150 35% 3% / 1.0) 100%)',
        }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, hsl(150 35% 3% / 0.65) 0%, hsl(150 35% 3% / 0.40) 40%, transparent 65%)',
        }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 55% at 60% 38%, transparent 25%, hsl(150 35% 3% / 0.50) 100%)',
        }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[700px] rounded-full bg-emerald-500/15 blur-[160px]" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full bg-emerald-400/10 blur-[140px]" />
      </div>

      <div className="relative z-10">

        {/* ── HEADER ── */}
        <header className="sticky top-0 z-40 border-b border-emerald-500/20 bg-[hsl(150_35%_3%/0.92)] backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <SharkLogo />
            <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/50 backdrop-blur border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Grupo Free · vagas abertas
            </div>
          </div>
        </header>

        {/* ── URGENCY BAR ── */}
        <UrgencyBar />

        {/* ── HERO ── */}
        <section className="relative max-w-3xl mx-auto px-4 pt-8 pb-10 md:pt-14 md:pb-16">
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider">
                🦈 GRUPO FREE · ACESSO IMEDIATO
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 border border-emerald-500/30 text-emerald-300 text-xs font-semibold uppercase tracking-wider">
                ● Promoções Esportivas
              </span>
            </div>

            <h1
              className="text-[1.65rem] sm:text-[2rem] md:text-[2.5rem] font-bold leading-[1.28] tracking-tight drop-shadow-[0_4px_24px_rgba(0,0,0,0.85)]"
              data-testid="text-hero-title"
            >
              Nossos{' '}
              <span className="bg-gradient-to-r from-emerald-300 via-green-400 to-emerald-500 bg-clip-text text-transparent">
                +de 500 alunos
              </span>{' '}
              estão Lucrando{' '}
              <span className="bg-gradient-to-r from-emerald-300 via-green-400 to-emerald-500 bg-clip-text text-transparent">
                +R$200 por dia
              </span>{' '}
              gastando em média 1 a 2h com Promoções Esportivas Bonificadas.
            </h1>

            {/* Callout */}
            <div className="rounded-xl border border-emerald-500/40 border-l-[3px] border-l-emerald-400 bg-gradient-to-r from-emerald-500/14 to-emerald-500/5 p-4">
              <p className="font-semibold text-white leading-snug text-sm md:text-base">
                Entre no nosso{' '}
                <span className="text-emerald-400">Grupo Free</span> e comece a acompanhar os sinais agora — sem pagar nada, sem compromisso.
              </p>
            </div>

            {/* Mini stats */}
            <div className="grid grid-cols-3 gap-2">
              <StatMini value="+500" label="Alunos ativos" />
              <StatMini value="1 a 2h" label="Tempo médio" />
              <StatMini value="R$200" label="Lucro/dia" />
            </div>

            <p className="text-white/70 text-sm leading-relaxed">
              Não precisa de experiência. Você só precisa seguir o que enviamos no grupo.{' '}
              <strong className="text-white">100% gratuito, acesso imediato.</strong>
            </p>

            <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-white/60">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Sem cartão
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Acesso imediato
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 100% gratuito
              </span>
            </div>

            {/* CTAs */}
            <div ref={ctaRef} className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => openFreeGroupModal('hero-primary')}
                className="w-full sm:w-auto h-13 bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 text-black font-bold text-base border-0 shadow-xl shadow-emerald-500/50 transition-transform hover:scale-[1.02]"
                data-testid="button-hero-primary-cta"
              >
                ENTRAR NO GRUPO FREE AGORA
              </Button>
              <a
                href={SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 h-13 px-5 rounded-md border border-emerald-500/30 bg-transparent text-emerald-300 text-sm font-medium hover:bg-emerald-500/10 transition-colors"
                data-testid="button-hero-support"
              >
                <MessageCircle className="w-4 h-4" />
                Falar com Suporte
              </a>
            </div>
          </div>
        </section>

        {/* ── PROOF STRIP ── */}
        <div className="relative border-y border-emerald-500/20 bg-emerald-500/7">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-center gap-6 sm:gap-10 flex-wrap">
            <ProofNum value="+500" label="Alunos" />
            <div className="w-px h-8 bg-emerald-500/25 hidden sm:block" />
            <ProofNum value="1 a 2h" label="Tempo médio" />
            <div className="w-px h-8 bg-emerald-500/25 hidden sm:block" />
            <ProofNum value="R$200" label="Lucro/dia" />
          </div>
        </div>

        {/* ── TICKER ── */}
        <div className="border-b border-emerald-500/20 bg-emerald-500/4 py-2 overflow-hidden">
          <div
            className="flex gap-12 whitespace-nowrap"
            style={{ animation: 'marquee 32s linear infinite', width: 'max-content' }}
          >
            {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
              <span key={i} className="inline-flex items-center gap-2 text-xs text-white/55">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* ── COMO FUNCIONA ── */}
        <section className="relative max-w-3xl mx-auto px-4 py-14 md:py-20 text-center">
          <div className="mb-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold uppercase tracking-wider">
            Como funciona
          </div>
          <h2
            className="text-3xl md:text-4xl font-bold tracking-tight mb-8"
            data-testid="text-how-title"
          >
            Como{' '}
            <span className="bg-gradient-to-r from-emerald-300 to-green-400 bg-clip-text text-transparent">
              Funciona
            </span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <StepCard
              step={1}
              icon={<MessageCircle className="w-6 h-6 text-emerald-400" />}
              title="Receba"
              text="Enviamos as melhores promoções esportivas do dia com passo a passo completo."
              testId="card-step-1"
            />
            <StepCard
              step={2}
              icon={<Target className="w-6 h-6 text-emerald-400" />}
              title="Siga"
              text="Você gasta de 1 a 2h seguindo o passo a passo. Sem pressa, sem pressão."
              testId="card-step-2"
            />
            <StepCard
              step={3}
              icon={<TrendingUp className="w-6 h-6 text-emerald-400" />}
              title="Lucre"
              text="O lucro cai na conta e você saca via PIX. Verde todo dia."
              testId="card-step-3"
            />
          </div>

          <Button
            onClick={() => openFreeGroupModal('how-section')}
            className="h-12 px-8 bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 text-black font-bold border-0 shadow-lg shadow-emerald-500/40"
            data-testid="button-how-cta"
          >
            ENTRAR NO GRUPO FREE
          </Button>
        </section>

        {/* ── DEPOIMENTOS COMPLETOS ── */}
        <section className="relative max-w-5xl mx-auto px-4 pb-14 md:pb-20">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-4">
              <Star className="w-3 h-3 fill-emerald-400 text-emerald-400" /> Resultados reais
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Quem já está{' '}
              <span className="bg-gradient-to-r from-emerald-300 to-green-400 bg-clip-text text-transparent">
                no verde
              </span>
            </h2>
            <p className="text-white/50 text-sm mt-2">
              Depoimentos de membros — nomes e cidades reais, resultados individuais variam.
            </p>
          </div>

          {/* Grade de prints reais */}
          <div className="columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3" data-testid="section-proof-grid">
            {[
              { src: proof1, alt: 'Print R$1.050 — Everton vs Manchester City' },
              { src: proof6, alt: 'Print carro comprado com 5 meses de Shark' },
              { src: proof7, alt: 'Print mais de mil reais em 6 dias / placa 10K' },
              { src: proof2, alt: 'Print mais de 3k de lucro — DOKU City duplo' },
              { src: proof8, alt: 'Print R$1.803 no duplo segunda-feira' },
              { src: proof4, alt: 'Print R$300 protegendo duplo Newcastle' },
              { src: proof5, alt: 'Print PC do filho pago com o Shark' },
              { src: proof3, alt: 'Print duplos nos 3 primeiros dias do mês' },
            ].map(({ src, alt }, i) => (
              <div
                key={i}
                className="break-inside-avoid rounded-xl overflow-hidden border border-emerald-500/20 shadow-lg shadow-black/40 hover:border-emerald-400/50 hover:scale-[1.02] transition-transform duration-200"
                data-testid={`img-proof-${i + 1}`}
              >
                <img
                  src={src}
                  alt={alt}
                  loading="lazy"
                  decoding="async"
                  width={400}
                  height={300}
                  className="w-full h-auto block"
                />
              </div>
            ))}
          </div>

          {/* Depoimentos textuais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
            <TestimonialCard
              name="Lucas M."
              city="São Paulo – SP"
              result="R$ 312 em 5 dias"
              text="Entrei sem saber nada de apostas. O procedimento chegou no grupo às 10h, fiz em 3 minutos no Bet365 e saí verde. Repeti isso 8 vezes e fechei R$ 312 limpos."
              stars={5}
              testId="card-full-testimonial-1"
            />
            <TestimonialCard
              name="Carla S."
              city="Belo Horizonte – MG"
              result="R$ 487 na primeira semana"
              text="Fui muito cética no começo — achei que era mais um grupo de palpite. Mas os sinais chegam antes do mercado se mover e o passo a passo é literal. Saquei R$ 487 via PIX no sétimo dia."
              stars={5}
              testId="card-full-testimonial-2"
            />
            <TestimonialCard
              name="Rafael O."
              city="Curitiba – PR"
              result="R$ 219 em 4 dias, sem experiência"
              text="Opero no intervalo do trabalho. Em 4 dias fechei R$ 219 positivo. Nunca tinha apostado em nada na vida. O grupo responde rápido quando trava alguma coisa na plataforma."
              stars={5}
              testId="card-full-testimonial-3"
            />
            <TestimonialCard
              name="Ana P."
              city="Rio de Janeiro – RJ"
              result="R$ 380 na primeira semana"
              text="Comecei com medo de errar, mas cada operação vem explicada: qual mercado, qual odd mínima, quanto colocar. Em 7 dias fechei R$ 380 e assinei na mesma hora. Não abro mão."
              stars={5}
              testId="card-full-testimonial-4"
            />
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="relative max-w-3xl mx-auto px-4 py-14 md:py-20">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-4">
              <Clock className="w-3 h-3" /> Dúvidas frequentes
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Suas dúvidas,{' '}
              <span className="bg-gradient-to-r from-emerald-300 to-green-400 bg-clip-text text-transparent">
                respondidas
              </span>
            </h2>
          </div>

          <div className="space-y-3" data-testid="section-faq">
            {FAQ_ITEMS.map((item, i) => (
              <FAQItem
                key={i}
                index={i}
                question={item.q}
                answer={item.a}
                open={openFaq === i}
                onToggle={() => setOpenFaq(openFaq === i ? null : i)}
              />
            ))}
          </div>
        </section>

        {/* ── CTA FINAL ── */}
        <section className="relative max-w-2xl mx-auto px-4 pb-16 md:pb-24 text-center">
          <div className="rounded-3xl border border-emerald-500/30 bg-black/50 backdrop-blur p-8 md:p-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
              Comprove com seus{' '}
              <span className="bg-gradient-to-r from-emerald-300 to-green-400 bg-clip-text text-transparent">
                próprios olhos
              </span>
            </h2>
            <Button
              onClick={() => openFreeGroupModal('final-cta')}
              className="w-full sm:w-auto h-14 px-10 bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 text-black font-bold text-base border-0 shadow-xl shadow-emerald-500/50 transition-transform hover:scale-[1.02]"
              data-testid="button-final-cta"
            >
              ENTRAR NO GRUPO FREE AGORA →
            </Button>
            <p className="text-white/35 text-xs mt-5">
              🦈 100% Gratuito · Acesso imediato · Sem compromisso
            </p>
            <a
              href={SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 text-white/40 hover:text-emerald-400 text-xs underline underline-offset-2 transition-colors"
              data-testid="button-final-support"
            >
              Falar com Suporte
            </a>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="relative max-w-7xl mx-auto px-4 py-10 text-center text-xs text-white/40 border-t border-emerald-500/15">
          <div className="mb-3">
            <a
              href={SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/40 hover:text-emerald-400 underline underline-offset-2 transition-colors text-xs"
              data-testid="button-footer-support"
            >
              Precisa de ajuda? Fale com o suporte
            </a>
          </div>
          © {new Date().getFullYear()} Shark 100% Green · Aposte com responsabilidade.
        </footer>

      </div>

      {/* ── STICKY BAR MOBILE ── */}
      {!ctaInView && (
        <div
          className="sm:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-emerald-500/30 bg-[hsl(150_35%_3%/0.97)] px-4 py-3"
          data-testid="sticky-bar-mobile"
        >
          <button
            onClick={() => openFreeGroupModal('sticky-bar')}
            className="w-full rounded-lg bg-emerald-500 text-white font-bold text-sm py-3 tracking-wide"
            data-testid="button-sticky-bar"
          >
            ENTRAR NO GRUPO FREE →
          </button>
        </div>
      )}

      {/* ── MODAL GRUPO FREE ── */}
      <FreeGroupModal open={showModal} onClose={() => setShowModal(false)} />

      {/* Ticker keyframe */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>

      {/* Meta Pixel — fallback noscript */}
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </div>
  );
}

/* ── FreeGroupModal ── */
function FreeGroupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', whatsapp: '', email: '' });
  const [errors, setErrors] = useState<Partial<Record<'name' | 'whatsapp', string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const utmRef = useRef<UtmParams>({
    utm_source: null, utm_medium: null, utm_campaign: null,
    utm_content: null, utm_term: null, fbclid: null, ct: null,
  });

  useEffect(() => {
    if (!open) return;
    const params = readUtmParams();
    utmRef.current = params;
    try {
      const saved = sessionStorage.getItem(TRIAL_UTM_KEY);
      if (!params.utm_source && !params.fbclid && saved) {
        utmRef.current = JSON.parse(saved);
      }
    } catch { /* ignore */ }
  }, [open]);

  const update = (k: 'name' | 'whatsapp' | 'email', v: string) => {
    setForm(prev => ({ ...prev, [k]: v }));
    if (errors[k as 'name' | 'whatsapp']) {
      setErrors(prev => ({ ...prev, [k]: undefined }));
    }
  };

  const handleClose = () => {
    setForm({ name: '', whatsapp: '', email: '' });
    setErrors({});
    setServerError(null);
    setSuccess(false);
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const parsed = modalSchema.safeParse({ name: form.name, whatsapp: form.whatsapp });
    if (!parsed.success) {
      const fe: Partial<Record<'name' | 'whatsapp', string>> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as 'name' | 'whatsapp';
        if (!fe[k]) fe[k] = issue.message;
      }
      setErrors(fe);
      return;
    }

    setSubmitting(true);
    try {
      const utms = utmRef.current;
      const whatsapp = parsed.data.whatsapp.replace(/\D/g, '');
      const emailRaw = form.email.trim().toLowerCase();
      const email = emailRaw && emailRaw.includes('@') && emailRaw.length > 5
        ? emailRaw
        : `free_${whatsapp}@placeholder.betshark`;

      const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

      const { error: insertErr } = await _sbLeads
        .from('trial_leads')
        .insert({
          name: parsed.data.name,
          whatsapp,
          email,
          telegram_username: `free_${whatsapp}`,
          status: 'active',
          cohort: 'free_group',
          expires_at: expiresAt,
          utm_source:   utms.utm_source   || null,
          utm_medium:   utms.utm_medium   || null,
          utm_campaign: utms.utm_campaign || null,
          ct:           utms.ct           || null,
        });

      // 23505 = whatsapp duplicado — tudo bem, deixa entrar no grupo mesmo assim
      const pgCode = (insertErr as { code?: string } | null)?.code;
      if (insertErr && pgCode !== '23505') {
        console.error('free-group-signup insert error', insertErr);
        setServerError('Não foi possível salvar seu cadastro. Tente novamente.');
        return;
      }

      track('cta_free_group_submitted', { name: parsed.data.name });
      trackT4Y('cta_telegram', {
        button: 'modal-submit',
        destination: 'free_groups',
        url: FREE_GROUPS_URL,
      });
      trackPixel('Lead', { content_name: 'free-group' });
      window.open(FREE_GROUPS_URL, '_blank', 'noopener,noreferrer');
      setSuccess(true);
      setTimeout(() => handleClose(), 2000);
    } catch {
      setServerError('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        className="bg-[hsl(150_30%_5%)] border border-emerald-500/30 text-white max-w-md"
        data-testid="modal-free-group"
      >
        {success ? (
          <div
            className="flex flex-col items-center justify-center gap-4 py-8 text-center"
            data-testid="modal-free-group-success"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center animate-pulse">
              <span className="text-3xl">✅</span>
            </div>
            <div>
              <p className="text-lg font-bold text-emerald-400">Link aberto!</p>
              <p className="text-sm text-white/70 mt-1 leading-relaxed">
                Clique em <span className="text-white font-semibold">"Aceitar convite"</span> no Telegram para entrar no grupo.
              </p>
            </div>
          </div>
        ) : (
        <>
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">
            Quase lá! 🦈 Informe seus dados para entrar
          </DialogTitle>
          <DialogDescription className="text-white/60 text-sm">
            Acesso 100% gratuito — sem cartão, sem compromisso
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 mt-2" data-testid="form-free-group">
          <ModalField
            label="Nome completo"
            error={errors.name}
            input={
              <Input
                value={form.name}
                onChange={e => update('name', e.target.value)}
                placeholder="Seu nome"
                className="bg-white/5 border-white/10 focus:border-emerald-500/60 h-11 text-white"
                data-testid="input-modal-name"
                autoFocus
              />
            }
          />
          <ModalField
            label="WhatsApp com DDD"
            error={errors.whatsapp}
            input={
              <Input
                inputMode="tel"
                value={fmtWhatsapp(form.whatsapp)}
                onChange={e => update('whatsapp', e.target.value)}
                placeholder="(11) 91234-5678"
                className="bg-white/5 border-white/10 focus:border-emerald-500/60 h-11 text-white"
                data-testid="input-modal-whatsapp"
              />
            }
          />
          <ModalField
            label="E-mail (opcional)"
            input={
              <Input
                type="email"
                value={form.email}
                onChange={e => update('email', e.target.value)}
                placeholder="seu@email.com"
                className="bg-white/5 border-white/10 focus:border-emerald-500/60 h-11 text-white"
                data-testid="input-modal-email"
              />
            }
          />

          {serverError && (
            <div
              className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/25 p-3 text-sm text-red-300"
              data-testid="text-modal-error"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-12 bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 text-black font-bold text-base border-0 shadow-lg shadow-emerald-500/40 disabled:opacity-60"
            data-testid="button-modal-submit"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Entrando…
              </span>
            ) : (
              'ENTRAR NO GRUPO AGORA →'
            )}
          </Button>

          <p className="text-[10px] text-center text-white/50 leading-relaxed">
            Ao entrar, você concorda em receber sinais e comunicados do grupo.
          </p>
        </form>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── ModalField ── */
function ModalField({
  label, error, input,
}: {
  label: string;
  error?: string;
  input: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-[10px] font-semibold uppercase tracking-wider text-white/60 mb-1.5 block">
        {label}
      </Label>
      {input}
      {error && (
        <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
}

/* ── SharkLogo ── */
function SharkLogo() {
  return (
    <div className="flex items-center gap-2.5" data-testid="logo-shark">
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="sharkGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <path
          d="M4 26 C4 26 8 10 16 6 C16 6 13 16 20 20 C20 20 14 22 12 26 Z"
          fill="url(#sharkGrad)"
        />
        <path
          d="M12 26 C12 26 14 18 22 18 C26 18 28 22 28 26 Z"
          fill="url(#sharkGrad)"
          opacity="0.7"
        />
        <path
          d="M2 26 L30 26"
          stroke="url(#sharkGrad)"
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

/* ── UrgencyBar ── */
function UrgencyBar() {
  return (
    <div
      className="relative z-30 border-b border-emerald-500/30 bg-emerald-500/13 px-4 py-2.5 text-center text-[0.78rem] font-medium text-emerald-300"
      data-testid="urgency-bar"
    >
      <span
        className="inline-block w-[7px] h-[7px] rounded-full bg-red-500 mr-2 align-middle"
        style={{ animation: 'pulse 1.4s ease-in-out infinite' }}
      />
      Sinais ao vivo agora —{' '}
      <strong className="text-white">venha lucrar com a gente hoje.</strong>
    </div>
  );
}

/* ── StatMini ── */
function StatMini({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/7 p-2.5 text-center">
      <div className="text-emerald-400 font-extrabold text-lg leading-tight tracking-tight">
        {value}
      </div>
      <div className="text-white/50 text-[0.62rem] uppercase tracking-wide mt-0.5">{label}</div>
    </div>
  );
}

/* ── ProofNum ── */
function ProofNum({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-emerald-400 font-extrabold text-2xl leading-tight tracking-tight">
        {value}
      </div>
      <div className="text-white/50 text-[0.65rem] uppercase tracking-wide mt-0.5">{label}</div>
    </div>
  );
}

/* ── TestimonialCard ── */
function TestimonialCard({
  name, city, result, text, stars, testId,
}: {
  name: string;
  city: string;
  result: string;
  text: string;
  stars: number;
  testId: string;
}) {
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:border-emerald-500/25 transition-colors"
      data-testid={testId}
    >
      <div className="flex items-center gap-1 mb-3">
        {Array.from({ length: stars }).map((_, i) => (
          <Star key={i} className="w-4 h-4 fill-emerald-400 text-emerald-400" />
        ))}
      </div>
      <p className="text-white/75 text-sm leading-relaxed mb-4">"{text}"</p>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/40 to-green-700/30 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-emerald-300">{initials}</span>
          </div>
          <div>
            <p className="font-bold text-sm">{name}</p>
            <p className="text-white/40 text-xs">{city}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <span className="text-emerald-400 font-bold text-sm">{result}</span>
        </div>
      </div>
    </div>
  );
}

/* ── StepCard ── */
function StepCard({
  step, icon, title, text, testId,
}: {
  step: number;
  icon: React.ReactNode;
  title: string;
  text: string;
  testId: string;
}) {
  return (
    <div
      className="rounded-2xl border border-emerald-500/20 bg-white/[0.02] p-5 hover:border-emerald-500/40 hover:bg-emerald-500/[0.04] transition-colors relative"
      data-testid={testId}
    >
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center text-black font-bold text-xs shadow-lg shadow-emerald-500/40 mx-auto mb-3">
        {step}
      </div>
      <div className="flex justify-center mb-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
          {icon}
        </div>
      </div>
      <h3 className="font-bold text-base mb-1.5 text-center">{title}</h3>
      <p className="text-white/60 text-sm leading-relaxed text-center">{text}</p>
    </div>
  );
}

/* ── FAQItem ── */
function FAQItem({
  index, question, answer, open, onToggle,
}: {
  index: number;
  question: string;
  answer: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`rounded-2xl border transition-colors ${open ? 'border-emerald-500/30 bg-emerald-500/[0.05]' : 'border-white/10 bg-white/[0.02]'}`}
      data-testid={`card-faq-${index}`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 p-5 text-left"
        data-testid={`button-faq-toggle-${index}`}
      >
        <span className="font-semibold text-sm md:text-base text-white/90">{question}</span>
        <ChevronDown
          className={`w-5 h-5 flex-shrink-0 text-emerald-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-5 pb-5 text-white/65 text-sm leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import {
  CheckCircle2, AlertCircle, Clock,
  Star, ChevronDown, MessageCircle, Target, TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import proof1 from '@assets/WhatsApp_Image_2026-05-07_at_20.43.24_(3)_1778197516426.jpeg';
import proof2 from '@assets/WhatsApp_Image_2026-05-07_at_20.43.24_(2)_1778197516427.jpeg';
import proof3 from '@assets/WhatsApp_Image_2026-05-07_at_20.43.24_(1)_1778197516427.jpeg';
import proof4 from '@assets/WhatsApp_Image_2026-05-07_at_20.43.24_1778197516427.jpeg';
import proof5 from '@assets/WhatsApp_Image_2026-05-03_at_05.16.04_1777796184266-CnYvy8Lp_1778197516428.jpeg';
import proof6 from '@assets/WhatsApp_Image_2026-05-03_at_05.16.03_1777796184266-Cu4xMMoY_1778197516428.jpeg';
import proof7 from '@assets/WhatsApp_Image_2026-05-03_at_05.16.04_(1)_1777796184266-Bv3rf_1778197516428.jpeg';
import proof8 from '@assets/WhatsApp_Image_2026-05-04_at_18.43.57_1778197516429.jpeg';

const HERO_WEBP_URL = '/images/hero.webp';

const SUPABASE_URL = import.meta.env.VITE_MAIN_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_MAIN_SUPABASE_ANON_KEY as string;

const FREE_GROUPS_URL =
  (import.meta.env.VITE_FREE_GROUPS_URL as string | undefined) ||
  'https://t.me/+uxaDoyMx845kMGUx';

const PIXEL_ID = '1486249896237184';
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

type TrackEvent = 'view' | 'cta_focus_form' | 'cta_free_group' | 'cta_checkout';

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

const schema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome completo'),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  whatsapp: z.string().refine(v => v.replace(/\D/g, '').length >= 10, 'WhatsApp inválido (mín. 10 dígitos com DDD)'),
  telegram_username: z.string()
    .trim()
    .min(3, '@ do Telegram muito curto')
    .transform(v => v.replace(/^@/, '').toLowerCase())
    .refine(v => /^[a-z0-9_]{3,32}$/.test(v), 'Use apenas letras, números e _'),
});

type FormState = {
  name: string;
  email: string;
  whatsapp: string;
  telegram_username: string;
};

const fmtWhatsapp = (raw: string) => {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return d;
};

const FAQ_ITEMS = [
  {
    q: 'Funciona de verdade? Não é mais um grupo de palpite?',
    a: 'Não. O Shark 100% Green usa um método matemático de sinais antecipados — não palpites. Cada operação passa por filtro de valor, leitura de mercado e checagem de viabilidade antes de chegar pra você. E temos uma garantia de 7 dias: se não gostar, devolvemos 100% do valor, sem perguntas.',
  },
  {
    q: 'Não entendo nada de apostas esportivas. Consigo usar?',
    a: 'Sim. O procedimento chega mastigado: qual casa, quanto colocar, qual odd mínima e qual prazo. Em média 3 minutos de execução. Se você sabe mexer em um app de banco, consegue operar aqui.',
  },
  {
    q: 'R$ 148 é muito caro para testar',
    a: 'Um green médio no Shark cobre o valor do acesso inteiro. Você tem 7 dias completos para validar isso na prática, e se não acontecer, devolvemos tudo. O risco real de testar é zero.',
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
    a: 'O método tem histórico documentado, membros com resultados reais e uma política de devolução incondicional em 7 dias. Se não entregar o que promete, você sai com o dinheiro de volta. Simples assim.',
  },
];

const TICKER_ITEMS = [
  'Lucas M. fez R$312 em 5 dias de trial — São Paulo/SP',
  'Carla S.: R$487 na primeira semana, sem experiência',
  'Rafael O.: R$219 em 4 dias — Curitiba/PR',
  'Ana P.: R$380 em 7 dias — Rio de Janeiro/RJ',
  'Rodrigo T.: primeiro green na manhã do dia 1',
  '+500 alunos ativos em todo o Brasil',
  '7 dias grátis · acesso imediato · sem cartão',
  'Fernanda G.: R$290 trabalhando 1h por dia',
  'Marcos V.: sacou R$430 via PIX na primeira semana',
  'Juliana C.: zero experiência → R$260 em 6 dias',
  'Thiago B.: operou no intervalo do almoço e saiu positivo',
  'Beatriz L.: R$195 no dia 2 de trial — Fortaleza/CE',
];

export default function TrialLanding() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [formInView, setFormInView] = useState(true);
  const formRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.title = 'Shark 100% Green — 7 Dias Grátis';
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      'content',
      '7 dias grátis no grupo VIP Shark 100% Green: +500 alunos lucrando R$200/dia com promoções esportivas. Sem cartão. Acesso imediato.',
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
    const el = formRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setFormInView(entry.isIntersecting),
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scrollToForm = (_where: string) => {
    const el = document.getElementById('form-hero');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        const input = el.querySelector('input') as HTMLInputElement | null;
        if (input) input.focus();
      }, 600);
    }
  };

  const onFreeGroups = (where: string) => {
    track('cta_free_group', { button: where });
    trackT4Y('cta_telegram', {
      button: where,
      destination: 'free_groups',
      url: FREE_GROUPS_URL,
    });
    window.open(FREE_GROUPS_URL, '_blank', 'noopener,noreferrer');
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
      {/* Camada base: escurece top→bottom progressivamente */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, hsl(150 35% 3% / 0.72) 0%, hsl(150 35% 3% / 0.60) 20%, hsl(150 35% 3% / 0.68) 45%, hsl(150 35% 3% / 0.88) 70%, hsl(150 35% 3% / 0.97) 88%, hsl(150 35% 3% / 1.0) 100%)',
        }}
        aria-hidden="true"
      />
      {/* Camada lateral esquerda: garante leitura do copy no desktop */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, hsl(150 35% 3% / 0.65) 0%, hsl(150 35% 3% / 0.40) 40%, transparent 65%)',
        }}
        aria-hidden="true"
      />
      {/* Vinheta radial: suaviza bordas e centro brilhante */}
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
              Acesso VIP · vagas limitadas
            </div>
          </div>
        </header>

        {/* ── URGENCY BAR ── */}
        <UrgencyBar />

        {/* ── HERO 2 COLUNAS ── */}
        <section className="relative max-w-6xl mx-auto px-4 pt-8 pb-10 md:pt-12 md:pb-14">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-start">

            {/* Coluna esquerda: copy */}
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider">
                  🎯 7 DIAS GRÁTIS · SEM CARTÃO
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 border border-emerald-500/30 text-emerald-300 text-xs font-semibold uppercase tracking-wider">
                  ● Promoções Esportivas
                </span>
              </div>

              <h1
                className="text-[1.65rem] sm:text-[2rem] md:text-[2.25rem] font-bold leading-[1.28] tracking-tight drop-shadow-[0_4px_24px_rgba(0,0,0,0.85)]"
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

              {/* Trial callout */}
              <div className="rounded-xl border border-emerald-500/40 border-l-[3px] border-l-emerald-400 bg-gradient-to-r from-emerald-500/14 to-emerald-500/5 p-4">
                <p className="font-semibold text-white leading-snug text-sm md:text-base">
                  Entre em nosso Grupo VIP por{' '}
                  <span className="text-emerald-400">7 dias Grátis</span>, comprove com seus olhos e comece a faturar hoje!
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
                <strong className="text-white">Teste grátis por 7 dias</strong> e veja o resultado na sua conta.
              </p>

              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-white/60">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Sem cartão
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Acesso imediato
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Cancele quando quiser
                </span>
              </div>

              {/* CTA — mobile: botão explícito; desktop: rola para o form ao lado */}
              <Button
                onClick={() => scrollToForm('hero-primary')}
                className="w-full md:w-auto h-13 bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 text-black font-bold text-base border-0 shadow-xl shadow-emerald-500/50 transition-transform hover:scale-[1.02]"
                data-testid="button-hero-primary-cta"
              >
                QUERO MEUS 7 DIAS GRÁTIS
              </Button>
            </div>

            {/* Coluna direita: formulário inline */}
            <div ref={formRef} id="form-hero">
              <InlineSignupForm
                onFocusTrack={() => track('cta_focus_form', { button: 'form-hero' })}
                onSuccessTrack={(eventId) => trackPixel('Lead', { content_name: 'trial-7d' }, eventId)}
                onT4YTrack={(event, params) => trackT4Y(event, params)}
              />
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
            onClick={() => scrollToForm('how-section')}
            className="h-12 px-8 bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 text-black font-bold border-0 shadow-lg shadow-emerald-500/40"
            data-testid="button-how-cta"
          >
            Quero testar 7 Dias Grátis
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

          {/* Grade de prints reais dos membros */}
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
              result="R$ 312 em 5 dias de trial"
              text="Entrei sem saber nada de apostas. O procedimento chegou no grupo às 10h, fiz em 3 minutos no Bet365 e saí verde. Repeti isso 8 vezes no trial e fechei R$ 312 limpos."
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
              text="Opero no intervalo do trabalho. Em 4 dias de trial fechei R$ 219 positivo. Nunca tinha apostado em nada na vida. O grupo responde rápido quando trava alguma coisa na plataforma."
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
              onClick={() => scrollToForm('final-cta')}
              className="w-full sm:w-auto h-14 px-10 bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 text-black font-bold text-base border-0 shadow-xl shadow-emerald-500/50 transition-transform hover:scale-[1.02]"
              data-testid="button-final-cta"
            >
              COMEÇAR TESTE GRÁTIS AGORA →
            </Button>
            <p className="text-white/35 text-xs mt-5">
              🛡️ Garantia de 7 dias · Acesso imediato · Sem cartão
            </p>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="relative max-w-7xl mx-auto px-4 py-10 text-center text-xs text-white/40 border-t border-emerald-500/15">
          <div className="mb-3">
            <button
              onClick={() => onFreeGroups('footer')}
              className="text-white/40 hover:text-emerald-400 underline underline-offset-2 transition-colors text-xs"
              data-testid="button-footer-free-groups"
            >
              Prefere só os grupos gratuitos? Acesse aqui
            </button>
          </div>
          © {new Date().getFullYear()} Shark 100% Green · Aposte com responsabilidade.
        </footer>

      </div>

      {/* ── STICKY BAR MOBILE ── */}
      {!formInView && (
        <div
          className="sm:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-emerald-500/30 bg-[hsl(150_35%_3%/0.97)] px-4 py-3"
          data-testid="sticky-bar-mobile"
        >
          <button
            onClick={() => scrollToForm('sticky-bar')}
            className="w-full rounded-lg bg-emerald-500 text-white font-bold text-sm py-3 tracking-wide"
            data-testid="button-sticky-bar"
          >
            QUERO MEUS 7 DIAS GRÁTIS →
          </button>
        </div>
      )}

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
        {/* Shark fin shape */}
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

/* ── InlineSignupForm ── */
function InlineSignupForm({
  onFocusTrack,
  onSuccessTrack,
}: {
  onFocusTrack: () => void;
  onSuccessTrack: (eventId: string) => void;
  onT4YTrack: (event: string, params: Record<string, unknown>) => void;
}) {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({
    name: '', email: '', whatsapp: '', telegram_username: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [focusTracked, setFocusTracked] = useState(false);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  const update = (k: keyof FormState, v: string) => {
    setForm(prev => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors(prev => ({ ...prev, [k]: undefined }));
  };

  const handleFirstFocus = () => {
    if (!focusTracked) {
      setFocusTracked(true);
      onFocusTrack();
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const fe: Partial<Record<keyof FormState, string>> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof FormState;
        if (!fe[k]) fe[k] = issue.message;
      }
      setErrors(fe);
      return;
    }

    setSubmitting(true);
    const leadEventId = makeEventId();
    try {
      const url = `${SUPABASE_URL}/functions/v1/trial-signup`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON,
        },
        body: JSON.stringify({
          name: parsed.data.name,
          email: parsed.data.email,
          whatsapp: parsed.data.whatsapp.replace(/\D/g, ''),
          telegram_username: parsed.data.telegram_username,
          event_id: leadEventId,
          event_source_url: typeof window !== 'undefined' ? window.location.href : null,
          fbp: readCookie('_fbp'),
          fbc: readCookie('_fbc'),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setServerError(json?.error || 'Não foi possível processar sua solicitação. Tente novamente.');
        return;
      }
      onSuccessTrack(leadEventId);
      try {
        sessionStorage.setItem(
          'trial_success',
          JSON.stringify({
            botStartUrl: json.bot_start_url,
            inviteLink: json.invite_link,
            leadEventId,
          }),
        );
      } catch {
        /* sessionStorage indisponível */
      }
      navigate('/obrigado');
    } catch {
      setServerError('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="rounded-2xl border border-emerald-500/30 bg-[hsl(150_30%_5%/0.95)] p-5 md:p-6 backdrop-blur shadow-2xl shadow-emerald-500/10"
      data-testid="card-inline-signup"
    >
      <>
          <h3 className="font-bold text-white text-base mb-4">Garantir meu acesso grátis</h3>
          <form onSubmit={submit} className="space-y-3" data-testid="form-trial-signup">
            <Field
              label="Seu Nome"
              error={errors.name}
              input={
                <Input
                  ref={firstInputRef}
                  value={form.name}
                  onChange={e => update('name', e.target.value)}
                  onFocus={handleFirstFocus}
                  placeholder="Seu nome"
                  className="bg-white/5 border-white/10 focus:border-emerald-500/60 h-11 text-white"
                  data-testid="input-trial-name"
                />
              }
            />
            <Field
              label="Seu E-mail"
              error={errors.email}
              input={
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => update('email', e.target.value)}
                  onFocus={handleFirstFocus}
                  placeholder="seu@email.com"
                  className="bg-white/5 border-white/10 focus:border-emerald-500/60 h-11 text-white"
                  data-testid="input-trial-email"
                />
              }
            />
            <Field
              label="Seu WhatsApp"
              error={errors.whatsapp}
              input={
                <Input
                  inputMode="tel"
                  value={fmtWhatsapp(form.whatsapp)}
                  onChange={e => update('whatsapp', e.target.value)}
                  onFocus={handleFirstFocus}
                  placeholder="(11) 91234-5678"
                  className="bg-white/5 border-white/10 focus:border-emerald-500/60 h-11 text-white"
                  data-testid="input-trial-whatsapp"
                />
              }
            />
            <Field
              label="@ do Telegram"
              error={errors.telegram_username}
              hint="Sem o @ — ex: joao_silva"
              input={
                <Input
                  value={form.telegram_username}
                  onChange={e => update('telegram_username', e.target.value.replace(/\s/g, ''))}
                  onFocus={handleFirstFocus}
                  placeholder="seu_usuario"
                  className="bg-white/5 border-white/10 focus:border-emerald-500/60 h-11 text-white"
                  data-testid="input-trial-telegram"
                />
              }
            />

            {serverError && (
              <div
                className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/25 p-3 text-sm text-red-300"
                data-testid="text-trial-error"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{serverError}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-12 bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 text-black font-bold text-base border-0 shadow-lg shadow-emerald-500/40 disabled:opacity-60"
              data-testid="button-trial-submit"
            >
              {submitting ? 'Processando…' : 'QUERO MEUS 7 DIAS GRÁTIS'}
            </Button>

            <p className="text-[10px] text-center text-white/50 leading-relaxed">
              Acesso liberado na hora · Sem cartão · Cada pessoa usa o trial apenas uma vez.
            </p>
          </form>
        </>
    </div>
  );
}

/* ── Field ── */
function Field({
  label, error, input, hint,
}: {
  label: string;
  error?: string;
  input: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <Label className="text-[10px] font-semibold uppercase tracking-wider text-white/60 mb-1.5 block">
        {label}
      </Label>
      {input}
      {hint && !error && <p className="text-[10px] text-white/50 mt-1">{hint}</p>}
      {error && (
        <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
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

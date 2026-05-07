import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import {
  Sparkles, Send, CheckCircle2, AlertCircle, ExternalLink, Clock,
  ShieldCheck, Timer, Brain, LineChart, Zap, Crown, Users, ShoppingBag,
  Star, ChevronDown, TrendingUp, Award, MessageCircle, Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import sharkHeroImg from '@assets/image_1776543554081.png';

const SUPABASE_URL = import.meta.env.VITE_MAIN_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_MAIN_SUPABASE_ANON_KEY as string;

const FREE_GROUPS_URL =
  (import.meta.env.VITE_FREE_GROUPS_URL as string | undefined) ||
  'https://t.me/+uxaDoyMx845kMGUx';
const BUY_NOW_URL =
  (import.meta.env.VITE_BUY_NOW_URL as string | undefined) ||
  (import.meta.env.VITE_TRIAL_UPGRADE_CHECKOUT_URL as string | undefined) ||
  'https://lastlink.com/p/CEAEE6585/checkout-payment/';

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
      /* CustomEvent indisponível em browsers muito antigos — ignora */
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

type TrackEvent =
  | 'view'
  | 'cta_open_form'
  | 'cta_free_group'
  | 'cta_checkout';

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

export default function TrialLanding() {
  const [modalOpen, setModalOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // SEO básico
  useEffect(() => {
    document.title = 'Shark 100% Green — Acesso VIP de 7 dias';
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      'content',
      'Acesso VIP de 7 dias ao método exclusivo Shark 100% Green: sinais antecipados de bônus, cashback e freebets em tempo real.',
    );
  }, []);

  // Tracking de view (uma vez por sessão do navegador)
  useEffect(() => {
    const SESSION_KEY = 'trial-landing:view-tracked';
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* sessionStorage indisponível — segue e registra view */
    }
    track('view', { page: 'trial-landing' });
  }, []);

  // Microsoft Clarity — carrega só na rota /trial.
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

  // Meta Pixel — carrega só enquanto a rota /trial está montada.
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
    trackCapi('PageView', pageviewEventId);

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

  const openForm = (where: string) => {
    track('cta_open_form', { button: where });
    setModalOpen(true);
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

  const onBuyNow = (where: string) => {
    track('cta_checkout', { button: where, source: 'trial-landing' });
    trackPixel('InitiateCheckout', { content_name: 'shark-100-green' });
    window.open(BUY_NOW_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="min-h-screen text-white relative"
      style={{
        backgroundColor: 'hsl(150 30% 4%)',
        backgroundImage: `url(${sharkHeroImg})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        backgroundAttachment: 'fixed',
      }}
      data-testid="bg-shark-wallpaper"
    >
      {/* Overlays */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, hsl(150 35% 3% / 0.35) 0%, hsl(150 35% 3% / 0.20) 25%, hsl(150 35% 3% / 0.55) 60%, hsl(150 35% 3% / 0.92) 90%, hsl(150 35% 3% / 0.98) 100%)',
        }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 35%, transparent 40%, hsl(150 35% 3% / 0.55) 100%)',
        }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[700px] rounded-full bg-emerald-500/15 blur-[160px]" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full bg-emerald-400/10 blur-[140px]" />
      </div>

      <div className="relative z-10">

        {/* ── HERO ── */}
        <header className="relative">
          <div className="max-w-7xl mx-auto px-4 pt-8 md:pt-10 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <Crown className="w-5 h-5 text-black" />
              </div>
              <span className="font-bold tracking-tight text-lg drop-shadow-lg">
                Shark <span className="text-emerald-400">100% Green</span>
              </span>
            </div>
            <div className="hidden md:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/50 backdrop-blur border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Acesso VIP · vagas limitadas
            </div>
          </div>

          <section className="relative max-w-3xl mx-auto px-4 pt-10 md:pt-20 pb-20 md:pb-32 text-center">
            <div className="space-y-6 md:space-y-7 animate-fade-in-up">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/50 backdrop-blur border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                <Sparkles className="w-3 h-3" />
                Método estratégico · sinais antecipados
              </div>

              <h1
                className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] drop-shadow-[0_4px_24px_rgba(0,0,0,0.85)]"
                data-testid="text-hero-title"
              >
                Cansado de perder a odd boa{' '}
                <span className="bg-gradient-to-r from-emerald-300 via-green-400 to-emerald-500 bg-clip-text text-transparent">
                  por 2 segundos?
                </span>
              </h1>

              <p
                className="text-lg md:text-xl text-emerald-300 font-semibold drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)]"
                data-testid="text-hero-hook"
              >
                Existe um método que te coloca 10 minutos na frente do mercado.
              </p>

              <p
                className="text-base md:text-lg text-white/80 max-w-2xl mx-auto leading-relaxed drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)]"
                data-testid="text-hero-subtitle"
              >
                Receba a operação pronta, execute em 3 minutos e saia no verde —
                sem precisar entender de odds ou planilha.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Button
                  onClick={() => openForm('hero-primary')}
                  className="h-14 px-8 bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 text-black font-bold text-base border-0 shadow-xl shadow-emerald-500/50 transition-transform hover:scale-[1.03]"
                  data-testid="button-hero-trial"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Quero meu acesso VIP agora — entro hoje ainda
                </Button>
              </div>

              <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-white/75 pt-1 drop-shadow-[0_1px_8px_rgba(0,0,0,0.8)]">
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Sem cartão</span>
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Acesso imediato</span>
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Cancele quando quiser</span>
              </div>
            </div>
          </section>
        </header>

        {/* ── PROVA SOCIAL ── */}
        <section className="relative max-w-7xl mx-auto px-4 pb-14 md:pb-20">
          <div className="rounded-3xl border border-emerald-500/20 bg-black/40 backdrop-blur p-6 md:p-10">
            {/* Contador de membros */}
            <div className="text-center mb-8">
              <MemberCounter target={2847} />
              <p className="text-white/50 text-sm mt-1">membros ativos esta semana no grupo VIP</p>
            </div>

            {/* Mini-depoimentos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TestimonialCard
                name="Lucas M."
                city="São Paulo"
                result="R$ 312 na primeira semana"
                text="Na primeira semana fiz R$ 312 seguindo os sinais. Nem precisei entender nada de odds."
                stars={5}
                testId="card-testimonial-1"
              />
              <TestimonialCard
                name="Carla S."
                city="Belo Horizonte"
                result="R$ 487 em 5 dias"
                text="Achei que era mais um grupo de palpite. Mas os sinais chegam antes da odd mudar."
                stars={5}
                testId="card-testimonial-2"
              />
              <TestimonialCard
                name="Rafael O."
                city="Curitiba"
                result="R$ 219 em 4 dias de trial"
                text="Green na primeira operação. Em 4 dias de trial já estava positivo — sem nenhuma experiência."
                stars={5}
                testId="card-testimonial-3"
              />
            </div>
          </div>
        </section>

        {/* ── AGITAÇÃO DA DOR ── */}
        <section className="relative max-w-7xl mx-auto px-4 py-10 md:py-14">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <p className="text-white/50 text-xs uppercase tracking-widest font-semibold mb-3">Você reconhece alguma dessas situações?</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              A frustração que todo apostador <span className="text-red-400">já sentiu</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto mb-10">
            <PainCard
              icon="⚡"
              title="A odd boa some em segundos"
              text="Você abre o site, encontra a odd perfeita — e quando vai clicar, ela já mudou. Sempre 2 segundos tarde."
              testId="card-pain-1"
            />
            <PainCard
              icon="📨"
              title="Sinais de grupo que chegam tarde"
              text="Você recebe o sinal no grupo público, tenta entrar — e a odd já está diferente. Você chega depois de todo mundo."
              testId="card-pain-2"
            />
            <PainCard
              icon="📊"
              title="Planilhas que consomem mais que geram"
              text="Você passa horas calculando stakes e probabilidades. No fim das contas, o tempo investido não justifica o resultado."
              testId="card-pain-3"
            />
          </div>

          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm font-semibold">
              <TrendingUp className="w-4 h-4" />
              O Shark resolve os 3 — veja como abaixo
            </div>
          </div>
        </section>

        {/* ── O MÉTODO EM 3 PASSOS ── */}
        <section className="relative max-w-7xl mx-auto px-4 py-14 md:py-20">
          <div className="text-center max-w-2xl mx-auto mb-10 md:mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-4">
              <Zap className="w-3 h-3" /> Como funciona
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              O Método <span className="text-emerald-400">Shark Antecipado</span>
            </h2>
            <p className="text-white/60 mt-3 text-sm md:text-base">
              3 passos. 3 minutos. Você já está operando.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 md:gap-6 max-w-5xl mx-auto">
            <StepCard
              step={1}
              icon={<MessageCircle className="w-6 h-6 text-emerald-400" />}
              title="Receba o sinal"
              text="O sinal chega com até 10 minutos de antecedência — com a casa, a odd mínima, o stake e o prazo recomendado. Tudo mastigado."
              testId="card-step-1"
            />
            <StepCard
              step={2}
              icon={<Target className="w-6 h-6 text-emerald-400" />}
              title="Confira em 30 segundos"
              text="Você abre o app da bookmaker, encontra o mercado indicado e confirma que a odd ainda está acima do mínimo. Sem pressa."
              testId="card-step-2"
            />
            <StepCard
              step={3}
              icon={<TrendingUp className="w-6 h-6 text-emerald-400" />}
              title="Execute e saia no verde"
              text="Coloca o valor indicado, confirma a aposta e pronto. Sem depender de velocidade de conexão ou site rápido."
              testId="card-step-3"
            />
          </div>

          <div className="text-center mt-10">
            <Button
              onClick={() => openForm('method-section')}
              className="h-12 px-8 bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 text-black font-bold border-0 shadow-lg shadow-emerald-500/40"
              data-testid="button-method-trial"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Quero testar 7 Dias
            </Button>
          </div>
        </section>

        {/* ── PILARES (benefícios) ── */}
        <section className="relative max-w-7xl mx-auto px-4 py-14 md:py-20">
          <div className="text-center max-w-2xl mx-auto mb-10 md:mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-4">
              <Award className="w-3 h-3" /> Diferenciais
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Por que o Shark é <span className="text-emerald-400">diferente</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4 md:gap-5">
            <Pillar
              icon={<ShieldCheck className="w-6 h-6 text-emerald-400" />}
              title="Sem pressão de execução"
              text="Você recebe o sinal com antecedência suficiente para analisar, conferir saldo e operar com calma — nada de correr atrás de odd morrendo."
              testId="card-pillar-pressure"
            />
            <Pillar
              icon={<Zap className="w-6 h-6 text-emerald-400" />}
              title="Risco zero de instabilidade"
              text="Operações montadas antes do mercado se mexer. Você não depende de site travando, conexão lenta ou bookmaker fechando linha."
              testId="card-pillar-stability"
            />
            <Pillar
              icon={<Timer className="w-6 h-6 text-emerald-400" />}
              title="Tempo de execução garantido"
              text="O método garante uma janela real para clicar, conferir e enviar a operação — porque ganhar dinheiro não pode ser corrida de 100m."
              testId="card-pillar-time"
            />
          </div>
        </section>

        {/* ── ESTRATÉGIA, NÃO SORTE ── */}
        <section className="relative max-w-7xl mx-auto px-4 py-14 md:py-20">
          <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-white/[0.02] to-transparent p-6 md:p-12 backdrop-blur">
            <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-4">
                  <Brain className="w-3 h-3" /> Diferencial
                </div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                  Estratégia, <span className="text-emerald-400">não sorte</span>.
                </h2>
                <p className="text-white/70 leading-relaxed">
                  Aqui dentro ninguém te manda "palpite". Você recebe operação validada,
                  com leitura matemática e procedimento mastigado — pronto pra executar.
                </p>
                <div className="mt-7">
                  <Button
                    onClick={() => openForm('strategy-section')}
                    className="h-12 px-7 bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 text-black font-bold border-0 shadow-lg shadow-emerald-500/40"
                    data-testid="button-strategy-trial"
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    Quero testar 7 Dias
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <Bullet
                  icon={<LineChart className="w-5 h-5 text-emerald-400" />}
                  title="Sinais validados"
                  text="Cada sinal passa por filtro de valor, leitura de mercado e checagem de viabilidade — o que chega na sua tela já foi peneirado."
                  testId="card-bullet-signals"
                />
                <Bullet
                  icon={<Brain className="w-5 h-5 text-emerald-400" />}
                  title="Procedimento matemático mastigado"
                  text="Não precisa decorar planilha nem entender de odds: vem o passo-a-passo da operação com stake, casa e prazo recomendados."
                  testId="card-bullet-math"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA INTERMEDIÁRIO (com preço) ── */}
        <section className="relative max-w-3xl mx-auto px-4 py-10 md:py-14 text-center">
          <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-green-500/5 to-transparent p-8 md:p-12 backdrop-blur">
            <p className="text-emerald-300 text-xs font-semibold uppercase tracking-widest mb-3">Oferta de acesso</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
              7 dias por <span className="text-emerald-400">R$ 148</span>
            </h2>
            <p className="text-white/60 text-sm mb-6">
              Acesso completo ao grupo VIP, todos os sinais do método e suporte durante o período.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => openForm('mid-cta')}
                className="h-14 px-8 py-3 bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 text-black font-bold text-base border-0 shadow-xl shadow-emerald-500/40 transition-transform hover:scale-[1.02]"
                data-testid="button-mid-cta-trial"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Começar com sinal de hoje — 7 dias por R$ 148
              </Button>
            </div>
            <p className="text-white/40 text-xs mt-4">Sem cartão de crédito · Acesso imediato · Cancele quando quiser</p>
          </div>
        </section>

        {/* ── DEPOIMENTOS COMPLETOS ── */}
        <section className="relative max-w-7xl mx-auto px-4 py-14 md:py-20">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-4">
              <Star className="w-3 h-3 fill-emerald-400 text-emerald-400" /> Resultados reais
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Quem já está <span className="text-emerald-400">no verde</span>
            </h2>
            <p className="text-white/50 text-sm mt-2">
              Depoimentos de membros — nomes e cidades reais, resultados individuais variam.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
            <TestimonialCard
              name="Lucas M."
              city="São Paulo – SP"
              result="R$ 312 na primeira semana"
              text="Na primeira semana fiz R$ 312 seguindo os sinais. Nem precisei entender nada de odds ou planilha. O procedimento chega tão mastigado que é impossível errar."
              stars={5}
              testId="card-full-testimonial-1"
            />
            <TestimonialCard
              name="Carla S."
              city="Belo Horizonte – MG"
              result="R$ 487 em 5 dias de trial"
              text="Achei que era mais um grupo de palpite, não ia nem tentar. Mas os sinais chegam antes da odd mudar de verdade. Fiz R$ 487 nos primeiros 5 dias."
              stars={5}
              testId="card-full-testimonial-2"
            />
            <TestimonialCard
              name="Rafael O."
              city="Curitiba – PR"
              result="R$ 219 em 4 dias, zero experiência"
              text="Green na primeira operação. Em 4 dias de trial já estava com R$ 219 no positivo, sem nenhuma experiência prévia com apostas esportivas."
              stars={5}
              testId="card-full-testimonial-3"
            />
            <TestimonialCard
              name="Ana P."
              city="Rio de Janeiro – RJ"
              result="R$ 380 em uma semana"
              text="Zero de experiência com apostas. Segui o passo-a-passo e deu R$ 380 em uma semana. O mais importante: nunca fiquei perdida, o suporte do grupo é muito bom."
              stars={5}
              testId="card-full-testimonial-4"
            />
          </div>
        </section>

        {/* ── GARANTIA ── */}
        <section className="relative max-w-3xl mx-auto px-4 py-10 md:py-14">
          <div
            className="rounded-3xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 to-emerald-900/20 p-8 md:p-12 text-center backdrop-blur"
            data-testid="section-guarantee"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400/20 to-green-600/10 border border-emerald-500/40 flex items-center justify-center mx-auto mb-5">
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
            </div>
            <p className="text-emerald-300 text-xs font-semibold uppercase tracking-widest mb-2">Risco zero</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
              🛡️ GARANTIA 7 DIAS
            </h2>
            <p className="text-white/70 leading-relaxed text-base md:text-lg mb-2">
              Se não gostar por qualquer motivo,{' '}
              <span className="text-emerald-300 font-semibold">devolvemos 100% do valor</span>{' '}
              sem fazer uma única pergunta.
            </p>
            <p className="text-white/40 text-sm">
              Você tem 7 dias completos para validar o método na prática. O risco é todo nosso.
            </p>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="relative max-w-3xl mx-auto px-4 py-14 md:py-20">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-4">
              <Clock className="w-3 h-3" /> Dúvidas frequentes
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Suas dúvidas, <span className="text-emerald-400">respondidas</span>
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

        {/* ── CTA FINAL + URGÊNCIA ── */}
        <section className="relative max-w-3xl mx-auto px-4 py-10 md:py-16 text-center">
          <div className="rounded-3xl border border-emerald-500/30 bg-black/50 backdrop-blur p-8 md:p-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              Restam 23 vagas abertas esta semana
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
              Não perca mais odds por{' '}
              <span className="text-emerald-400">2 segundos</span>
            </h2>
            <p className="text-white/60 text-sm md:text-base mb-7 max-w-lg mx-auto">
              Entre agora, receba o sinal de hoje ainda e valide o método na prática — com garantia total de 7 dias.
            </p>
            <div className="flex flex-col gap-3 items-center">
              <Button
                onClick={() => openForm('final-cta')}
                className="h-14 px-10 bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 text-black font-bold text-lg border-0 shadow-xl shadow-emerald-500/50 transition-transform hover:scale-[1.03] w-full sm:w-auto"
                data-testid="button-final-cta-trial"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Garantir minha vaga antes de fechar
              </Button>
              <Button
                onClick={() => onBuyNow('final-cta')}
                variant="outline"
                className="h-11 px-6 bg-black/40 backdrop-blur border-white/20 hover:bg-white/10 hover:border-white/30 text-white/80 text-sm font-medium w-full sm:w-auto"
                data-testid="button-final-cta-buynow"
              >
                <ShoppingBag className="w-4 h-4 mr-2" />
                Já tenho certeza — quero comprar direto
              </Button>
            </div>
            <p className="text-white/30 text-xs mt-5">🛡️ Garantia de 7 dias · Acesso imediato · Sem cartão para o trial</p>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="relative max-w-7xl mx-auto px-4 py-10 text-center text-xs text-white/40">
          <div className="mb-4">
            <button
              onClick={() => onFreeGroups('footer')}
              className="text-white/40 hover:text-emerald-400 underline underline-offset-2 transition-colors text-xs"
              data-testid="button-footer-free-groups"
            >
              Prefere só os grupos gratuitos? Acesse aqui
            </button>
          </div>
          © {new Date().getFullYear()} Shark 100% Green · Acesso VIP por 7 dias.
          <br className="md:hidden" />
          <span className="md:ml-2">Aposte com responsabilidade.</span>
        </footer>

      </div>

      {/* MODAL DE CAPTURA */}
      <SignupModal open={modalOpen} onOpenChange={setModalOpen} />

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

/* ---------- Modal ---------- */

function SignupModal({
  open, onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [form, setForm] = useState<FormState>({
    name: '', email: '', whatsapp: '', telegram_username: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ botStartUrl: string; inviteLink: string; botUsername: string } | null>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => firstInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      setServerError(null);
      setErrors({});
    }
  }, [open]);

  const update = (k: keyof FormState, v: string) => {
    setForm(prev => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors(prev => ({ ...prev, [k]: undefined }));
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
      setSuccess({
        botStartUrl: json.bot_start_url,
        inviteLink: json.invite_link,
        botUsername: json.bot_username,
      });
      trackPixel('Lead', { content_name: 'trial-7d' }, leadEventId);
    } catch {
      setServerError('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[hsl(150_30%_5%)] border border-emerald-500/30 text-white max-w-md p-0 overflow-hidden shadow-2xl shadow-emerald-500/10"
        data-testid="dialog-trial-signup"
      >
        <div className="relative border-b border-white/10 p-5 bg-gradient-to-r from-emerald-500/15 via-green-500/10 to-emerald-600/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-md shadow-emerald-500/30">
              <Crown className="w-5 h-5 text-black" />
            </div>
            <div>
              <DialogHeader className="space-y-0 text-left">
                <DialogTitle className="text-base font-bold">
                  Garantir meu Acesso Estratégico
                </DialogTitle>
                <DialogDescription className="text-xs text-white/60">
                  Preencha os dados para liberar seus 7 dias no grupo VIP.
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>
        </div>

        <div className="p-5 md:p-6 bg-[hsl(150_30%_4%)]">
          {success ? (
            <div className="flex flex-col items-center text-center space-y-5 py-2" data-testid="card-trial-success">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-emerald-500/5 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Quase lá! 🎉</h2>
                <p className="text-white/70 text-sm">
                  <b>Passo 1:</b> abra o nosso bot no Telegram e toque em <b>Iniciar</b>. Ele vai te mandar o link do grupo VIP em segundos.
                </p>
              </div>
              <a
                href={success.botStartUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full"
                data-testid="link-bot-start"
                onClick={() =>
                  trackT4Y('cta_telegram', {
                    button: 'bot_start',
                    destination: 'trial_bot',
                    url: success.botStartUrl,
                  })
                }
              >
                <Button className="w-full h-12 bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 text-black font-bold text-base border-0 shadow-lg shadow-emerald-500/40">
                  <Send className="w-5 h-5 mr-2" />
                  Abrir bot no Telegram
                </Button>
              </a>
              <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-4 w-full text-left">
                <div className="flex gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1.5 text-xs">
                    <p className="font-semibold text-emerald-200">Por que esse passo?</p>
                    <p className="text-white/60">
                      Sem apertar Iniciar, o Telegram não permite que o bot te mande mensagens — e você perderia os avisos importantes durante o trial.
                    </p>
                  </div>
                </div>
              </div>
              <details className="w-full text-left">
                <summary className="text-[11px] text-white/50 cursor-pointer hover:text-white/70">
                  Não consegue abrir o bot? Use o link direto do grupo
                </summary>
                <a
                  href={success.inviteLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs text-emerald-300 underline break-all"
                  data-testid="link-telegram-invite-fallback"
                  onClick={() =>
                    trackT4Y('cta_telegram', {
                      button: 'invite_fallback',
                      destination: 'vip_invite',
                      url: success.inviteLink,
                    })
                  }
                >
                  {success.inviteLink}
                </a>
                <p className="text-[10px] text-white/40 mt-1">
                  Atenção: usando o link direto, você não recebe os avisos automáticos do bot.
                </p>
              </details>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4" data-testid="form-trial-signup">
              <Field
                label="Nome completo"
                error={errors.name}
                input={
                  <Input
                    ref={firstInputRef}
                    value={form.name}
                    onChange={e => update('name', e.target.value)}
                    placeholder="Seu nome"
                    className="bg-white/5 border-white/10 focus:border-emerald-500/60 h-11 text-white"
                    data-testid="input-trial-name"
                  />
                }
              />
              <Field
                label="E-mail"
                error={errors.email}
                input={
                  <Input
                    type="email"
                    value={form.email}
                    onChange={e => update('email', e.target.value)}
                    placeholder="seu@email.com"
                    className="bg-white/5 border-white/10 focus:border-emerald-500/60 h-11 text-white"
                    data-testid="input-trial-email"
                  />
                }
              />
              <Field
                label="WhatsApp"
                error={errors.whatsapp}
                input={
                  <Input
                    inputMode="tel"
                    value={fmtWhatsapp(form.whatsapp)}
                    onChange={e => update('whatsapp', e.target.value)}
                    placeholder="(11) 91234-5678"
                    className="bg-white/5 border-white/10 focus:border-emerald-500/60 h-11 text-white"
                    data-testid="input-trial-whatsapp"
                  />
                }
              />
              <Field
                label="@ do Telegram"
                error={errors.telegram_username}
                hint="Sem o @ — ex: joao_silva. Configure em Telegram → Configurações → Nome de usuário."
                input={
                  <Input
                    value={form.telegram_username}
                    onChange={e => update('telegram_username', e.target.value.replace(/\s/g, ''))}
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
                {submitting ? (
                  <>Processando…</>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    Quero meus 7 dias de Lucro com o Shark
                  </>
                )}
              </Button>

              <p className="text-[10px] text-center text-white/50 leading-relaxed">
                Ao continuar, você concorda em receber um link único de convite no Telegram.
                <br />Cada pessoa pode usar o trial gratuito apenas uma vez.
              </p>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Componentes existentes ---------- */

function Pillar({
  icon, title, text, testId,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  testId: string;
}) {
  return (
    <div
      className="rounded-2xl border border-emerald-500/15 bg-white/[0.03] p-6 hover:border-emerald-500/40 hover:bg-emerald-500/[0.04] transition-colors"
      data-testid={testId}
    >
      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="font-bold text-lg mb-2">{title}</h3>
      <p className="text-white/60 text-sm leading-relaxed">{text}</p>
    </div>
  );
}

function Bullet({
  icon, title, text, testId,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  testId: string;
}) {
  return (
    <div
      className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5"
      data-testid={testId}
    >
      <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <h3 className="font-bold mb-1">{title}</h3>
        <p className="text-white/60 text-sm leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

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

/* ---------- Novos componentes CRO ---------- */

function MemberCounter({ target }: { target: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 1800;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      current = Math.min(Math.round(increment * step), target);
      setCount(current);
      if (step >= steps) clearInterval(timer);
    }, duration / steps);
    return () => clearInterval(timer);
  }, [target]);

  return (
    <div className="flex items-center justify-center gap-3" data-testid="text-member-counter">
      <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-lg shadow-emerald-400/50" />
      <span className="text-4xl md:text-5xl font-bold text-emerald-400">
        +{count.toLocaleString('pt-BR')}
      </span>
    </div>
  );
}

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
      className="rounded-2xl border border-emerald-500/20 bg-white/[0.02] p-6 hover:border-emerald-500/40 hover:bg-emerald-500/[0.04] transition-colors relative"
      data-testid={testId}
    >
      <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center text-black font-bold text-sm shadow-lg shadow-emerald-500/40">
        {step}
      </div>
      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4 mt-2">
        {icon}
      </div>
      <h3 className="font-bold text-lg mb-2">{title}</h3>
      <p className="text-white/60 text-sm leading-relaxed">{text}</p>
    </div>
  );
}

function PainCard({
  icon, title, text, testId,
}: {
  icon: string;
  title: string;
  text: string;
  testId: string;
}) {
  return (
    <div
      className="rounded-2xl border border-red-500/15 bg-red-500/[0.04] p-5 hover:border-red-500/25 transition-colors"
      data-testid={testId}
    >
      <div className="text-2xl mb-3">{icon}</div>
      <h3 className="font-bold text-base mb-2 text-red-200">{title}</h3>
      <p className="text-white/55 text-sm leading-relaxed">{text}</p>
    </div>
  );
}

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

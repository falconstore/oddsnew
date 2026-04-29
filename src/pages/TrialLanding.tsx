import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import {
  Sparkles, Send, CheckCircle2, AlertCircle, ExternalLink, Clock,
  ShieldCheck, Timer, Brain, LineChart, Zap, Crown, Users, ShoppingBag,
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
  'https://t.me/+Icv1WXcUHTk1Yjhh';
const BUY_NOW_URL =
  (import.meta.env.VITE_BUY_NOW_URL as string | undefined) ||
  (import.meta.env.VITE_TRIAL_UPGRADE_CHECKOUT_URL as string | undefined) ||
  'https://lastlink.com/p/CEAEE6585/checkout-payment/';

const PIXEL_ID = '1295449168383975';

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
    _fbq?: unknown;
  }
}

function trackPixel(event: 'PageView' | 'Lead' | 'InitiateCheckout', params?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  try {
    if (typeof window.fbq === 'function') {
      window.fbq('track', event, params);
    }
  } catch {
    /* adblock / pixel não carregado — ignora */
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

export default function TrialLanding() {
  const [modalOpen, setModalOpen] = useState(false);

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

  // Meta Pixel — carrega só na rota /trial. Idempotente: se já foi injetado
  // (ex: usuário navegou pra outra rota e voltou), só dispara PageView de novo.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'PageView');
      return;
    }
    (function (f: Window & typeof globalThis, b: Document, e: string, v: string) {
      if (f.fbq) return;
      const n: any = function (...args: unknown[]) {
        n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
      };
      f.fbq = n;
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];
      const t = b.createElement(e) as HTMLScriptElement;
      t.async = true;
      t.src = v;
      const s = b.getElementsByTagName(e)[0];
      s.parentNode?.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq?.('init', PIXEL_ID);
    window.fbq?.('track', 'PageView');
  }, []);

  const openForm = (where: string) => {
    track('cta_open_form', { button: where });
    setModalOpen(true);
  };

  const onFreeGroups = (where: string) => {
    track('cta_free_group', { button: where });
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
      {/* Overlay escuro / verde para dar legibilidade ao texto.
          Mais claro no topo (deixa o Shark/Rolls aparecer) e escurece
          a partir do meio para garantir contraste do conteúdo abaixo. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, hsl(150 35% 3% / 0.35) 0%, hsl(150 35% 3% / 0.20) 25%, hsl(150 35% 3% / 0.55) 60%, hsl(150 35% 3% / 0.92) 90%, hsl(150 35% 3% / 0.98) 100%)',
        }}
        aria-hidden="true"
      />
      {/* Vinheta lateral suave para focar atenção no centro */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 35%, transparent 40%, hsl(150 35% 3% / 0.55) 100%)',
        }}
        aria-hidden="true"
      />
      {/* Glow neon-green sutil */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[700px] rounded-full bg-emerald-500/15 blur-[160px]" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full bg-emerald-400/10 blur-[140px]" />
      </div>
      {/* Wrapper que mantém todo o conteúdo acima dos overlays */}
      <div className="relative z-10">

      {/* HERO */}
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
            Acesso VIP por 7 dias · vagas limitadas
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
              Acesso VIP{' '}
              <span className="bg-gradient-to-r from-emerald-300 via-green-400 to-emerald-500 bg-clip-text text-transparent">
                Shark 100% Green
              </span>
              :<br className="hidden md:block" /> Lucro Estratégico por 7 Dias
            </h1>

            <p
              className="text-base md:text-lg text-white/85 max-w-2xl mx-auto leading-relaxed drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)]"
              data-testid="text-hero-subtitle"
            >
              Acesso completo ao método exclusivo de sinais antecipados para
              bônus, cashback e freebets da{' '}
              <span className="text-emerald-300 font-semibold">Shark 100% Green</span>.
              Sinais de Valor em tempo real.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 max-w-2xl mx-auto">
              <Button
                onClick={() => openForm('hero-primary')}
                className="h-12 sm:h-14 bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 text-black font-bold text-sm sm:text-base border-0 shadow-lg shadow-emerald-500/40 transition-transform hover:scale-[1.02]"
                data-testid="button-hero-trial"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Quero testar 7 Dias
              </Button>
              <Button
                onClick={() => onFreeGroups('hero')}
                variant="outline"
                className="h-12 sm:h-14 bg-black/40 backdrop-blur border-emerald-500/40 hover:bg-emerald-500/15 hover:border-emerald-400/60 text-white font-semibold"
                data-testid="button-hero-free-groups"
              >
                <Users className="w-5 h-5 mr-2 text-emerald-300" />
                Acessar Grupos Free
              </Button>
              <Button
                onClick={() => onBuyNow('hero')}
                variant="outline"
                className="h-12 sm:h-14 bg-black/40 backdrop-blur border-white/20 hover:bg-white/10 hover:border-white/30 text-white font-semibold"
                data-testid="button-hero-buy-now"
              >
                <ShoppingBag className="w-5 h-5 mr-2" />
                Compre Agora
              </Button>
            </div>

            <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-white/75 pt-2 drop-shadow-[0_1px_8px_rgba(0,0,0,0.8)]">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Sem cartão</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Acesso imediato</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Cancele quando quiser</span>
            </div>
          </div>
        </section>
      </header>

      {/* MÉTODO SHARK ANTECIPADO */}
      <section className="relative max-w-7xl mx-auto px-4 py-14 md:py-20">
        <div className="text-center max-w-2xl mx-auto mb-10 md:mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-4">
            <Zap className="w-3 h-3" /> Método
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Método <span className="text-emerald-400">Shark Antecipado</span>
          </h2>
          <p className="text-white/60 mt-3 text-sm md:text-base">
            A diferença entre apostar correndo atrás da odd e apostar com tempo de execução real.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 md:gap-5">
          <Pillar
            icon={<ShieldCheck className="w-6 h-6 text-emerald-400" />}
            title="Sem pressão"
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

        <div className="text-center mt-10">
          <Button
            onClick={() => openForm('method-section')}
            className="h-12 px-7 bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 text-black font-bold border-0 shadow-lg shadow-emerald-500/40"
            data-testid="button-method-trial"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Quero testar 7 Dias
          </Button>
        </div>
      </section>

      {/* ESTRATÉGIA, NÃO SORTE */}
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

      {/* FOOTER */}
      <footer className="relative max-w-7xl mx-auto px-4 py-10 text-center text-xs text-white/40">
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

  // Foca o primeiro campo ao abrir
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => firstInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Reseta estado ao fechar (após sucesso ou erro)
  useEffect(() => {
    if (!open) {
      setServerError(null);
      setErrors({});
      // Mantém success caso usuário reabra o modal e queira o link de novo:
      // se quiser zerar, descomente abaixo.
      // setSuccess(null);
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
      trackPixel('Lead', { content_name: 'trial-7d' });
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

/* ---------- Pequenos componentes ---------- */

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

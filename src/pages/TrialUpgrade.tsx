import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Sparkles, CheckCircle2, Crown, Zap, MessageCircle,
  CreditCard, Clock, ShieldCheck, TrendingUp, Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const SUPABASE_URL = import.meta.env.VITE_MAIN_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_MAIN_SUPABASE_ANON_KEY;

const WHATSAPP_E164 =
  (import.meta.env.VITE_TRIAL_UPGRADE_WHATSAPP as string | undefined)?.replace(/\D/g, '') || '5511999999999';
const WHATSAPP_MSG = encodeURIComponent(
  'Olá! Quero virar assinante da BetShark Pro depois do meu trial.',
);
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_E164}?text=${WHATSAPP_MSG}`;
const CHECKOUT_URL =
  (import.meta.env.VITE_TRIAL_UPGRADE_CHECKOUT_URL as string | undefined) || WHATSAPP_URL;
const TELEGRAM_SUPPORT_URL =
  (import.meta.env.VITE_TRIAL_UPGRADE_TELEGRAM_URL as string | undefined) || WHATSAPP_URL;

type Plan = {
  id: string;
  name: string;
  price: string;
  period: string;
  highlight?: boolean;
  badge?: string;
  perks: string[];
};

const PLANS: Plan[] = [
  {
    id: 'mensal',
    name: 'Mensal',
    price: 'R$ 197',
    period: '/mês',
    perks: [
      'Acesso ao grupo VIP no Telegram',
      'Sinais de Duplo Green em tempo real',
      'Suporte por WhatsApp em horário comercial',
    ],
  },
  {
    id: 'trimestral',
    name: 'Trimestral',
    price: 'R$ 447',
    period: '/3 meses',
    highlight: true,
    badge: 'Mais escolhido',
    perks: [
      'Tudo do plano Mensal',
      'Economia de R$ 144 (~25% off)',
      'Suporte prioritário',
      'Live mensal de bankroll',
    ],
  },
  {
    id: 'anual',
    name: 'Anual',
    price: 'R$ 1.497',
    period: '/12 meses',
    badge: 'Melhor custo',
    perks: [
      'Tudo do plano Trimestral',
      'Economia de R$ 867 (~37% off)',
      'Mentoria 1:1 trimestral',
      'Garantia de bloqueio do preço',
    ],
  },
];

type EventType = 'view' | 'cta_whatsapp' | 'cta_checkout' | 'cta_telegram';

function track(event_type: EventType, leadId: string | null, meta: Record<string, unknown> = {}) {
  if (!SUPABASE_URL || !SUPABASE_ANON) return;
  try {
    const url = `${SUPABASE_URL}/functions/v1/trial-upgrade-track`;
    const body = JSON.stringify({
      event_type,
      lead_id: leadId,
      source: 'trial-upgrade-page',
      meta,
    });
    // Usa keepalive para garantir envio em transições de página.
    fetch(url, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON,
      },
      body,
    }).catch(() => {});
  } catch {
    /* noop */
  }
}

export default function TrialUpgrade() {
  const [params] = useSearchParams();
  const leadId = params.get('lead');
  const utm = useMemo(() => ({
    source: params.get('utm_source'),
    medium: params.get('utm_medium'),
    campaign: params.get('utm_campaign'),
  }), [params]);

  const viewSent = useRef(false);
  const [success, setSuccess] = useState<null | EventType>(null);

  useEffect(() => {
    if (viewSent.current) return;
    viewSent.current = true;
    track('view', leadId, { utm });
  }, [leadId, utm]);

  const handleCta = (type: EventType, plan?: string) => {
    track(type, leadId, { utm, plan });
    setSuccess(type);
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background neon (mesma identidade da /trial) */}
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] rounded-full bg-pink-500/15 blur-[140px]" />
        <div className="absolute top-1/3 -left-32 w-[600px] h-[600px] rounded-full bg-purple-500/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-fuchsia-500/10 blur-[120px]" />
      </div>
      <div className="absolute inset-0 pointer-events-none -z-10 opacity-30"
        style={{
          backgroundImage: `linear-gradient(hsl(330 90% 60% / 0.05) 1px, transparent 1px), linear-gradient(90deg, hsl(330 90% 60% / 0.05) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, white 30%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, white 30%, transparent 100%)',
        }}
      />

      <div className="relative max-w-5xl mx-auto px-4 py-10 md:py-16">
        {/* Header */}
        <header className="text-center mb-10 md:mb-14 space-y-4 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/25 text-pink-300 text-xs font-semibold">
            <Sparkles className="w-3 h-3" />
            Seu trial está acabando — não perca o ritmo
            <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse-glow" />
          </div>
          <h1
            className="text-3xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-pink-400 via-fuchsia-400 to-purple-400 bg-clip-text text-transparent"
            data-testid="text-trial-upgrade-title"
          >
            Continue dentro do grupo VIP
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            Você experimentou de graça por 7 dias. Para manter os sinais de Duplo Green
            chegando em tempo real, escolha um plano abaixo — sem fidelidade, cancela quando quiser.
          </p>
        </header>

        {/* Benefícios */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10 md:mb-14">
          <Benefit icon={<TrendingUp className="w-5 h-5 text-emerald-300" />} title="Sinais 24/7"
            text="Duplo Green em tempo real direto no Telegram." />
          <Benefit icon={<ShieldCheck className="w-5 h-5 text-cyan-300" />} title="Sem fidelidade"
            text="Cancela quando quiser, sem multa." />
          <Benefit icon={<Zap className="w-5 h-5 text-amber-300" />} title="Acesso imediato"
            text="Pague e entre no grupo na hora." />
        </section>

        {/* Planos */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-10 md:mb-14">
          {PLANS.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onCheckout={() => {
                handleCta('cta_checkout', plan.id);
                window.open(CHECKOUT_URL, '_blank', 'noopener,noreferrer');
              }}
            />
          ))}
        </section>

        {/* CTAs alternativos */}
        <section className="glass rounded-3xl border border-pink-500/20 shadow-2xl shadow-pink-500/10 p-6 md:p-8 animate-fade-in-up">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 items-center">
            <div className="space-y-2">
              <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                <Crown className="w-5 h-5 text-pink-300" />
                Prefere falar com um humano?
              </h2>
              <p className="text-sm text-muted-foreground">
                Nosso time tira dúvidas e libera seu acesso na hora pelo WhatsApp ou Telegram.
              </p>
              {success && (
                <div className="flex items-center gap-2 text-xs text-emerald-300 mt-2" data-testid="text-trial-upgrade-success">
                  <CheckCircle2 className="w-4 h-4" />
                  Tudo certo! Estamos te esperando do outro lado.
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleCta('cta_whatsapp')}
                data-testid="link-trial-upgrade-whatsapp"
              >
                <Button
                  className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold border-0 shadow-lg shadow-emerald-500/30"
                  data-testid="button-trial-upgrade-whatsapp"
                >
                  <MessageCircle className="w-5 h-5 mr-2" />
                  WhatsApp
                </Button>
              </a>
              <a
                href={TELEGRAM_SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleCta('cta_telegram')}
                data-testid="link-trial-upgrade-telegram"
              >
                <Button
                  variant="outline"
                  className="w-full h-12 border-pink-500/40 text-pink-200 hover:bg-pink-500/10 font-semibold"
                  data-testid="button-trial-upgrade-telegram"
                >
                  <Send className="w-5 h-5 mr-2" />
                  Telegram
                </Button>
              </a>
            </div>
          </div>
        </section>

        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          Vagas limitadas para preservar a qualidade do grupo.
        </div>
      </div>
    </div>
  );
}

function Benefit({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="glass rounded-2xl border border-white/10 p-5 flex flex-col gap-2 animate-fade-in-up">
      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
        {icon}
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}

function PlanCard({ plan, onCheckout }: { plan: Plan; onCheckout: () => void }) {
  const isHi = plan.highlight;
  return (
    <div
      className={[
        'relative glass rounded-3xl p-6 flex flex-col gap-4 animate-fade-in-up transition-transform',
        isHi
          ? 'border border-pink-500/40 shadow-2xl shadow-pink-500/20 md:-translate-y-2'
          : 'border border-white/10',
      ].join(' ')}
      data-testid={`card-plan-${plan.id}`}
    >
      {plan.badge && (
        <span
          className={[
            'absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider',
            isHi
              ? 'bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-600 text-white shadow-lg shadow-pink-500/30'
              : 'bg-white/10 text-white/80 border border-white/15',
          ].join(' ')}
        >
          {plan.badge}
        </span>
      )}
      <div>
        <h3 className="text-lg font-bold" data-testid={`text-plan-name-${plan.id}`}>{plan.name}</h3>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-pink-400 via-fuchsia-400 to-purple-400 bg-clip-text text-transparent" data-testid={`text-plan-price-${plan.id}`}>
            {plan.price}
          </span>
          <span className="text-xs text-muted-foreground">{plan.period}</span>
        </div>
      </div>
      <ul className="space-y-2 text-sm">
        {plan.perks.map(p => (
          <li key={p} className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            <span className="text-muted-foreground">{p}</span>
          </li>
        ))}
      </ul>
      <Button
        onClick={onCheckout}
        className={[
          'w-full h-11 mt-auto font-semibold border-0',
          isHi
            ? 'bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white shadow-lg shadow-pink-500/30'
            : 'bg-white/10 hover:bg-white/15 text-white',
        ].join(' ')}
        data-testid={`button-plan-checkout-${plan.id}`}
      >
        <CreditCard className="w-4 h-4 mr-2" />
        Quero esse plano
      </Button>
    </div>
  );
}

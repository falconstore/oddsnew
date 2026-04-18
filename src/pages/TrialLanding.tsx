import { useState } from 'react';
import { z } from 'zod';
import { Sparkles, Send, CheckCircle2, AlertCircle, ExternalLink, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
  const [form, setForm] = useState<FormState>({
    name: '', email: '', whatsapp: '', telegram_username: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ link: string } | null>(null);

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
      const url = `${import.meta.env.VITE_MAIN_SUPABASE_URL}/functions/v1/trial-signup`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_MAIN_SUPABASE_ANON_KEY,
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
      setSuccess({ link: json.invite_link });
    } catch {
      setServerError('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background neon */}
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

      <div className="relative max-w-2xl mx-auto px-4 py-10 md:py-16">
        {/* Header */}
        <div className="text-center mb-8 md:mb-10 space-y-4 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/25 text-pink-300 text-xs font-semibold">
            <Sparkles className="w-3 h-3" />
            7 dias grátis · vagas limitadas
            <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse-glow" />
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-pink-400 via-fuchsia-400 to-purple-400 bg-clip-text text-transparent">
            Trial gratuito de 7 dias
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-lg mx-auto">
            Acesso completo ao grupo VIP da BetShark Pro com sinais de Duplo Green em tempo real.
          </p>
        </div>

        {success ? (
          <div className="glass rounded-3xl border border-emerald-500/25 p-6 md:p-8 shadow-2xl shadow-emerald-500/10 animate-fade-in-up" data-testid="card-trial-success">
            <div className="flex flex-col items-center text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-emerald-500/5 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Tudo pronto! 🎉</h2>
                <p className="text-muted-foreground text-sm">
                  Seu link de convite está abaixo. Clique para entrar no grupo VIP.
                </p>
              </div>
              <a
                href={success.link}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full"
                data-testid="link-telegram-invite"
              >
                <Button className="w-full h-12 bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-semibold text-base border-0 shadow-lg shadow-pink-500/30">
                  <ExternalLink className="w-5 h-5 mr-2" />
                  Abrir no Telegram
                </Button>
              </a>
              <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-4 w-full text-left">
                <div className="flex gap-3">
                  <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1.5 text-xs">
                    <p className="font-semibold text-amber-200">Link válido por 24h, 1 uso</p>
                    <p className="text-muted-foreground">Entre no grupo agora — após o join, seu acesso de 7 dias é ativado automaticamente.</p>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground break-all">
                Link: <span className="font-mono">{success.link}</span>
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="glass rounded-3xl border border-pink-500/20 shadow-2xl shadow-pink-500/10 overflow-hidden animate-fade-in-up" data-testid="form-trial-signup">
            <div className="relative border-b border-white/10 p-5 bg-gradient-to-r from-pink-500/15 via-fuchsia-500/8 to-purple-600/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500/30 to-fuchsia-500/10 border border-pink-500/30 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-pink-300" />
                </div>
                <div>
                  <h2 className="text-base font-bold">Garantir meu acesso</h2>
                  <p className="text-xs text-muted-foreground">Preencha os dados para receber o link de convite</p>
                </div>
              </div>
            </div>

            <div className="p-5 md:p-6 space-y-4 bg-background/95">
              <Field
                label="Nome completo"
                error={errors.name}
                input={
                  <Input
                    value={form.name}
                    onChange={e => update('name', e.target.value)}
                    placeholder="Seu nome"
                    className="bg-white/5 border-white/10 focus:border-pink-500/60 h-11"
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
                    className="bg-white/5 border-white/10 focus:border-pink-500/60 h-11"
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
                    className="bg-white/5 border-white/10 focus:border-pink-500/60 h-11"
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
                    className="bg-white/5 border-white/10 focus:border-pink-500/60 h-11"
                    data-testid="input-trial-telegram"
                  />
                }
              />

              {serverError && (
                <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/25 p-3 text-sm text-red-300" data-testid="text-trial-error">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{serverError}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-12 bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-semibold text-base border-0 shadow-lg shadow-pink-500/30 disabled:opacity-60"
                data-testid="button-trial-submit"
              >
                {submitting ? (
                  <>Processando…</>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    Quero meus 7 dias grátis
                  </>
                )}
              </Button>
              <p className="text-[10px] text-center text-muted-foreground leading-relaxed">
                Ao continuar, você concorda em receber um link único de convite no Telegram.
                <br />Cada pessoa pode usar o trial gratuito apenas uma vez.
              </p>
            </div>
          </form>
        )}
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
      <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
        {label}
      </Label>
      {input}
      {hint && !error && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
      {error && <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
    </div>
  );
}

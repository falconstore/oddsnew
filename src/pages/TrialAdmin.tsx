import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Gift, Search, Sparkles, Users, CheckCircle2, Clock, Ban, UserMinus,
  Mail, Phone, Send, ExternalLink, Trash2, Eye, MousePointerClick, BellRing,
  MessageCircle, ShoppingCart, TrendingUp, Users2, FileSignature,
  Stethoscope, AlertTriangle, Loader2, XCircle, Link2, RotateCw,
  ShieldAlert, Unlock, Radio, ServerCog, Receipt, Eraser,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  useTrialLeads, useKickTrialLead, usePurgeTrialLead, useDiagnoseTelegram,
  useLinkManual, useResetWebhook, useForceActivate, useLinkGc, type TelegramDiagnose,
  useTrialSettings, useUpdateTrialSettings, useSendReminderTest,
} from '@/hooks/useTrialLeads';
import { useTrialUpgradeStats, type TrialStatsRange } from '@/hooks/useTrialUpgradeStats';
import { useTrialCapiStats } from '@/hooks/useTrialCapiStats';
import type { TrialLead, TrialStatus } from '@/types/trial';
import { TRIAL_PUBLIC_URL } from '@/components/AnimatedRoutes';

const RANGE_LABELS: Record<TrialStatsRange, string> = {
  today: 'Hoje',
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  all: 'Todo o período',
};

const STATUS_META: Record<TrialStatus, { label: string; cls: string }> = {
  pending: { label: 'Aguardando entrada', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  active: { label: 'Ativo', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  expired: { label: 'Expirado', cls: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30' },
  removed: { label: 'Removido', cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
  blocked: { label: 'Bloqueado', cls: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  blocked_repeat: { label: 'Repetidor bloqueado', cls: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  converted: { label: 'Convertido (pago)', cls: 'bg-emerald-600/20 text-emerald-200 border-emerald-500/40' },
};

const fmtDate = (iso: string | null) =>
  iso ? format(new Date(iso), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '—';

const fmtWhatsapp = (raw: string) => {
  const d = raw.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
};

export default function TrialAdmin() {
  const { data: leads = [], isLoading } = useTrialLeads();
  const kick = useKickTrialLead();
  const purge = usePurgeTrialLead();
  const [confirmPurge, setConfirmPurge] = useState<TrialLead | null>(null);
  const diagnose = useDiagnoseTelegram();
  const linkGc = useLinkGc();
  const linkManual = useLinkManual();
  const resetWebhook = useResetWebhook();
  const forceActivate = useForceActivate();
  const [forceLead, setForceLead] = useState<TrialLead | null>(null);
  const [historyLead, setHistoryLead] = useState<TrialLead | null>(null);
  const [diagOpen, setDiagOpen] = useState(false);
  const diag: TelegramDiagnose | undefined = diagnose.data;

  const settings = useTrialSettings();
  const updateSettings = useUpdateTrialSettings();
  const sendTest = useSendReminderTest();
  const [couponDraft, setCouponDraft] = useState<string>('');
  const [testOpen, setTestOpen] = useState(false);
  const [testForm, setTestForm] = useState({ variant: '24h' as '24h' | '1h', userId: '', username: '', name: '' });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TrialStatus>('all');
  const [cohortFilter, setCohortFilter] = useState<'all' | 'v1' | 'v2'>('all');
  const [confirmKick, setConfirmKick] = useState<TrialLead | null>(null);
  const [linkLead, setLinkLead] = useState<TrialLead | null>(null);
  const [manualUserId, setManualUserId] = useState('');
  const [linkResult, setLinkResult] = useState<{ message?: string; needManual?: boolean } | null>(null);
  const [statsRange, setStatsRange] = useState<TrialStatsRange>('7d');
  const { data: upgradeStats, isLoading: statsLoading } = useTrialUpgradeStats(statsRange, 'trial-upgrade-page');
  const { data: landingStats, isLoading: landingLoading } = useTrialUpgradeStats(statsRange, 'trial-landing-hero');
  const { data: capiStats, isLoading: capiLoading } = useTrialCapiStats();

  const stats = useMemo(() => {
    const s = { total: leads.length, active: 0, expired: 0, blocked: 0, pending: 0, removed: 0, blockedRepeat: 0, converted: 0, v1: 0, v2: 0 };
    for (const l of leads) {
      if (l.status === 'active') s.active++;
      else if (l.status === 'expired') s.expired++;
      else if (l.status === 'blocked') s.blocked++;
      else if (l.status === 'pending') s.pending++;
      else if (l.status === 'removed') s.removed++;
      else if (l.status === 'blocked_repeat') s.blockedRepeat++;
      else if (l.status === 'converted') s.converted++;
      if (l.cohort === 'v1') s.v1++;
      else if (l.cohort === 'v2') s.v2++;
    }
    return s;
  }, [leads]);

  const filtered = useMemo(() => {
    let list = leads;
    if (statusFilter !== 'all') list = list.filter(l => l.status === statusFilter);
    if (cohortFilter !== 'all') list = list.filter(l => l.cohort === cohortFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        l.name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.whatsapp.includes(q.replace(/\D/g, '')) ||
        l.telegram_username.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q) ||
        (l.previous_lead_id?.toLowerCase().includes(q) ?? false)
      );
    }
    return list;
  }, [leads, statusFilter, cohortFilter, search]);

  return (
    <Layout>
      <div className="relative space-y-4 md:space-y-6 animate-fade-in">
        <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
          <div className="absolute top-0 left-1/3 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-pink-500/8 blur-[130px]" />
          <div className="absolute top-1/2 right-0 w-[400px] h-[400px] rounded-full bg-purple-500/6 blur-[100px]" />
        </div>

        {/* Hero */}
        <div className="relative rounded-3xl overflow-hidden border border-white/8 glass p-6 md:p-8">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[180px] rounded-full bg-pink-500/12 blur-[70px]" />
          </div>
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/25 text-pink-300 text-xs font-semibold">
                <Sparkles className="w-3 h-3" />
                Trial Telegram
                <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse-glow" />
              </div>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500/30 to-purple-600/10 border border-pink-500/30 flex items-center justify-center shadow-lg shadow-pink-500/15 flex-shrink-0">
                  <Gift className="h-7 w-7 text-pink-300" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-pink-400 via-fuchsia-400 to-purple-400 bg-clip-text text-transparent">
                    CRM Trial 7 dias
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    {stats.total} leads · {stats.active} ativos · {stats.pending} aguardando
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                onClick={() => { setDiagOpen(true); diagnose.mutate(); }}
                data-testid="button-diagnose-telegram"
              >
                <Stethoscope className="w-4 h-4 mr-1.5" />
                Diagnosticar Telegram
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                onClick={() => setTestOpen(true)}
                data-testid="button-open-test-dm"
              >
                <Send className="w-4 h-4 mr-1.5" />
                Enviar DM teste
              </Button>
              <a href={`${TRIAL_PUBLIC_URL}/`} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="border-pink-500/30 text-pink-300 hover:bg-pink-500/10" data-testid="link-trial-landing">
                  <ExternalLink className="w-4 h-4 mr-1.5" />
                  Abrir landing
                </Button>
              </a>
            </div>
          </div>
        </div>

        {/* Configurações dos avisos (cupom editável sem redeploy) */}
        <div className="glass rounded-3xl border border-white/8 p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-pink-400" />
                Cupom dos avisos (24h e 1h)
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Esse cupom aparece nas DMs automáticas e no botão "Assinar com cupom".
                {settings.data?.updated_at && (
                  <> Última alteração: {fmtDate(settings.data.updated_at)}{settings.data.updated_by ? ` por ${settings.data.updated_by}` : ''}.</>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Cupom</label>
                <Input
                  value={couponDraft || settings.data?.reminder_coupon || ''}
                  placeholder={settings.isLoading ? 'Carregando…' : 'PODPROMO'}
                  onChange={(e) => setCouponDraft(e.target.value.toUpperCase())}
                  disabled={settings.isLoading}
                  className="bg-white/5 border-white/10 h-9 text-sm uppercase font-mono w-[200px]"
                  data-testid="input-reminder-coupon"
                />
              </div>
              <Button
                size="sm"
                onClick={() => {
                  const next = (couponDraft || settings.data?.reminder_coupon || '').trim();
                  if (!next) return;
                  if (next === settings.data?.reminder_coupon) return;
                  updateSettings.mutate({ coupon: next }, {
                    onSuccess: () => setCouponDraft(''),
                  });
                }}
                disabled={
                  updateSettings.isPending
                  || !couponDraft.trim()
                  || couponDraft.trim() === settings.data?.reminder_coupon
                }
                className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/30 h-9"
                data-testid="button-save-coupon"
              >
                {updateSettings.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                Salvar cupom
              </Button>
            </div>
          </div>
        </div>

        {/* Conversão Trial → Assinante */}
        <div className="glass rounded-3xl border border-white/8 p-5 md:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                Conversão do aviso de 24h
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Avisos enviados, visitas em /trial-upgrade e cliques nos CTAs · {RANGE_LABELS[statsRange]}
              </p>
            </div>
            <Select value={statsRange} onValueChange={v => setStatsRange(v as TrialStatsRange)}>
              <SelectTrigger
                className="bg-white/5 border-white/10 h-9 text-sm w-[180px]"
                data-testid="select-stats-range"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="all">Todo o período</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {statsLoading || !upgradeStats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-white/5 p-4 h-24 animate-pulse bg-white/2" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard
                  icon={<BellRing className="w-5 h-5" />}
                  label="Avisos enviados"
                  value={upgradeStats.remindersSent}
                  hint="Trials que receberam o aviso de 24h"
                  accent="from-amber-500/20 to-amber-500/5 border-amber-500/25 text-amber-300"
                  testId="metric-reminders-sent"
                />
                <MetricCard
                  icon={<Eye className="w-5 h-5" />}
                  label="Visitas /trial-upgrade"
                  value={upgradeStats.views}
                  hint="Quantas vezes a página foi aberta"
                  accent="from-sky-500/20 to-sky-500/5 border-sky-500/25 text-sky-300"
                  testId="metric-views"
                />
                <MetricCard
                  icon={<MousePointerClick className="w-5 h-5" />}
                  label="Leads únicos com clique"
                  value={upgradeStats.uniqueLeadsClicked}
                  hint={`${upgradeStats.totalClicks} cliques no total`}
                  accent="from-fuchsia-500/20 to-fuchsia-500/5 border-fuchsia-500/25 text-fuchsia-300"
                  testId="metric-unique-clicks"
                />
                <MetricCard
                  icon={<TrendingUp className="w-5 h-5" />}
                  label="Taxa de conversão"
                  value={`${upgradeStats.conversionRate.toFixed(1)}%`}
                  hint={
                    upgradeStats.remindersSent > 0
                      ? `${upgradeStats.uniqueLeadsClicked} de ${upgradeStats.remindersSent} avisos`
                      : 'Sem avisos no período'
                  }
                  accent="from-emerald-500/20 to-emerald-500/5 border-emerald-500/25 text-emerald-300"
                  testId="metric-conversion-rate"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <CtaBreakdownCard
                  icon={<MessageCircle className="w-4 h-4" />}
                  label="WhatsApp"
                  value={upgradeStats.clicksWhatsapp}
                  total={upgradeStats.totalClicks}
                  accent="text-emerald-300 bg-emerald-500/10 border-emerald-500/25"
                  bar="bg-emerald-400/70"
                  testId="metric-cta-whatsapp"
                />
                <CtaBreakdownCard
                  icon={<Send className="w-4 h-4" />}
                  label="Telegram"
                  value={upgradeStats.clicksTelegram}
                  total={upgradeStats.totalClicks}
                  accent="text-sky-300 bg-sky-500/10 border-sky-500/25"
                  bar="bg-sky-400/70"
                  testId="metric-cta-telegram"
                />
                <CtaBreakdownCard
                  icon={<ShoppingCart className="w-4 h-4" />}
                  label="Checkout"
                  value={upgradeStats.clicksCheckout}
                  total={upgradeStats.totalClicks}
                  accent="text-pink-300 bg-pink-500/10 border-pink-500/25"
                  bar="bg-pink-400/70"
                  testId="metric-cta-checkout"
                />
              </div>
            </>
          )}
        </div>

        {/* Conversão LP Shark 100% Green */}
        <div className="glass rounded-3xl border border-white/8 p-5 md:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                LP Shark 100% Green
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Visitas e cliques nos 3 CTAs da landing pública · {RANGE_LABELS[statsRange]}
              </p>
            </div>
            <a href={`${TRIAL_PUBLIC_URL}/`} target="_blank" rel="noopener noreferrer">
              <Button
                size="sm"
                variant="outline"
                className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                data-testid="link-trial-landing-stats"
              >
                <ExternalLink className="w-4 h-4 mr-1.5" />
                Abrir LP
              </Button>
            </a>
          </div>

          {landingLoading || !landingStats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-white/5 p-4 h-24 animate-pulse bg-white/2" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard
                  icon={<Eye className="w-5 h-5" />}
                  label="Visitas na LP"
                  value={landingStats.views}
                  hint="Quantas vezes a landing foi aberta"
                  accent="from-sky-500/20 to-sky-500/5 border-sky-500/25 text-sky-300"
                  testId="metric-lp-views"
                />
                <MetricCard
                  icon={<MousePointerClick className="w-5 h-5" />}
                  label="Total de cliques"
                  value={landingStats.totalClicks}
                  hint="Soma dos 3 botões"
                  accent="from-fuchsia-500/20 to-fuchsia-500/5 border-fuchsia-500/25 text-fuchsia-300"
                  testId="metric-lp-total-clicks"
                />
                <MetricCard
                  icon={<TrendingUp className="w-5 h-5" />}
                  label="Taxa de clique"
                  value={
                    landingStats.views > 0
                      ? `${((landingStats.totalClicks / landingStats.views) * 100).toFixed(1)}%`
                      : '0%'
                  }
                  hint={
                    landingStats.views > 0
                      ? `${landingStats.totalClicks} de ${landingStats.views} visitas`
                      : 'Sem visitas no período'
                  }
                  accent="from-emerald-500/20 to-emerald-500/5 border-emerald-500/25 text-emerald-300"
                  testId="metric-lp-ctr"
                />
                <MetricCard
                  icon={<FileSignature className="w-5 h-5" />}
                  label="Abriu form trial"
                  value={landingStats.clicksOpenForm}
                  hint='Cliques em "Quero testar 7 Dias"'
                  accent="from-amber-500/20 to-amber-500/5 border-amber-500/25 text-amber-300"
                  testId="metric-lp-open-form"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <CtaBreakdownCard
                  icon={<FileSignature className="w-4 h-4" />}
                  label="Quero testar 7 Dias"
                  value={landingStats.clicksOpenForm}
                  total={landingStats.totalClicks}
                  accent="text-amber-300 bg-amber-500/10 border-amber-500/25"
                  bar="bg-amber-400/70"
                  testId="metric-lp-cta-form"
                />
                <CtaBreakdownCard
                  icon={<Users2 className="w-4 h-4" />}
                  label="Acessar Grupos Free"
                  value={landingStats.clicksFreeGroup}
                  total={landingStats.totalClicks}
                  accent="text-sky-300 bg-sky-500/10 border-sky-500/25"
                  bar="bg-sky-400/70"
                  testId="metric-lp-cta-free-group"
                />
                <CtaBreakdownCard
                  icon={<ShoppingCart className="w-4 h-4" />}
                  label="Compre Agora"
                  value={landingStats.clicksCheckout}
                  total={landingStats.totalClicks}
                  accent="text-pink-300 bg-pink-500/10 border-pink-500/25"
                  bar="bg-pink-400/70"
                  testId="metric-lp-cta-checkout"
                />
              </div>
            </>
          )}
        </div>

        {/* Conversions API (server-side) — últimas 24h */}
        <div className="glass rounded-3xl border border-white/8 p-5 md:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                <Radio className="w-5 h-5 text-emerald-400" />
                Conversions API · últimas 24h
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Eventos enviados pra Meta direto da Edge Function (PageView e Lead). Casa com o pixel via <code className="text-emerald-300">event_id</code> pra deduplicar.
              </p>
            </div>
          </div>

          {capiLoading || !capiStats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-white/5 p-4 h-24 animate-pulse bg-white/2" />
              ))}
            </div>
          ) : capiStats.total === 0 ? (
            <div
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-sm text-muted-foreground flex items-center gap-3"
              data-testid="capi-empty-state"
            >
              <ServerCog className="w-5 h-5 text-white/40 flex-shrink-0" />
              <div>
                Nenhum evento server-side enviado nas últimas 24h. Confira se a secret <code className="text-emerald-300">META_CAPI_ACCESS_TOKEN</code> está configurada no Supabase.
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard
                  icon={<ServerCog className="w-5 h-5" />}
                  label="Eventos enviados"
                  value={capiStats.total}
                  hint="Total de tentativas (sucesso + erro)"
                  accent="from-sky-500/20 to-sky-500/5 border-sky-500/25 text-sky-300"
                  testId="metric-capi-total"
                />
                <MetricCard
                  icon={<CheckCircle2 className="w-5 h-5" />}
                  label="Sucessos"
                  value={capiStats.success}
                  hint="Aceitos pela Meta (HTTP 200)"
                  accent="from-emerald-500/20 to-emerald-500/5 border-emerald-500/25 text-emerald-300"
                  testId="metric-capi-success"
                />
                <MetricCard
                  icon={<XCircle className="w-5 h-5" />}
                  label="Erros"
                  value={capiStats.errors}
                  hint={
                    capiStats.lastError
                      ? `Último: ${capiStats.lastError.error_message ?? 'falha desconhecida'}`
                      : 'Nenhum erro registrado'
                  }
                  accent="from-red-500/20 to-red-500/5 border-red-500/25 text-red-300"
                  testId="metric-capi-errors"
                />
                <MetricCard
                  icon={<TrendingUp className="w-5 h-5" />}
                  label="Taxa de sucesso"
                  value={`${capiStats.successRate.toFixed(1)}%`}
                  hint={`${capiStats.success} de ${capiStats.total}`}
                  accent="from-fuchsia-500/20 to-fuchsia-500/5 border-fuchsia-500/25 text-fuchsia-300"
                  testId="metric-capi-success-rate"
                />
              </div>

              {Object.keys(capiStats.byEventName).length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {Object.entries(capiStats.byEventName).map(([name, b]) => {
                    const total = b.success + b.errors;
                    const rate = total > 0 ? (b.success / total) * 100 : 0;
                    return (
                      <div
                        key={name}
                        className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
                        data-testid={`capi-event-${name}`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-sm font-semibold flex items-center gap-1.5">
                            <Radio className="w-3.5 h-3.5 text-emerald-300" />
                            {name}
                          </span>
                          <span className="text-xs font-mono text-emerald-300">
                            {rate.toFixed(0)}% ok
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="inline-flex items-center gap-1 text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" /> {b.success}
                          </span>
                          <span className="inline-flex items-center gap-1 text-red-300">
                            <XCircle className="w-3 h-3" /> {b.errors}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {capiStats.lastError && (
                <div
                  className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-xs text-red-200 space-y-1"
                  data-testid="capi-last-error"
                >
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Último erro: {capiStats.lastError.event_name}
                  </div>
                  <div className="font-mono text-red-300/90 break-words">
                    {capiStats.lastError.error_message ?? 'falha desconhecida'}
                    {capiStats.lastError.http_status
                      ? ` · HTTP ${capiStats.lastError.http_status}`
                      : ''}
                  </div>
                  <div className="text-[11px] text-red-300/60">
                    {fmtDate(capiStats.lastError.created_at)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 md:gap-4">
          <StatCard icon={<Users className="w-5 h-5" />} label="Total leads" value={stats.total} accent="from-pink-500/20 to-pink-500/5 border-pink-500/25 text-pink-300" />
          <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="Ativos" value={stats.active} accent="from-emerald-500/20 to-emerald-500/5 border-emerald-500/25 text-emerald-300" />
          <StatCard icon={<Clock className="w-5 h-5" />} label="Expirados" value={stats.expired} accent="from-zinc-500/20 to-zinc-500/5 border-zinc-500/25 text-zinc-300" />
          <StatCard icon={<Ban className="w-5 h-5" />} label="Bloqueados" value={stats.blocked} accent="from-purple-500/20 to-purple-500/5 border-purple-500/25 text-purple-300" />
          <StatCard icon={<ShieldAlert className="w-5 h-5" />} label="Repetidores bloqueados" value={stats.blockedRepeat} accent="from-orange-500/20 to-orange-500/5 border-orange-500/25 text-orange-300" />
          <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="Convertidos (pagos)" value={stats.converted} accent="from-emerald-600/25 to-emerald-600/5 border-emerald-500/30 text-emerald-200" />
          <StatCard icon={<Ban className="w-5 h-5" />} label="Removidos" value={stats.removed} accent="from-red-500/20 to-red-500/5 border-red-500/25 text-red-300" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome, email, WhatsApp ou @..."
              className="pl-9 bg-white/5 border-white/10 h-9 text-sm"
              data-testid="input-trial-search"
            />
          </div>
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as 'all' | TrialStatus)}>
            <SelectTrigger className="bg-white/5 border-white/10 h-9 text-sm w-[180px]" data-testid="select-trial-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pending">Aguardando entrada</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="expired">Expirados</SelectItem>
              <SelectItem value="removed">Removidos</SelectItem>
              <SelectItem value="blocked">Bloqueados</SelectItem>
              <SelectItem value="blocked_repeat">Repetidores bloqueados</SelectItem>
              <SelectItem value="converted">Convertidos (pagos)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={cohortFilter} onValueChange={v => setCohortFilter(v as 'all' | 'v1' | 'v2')}>
            <SelectTrigger className="bg-white/5 border-white/10 h-9 text-sm w-[180px]" data-testid="select-trial-cohort-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as turmas</SelectItem>
              <SelectItem value="v2">v2 — grupo atual ({stats.v2})</SelectItem>
              <SelectItem value="v1">v1 — grupo antigo ({stats.v1})</SelectItem>
            </SelectContent>
          </Select>
          {(search || statusFilter !== 'all' || cohortFilter !== 'all') && (
            <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => { setSearch(''); setStatusFilter('all'); setCohortFilter('all'); }}
              data-testid="button-trial-clear-filters">
              Limpar filtros
            </Button>
          )}
        </div>

        {/* Table / Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="glass rounded-2xl border border-white/5 p-4 h-24 animate-pulse bg-white/2" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-2xl border border-white/8 p-10 text-center">
            <Gift className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {leads.length === 0 ? 'Nenhum lead capturado ainda. Compartilhe ' : 'Nenhum lead com esses filtros.'}
              {leads.length === 0 && (
                <a href={`${TRIAL_PUBLIC_URL}/`} target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:text-pink-300 underline">
                  o link da landing
                </a>
              )}
              {leads.length === 0 && ' para começar.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(lead => {
              const meta = STATUS_META[lead.status];
              // Permitimos forçar a expulsão sempre que o lead já tiver entrado
              // alguma vez no grupo (telegram_user_id preenchido), independente
              // do status atual. Isso cobre o caso "lead removido voltou para o
              // grupo" — o admin pode clicar em Remover de novo para forçar
              // o re-kick imediato.
              const canKick = !!lead.telegram_user_id;
              const isAlreadyRemoved = lead.status === 'removed' || lead.status === 'blocked';
              const kickTitle = !canKick
                ? 'Lead ainda não entrou no grupo'
                : isAlreadyRemoved
                  ? 'Forçar re-expulsão (caso tenha voltado)'
                  : 'Remover do grupo agora';
              const kickLabel = isAlreadyRemoved ? 'Re-expulsar' : 'Remover';
              return (
                <div key={lead.id}
                  className="glass rounded-2xl border border-white/8 p-4 hover:border-pink-500/25 transition-all duration-200 card-hover"
                  data-testid={`card-trial-lead-${lead.id}`}>
                  <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
                    {/* Identity */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h3 className="font-bold text-sm truncate" data-testid={`text-lead-name-${lead.id}`}>{lead.name}</h3>
                        <Badge className={`text-[10px] ${meta.cls}`} data-testid={`badge-lead-status-${lead.id}`}>
                          {meta.label}
                        </Badge>
                        {lead.cohort === 'v1' && (
                          <Badge
                            className="text-[10px] bg-zinc-500/10 text-zinc-300 border-zinc-500/30"
                            data-testid={`badge-cohort-v1-${lead.id}`}
                            title="Lead do grupo antigo (v1) — não recebe DM nem é kickado"
                          >
                            v1 (grupo antigo)
                          </Badge>
                        )}
                        {lead.previous_lead_id && (
                          <Badge
                            className="text-[10px] bg-orange-500/10 text-orange-300 border-orange-500/30"
                            data-testid={`badge-previous-lead-${lead.id}`}
                          >
                            <ShieldAlert className="w-2.5 h-2.5 mr-1" />
                            Tentou repetir trial
                          </Badge>
                        )}
                        {lead.previous_lead_id && (
                          <button
                            type="button"
                            onClick={() => setHistoryLead(lead)}
                            className="text-[10px] text-orange-300 hover:text-orange-200 underline underline-offset-2"
                            data-testid={`button-view-previous-${lead.id}`}
                          >
                            Ver trial anterior
                          </button>
                        )}
                        {(lead.status === 'converted' || lead.paid_at) && (
                          <RouterLink
                            to={`/lastlink-admin?lead=${lead.id}`}
                            className="inline-flex items-center gap-1 text-[10px] text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
                            data-testid={`link-lastlink-detail-${lead.id}`}
                            title="Ver detalhes do pagamento na Lastlink"
                          >
                            <Receipt className="w-2.5 h-2.5" />
                            Detalhes do pagamento
                          </RouterLink>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</span>
                        <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{fmtWhatsapp(lead.whatsapp)}</span>
                        <span className="inline-flex items-center gap-1"><Send className="w-3 h-3" />@{lead.telegram_username}</span>
                      </div>
                      {/* Badges de presença em cada grupo (VIP + Área do Aluno bônus) */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {lead.entered_at ? (
                          <Badge
                            className="text-[10px] bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                            data-testid={`badge-vip-${lead.id}`}
                            title={`Entrou no VIP em ${fmtDate(lead.entered_at)}`}
                          >
                            <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                            VIP · {fmtDate(lead.entered_at)}
                          </Badge>
                        ) : (
                          <Badge
                            className="text-[10px] bg-zinc-500/10 text-zinc-400 border-zinc-500/30"
                            data-testid={`badge-vip-pending-${lead.id}`}
                            title="Ainda não entrou no grupo VIP"
                          >
                            <XCircle className="w-2.5 h-2.5 mr-1" />
                            VIP pendente
                          </Badge>
                        )}
                        {lead.bonus_entered_at ? (
                          <Badge
                            className="text-[10px] bg-amber-500/10 text-amber-300 border-amber-500/30"
                            data-testid={`badge-bonus-${lead.id}`}
                            title={`Entrou no bônus em ${fmtDate(lead.bonus_entered_at)}`}
                          >
                            <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                            Área do Aluno · {fmtDate(lead.bonus_entered_at)}
                          </Badge>
                        ) : lead.bonus_invite_link ? (
                          <Badge
                            className="text-[10px] bg-zinc-500/10 text-zinc-400 border-zinc-500/30"
                            data-testid={`badge-bonus-pending-${lead.id}`}
                            title="Não entrou no grupo bônus (Área do Aluno)"
                          >
                            <XCircle className="w-2.5 h-2.5 mr-1" />
                            Área do Aluno pendente
                          </Badge>
                        ) : (
                          <Badge
                            className="text-[10px] bg-white/5 text-muted-foreground border-white/10"
                            data-testid={`badge-bonus-unavailable-${lead.id}`}
                            title="Grupo bônus não estava configurado quando este lead se cadastrou"
                          >
                            Área do Aluno indisponível
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="flex gap-4 text-[11px]">
                      <div>
                        <p className="text-muted-foreground/70 uppercase tracking-wider mb-0.5">Entrada</p>
                        <p className="font-mono">{fmtDate(lead.entered_at)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground/70 uppercase tracking-wider mb-0.5">Expira em</p>
                        <p className="font-mono">{fmtDate(lead.expires_at)}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 lg:ml-auto">
                      {lead.invite_link && lead.status === 'pending' && (
                        <a href={lead.invite_link} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="h-8 text-xs border-white/10" data-testid={`button-lead-link-${lead.id}`}>
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Link
                          </Button>
                        </a>
                      )}
                      {!lead.telegram_user_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs border-sky-500/30 text-sky-300 hover:bg-sky-500/10"
                          onClick={() => {
                            setLinkLead(lead);
                            setManualUserId('');
                            setLinkResult(null);
                            linkManual.reset();
                          }}
                          data-testid={`button-lead-link-manual-${lead.id}`}
                          title="Vincular ao Telegram (caso já tenha entrado mas o webhook perdeu o evento)"
                        >
                          <Link2 className="w-3 h-3 mr-1" />
                          Vincular
                        </Button>
                      )}
                      {lead.status === 'blocked_repeat' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs border-orange-500/30 text-orange-300 hover:bg-orange-500/10"
                          onClick={() => setForceLead(lead)}
                          data-testid={`button-lead-force-activate-${lead.id}`}
                          title="Forçar a ativação por 7 dias mesmo sendo um Telegram repetido"
                        >
                          <Unlock className="w-3 h-3 mr-1" />
                          Liberar e ativar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-40"
                        disabled={!lead.telegram_user_id || sendTest.isPending}
                        onClick={() => sendTest.mutate({
                          variant: '24h',
                          telegramUserId: lead.telegram_user_id ? String(lead.telegram_user_id) : undefined,
                          telegramUsername: !lead.telegram_user_id ? (lead.telegram_username ?? undefined) : undefined,
                          name: lead.name,
                        })}
                        data-testid={`button-lead-test-dm-${lead.id}`}
                        title={lead.telegram_user_id
                          ? 'Enviar DM teste (variante 24h) para este lead'
                          : 'Lead ainda sem Telegram ID — vincule primeiro'}
                      >
                        {sendTest.isPending && sendTest.variables?.telegramUserId === String(lead.telegram_user_id ?? '')
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Send className="w-3.5 h-3.5" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs border-red-500/30 text-red-300 hover:bg-red-500/10 disabled:opacity-40"
                        disabled={!canKick}
                        onClick={() => setConfirmKick(lead)}
                        data-testid={`button-lead-kick-${lead.id}`}
                        title={kickTitle}
                      >
                        <UserMinus className="w-3 h-3 mr-1" />
                        {kickLabel}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs border-red-700/40 text-red-400 hover:bg-red-700/15"
                        onClick={() => setConfirmPurge(lead)}
                        data-testid={`button-lead-purge-${lead.id}`}
                        title="Apagar definitivamente do banco — libera email/whatsapp/@ pra um novo trial"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Apagar do banco
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm kick dialog */}
      <Dialog open={!!confirmKick} onOpenChange={() => setConfirmKick(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-400" />
              Remover do grupo
            </DialogTitle>
            <DialogDescription>
              Tem certeza que quer remover <b>{confirmKick?.name}</b> (@{confirmKick?.telegram_username}) do grupo Telegram agora?
              <br />Essa ação encerra o trial imediatamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmKick(null)} disabled={kick.isPending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={kick.isPending}
              onClick={async () => {
                if (!confirmKick) return;
                await kick.mutateAsync(confirmKick.id).catch(() => {});
                setConfirmKick(null);
              }}
              data-testid="button-confirm-kick"
            >
              {kick.isPending ? 'Removendo…' : 'Remover do grupo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diagnóstico Telegram dialog */}
      <Dialog open={diagOpen} onOpenChange={setDiagOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-amber-400" />
              Diagnóstico do Telegram
            </DialogTitle>
            <DialogDescription>
              Verifica em tempo real o estado do bot, do webhook e das permissões no grupo.
            </DialogDescription>
          </DialogHeader>

          {diagnose.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Consultando o Telegram…
            </div>
          )}

          {diagnose.isError && (
            <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              {(diagnose.error as Error)?.message || 'Falha ao rodar o diagnóstico.'}
            </div>
          )}

          {diag && (
            <div className="space-y-4 text-sm">
              {/* Banner global */}
              <div className={`rounded-xl border p-3 flex items-start gap-2 ${
                diag.ok
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  : 'bg-red-500/10 border-red-500/30 text-red-200'
              }`}>
                {diag.ok
                  ? <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  : <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                <div>
                  <div className="font-semibold">
                    {diag.ok ? 'Tudo certo — entradas e saídas devem ser detectadas.' : `${diag.issues.length} problema(s) encontrado(s).`}
                  </div>
                  {!diag.ok && (
                    <ul className="mt-2 space-y-1 list-disc list-inside text-xs">
                      {diag.issues.map((iss, i) => <li key={i}>{iss}</li>)}
                    </ul>
                  )}
                </div>
              </div>

              {/* Cards de checagens */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <DiagRow ok={diag.summary.bot_alive} label="Bot online" value={diag.summary.bot_username ? `@${diag.summary.bot_username}` : '—'} />
                <DiagRow ok={diag.summary.webhook_registered && diag.summary.webhook_url_ok} label="Webhook registrado" value={diag.summary.webhook_url ?? 'não registrado'} />
                <DiagRow
                  ok={diag.summary.webhook_has_chat_member_subscription}
                  label="Assinatura de chat_member"
                  value={diag.summary.webhook_allowed_updates.length > 0 ? diag.summary.webhook_allowed_updates.join(', ') : 'lista vazia (= apenas defaults)'}
                />
                <DiagRow ok={diag.summary.bot_in_chat} label="Bot dentro do grupo" value={diag.summary.chat_title ?? '—'} />
                <DiagRow
                  ok={diag.summary.bot_status_in_chat === 'administrator' || diag.summary.bot_status_in_chat === 'creator'}
                  label="Bot é admin"
                  value={diag.summary.bot_status_in_chat ?? '—'}
                />
                <DiagRow ok={!!diag.summary.bot_can_restrict_members} label="Permissão Banir usuários" value={diag.summary.bot_can_restrict_members ? 'sim' : 'não'} />
                {(() => {
                  const errMsg = diag.summary.webhook_last_error_message;
                  const errDate = diag.summary.webhook_last_error_date;
                  const pending = diag.summary.webhook_pending_update_count ?? 0;
                  const isHistorical = !!errMsg && pending === 0;
                  const ageStr = errDate
                    ? formatDistanceToNow(new Date(errDate * 1000), { addSuffix: true, locale: ptBR })
                    : null;
                  const value = !errMsg
                    ? 'nenhum'
                    : `${errMsg}${ageStr ? ` (${ageStr})` : ''}${
                        isHistorical ? ' — histórico, sem novos erros' : ''
                      }`;
                  return (
                    <DiagRow
                      ok={!errMsg || isHistorical}
                      tone={isHistorical ? 'info' : undefined}
                      label={isHistorical ? 'Erro do webhook (histórico)' : 'Sem erros recentes do webhook'}
                      value={value}
                    />
                  );
                })()}
                <DiagRow
                  ok={(diag.summary.webhook_pending_update_count ?? 0) === 0}
                  label="Updates pendentes"
                  value={String(diag.summary.webhook_pending_update_count ?? 0)}
                />
              </div>

              {!diag.summary.webhook_has_chat_member_subscription && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-100 space-y-2">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> Como religar o webhook (causa mais comum)
                  </div>
                  <p>Rode no terminal trocando <code className="bg-black/40 px-1 rounded">SEU_TOKEN</code>, <code className="bg-black/40 px-1 rounded">SEU_PROJETO</code> e <code className="bg-black/40 px-1 rounded">SEU_SECRET</code>:</p>
                  <pre className="bg-black/50 rounded p-2 overflow-x-auto whitespace-pre-wrap">{`curl "https://api.telegram.org/botSEU_TOKEN/setWebhook" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://SEU_PROJETO.functions.supabase.co/trial-webhook","secret_token":"SEU_SECRET","allowed_updates":["chat_member","my_chat_member"]}'`}</pre>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setDiagOpen(false)} data-testid="button-close-diag">
              Fechar
            </Button>
            <Button
              variant="outline"
              className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
              onClick={() => linkGc.mutate()}
              disabled={linkGc.isPending}
              data-testid="button-link-gc"
              title="Revoga no Telegram todos os invite links de leads com mais de 24h e libera vagas no teto do bot. Use se a LP parar de gerar links."
            >
              {linkGc.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Eraser className="w-4 h-4 mr-1.5" />}
              Limpar links antigos
            </Button>
            <Button
              variant="outline"
              className="border-sky-500/30 text-sky-300 hover:bg-sky-500/10"
              onClick={async () => {
                await resetWebhook.mutateAsync().catch(() => {});
                diagnose.mutate();
              }}
              disabled={resetWebhook.isPending || diagnose.isPending}
              data-testid="button-reset-webhook"
              title="Re-instala o webhook no Telegram com URL, secret e allowed_updates corretos"
            >
              {resetWebhook.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RotateCw className="w-4 h-4 mr-1.5" />}
              Resetar webhook
            </Button>
            <Button
              variant="outline"
              className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
              onClick={() => diagnose.mutate()}
              disabled={diagnose.isPending}
              data-testid="button-rerun-diag"
            >
              {diagnose.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Stethoscope className="w-4 h-4 mr-1.5" />}
              Rodar de novo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vincular ao Telegram dialog */}
      <Dialog
        open={!!linkLead}
        onOpenChange={(open) => {
          if (!open) {
            setLinkLead(null);
            setManualUserId('');
            setLinkResult(null);
            linkManual.reset();
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-sky-400" />
              Vincular ao Telegram
            </DialogTitle>
            <DialogDescription>
              Marca <b>{linkLead?.name}</b> (@{linkLead?.telegram_username}) como ativo
              caso ele já esteja dentro do grupo. Use isso quando o webhook perdeu o
              evento de entrada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            {linkResult?.needManual && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100 space-y-2">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> ID numérico necessário
                </div>
                <p>{linkResult.message}</p>
              </div>
            )}
            {linkResult?.needManual !== undefined && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  ID numérico do Telegram (opcional na 1ª tentativa)
                </label>
                <Input
                  value={manualUserId}
                  onChange={(e) => setManualUserId(e.target.value.replace(/\D/g, ''))}
                  placeholder="ex: 123456789"
                  className="bg-white/5 border-white/10"
                  inputMode="numeric"
                  data-testid="input-manual-user-id"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Peça para o usuário abrir <b>@userinfobot</b> no Telegram e enviar /start.
                  O bot devolve o "Id" — cole aqui.
                </p>
              </div>
            )}
            {linkManual.isError && (
              <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                {(linkManual.error as Error)?.message}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setLinkLead(null)}
              disabled={linkManual.isPending}
            >
              Cancelar
            </Button>
            <Button
              className="bg-sky-500 hover:bg-sky-400 text-white"
              disabled={linkManual.isPending}
              onClick={async () => {
                if (!linkLead) return;
                const result = await linkManual
                  .mutateAsync({ leadId: linkLead.id, manualUserId })
                  .catch(() => null);
                if (result?.need_manual_id) {
                  setLinkResult({ message: result.error, needManual: true });
                  return;
                }
                if (result?.action === 'activated' || result?.action === 'already-active') {
                  setLinkLead(null);
                  setManualUserId('');
                  setLinkResult(null);
                }
              }}
              data-testid="button-confirm-link-manual"
            >
              {linkManual.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Vinculando…
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4 mr-1.5" />
                  {manualUserId ? 'Vincular com este ID' : 'Tentar vincular'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm purge dialog — apaga DEFINITIVAMENTE do banco */}
      <Dialog open={!!confirmPurge} onOpenChange={() => setConfirmPurge(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              Apagar do banco
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <span className="block">
                Você está prestes a <b>apagar definitivamente</b> o lead <b>{confirmPurge?.name}</b>{' '}
                (@{confirmPurge?.telegram_username}) do banco de dados.
              </span>
              <span className="block text-amber-300/90 text-xs">
                ⚠️ Essa ação <b>não pode ser desfeita</b>. Se o usuário ainda estiver
                no grupo, ele será removido antes. O email, WhatsApp e @ ficam livres
                para um novo cadastro.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmPurge(null)} disabled={purge.isPending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={purge.isPending}
              onClick={async () => {
                if (!confirmPurge) return;
                await purge.mutateAsync(confirmPurge.id).catch(() => {});
                setConfirmPurge(null);
              }}
              data-testid="button-confirm-purge"
            >
              {purge.isPending ? 'Apagando…' : 'Apagar do banco'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ver trial anterior — mostra histórico do lead apontado por previous_lead_id */}
      <Dialog open={!!historyLead} onOpenChange={(open) => { if (!open) setHistoryLead(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-orange-400" />
              Trial anterior
            </DialogTitle>
            <DialogDescription>
              Esse Telegram já tinha um trial registrado antes — abaixo, os dados do lead original.
            </DialogDescription>
          </DialogHeader>
          {(() => {
            if (!historyLead) return null;
            const prev = leads.find(l => l.id === historyLead.previous_lead_id);
            if (!prev) {
              return (
                <div className="text-sm text-muted-foreground py-4">
                  Lead anterior <span className="font-mono text-xs">{historyLead.previous_lead_id}</span> não está na lista carregada.
                  Pode ter sido removido manualmente do banco.
                </div>
              );
            }
            const prevMeta = STATUS_META[prev.status];
            return (
              <div className="space-y-3 text-sm" data-testid={`history-lead-${prev.id}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold">{prev.name}</h4>
                  <Badge className={`text-[10px] ${prevMeta.cls}`}>{prevMeta.label}</Badge>
                </div>
                <div className="grid grid-cols-1 gap-1.5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5"><Mail className="w-3 h-3" />{prev.email}</span>
                  <span className="inline-flex items-center gap-1.5"><Phone className="w-3 h-3" />{fmtWhatsapp(prev.whatsapp)}</span>
                  <span className="inline-flex items-center gap-1.5"><Send className="w-3 h-3" />@{prev.telegram_username}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-[11px] pt-2 border-t border-white/5">
                  <div>
                    <p className="text-muted-foreground/70 uppercase tracking-wider mb-0.5">Cadastro</p>
                    <p className="font-mono">{fmtDate(prev.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground/70 uppercase tracking-wider mb-0.5">Entrou em</p>
                    <p className="font-mono">{fmtDate(prev.entered_at)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground/70 uppercase tracking-wider mb-0.5">Expirou em</p>
                    <p className="font-mono">{fmtDate(prev.expires_at)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground/70 uppercase tracking-wider mb-0.5">Removido em</p>
                    <p className="font-mono">{fmtDate(prev.removed_at)}</p>
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground pt-2 border-t border-white/5">
                  ID: <span className="font-mono">{prev.id}</span>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryLead(null)} data-testid="button-close-history">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Liberar e ativar (override anti-repetidor) */}
      <Dialog open={!!forceLead} onOpenChange={(open) => { if (!open) setForceLead(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unlock className="w-5 h-5 text-orange-400" />
              Liberar e ativar trial
            </DialogTitle>
            <DialogDescription>
              <b>{forceLead?.name}</b> (@{forceLead?.telegram_username}) foi marcado como <b>repetidor</b> porque
              esse Telegram já fez trial antes. Liberar e ativar concede mais 7 dias de acesso. Use somente se
              for cliente legítimo (ex: pagou e perdeu acesso).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setForceLead(null)} disabled={forceActivate.isPending}>
              Cancelar
            </Button>
            <Button
              className="bg-orange-500 hover:bg-orange-400 text-white"
              disabled={forceActivate.isPending}
              onClick={async () => {
                if (!forceLead) return;
                await forceActivate.mutateAsync({
                  leadId: forceLead.id,
                  telegramUserId: forceLead.telegram_user_id,
                }).catch(() => {});
                setForceLead(null);
              }}
              data-testid="button-confirm-force-activate"
            >
              {forceActivate.isPending ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Liberando…</>
              ) : (
                <><Unlock className="w-4 h-4 mr-1.5" /> Liberar e ativar 7 dias</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enviar DM de teste */}
      <Dialog open={testOpen} onOpenChange={(o) => { setTestOpen(o); if (!o) setTestForm({ variant: '24h', userId: '', username: '', name: '' }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-emerald-400" />
              Enviar DM de teste
            </DialogTitle>
            <DialogDescription>
              Manda a mensagem real (24h ou 1h antes da expiração) para um Telegram qualquer. O cupom usado é o que está salvo acima.
              <br />
              <span className="text-amber-300/80 text-xs">Importante: o destinatário precisa ter iniciado conversa com o bot pelo menos uma vez (mandar /start).</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Variante</label>
              <Select value={testForm.variant} onValueChange={(v) => setTestForm(f => ({ ...f, variant: v as '24h' | '1h' }))}>
                <SelectTrigger className="bg-white/5 border-white/10 h-9 text-sm" data-testid="select-test-variant">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">DM de 24h antes</SelectItem>
                  <SelectItem value="1h">DM de 1h antes (última chance)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Telegram user ID (numérico)</label>
              <Input
                value={testForm.userId}
                onChange={(e) => setTestForm(f => ({ ...f, userId: e.target.value.replace(/\D/g, '') }))}
                placeholder="ex: 123456789"
                className="bg-white/5 border-white/10 h-9 text-sm font-mono"
                data-testid="input-test-user-id"
              />
              <p className="text-[11px] text-muted-foreground">Peça pra pessoa rodar @userinfobot no Telegram pra descobrir o ID.</p>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">— ou — @username</label>
              <Input
                value={testForm.username}
                onChange={(e) => setTestForm(f => ({ ...f, username: e.target.value.replace(/^@+/, '') }))}
                placeholder="ex: joaosilva"
                className="bg-white/5 border-white/10 h-9 text-sm font-mono"
                data-testid="input-test-username"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Nome (opcional)</label>
              <Input
                value={testForm.name}
                onChange={(e) => setTestForm(f => ({ ...f, name: e.target.value }))}
                placeholder="ex: João"
                className="bg-white/5 border-white/10 h-9 text-sm"
                data-testid="input-test-name"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTestOpen(false)} data-testid="button-cancel-test">
              Cancelar
            </Button>
            <Button
              onClick={() => {
                sendTest.mutate({
                  variant: testForm.variant,
                  telegramUserId: testForm.userId || undefined,
                  telegramUsername: testForm.username || undefined,
                  name: testForm.name || undefined,
                }, {
                  onSuccess: () => setTestOpen(false),
                });
              }}
              disabled={sendTest.isPending || (!testForm.userId.trim() && !testForm.username.trim())}
              className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/30"
              data-testid="button-confirm-test"
            >
              {sendTest.isPending ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Enviando…</> : <><Send className="w-4 h-4 mr-1.5" /> Enviar DM teste</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function DiagRow({
  ok, label, value, tone,
}: { ok: boolean; label: string; value: string; tone?: 'info' }) {
  const cls = tone === 'info'
    ? 'border-amber-500/30 bg-amber-500/5'
    : ok
      ? 'border-emerald-500/20 bg-emerald-500/5'
      : 'border-red-500/25 bg-red-500/5';
  const Icon = tone === 'info' ? AlertTriangle : ok ? CheckCircle2 : XCircle;
  const iconCls = tone === 'info'
    ? 'text-amber-400'
    : ok ? 'text-emerald-400' : 'text-red-400';
  return (
    <div className={`rounded-xl border p-2.5 flex items-start gap-2 ${cls}`}>
      <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${iconCls}`} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold">{label}</div>
        <div className="text-[11px] text-muted-foreground break-all">{value}</div>
      </div>
    </div>
  );
}

function StatCard({
  icon, label, value, accent,
}: { icon: React.ReactNode; label: string; value: number; accent: string }) {
  return (
    <div className={`relative rounded-2xl border bg-gradient-to-br p-4 overflow-hidden ${accent}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{label}</span>
        <div className="opacity-70">{icon}</div>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function MetricCard({
  icon, label, value, hint, accent, testId,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  hint?: string;
  accent: string;
  testId?: string;
}) {
  return (
    <div
      className={`relative rounded-2xl border bg-gradient-to-br p-4 overflow-hidden ${accent}`}
      data-testid={testId}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{label}</span>
        <div className="opacity-70">{icon}</div>
      </div>
      <p className="text-2xl font-bold" data-testid={testId ? `${testId}-value` : undefined}>{value}</p>
      {hint && <p className="text-[11px] opacity-70 mt-1 leading-tight">{hint}</p>}
    </div>
  );
}

function CtaBreakdownCard({
  icon, label, value, total, accent, bar, testId,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  total: number;
  accent: string;
  bar: string;
  testId?: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div
      className="relative rounded-2xl border border-white/8 bg-white/3 p-4 overflow-hidden"
      data-testid={testId}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${accent}`}>
          {icon}
          {label}
        </span>
        <span className="text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
      </div>
      <p className="text-2xl font-bold" data-testid={testId ? `${testId}-value` : undefined}>{value}</p>
      <p className="text-[11px] text-muted-foreground mb-2">cliques no CTA</p>
      <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
        <div className={`h-full ${bar} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

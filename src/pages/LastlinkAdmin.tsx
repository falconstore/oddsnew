import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Receipt, Search, Sparkles, Users, CreditCard, RefreshCcw, TrendingUp,
  Eye, Filter, Calendar as CalendarIcon, FileText, Globe, ExternalLink,
  Phone, MapPin, IdCard, Tag, Banknote, Mail, Activity, ChevronDown,
  CheckCircle2, XCircle, AlertCircle, FlaskConical, Loader2, X,
  Building2, Clock, ArrowUpRight, Info,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MultiSelectPopover } from '@/components/ui/multi-select-popover';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useLastlinkPayments, useLastlinkEvents, useLastlinkLeadEvents } from '@/hooks/useLastlinkData';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import type { TrialLead, LastlinkEvent, LastlinkBuyerAddress, LastlinkUtm } from '@/types/trial';

// ─── helpers ──────────────────────────────────────────────────────────────

const fmtDate = (iso: string | null | undefined, withTime = true) => {
  if (!iso) return '—';
  return format(new Date(iso), withTime ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy', { locale: ptBR });
};

const fmtMoney = (value: number | null | undefined, currency: string | null | undefined = 'BRL') => {
  if (value == null) return '—';
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: (currency || 'BRL').toUpperCase(),
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `R$ ${value.toFixed(2)}`;
  }
};

const fmtCpf = (raw: string | null | undefined) => {
  if (!raw) return '—';
  const d = raw.replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  return raw;
};

const fmtPhone = (raw: string | null | undefined) => {
  if (!raw) return '—';
  const d = raw.replace(/\D/g, '');
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
};

const SUB_STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: 'Ativa', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  pending: { label: 'Aguardando', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  canceled: { label: 'Cancelada', cls: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30' },
  expired: { label: 'Expirada', cls: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  refunded: { label: 'Reembolsada', cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
  refund_requested: { label: 'Reembolso solicitado', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  chargeback: { label: 'Chargeback', cls: 'bg-red-600/20 text-red-200 border-red-600/40' },
  access_ended: { label: 'Acesso encerrado', cls: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30' },
};

const subStatusBadge = (status: string | null | undefined) => {
  if (!status) return <Badge variant="outline" className="text-xs text-muted-foreground">—</Badge>;
  const meta = SUB_STATUS_META[status] ?? { label: status, cls: 'bg-white/5 text-foreground border-white/10' };
  return <Badge variant="outline" className={`text-xs ${meta.cls}`}>{meta.label}</Badge>;
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  credit_card: 'Cartão de crédito',
  creditcard: 'Cartão de crédito',
  pix: 'Pix',
  boleto: 'Boleto',
  bankslip: 'Boleto',
};

const fmtPaymentMethod = (m: string | null | undefined) => {
  if (!m) return '—';
  return PAYMENT_METHOD_LABELS[m.toLowerCase()] ?? m;
};

const EVENT_TYPE_META: Record<string, { color: string; icon: string }> = {
  Purchase_Order_Confirmed:   { color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30', icon: '💚' },
  Purchase_Request_Confirmed: { color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30', icon: '✅' },
  Recurrent_Payment:          { color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30', icon: '🔁' },
  Subscription_Renewal_Pending: { color: 'text-amber-300 bg-amber-500/10 border-amber-500/30', icon: '⏳' },
  Subscription_Canceled:      { color: 'text-zinc-300 bg-zinc-500/10 border-zinc-500/30', icon: '🛑' },
  Subscription_Expired:       { color: 'text-orange-300 bg-orange-500/10 border-orange-500/30', icon: '⌛' },
  Payment_Refund:             { color: 'text-red-300 bg-red-500/10 border-red-500/30', icon: '↩️' },
  Payment_Chargeback:         { color: 'text-red-200 bg-red-600/15 border-red-600/40', icon: '⚠️' },
  Refund_Requested:           { color: 'text-rose-300 bg-rose-500/10 border-rose-500/30', icon: '📩' },
  Refund_Period_Over:         { color: 'text-zinc-300 bg-zinc-500/10 border-zinc-500/30', icon: '⏱️' },
  Product_Access_Started:     { color: 'text-sky-300 bg-sky-500/10 border-sky-500/30', icon: '🔓' },
  Product_Access_Ended:       { color: 'text-zinc-300 bg-zinc-500/10 border-zinc-500/30', icon: '🔒' },
  Abandoned_Cart:             { color: 'text-purple-300 bg-purple-500/10 border-purple-500/30', icon: '🛒' },
};

const eventBadge = (type: string | null) => {
  if (!type) return null;
  const meta = EVENT_TYPE_META[type] ?? { color: 'text-foreground bg-white/5 border-white/10', icon: '•' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${meta.color}`}>
      <span>{meta.icon}</span>
      {type.replace(/_/g, ' ')}
    </span>
  );
};

// ─── period ────────────────────────────────────────────────────────────────

type RangeKey = 'today' | '7d' | '30d' | 'all' | 'custom';

const RANGE_LABELS: Record<RangeKey, string> = {
  today: 'Hoje',
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  all: 'Todo o período',
  custom: 'Período personalizado',
};

function rangeBounds(range: RangeKey, customFrom?: Date, customTo?: Date): { from: Date | null; to: Date | null } {
  const now = new Date();
  if (range === 'all') return { from: null, to: null };
  if (range === 'custom') return { from: customFrom ?? null, to: customTo ?? null };
  const to = new Date(now);
  const from = new Date(now);
  if (range === 'today') {
    from.setHours(0, 0, 0, 0);
  } else if (range === '7d') {
    from.setDate(from.getDate() - 7);
  } else if (range === '30d') {
    from.setDate(from.getDate() - 30);
  }
  return { from, to };
}

function inRange(iso: string | null | undefined, from: Date | null, to: Date | null): boolean {
  if (!iso) return false;
  if (!from && !to) return true;
  const d = new Date(iso);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

// ─── main page ─────────────────────────────────────────────────────────────

export default function LastlinkAdmin() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialLead = searchParams.get('lead');

  const { data: payments = [], isLoading } = useLastlinkPayments();

  // ─── filter state — TUDO espelhado na URL pra ser linkável/compartilhável ──
  const [tab, setTab] = useState<'pagantes' | 'eventos'>(() =>
    searchParams.get('tab') === 'eventos' ? 'eventos' : 'pagantes',
  );
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(initialLead);
  const [range, setRange] = useState<RangeKey>(() => {
    const v = searchParams.get('range') as RangeKey | null;
    return v && ['today', '7d', '30d', 'all', 'custom'].includes(v) ? v : '30d';
  });
  const [customFrom, setCustomFrom] = useState<Date | undefined>(() => {
    const v = searchParams.get('from');
    return v ? new Date(`${v}T00:00:00`) : undefined;
  });
  const [customTo, setCustomTo] = useState<Date | undefined>(() => {
    const v = searchParams.get('to');
    return v ? new Date(`${v}T23:59:59`) : undefined;
  });
  const [statusFilter, setStatusFilter] = useState<string>(() => searchParams.get('status') || 'all');
  const [methodFilter, setMethodFilter] = useState<string>(() => searchParams.get('method') || 'all');
  const [coupons, setCoupons] = useState<string[]>(() =>
    searchParams.get('coupons')?.split(',').filter(Boolean) || [],
  );
  const [affiliates, setAffiliates] = useState<string[]>(() =>
    searchParams.get('affiliates')?.split(',').filter(Boolean) || [],
  );
  const [plans, setPlans] = useState<string[]>(() =>
    searchParams.get('plans')?.split(',').filter(Boolean) || [],
  );
  const [utmSources, setUtmSources] = useState<string[]>(() =>
    searchParams.get('utm')?.split(',').filter(Boolean) || [],
  );
  const [hideTest, setHideTest] = useState(() => searchParams.get('hideTest') !== '0');
  const [search, setSearch] = useState(() => searchParams.get('q') || '');

  // Sincroniza estado → URL (replace, sem poluir histórico) sempre que mudar.
  useEffect(() => {
    const next = new URLSearchParams();
    const setIf = (k: string, v: string | null | undefined) => {
      if (v != null && v !== '') next.set(k, v);
    };
    if (tab !== 'pagantes') setIf('tab', tab);
    setIf('lead', selectedLeadId);
    if (range !== '30d') setIf('range', range);
    if (customFrom) setIf('from', format(customFrom, 'yyyy-MM-dd'));
    if (customTo) setIf('to', format(customTo, 'yyyy-MM-dd'));
    if (statusFilter !== 'all') setIf('status', statusFilter);
    if (methodFilter !== 'all') setIf('method', methodFilter);
    if (coupons.length) setIf('coupons', coupons.join(','));
    if (affiliates.length) setIf('affiliates', affiliates.join(','));
    if (plans.length) setIf('plans', plans.join(','));
    if (utmSources.length) setIf('utm', utmSources.join(','));
    if (!hideTest) setIf('hideTest', '0');
    setIf('q', search.trim() || undefined);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [tab, selectedLeadId, range, customFrom, customTo, statusFilter, methodFilter, coupons, affiliates, plans, utmSources, hideTest, search, searchParams, setSearchParams]);

  // Realtime — atualiza tabela e drawer (timeline) quando chegar pagamento/evento novo
  useRealtimeSubscription({
    tableName: 'trial_leads',
    queryKeys: [['lastlink_payments']],
    event: '*',
  });
  useRealtimeSubscription({
    tableName: 'lastlink_events',
    queryKeys: selectedLeadId
      ? [['lastlink_events'], ['lastlink_events_lead', selectedLeadId]]
      : [['lastlink_events']],
    event: 'INSERT',
  });

  const { from: rangeFrom, to: rangeTo } = useMemo(
    () => rangeBounds(range, customFrom, customTo),
    [range, customFrom, customTo],
  );

  const couponOptions = useMemo(
    () => Array.from(new Set(payments.map(p => p.coupon_code).filter(Boolean) as string[]))
      .sort().map(v => ({ value: v, label: v })),
    [payments],
  );
  const affiliateOptions = useMemo(
    () => Array.from(new Set(payments.map(p => p.lastlink_affiliate_email).filter(Boolean) as string[]))
      .sort().map(v => ({ value: v, label: v })),
    [payments],
  );
  const planOptions = useMemo(
    () => Array.from(new Set(payments.map(p => p.plan_name || p.lastlink_offer_name).filter(Boolean) as string[]))
      .sort().map(v => ({ value: v, label: v })),
    [payments],
  );
  const utmSourceOptions = useMemo(
    () => Array.from(new Set(payments.map(p => p.lastlink_utm?.source).filter(Boolean) as string[]))
      .sort().map(v => ({ value: v, label: v })),
    [payments],
  );

  const filtered = useMemo(() => {
    return payments.filter(p => {
      if (hideTest && p.lastlink_is_test) return false;
      if (statusFilter !== 'all' && p.subscription_status !== statusFilter) return false;
      if (methodFilter !== 'all') {
        // Normaliza pra casar tanto `credit_card` quanto `creditcard` (Lastlink envia em formatos variados)
        const m = (p.payment_method || '').toLowerCase().replace(/[_\s-]/g, '');
        const target = methodFilter.replace(/[_\s-]/g, '');
        if (m !== target) return false;
      }
      if (coupons.length && !coupons.includes(p.coupon_code ?? '')) return false;
      if (affiliates.length && !affiliates.includes(p.lastlink_affiliate_email ?? '')) return false;
      if (plans.length && !plans.includes((p.plan_name || p.lastlink_offer_name) ?? '')) return false;
      if (utmSources.length && !utmSources.includes(p.lastlink_utm?.source ?? '')) return false;
      // Período: usa paid_at, fallback pra lastlink_last_event_at, fallback pra created_at
      const refDate = p.paid_at ?? p.lastlink_last_event_at ?? p.created_at;
      if ((rangeFrom || rangeTo) && !inRange(refDate, rangeFrom, rangeTo)) return false;
      if (search) {
        const q = search.toLowerCase().trim();
        const haystack = [
          p.name, p.email, p.whatsapp, p.buyer_name,
          p.buyer_phone, p.buyer_document, p.lastlink_order_id,
          p.lastlink_subscription_id, p.lastlink_payment_id,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q) && !p.id.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [payments, hideTest, statusFilter, methodFilter, coupons, affiliates, plans, utmSources, rangeFrom, rangeTo, search]);

  // KPIs
  const kpis = useMemo(() => {
    let revenue = 0;
    let conversions = 0;
    let refundCount = 0;
    let refundAmount = 0;
    const couponTally = new Map<string, number>();
    const affRevenue = new Map<string, number>();
    for (const p of filtered) {
      if (p.paid_at) {
        conversions++;
        revenue += p.paid_amount ?? 0;
      }
      if (p.subscription_status === 'refunded' || p.subscription_status === 'chargeback' || p.refunded_at) {
        refundCount++;
        refundAmount += p.paid_amount ?? 0;
      }
      if (p.coupon_code) couponTally.set(p.coupon_code, (couponTally.get(p.coupon_code) ?? 0) + 1);
      if (p.lastlink_affiliate_email && p.paid_amount) {
        affRevenue.set(p.lastlink_affiliate_email, (affRevenue.get(p.lastlink_affiliate_email) ?? 0) + p.paid_amount);
      }
    }
    const ticket = conversions > 0 ? revenue / conversions : 0;
    const topCoupons = [...couponTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const topAffiliates = [...affRevenue.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { revenue, conversions, ticket, refundCount, refundAmount, topCoupons, topAffiliates };
  }, [filtered]);

  const selectedLead = useMemo(
    () => payments.find(p => p.id === selectedLeadId) ?? null,
    [payments, selectedLeadId],
  );

  const openLead = (id: string) => setSelectedLeadId(id);
  const closeLead = () => setSelectedLeadId(null);

  const clearFilters = () => {
    setRange('30d');
    setCustomFrom(undefined);
    setCustomTo(undefined);
    setStatusFilter('all');
    setMethodFilter('all');
    setCoupons([]);
    setAffiliates([]);
    setPlans([]);
    setUtmSources([]);
    setSearch('');
  };

  const hasActiveFilters =
    range !== '30d' || statusFilter !== 'all' || methodFilter !== 'all' ||
    coupons.length > 0 || affiliates.length > 0 || plans.length > 0 ||
    utmSources.length > 0 || search.trim().length > 0;

  return (
    <Layout>
      <div className="relative space-y-4 md:space-y-6 animate-fade-in">
        <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
          <div className="absolute top-0 left-1/3 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-emerald-500/8 blur-[130px]" />
          <div className="absolute top-1/2 right-0 w-[400px] h-[400px] rounded-full bg-cyan-500/6 blur-[100px]" />
        </div>

        {/* Hero */}
        <div className="relative rounded-3xl overflow-hidden border border-white/8 glass p-6 md:p-8">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[180px] rounded-full bg-emerald-500/12 blur-[70px]" />
          </div>
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-semibold">
                <Sparkles className="w-3 h-3" />
                Lastlink · Pagamentos
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-glow" />
              </div>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-cyan-600/10 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/15 flex-shrink-0">
                  <Receipt className="h-7 w-7 text-emerald-300" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 via-cyan-400 to-sky-400 bg-clip-text text-transparent">
                    CRM de Pagantes
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    {payments.length} compradores no total · todos os eventos da Lastlink em um só lugar
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            icon={<Banknote className="w-5 h-5" />}
            label="Receita do período"
            value={fmtMoney(kpis.revenue)}
            hint={`${RANGE_LABELS[range]}`}
            accent="from-emerald-500/20 to-emerald-500/5 border-emerald-500/25 text-emerald-300"
            testId="kpi-revenue"
          />
          <KpiCard
            icon={<CheckCircle2 className="w-5 h-5" />}
            label="Conversões"
            value={kpis.conversions}
            hint="Pagamentos confirmados"
            accent="from-cyan-500/20 to-cyan-500/5 border-cyan-500/25 text-cyan-300"
            testId="kpi-conversions"
          />
          <KpiCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="Ticket médio"
            value={fmtMoney(kpis.ticket)}
            hint="Receita ÷ conversões"
            accent="from-sky-500/20 to-sky-500/5 border-sky-500/25 text-sky-300"
            testId="kpi-avg-ticket"
          />
          <KpiCard
            icon={<RefreshCcw className="w-5 h-5" />}
            label="Refunds + chargebacks"
            value={`${kpis.refundCount}`}
            hint={fmtMoney(kpis.refundAmount)}
            accent="from-red-500/20 to-red-500/5 border-red-500/25 text-red-300"
            testId="kpi-refunds"
          />
          <ListKpiCard
            icon={<Tag className="w-5 h-5" />}
            label="Top cupons"
            items={kpis.topCoupons.map(([k, v]) => ({ label: k, count: `${v}×` }))}
            accent="from-pink-500/20 to-pink-500/5 border-pink-500/25 text-pink-300"
            testId="kpi-top-coupons"
          />
          <ListKpiCard
            icon={<Users className="w-5 h-5" />}
            label="Top afiliados (R$)"
            items={kpis.topAffiliates.map(([k, v]) => ({ label: k, count: fmtMoney(v) }))}
            accent="from-amber-500/20 to-amber-500/5 border-amber-500/25 text-amber-300"
            testId="kpi-top-affiliates"
          />
        </div>

        {/* Filtros */}
        <div className="glass rounded-3xl border border-white/8 p-4 md:p-5 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Filter className="w-4 h-4 text-emerald-400" />
              Filtros
            </div>
            {hasActiveFilters && (
              <Button
                size="sm"
                variant="ghost"
                onClick={clearFilters}
                className="text-xs text-muted-foreground hover:text-foreground h-7"
                data-testid="button-clear-filters"
              >
                <X className="w-3 h-3 mr-1" /> Limpar filtros
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {/* Período */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Período</label>
              <Select value={range} onValueChange={v => setRange(v as RangeKey)}>
                <SelectTrigger className="bg-white/5 border-white/10 h-9 text-sm" data-testid="filter-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="all">Todo o período</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
              {range === 'custom' && (
                <div className="grid grid-cols-2 gap-1 mt-1">
                  <DatePickerButton value={customFrom} onChange={setCustomFrom} placeholder="Início" testId="filter-custom-from" />
                  <DatePickerButton value={customTo} onChange={setCustomTo} placeholder="Fim" testId="filter-custom-to" />
                </div>
              )}
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Status da assinatura</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-white/5 border-white/10 h-9 text-sm" data-testid="filter-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="canceled">Cancelada</SelectItem>
                  <SelectItem value="expired">Expirada</SelectItem>
                  <SelectItem value="refunded">Reembolsada</SelectItem>
                  <SelectItem value="refund_requested">Reembolso solicitado</SelectItem>
                  <SelectItem value="chargeback">Chargeback</SelectItem>
                  <SelectItem value="access_ended">Acesso encerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Método */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Forma de pagamento</label>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="bg-white/5 border-white/10 h-9 text-sm" data-testid="filter-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="credit_card">Cartão</SelectItem>
                  <SelectItem value="pix">Pix</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Cupons */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Cupom</label>
              <MultiSelectPopover
                options={couponOptions}
                selected={coupons}
                onChange={setCoupons}
                placeholder="Todos os cupons"
                emptyText="Nenhum cupom registrado"
                className="bg-white/5 border-white/10 h-9 text-sm w-full"
              />
            </div>

            {/* Afiliados */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Afiliado</label>
              <MultiSelectPopover
                options={affiliateOptions}
                selected={affiliates}
                onChange={setAffiliates}
                placeholder="Todos os afiliados"
                emptyText="Nenhum afiliado registrado"
                className="bg-white/5 border-white/10 h-9 text-sm w-full"
              />
            </div>

            {/* Planos */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Plano / oferta</label>
              <MultiSelectPopover
                options={planOptions}
                selected={plans}
                onChange={setPlans}
                placeholder="Todos os planos"
                emptyText="Nenhum plano registrado"
                className="bg-white/5 border-white/10 h-9 text-sm w-full"
              />
            </div>

            {/* UTM source */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">UTM source</label>
              <MultiSelectPopover
                options={utmSourceOptions}
                selected={utmSources}
                onChange={setUtmSources}
                placeholder="Todas as origens"
                emptyText="Nenhuma origem registrada"
                className="bg-white/5 border-white/10 h-9 text-sm w-full"
              />
            </div>

            {/* Hide test toggle */}
            <div className="flex items-end">
              <div className="flex items-center justify-between gap-3 px-3 h-9 rounded-md border border-white/10 bg-white/5 w-full">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <FlaskConical className="w-3.5 h-3.5" /> Esconder testes
                </span>
                <Switch checked={hideTest} onCheckedChange={setHideTest} data-testid="filter-hide-test" />
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome, email, telefone, CPF, order ID, subscription ID…"
              className="pl-10 bg-white/5 border-white/10 h-10"
              data-testid="filter-search"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={v => setTab(v as 'pagantes' | 'eventos')} className="space-y-4">
          <TabsList className="bg-white/5 border border-white/10 p-1 h-11">
            <TabsTrigger value="pagantes" className="data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-200 px-4" data-testid="tab-pagantes">
              <Users className="w-4 h-4 mr-1.5" />
              Pagantes
              <Badge variant="outline" className="ml-2 text-[10px] px-1.5 bg-white/5 border-white/10">
                {filtered.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="eventos" className="data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-200 px-4" data-testid="tab-eventos">
              <Activity className="w-4 h-4 mr-1.5" />
              Eventos brutos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pagantes" className="mt-0">
            <PaymentsTable
              payments={filtered}
              isLoading={isLoading}
              onRowClick={openLead}
            />
          </TabsContent>

          <TabsContent value="eventos" className="mt-0">
            <EventsPanel onLeadClick={openLead} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Drawer detalhado */}
      <Sheet open={!!selectedLead} onOpenChange={(o) => { if (!o) closeLead(); }}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl overflow-y-auto bg-background border-l border-white/10 p-0"
        >
          {selectedLead && <LeadDetail lead={selectedLead} />}
        </SheetContent>
      </Sheet>
    </Layout>
  );
}

// ─── DatePickerButton ──────────────────────────────────────────────────────

function DatePickerButton({
  value, onChange, placeholder, testId,
}: { value: Date | undefined; onChange: (d: Date | undefined) => void; placeholder: string; testId?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-white/5 border-white/10 h-8 text-xs justify-start font-normal w-full"
          data-testid={testId}
        >
          <CalendarIcon className="w-3 h-3 mr-1.5" />
          {value ? format(value, 'dd/MM/yyyy', { locale: ptBR }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value} onSelect={onChange} locale={ptBR} initialFocus />
      </PopoverContent>
    </Popover>
  );
}

// ─── KPI cards ─────────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, hint, accent, testId,
}: {
  icon: React.ReactNode; label: string; value: number | string; hint?: string;
  accent: string; testId?: string;
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
      <p className="text-xl md:text-2xl font-bold leading-tight" data-testid={testId ? `${testId}-value` : undefined}>{value}</p>
      {hint && <p className="text-[11px] opacity-70 mt-1 leading-tight truncate">{hint}</p>}
    </div>
  );
}

function ListKpiCard({
  icon, label, items, accent, testId,
}: {
  icon: React.ReactNode; label: string;
  items: { label: string; count: string }[];
  accent: string; testId?: string;
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
      {items.length === 0 ? (
        <p className="text-xs opacity-60">—</p>
      ) : (
        <ul className="space-y-1">
          {items.map((it) => (
            <li key={it.label} className="text-xs flex items-center justify-between gap-2">
              <span className="truncate font-medium">{it.label}</span>
              <span className="opacity-70 flex-shrink-0 font-mono text-[10px]">{it.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Payments table ────────────────────────────────────────────────────────

function PaymentsTable({
  payments, isLoading, onRowClick,
}: {
  payments: TrialLead[]; isLoading: boolean;
  onRowClick: (id: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="glass rounded-3xl border border-white/8 p-12 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
      </div>
    );
  }
  if (payments.length === 0) {
    return (
      <div className="glass rounded-3xl border border-white/8 p-12 text-center text-sm text-muted-foreground">
        <Info className="w-8 h-8 mx-auto mb-3 opacity-40" />
        Nenhum pagamento bate com os filtros selecionados.
      </div>
    );
  }
  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block glass rounded-3xl border border-white/8 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/8 hover:bg-transparent">
              <TableHead className="text-[10px] uppercase tracking-wider">Cliente</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider">Plano · Cupom</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider">Valor</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider">Pagamento</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider">Status</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider">Próx. cobrança</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider">Afiliado</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider">UTM source</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wider">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => {
              const discount = p.original_price && p.paid_amount && p.original_price > p.paid_amount
                ? p.original_price - p.paid_amount
                : null;
              return (
                <TableRow
                  key={p.id}
                  className="border-white/5 cursor-pointer"
                  onClick={() => onRowClick(p.id)}
                  data-testid={`row-payment-${p.id}`}
                >
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/30 to-cyan-500/15 border border-emerald-500/30 flex items-center justify-center text-xs font-semibold text-emerald-200 flex-shrink-0">
                        {(p.buyer_name || p.name).charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.buyer_name || p.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{p.email}</p>
                      </div>
                      {p.lastlink_is_test && (
                        <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-300 border-amber-500/30">TESTE</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <p className="text-sm">{p.plan_name || p.lastlink_offer_name || '—'}</p>
                    {p.coupon_code && (
                      <Badge variant="outline" className="text-[10px] mt-0.5 bg-pink-500/10 text-pink-300 border-pink-500/30 font-mono">
                        {p.coupon_code}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-3">
                    <p className="text-sm font-semibold">{fmtMoney(p.paid_amount, p.paid_currency)}</p>
                    {discount && (
                      <p className="text-[10px] text-muted-foreground line-through">{fmtMoney(p.original_price, p.paid_currency)}</p>
                    )}
                  </TableCell>
                  <TableCell className="py-3">
                    <p className="text-sm">{fmtPaymentMethod(p.payment_method)}</p>
                    {p.installments && p.installments > 1 && (
                      <p className="text-[10px] text-muted-foreground">{p.installments}× de {fmtMoney((p.paid_amount ?? 0) / p.installments, p.paid_currency)}</p>
                    )}
                  </TableCell>
                  <TableCell className="py-3">{subStatusBadge(p.subscription_status)}</TableCell>
                  <TableCell className="py-3 text-xs text-muted-foreground">
                    {fmtDate(p.next_billing_at, false)}
                  </TableCell>
                  <TableCell className="py-3 text-xs">
                    <p className="text-muted-foreground truncate max-w-[160px]" title={p.lastlink_affiliate_email ?? undefined}>
                      {p.lastlink_affiliate_email || '—'}
                    </p>
                  </TableCell>
                  <TableCell className="py-3 text-xs">
                    <p className="text-muted-foreground truncate max-w-[120px]" title={p.lastlink_utm?.source ?? undefined}>
                      {p.lastlink_utm?.source || '—'}
                    </p>
                    {p.lastlink_utm?.campaign && (
                      <p className="text-[10px] text-muted-foreground/60 truncate max-w-[120px]" title={p.lastlink_utm.campaign}>
                        {p.lastlink_utm.campaign}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10"
                      onClick={(e) => { e.stopPropagation(); onRowClick(p.id); }}
                      data-testid={`button-view-${p.id}`}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" /> Ver
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {payments.map((p) => (
          <button
            key={p.id}
            onClick={() => onRowClick(p.id)}
            className="block w-full text-left glass rounded-2xl border border-white/8 p-3 hover:border-emerald-500/30 transition-colors"
            data-testid={`card-payment-${p.id}`}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500/30 to-cyan-500/15 border border-emerald-500/30 flex items-center justify-center text-xs font-semibold text-emerald-200 flex-shrink-0">
                  {(p.buyer_name || p.name).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.buyer_name || p.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{p.email}</p>
                </div>
              </div>
              {subStatusBadge(p.subscription_status)}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Valor</p>
                <p className="font-semibold">{fmtMoney(p.paid_amount, p.paid_currency)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Plano</p>
                <p className="truncate">{p.plan_name || p.lastlink_offer_name || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Forma</p>
                <p>{fmtPaymentMethod(p.payment_method)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Próx. cobrança</p>
                <p>{fmtDate(p.next_billing_at, false)}</p>
              </div>
            </div>
            {p.coupon_code && (
              <Badge variant="outline" className="text-[10px] mt-2 bg-pink-500/10 text-pink-300 border-pink-500/30 font-mono">
                {p.coupon_code}
              </Badge>
            )}
          </button>
        ))}
      </div>
    </>
  );
}

// ─── Lead detail drawer ───────────────────────────────────────────────────

function LeadDetail({ lead }: { lead: TrialLead }) {
  const { data: events = [], isLoading: loadingEvents } = useLastlinkLeadEvents(lead.id);
  const [showRaw, setShowRaw] = useState(false);

  const discount = lead.original_price && lead.paid_amount && lead.original_price > lead.paid_amount
    ? lead.original_price - lead.paid_amount
    : null;
  const discountPct = discount && lead.original_price ? (discount / lead.original_price) * 100 : null;

  const addr = lead.buyer_address as LastlinkBuyerAddress | null;
  const utm = lead.lastlink_utm as LastlinkUtm | null;

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="relative p-6 border-b border-white/10 bg-gradient-to-br from-emerald-500/15 to-cyan-500/5">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-10 -right-10 w-[200px] h-[200px] rounded-full bg-emerald-500/20 blur-[80px]" />
        </div>
        <div className="relative">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/15 border border-emerald-500/30 flex items-center justify-center text-xl font-bold text-emerald-200 flex-shrink-0">
              {(lead.buyer_name || lead.name).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 pr-8">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="text-lg font-bold truncate" data-testid="detail-buyer-name">{lead.buyer_name || lead.name}</h2>
                {lead.lastlink_is_test && (
                  <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-300 border-amber-500/30">TESTE</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate flex items-center gap-1.5">
                <Mail className="w-3 h-3" /> {lead.email}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {subStatusBadge(lead.subscription_status)}
                {lead.paid_at && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Comprou em {fmtDate(lead.paid_at)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Contato */}
        <Section icon={<Phone className="w-4 h-4" />} title="Contato" accent="text-cyan-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Telefone" value={fmtPhone(lead.buyer_phone || lead.whatsapp)} icon={<Phone className="w-3 h-3" />} />
            <Field label="CPF" value={fmtCpf(lead.buyer_document)} icon={<IdCard className="w-3 h-3" />} />
            <Field label="WhatsApp do trial" value={fmtPhone(lead.whatsapp)} icon={<Phone className="w-3 h-3" />} />
            <Field label="Telegram" value={lead.telegram_username || '—'} icon={<Mail className="w-3 h-3" />} />
          </div>
          {addr && (Object.values(addr).some(v => v)) && (
            <div className="mt-3 p-3 rounded-xl bg-white/3 border border-white/8">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <MapPin className="w-3 h-3" /> Endereço
              </p>
              <p className="text-sm leading-relaxed">
                {[addr.street, addr.number].filter(Boolean).join(', ')}
                {addr.complement && <>, {addr.complement}</>}
                {addr.district && <> · {addr.district}</>}
                <br />
                {[addr.city, addr.state].filter(Boolean).join(' / ')}
                {addr.zip_code && <> · CEP {addr.zip_code}</>}
                {addr.country && <> · {addr.country}</>}
              </p>
            </div>
          )}
        </Section>

        {/* Pagamento */}
        <Section icon={<CreditCard className="w-4 h-4" />} title="Pagamento atual" accent="text-emerald-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Plano" value={lead.plan_name || lead.lastlink_offer_name || '—'} />
            <Field label="Oferta (ID)" value={lead.lastlink_offer_id || '—'} mono />
            <Field
              label="Valor pago"
              value={fmtMoney(lead.paid_amount, lead.paid_currency)}
              extra={discount ? (
                <span className="text-[11px] text-muted-foreground">
                  de <span className="line-through">{fmtMoney(lead.original_price, lead.paid_currency)}</span>
                  {discountPct && <> · -{discountPct.toFixed(0)}%</>}
                </span>
              ) : null}
              highlight
            />
            <Field label="Cupom" value={lead.coupon_code || '—'} mono />
            <Field label="Forma" value={fmtPaymentMethod(lead.payment_method)} />
            <Field label="Parcelas" value={lead.installments ? `${lead.installments}×` : '—'} />
            <Field label="Recorrência" value={lead.recurrency_months ? `${lead.recurrency_months} meses` : '—'} />
            <Field label="Próxima cobrança" value={fmtDate(lead.next_billing_at, false)} />
          </div>
          {lead.lastlink_invoice_url && (
            <a
              href={lead.lastlink_invoice_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-xs text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
              data-testid="link-invoice"
            >
              <FileText className="w-3.5 h-3.5" /> Abrir fatura na Lastlink <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </Section>

        {/* IDs Lastlink */}
        <Section icon={<Tag className="w-4 h-4" />} title="IDs da Lastlink" accent="text-purple-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Order ID" value={lead.lastlink_order_id || '—'} mono />
            <Field label="Subscription ID" value={lead.lastlink_subscription_id || '—'} mono />
            <Field label="Payment ID" value={lead.lastlink_payment_id || '—'} mono />
            <Field label="Event ID" value={lead.lastlink_event_id || '—'} mono />
          </div>
        </Section>

        {/* Marketing */}
        <Section icon={<Globe className="w-4 h-4" />} title="Marketing & atribuição" accent="text-fuchsia-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="UTM source" value={utm?.source || '—'} />
            <Field label="UTM medium" value={utm?.medium || '—'} />
            <Field label="UTM campaign" value={utm?.campaign || '—'} />
            <Field label="UTM content" value={utm?.content || '—'} />
            <Field label="UTM term" value={utm?.term || '—'} />
            <Field label="Afiliado" value={lead.lastlink_affiliate_email || '—'} />
          </div>
          {lead.lastlink_origin_url && (
            <a
              href={lead.lastlink_origin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-xs text-fuchsia-300 hover:text-fuchsia-200 underline underline-offset-2 break-all"
            >
              <ArrowUpRight className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="break-all">{lead.lastlink_origin_url}</span>
            </a>
          )}
          {lead.lastlink_offer_url && (
            <div className="mt-2">
              <a
                href={lead.lastlink_offer_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
              >
                <Building2 className="w-3.5 h-3.5" /> Página da oferta <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </Section>

        {/* Status & datas críticas */}
        <Section icon={<AlertCircle className="w-4 h-4" />} title="Status & datas" accent="text-amber-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Pago em" value={fmtDate(lead.paid_at)} />
            <Field label="Cancelada em" value={fmtDate(lead.canceled_at)} />
            <Field label="Reembolsada em" value={fmtDate(lead.refunded_at)} />
            <Field label="Último evento" value={lead.lastlink_last_event || '—'} />
            <Field label="Recebido em" value={fmtDate(lead.lastlink_last_event_at)} />
            <Field label="Status do trial" value={lead.status} />
          </div>
        </Section>

        {/* Timeline de eventos */}
        <Section icon={<Activity className="w-4 h-4" />} title={`Histórico de eventos (${events.length})`} accent="text-sky-300">
          {loadingEvents ? (
            <div className="py-4 flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : events.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum evento registrado pra este lead.</p>
          ) : (
            <div className="space-y-2">
              {events.map(ev => (
                <div
                  key={ev.id}
                  className="rounded-xl border border-white/8 bg-white/3 p-3 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {eventBadge(ev.event_type)}
                      {ev.is_test && (
                        <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-300 border-amber-500/30">TESTE</Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{fmtDate(ev.received_at)}</p>
                    {ev.order_id && (
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">order: {ev.order_id}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Raw payload */}
        <Collapsible open={showRaw} onOpenChange={setShowRaw}>
          <CollapsibleTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full border-white/10 bg-white/3 hover:bg-white/5 justify-between"
              data-testid="button-toggle-raw"
            >
              <span className="text-xs flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" />
                Payload bruto do último evento
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showRaw ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <pre className="text-[10px] font-mono p-3 rounded-xl bg-black/40 border border-white/5 max-h-[400px] overflow-auto whitespace-pre-wrap break-all text-zinc-300">
              {lead.lastlink_raw ? JSON.stringify(lead.lastlink_raw, null, 2) : 'Nenhum payload bruto salvo.'}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}

function Section({
  icon, title, accent, children,
}: { icon: React.ReactNode; title: string; accent: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className={`text-sm font-semibold flex items-center gap-2 mb-3 ${accent}`}>
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({
  label, value, icon, mono, highlight, extra,
}: {
  label: string; value: string;
  icon?: React.ReactNode; mono?: boolean; highlight?: boolean; extra?: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        {icon} {label}
      </p>
      <p className={`${mono ? 'font-mono text-xs' : 'text-sm'} ${highlight ? 'font-semibold text-emerald-300' : ''} break-all`}>
        {value}
      </p>
      {extra}
    </div>
  );
}

// ─── Eventos brutos panel ─────────────────────────────────────────────────

function EventsPanel({ onLeadClick }: { onLeadClick: (id: string) => void }) {
  // Filtros 100% próprios da aba — independentes do bar global da Pagantes.
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [matchedFilter, setMatchedFilter] = useState<'all' | 'matched' | 'unmatched'>('all');
  const [evRange, setEvRange] = useState<RangeKey>('30d');
  const [evCustomFrom, setEvCustomFrom] = useState<Date | undefined>(undefined);
  const [evCustomTo, setEvCustomTo] = useState<Date | undefined>(undefined);
  const [evHideTest, setEvHideTest] = useState(true);
  const [evSearch, setEvSearch] = useState('');
  const [eventLimit, setEventLimit] = useState(200);

  const { from: evFrom, to: evTo } = useMemo(
    () => rangeBounds(evRange, evCustomFrom, evCustomTo),
    [evRange, evCustomFrom, evCustomTo],
  );

  const { data: events = [], isLoading } = useLastlinkEvents(eventLimit);

  const eventTypeOptions = useMemo(() => {
    const types = new Set<string>();
    events.forEach(e => { if (e.event_type) types.add(e.event_type); });
    return Array.from(types).sort();
  }, [events]);

  const filtered = useMemo(() => {
    return events.filter(e => {
      if (evHideTest && e.is_test) return false;
      if (eventTypeFilter !== 'all' && e.event_type !== eventTypeFilter) return false;
      if (matchedFilter === 'matched' && !e.matched_lead) return false;
      if (matchedFilter === 'unmatched' && e.matched_lead) return false;
      if ((evFrom || evTo) && !inRange(e.received_at, evFrom, evTo)) return false;
      if (evSearch) {
        const q = evSearch.toLowerCase();
        const haystack = [e.buyer_email, e.order_id, e.event_type].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [events, evHideTest, eventTypeFilter, matchedFilter, evFrom, evTo, evSearch]);

  return (
    <div className="space-y-3">
      {/* Linha 1 — tipo, matched, período próprio */}
      <div className="glass rounded-2xl border border-white/8 p-3 flex items-center gap-2 flex-wrap">
        <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
          <SelectTrigger className="bg-white/5 border-white/10 h-8 text-xs w-[220px]" data-testid="filter-event-type">
            <SelectValue placeholder="Tipo de evento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {eventTypeOptions.map(t => (
              <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={matchedFilter} onValueChange={v => setMatchedFilter(v as 'all' | 'matched' | 'unmatched')}>
          <SelectTrigger className="bg-white/5 border-white/10 h-8 text-xs w-[180px]" data-testid="filter-matched">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="matched">Casados com lead</SelectItem>
            <SelectItem value="unmatched">Sem lead casado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={evRange} onValueChange={v => setEvRange(v as RangeKey)}>
          <SelectTrigger className="bg-white/5 border-white/10 h-8 text-xs w-[180px]" data-testid="filter-event-range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="all">Todo o período</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>
        {evRange === 'custom' && (
          <>
            <DatePickerButton value={evCustomFrom} onChange={setEvCustomFrom} placeholder="De" testId="filter-event-from" />
            <DatePickerButton value={evCustomTo} onChange={setEvCustomTo} placeholder="Até" testId="filter-event-to" />
          </>
        )}
        <div className="flex items-center gap-2 px-3 h-8 rounded-md border border-white/10 bg-white/5">
          <FlaskConical className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Esconder testes</span>
          <Switch checked={evHideTest} onCheckedChange={setEvHideTest} data-testid="filter-event-hide-test" />
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length} de {events.length} eventos
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs border-white/10"
          onClick={() => setEventLimit(l => l + 200)}
          data-testid="button-load-more-events"
        >
          Carregar mais
        </Button>
      </div>

      {/* Linha 2 — busca dedicada */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={evSearch}
          onChange={e => setEvSearch(e.target.value)}
          placeholder="Buscar evento por email, order ID, tipo…"
          className="pl-10 bg-white/5 border-white/10 h-9"
          data-testid="filter-event-search"
        />
      </div>

      {isLoading ? (
        <div className="glass rounded-3xl border border-white/8 p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-3xl border border-white/8 p-12 text-center text-sm text-muted-foreground">
          <Info className="w-8 h-8 mx-auto mb-3 opacity-40" />
          Nenhum evento bate com esses filtros.
        </div>
      ) : (
        <div className="glass rounded-3xl border border-white/8 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/8 hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider">Recebido em</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider">Tipo</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider">Comprador</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider">Order ID</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider">Lead</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(ev => (
                <TableRow key={ev.id} className="border-white/5" data-testid={`row-event-${ev.id}`}>
                  <TableCell className="py-3 text-xs whitespace-nowrap">{fmtDate(ev.received_at)}</TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      {eventBadge(ev.event_type)}
                      {ev.is_test && (
                        <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-300 border-amber-500/30">TESTE</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-xs">{ev.buyer_email || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="py-3 text-[11px] font-mono text-muted-foreground truncate max-w-[180px]">{ev.order_id || '—'}</TableCell>
                  <TableCell className="py-3">
                    {ev.matched_lead ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[11px] text-emerald-300 hover:bg-emerald-500/10 px-2"
                        onClick={() => onLeadClick(ev.matched_lead!)}
                        data-testid={`button-open-lead-${ev.id}`}
                      >
                        <Eye className="w-3 h-3 mr-1" /> Ver lead
                      </Button>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-zinc-500/10 text-zinc-400 border-zinc-500/20">
                        sem match
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

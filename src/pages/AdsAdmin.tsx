import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Megaphone, Search, Users, Phone, Clock, ExternalLink,
  TrendingUp, CheckCircle2, XCircle, RefreshCw, Loader2,
  Filter, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTrialLeads } from '@/hooks/useTrialLeads';
import type { TrialLead, TrialStatus } from '@/types/trial';

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_META: Record<TrialStatus, { label: string; cls: string }> = {
  pending:        { label: 'Aguardando',     cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  active:         { label: 'Ativo',          cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  expired:        { label: 'Expirado',       cls: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30' },
  removed:        { label: 'Removido',       cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
  blocked:        { label: 'Bloqueado',      cls: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  blocked_repeat: { label: 'Repetidor',      cls: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  converted:      { label: 'Convertido ✓',   cls: 'bg-emerald-600/20 text-emerald-200 border-emerald-500/40' },
};

const fmtDate = (iso: string | null) =>
  iso ? format(new Date(iso), "dd/MM/yy HH:mm", { locale: ptBR }) : '—';

const fmtWhatsapp = (raw: string) => {
  const d = raw.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
};

// Paleta determinística por string — colorir campanhas / UTM values
const UTM_PALETTE = [
  'bg-cyan-500/20 text-cyan-300 border-cyan-500/35',
  'bg-violet-500/20 text-violet-300 border-violet-500/35',
  'bg-amber-500/20 text-amber-300 border-amber-500/35',
  'bg-pink-500/20 text-pink-300 border-pink-500/35',
  'bg-lime-500/20 text-lime-300 border-lime-500/35',
  'bg-sky-500/20 text-sky-300 border-sky-500/35',
  'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/35',
  'bg-orange-500/20 text-orange-300 border-orange-500/35',
];

const colorFor = (() => {
  const cache = new Map<string, string>();
  return (val: string) => {
    if (!cache.has(val)) {
      let h = 0;
      for (let i = 0; i < val.length; i++) h = (h * 31 + val.charCodeAt(i)) >>> 0;
      cache.set(val, UTM_PALETTE[h % UTM_PALETTE.length]);
    }
    return cache.get(val)!;
  };
})();

// ── Component ──────────────────────────────────────────────────────────────

export default function AdsAdmin() {
  const { data: allLeads = [], isLoading, refetch, isFetching } = useTrialLeads();

  // Leads de tráfego pago: cohort='ads' OU qualquer UTM/fbclid presente
  // (captura leads da landing /trial que vieram de campanhas)
  const adsLeads = useMemo(
    () => allLeads.filter(l =>
      l.cohort === 'ads' ||
      !!l.utm_source   ||
      !!l.utm_campaign ||
      !!l.utm_content  ||
      !!l.fbclid        ||
      !!l.ct,
    ),
    [allLeads],
  );

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TrialStatus>('all');
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState<string>(() => format(new Date(), 'yyyy-MM'));
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Opções de filtro dinâmicas
  const campaigns = useMemo(() => {
    const s = new Set<string>();
    adsLeads.forEach(l => { if (l.utm_campaign) s.add(l.utm_campaign); });
    return Array.from(s).sort();
  }, [adsLeads]);

  const sources = useMemo(() => {
    const s = new Set<string>();
    adsLeads.forEach(l => { if (l.utm_source) s.add(l.utm_source); });
    return Array.from(s).sort();
  }, [adsLeads]);

  const monthOptions = useMemo(() => {
    const now = new Date();
    const opts: { value: string; label: string }[] = [{ value: 'all', label: 'Todos os meses' }];
    for (let i = 0; i < 12; i++) {
      const d = subMonths(now, i);
      opts.push({ value: format(d, 'yyyy-MM'), label: format(d, 'MMMM/yyyy', { locale: ptBR }) });
    }
    return opts;
  }, []);

  // Stats
  const stats = useMemo(() => {
    const s = { total: adsLeads.length, active: 0, converted: 0, pending: 0 };
    for (const l of adsLeads) {
      if (l.status === 'active') s.active++;
      else if (l.status === 'converted') s.converted++;
      else if (l.status === 'pending') s.pending++;
    }
    return s;
  }, [adsLeads]);

  // Leads por campanha (top 5)
  const byCampaign = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of adsLeads) {
      const k = l.utm_campaign ?? '(sem campanha)';
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [adsLeads]);

  // Filtro principal
  const filtered = useMemo(() => {
    let list = adsLeads;
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');

    if (!q && monthFilter !== 'all') {
      list = list.filter(l => l.created_at.startsWith(monthFilter));
    }
    if (statusFilter !== 'all') list = list.filter(l => l.status === statusFilter);
    if (campaignFilter !== 'all') list = list.filter(l => (l.utm_campaign ?? '') === campaignFilter);
    if (sourceFilter !== 'all') list = list.filter(l => (l.utm_source ?? '') === sourceFilter);
    if (q) {
      list = list.filter(l =>
        (l.name ?? '').toLowerCase().includes(q) ||
        (qDigits && (l.whatsapp ?? '').includes(qDigits)) ||
        (l.utm_campaign ?? '').toLowerCase().includes(q) ||
        (l.utm_content  ?? '').toLowerCase().includes(q) ||
        (l.utm_source   ?? '').toLowerCase().includes(q) ||
        (l.fbclid       ?? '').toLowerCase().includes(q) ||
        (l.ct           ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [adsLeads, search, statusFilter, campaignFilter, sourceFilter, monthFilter]);

  const hasFilter = search || statusFilter !== 'all' || campaignFilter !== 'all' || sourceFilter !== 'all' || monthFilter !== 'all';

  return (
    <Layout>
      <div className="relative space-y-4 md:space-y-6 animate-fade-in">

        {/* Glows */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
          <div className="absolute top-0 left-1/3 -translate-x-1/2 w-[700px] h-[400px] rounded-full bg-cyan-500/6 blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[350px] h-[350px] rounded-full bg-blue-500/5 blur-[90px]" />
        </div>

        {/* Hero */}
        <div className="relative rounded-3xl overflow-hidden border border-white/8 glass p-6 md:p-8">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[180px] rounded-full bg-cyan-500/10 blur-[70px]" />
          </div>
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-xs font-semibold">
                <Megaphone className="w-3 h-3" />
                Tráfego Pago
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              </div>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/30 to-blue-600/10 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/15 flex-shrink-0">
                  <Megaphone className="h-7 w-7 text-cyan-300" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-400 bg-clip-text text-transparent">
                    Leads de Anúncios
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    {stats.total} leads · {stats.active} ativos · {stats.converted} convertidos
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10"
                onClick={() => refetch()}
                disabled={isFetching}
                data-testid="button-ads-admin-refresh"
              >
                {isFetching
                  ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  : <RefreshCw className="w-4 h-4 mr-1.5" />}
                Atualizar
              </Button>
              <a href="/ads" target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10" data-testid="link-ads-landing">
                  <ExternalLink className="w-4 h-4 mr-1.5" />
                  Abrir landing /ads
                </Button>
              </a>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: <Users className="w-5 h-5" />, label: 'Total de leads', value: stats.total, cls: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/25 text-cyan-300' },
            { icon: <CheckCircle2 className="w-5 h-5" />, label: 'Ativos no grupo', value: stats.active, cls: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/25 text-emerald-300' },
            { icon: <Clock className="w-5 h-5" />, label: 'Aguardando bot', value: stats.pending, cls: 'from-amber-500/20 to-amber-500/5 border-amber-500/25 text-amber-300' },
            { icon: <TrendingUp className="w-5 h-5" />, label: 'Convertidos', value: stats.converted, cls: 'from-violet-500/20 to-violet-500/5 border-violet-500/25 text-violet-300' },
          ].map(({ icon, label, value, cls }) => (
            <div key={label} className={`glass rounded-2xl border bg-gradient-to-br p-4 ${cls}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="opacity-80">{icon}</div>
              </div>
              <p className="text-2xl font-black mt-2 leading-none">{value}</p>
              <p className="text-[11px] opacity-75 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Top campanhas */}
        {byCampaign.length > 0 && (
          <div className="glass rounded-3xl border border-white/8 p-5 md:p-6">
            <h2 className="text-base font-bold flex items-center gap-2 mb-4">
              <Megaphone className="w-4 h-4 text-cyan-400" />
              Leads por campanha
            </h2>
            <div className="flex flex-wrap gap-2">
              {byCampaign.map(([campaign, count]) => (
                <button
                  key={campaign}
                  type="button"
                  onClick={() => setCampaignFilter(campaignFilter === campaign ? 'all' : campaign)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all hover:opacity-90 ${
                    campaignFilter === campaign
                      ? colorFor(campaign) + ' ring-1 ring-cyan-400/40'
                      : colorFor(campaign) + ' opacity-75'
                  }`}
                  data-testid={`button-campaign-filter-${campaign}`}
                >
                  {campaign}
                  <span className="bg-white/20 rounded-full px-1.5 py-0.5 text-[10px] font-black">{count}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar nome, WhatsApp, campanha…"
              className="pl-9 bg-white/5 border-white/10 h-9 text-sm"
              data-testid="input-ads-admin-search"
            />
          </div>

          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="bg-white/5 border-white/10 h-9 text-sm w-[170px]" data-testid="select-ads-month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as 'all' | TrialStatus)}>
            <SelectTrigger className="bg-white/5 border-white/10 h-9 text-sm w-[150px]" data-testid="select-ads-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="pending">Aguardando</SelectItem>
              <SelectItem value="converted">Convertidos</SelectItem>
              <SelectItem value="expired">Expirados</SelectItem>
              <SelectItem value="removed">Removidos</SelectItem>
            </SelectContent>
          </Select>

          {sources.length > 0 && (
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="bg-white/5 border-white/10 h-9 text-sm w-[140px]" data-testid="select-ads-source">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os sources</SelectItem>
                {sources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {hasFilter && (
            <Button
              variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => { setSearch(''); setStatusFilter('all'); setCampaignFilter('all'); setSourceFilter('all'); setMonthFilter('all'); }}
              data-testid="button-ads-clear-filters"
            >
              Limpar filtros
            </Button>
          )}
        </div>

        {/* Contador */}
        <p className="text-xs text-muted-foreground -mt-2">
          {filtered.length} lead{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
          {hasFilter && ` (de ${stats.total} total)`}
        </p>

        {/* Lista */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="glass rounded-2xl border border-white/5 p-4 h-24 animate-pulse bg-white/2" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-2xl border border-white/8 p-10 text-center">
            <Megaphone className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {adsLeads.length === 0
                ? 'Nenhum lead de anúncio ainda — compartilhe o link da landing.'
                : 'Nenhum lead com esses filtros.'}
            </p>
            {adsLeads.length === 0 && (
              <a href="/ads" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 underline underline-offset-2 mt-2">
                <ExternalLink className="w-3 h-3" /> Abrir /ads
              </a>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(lead => (
              <LeadCard
                key={lead.id}
                lead={lead}
                expanded={expandedId === lead.id}
                onToggle={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
              />
            ))}
          </div>
        )}

      </div>
    </Layout>
  );
}

// ── LeadCard ───────────────────────────────────────────────────────────────

function LeadCard({ lead, expanded, onToggle }: {
  lead: TrialLead;
  expanded: boolean;
  onToggle: () => void;
}) {
  const meta = STATUS_META[lead.status];
  const hasUtm = lead.utm_source || lead.utm_medium || lead.utm_campaign || lead.utm_content || lead.utm_term || lead.ct;

  return (
    <div
      className="glass rounded-2xl border border-white/8 p-4 hover:border-cyan-500/25 transition-all duration-200"
      data-testid={`card-ads-lead-${lead.id}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">

        {/* Coluna esquerda — UTM source / plataforma */}
        <div className="flex-shrink-0 flex flex-col gap-1.5 min-w-[100px]">
          {lead.utm_source && (
            <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg border text-[11px] font-bold uppercase tracking-wide ${colorFor(lead.utm_source)}`}
              data-testid={`badge-utm-source-${lead.id}`}>
              {lead.utm_source}
            </span>
          )}
          {lead.ct && (
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded border border-violet-500/30 bg-violet-500/10 text-violet-300 text-[10px] font-semibold font-mono"
              data-testid={`badge-ct-${lead.id}`} title="AdsScala CT">
              {lead.ct}
            </span>
          )}
          {lead.fbclid && (
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-300 text-[10px] font-semibold">
              fbclid ✓
            </span>
          )}
        </div>

        {/* Coluna central — info principal */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Nome + status */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm truncate" data-testid={`text-ads-name-${lead.id}`}>{lead.name}</span>
            <Badge className={`text-[10px] ${meta.cls}`} data-testid={`badge-ads-status-${lead.id}`}>
              {meta.label}
            </Badge>
            {lead.status === 'converted' && (
              <RouterLink
                to={`/trial-admin`}
                className="text-[10px] text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
                data-testid={`link-ads-trial-admin-${lead.id}`}
              >
                Ver no CRM
              </RouterLink>
            )}
          </div>

          {/* Contato */}
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Phone className="w-3 h-3" />{fmtWhatsapp(lead.whatsapp)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />{fmtDate(lead.created_at)}
            </span>
          </div>

          {/* Tags UTM em linha */}
          {hasUtm && (
            <div className="flex flex-wrap gap-1.5" data-testid={`utm-tags-${lead.id}`}>
              {lead.utm_campaign && (
                <UtmTag label={lead.utm_campaign} color={colorFor(lead.utm_campaign)} title="utm_campaign" />
              )}
              {lead.utm_content && (
                <UtmTag label={lead.utm_content} color={colorFor(lead.utm_content)} title="utm_content" />
              )}
              {lead.utm_medium && (
                <UtmTag label={lead.utm_medium} color={colorFor(lead.utm_medium)} title="utm_medium" />
              )}
              {lead.utm_term && (
                <UtmTag label={lead.utm_term} color={colorFor(lead.utm_term)} title="utm_term" />
              )}
            </div>
          )}
        </div>

        {/* Botão expandir */}
        <button
          type="button"
          onClick={onToggle}
          className="self-start sm:self-center flex-shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/8 transition-colors"
          data-testid={`button-ads-expand-${lead.id}`}
          title={expanded ? 'Recolher' : 'Ver mais detalhes'}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Detalhes expandidos */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/8 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-[11px]">
            {[
              ['utm_source',   lead.utm_source],
              ['utm_medium',   lead.utm_medium],
              ['utm_campaign', lead.utm_campaign],
              ['utm_content',  lead.utm_content],
              ['utm_term',     lead.utm_term],
              ['ct (AdsScala)', lead.ct],
              ['fbclid',       lead.fbclid ? `${lead.fbclid.slice(0, 20)}…` : null],
              ['ID do lead',   lead.id.slice(0, 18) + '…'],
              ['Expira em',    lead.expires_at ? fmtDate(lead.expires_at) : null],
            ].filter(([, v]) => !!v).map(([k, v]) => (
              <div key={k as string}>
                <p className="text-muted-foreground/60 uppercase tracking-wide text-[9px]">{k}</p>
                <p className="font-mono text-white/80 break-all">{v}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-1 pt-1">
            <a
              href={`https://wa.me/55${lead.whatsapp.replace(/\D/g, '')}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
              data-testid={`link-ads-whatsapp-${lead.id}`}
            >
              <Phone className="w-3 h-3" /> Abrir no WhatsApp
            </a>
            <RouterLink
              to="/trial-admin"
              className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
              data-testid={`link-ads-full-crm-${lead.id}`}
            >
              <Filter className="w-3 h-3" /> Ver no CRM Trial
            </RouterLink>
          </div>
        </div>
      )}
    </div>
  );
}

function UtmTag({ label, color, title }: { label: string; color: string; title: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-medium ${color}`}
      title={title}
    >
      {label}
    </span>
  );
}

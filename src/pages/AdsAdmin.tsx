import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Megaphone, Search, Users, Phone, Clock, ExternalLink,
  TrendingUp, CheckCircle2, XCircle, RefreshCw, Loader2,
  Filter, ChevronDown, ChevronUp, Copy, Check, Send, Bot,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTrialLeads } from '@/hooks/useTrialLeads';
import type { TrialLead, TrialStatus } from '@/types/trial';

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_META: Record<TrialStatus, { label: string; cls: string }> = {
  pending:        { label: 'Aguardando',     cls: 'bg-warning/15 text-warning border-warning/30' },
  active:         { label: 'Ativo',          cls: 'bg-primary/15 text-primary border-primary/30' },
  expired:        { label: 'Expirado',       cls: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30' },
  removed:        { label: 'Removido',       cls: 'bg-destructive/15 text-destructive border-destructive/30' },
  blocked:        { label: 'Bloqueado',      cls: 'bg-muted text-muted-foreground border-border' },
  blocked_repeat: { label: 'Repetidor',      cls: 'bg-warning/15 text-warning border-warning/30' },
  converted:      { label: 'Convertido ✓',   cls: 'bg-primary/20 text-primary border-primary/40' },
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
  'bg-muted text-muted-foreground border-border',
  'bg-muted text-muted-foreground border-border',
  'bg-muted text-muted-foreground border-border',
  'bg-muted text-muted-foreground border-border',
  'bg-muted text-muted-foreground border-border',
  'bg-muted text-muted-foreground border-border',
  'bg-muted text-muted-foreground border-border',
  'bg-muted text-muted-foreground border-border',
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
        <PageHeader
          eyebrow="ADS"
          title="Leads de Anúncios"
          subtitle="TRÁFEGO PAGO"
          icon={Megaphone}
          actions={<>
            <Button
              size="sm"
              variant="outline"
              className="border-border text-muted-foreground hover:bg-muted"
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
              <Button size="sm" variant="outline" className="border-primary/30 text-primary hover:bg-primary/10" data-testid="link-ads-landing">
                <ExternalLink className="w-4 h-4 mr-1.5" />
                Abrir landing /ads
              </Button>
            </a>
          </>}
        />

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: <Users className="w-5 h-5" />, label: 'Total de leads', value: stats.total, cls: 'from-muted to-muted/50 border-border text-muted-foreground' },
            { icon: <CheckCircle2 className="w-5 h-5" />, label: 'Ativos no grupo', value: stats.active, cls: 'from-primary/20 to-primary/5 border-primary/25 text-primary' },
            { icon: <Clock className="w-5 h-5" />, label: 'Aguardando bot', value: stats.pending, cls: 'from-warning/20 to-warning/5 border-warning/25 text-warning' },
            { icon: <TrendingUp className="w-5 h-5" />, label: 'Convertidos', value: stats.converted, cls: 'from-muted to-muted/50 border-border text-muted-foreground' },
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
              <Megaphone className="w-4 h-4 text-muted-foreground" />
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
                      ? colorFor(campaign) + ' ring-1 ring-border'
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
          <div className="relative flex-1 min-w-[140px]">
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
            <SelectTrigger className="bg-white/5 border-white/10 h-9 text-sm w-full sm:w-[170px]" data-testid="select-ads-month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as 'all' | TrialStatus)}>
            <SelectTrigger className="bg-white/5 border-white/10 h-9 text-sm w-full sm:w-[150px]" data-testid="select-ads-status">
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
              <SelectTrigger className="bg-white/5 border-white/10 h-9 text-sm w-full sm:w-[140px]" data-testid="select-ads-source">
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
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 mt-2">
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

// ── Bot link helper ─────────────────────────────────────────────────────────

const BOT_USERNAME = 'sharkinhogreen_bot';

function botStartUrl(leadId: string) {
  return `https://t.me/${BOT_USERNAME}?start=lead_${leadId}`;
}

function waBotMsg(lead: TrialLead) {
  const link = botStartUrl(lead.id);
  const name = lead.name?.split(' ')[0] || 'olá';
  const msg = `Oi ${name}! 👋\n\nSeu cadastro no *Shark Green* foi feito com sucesso, mas o acesso ainda não foi ativado.\n\nClique no link abaixo, abra o bot e aperte *START* para receber o link do grupo de trial:\n\n${link}\n\nQualquer dúvida é só falar! 🦈`;
  return `https://wa.me/55${lead.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
}

function waNoTelegramMsg(lead: TrialLead) {
  const link = botStartUrl(lead.id);
  const name = lead.name?.split(' ')[0] || 'olá';
  const msg = [
    `Oi ${name}! 👋`,
    ``,
    `Seu cadastro no *Shark Green* foi feito com sucesso! 🦈`,
    ``,
    `Para acessar o grupo de sinais, você vai precisar do *Telegram* — é gratuito, seguro e em menos de 2 minutos você já está dentro! 😊`,
    ``,
    `*📲 Passo a passo:*`,
    ``,
    `1️⃣ Baixe o Telegram (grátis):`,
    `   🤖 Android → https://play.google.com/store/apps/details?id=org.telegram.messenger`,
    `   🍎 iPhone → https://apps.apple.com/br/app/telegram-messenger/id686449807`,
    ``,
    `2️⃣ Instale e crie sua conta (só precisa de número de celular)`,
    ``,
    `3️⃣ Clique no link abaixo e aperte *START*:`,
    `${link}`,
    ``,
    `Pronto! Você vai receber o acesso ao grupo em segundos. 🚀`,
    ``,
    `Qualquer dúvida é só chamar aqui!`,
  ].join('\n');
  return `https://wa.me/55${lead.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
}

// ── LeadCard ───────────────────────────────────────────────────────────────

function LeadCard({ lead, expanded, onToggle }: {
  lead: TrialLead;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const meta = STATUS_META[lead.status];
  const hasUtm = lead.utm_source || lead.utm_medium || lead.utm_campaign || lead.utm_content || lead.utm_term || lead.ct;
  const isPending = lead.status === 'pending';

  function copyBotLink() {
    navigator.clipboard.writeText(botStartUrl(lead.id));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className={`glass rounded-2xl border p-4 transition-all duration-200 ${isPending ? 'border-warning/30 hover:border-warning/50' : 'border-white/8 hover:border-border'}`}
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
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded border border-border bg-muted text-muted-foreground text-[10px] font-semibold font-mono"
              data-testid={`badge-ct-${lead.id}`} title="AdsScala CT">
              {lead.ct}
            </span>
          )}
          {lead.fbclid && (
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded border border-border bg-muted text-muted-foreground text-[10px] font-semibold">
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
            {isPending && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-warning/40 bg-warning/10 text-warning text-[10px] font-medium"
                title="Usuário não iniciou o bot do Telegram — clique em expandir para recuperar">
                <Bot className="w-3 h-3" /> Não iniciou bot
              </span>
            )}
            {lead.status === 'converted' && (
              <RouterLink
                to={`/trial-admin`}
                className="text-[10px] text-primary hover:text-primary/80 underline underline-offset-2"
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

          {/* Bloco de recuperação — só para leads Aguardando */}
          {isPending && (
            <div className="rounded-xl border border-warning/30 bg-warning/8 p-3 space-y-2"
              data-testid={`block-bot-recovery-${lead.id}`}>
              <p className="text-[11px] font-semibold text-warning flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5" />
                Usuário não iniciou o bot — envie o link abaixo para ativar o trial
              </p>
              <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-1.5 border border-white/8">
                <code className="text-[10px] text-muted-foreground font-mono flex-1 break-all select-all"
                  data-testid={`text-bot-link-${lead.id}`}>
                  {botStartUrl(lead.id)}
                </code>
                <button
                  type="button"
                  onClick={copyBotLink}
                  className="flex-shrink-0 p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-warning transition-colors"
                  title="Copiar link do bot"
                  data-testid={`button-copy-bot-link-${lead.id}`}
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copyBotLink}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-warning/30 bg-warning/10 text-warning hover:bg-warning/20 text-[11px] font-medium transition-colors"
                  data-testid={`button-copy-bot-link-action-${lead.id}`}
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copiado!' : 'Copiar link'}
                </button>
                <a
                  href={waBotMsg(lead)}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 text-[11px] font-medium transition-colors"
                  data-testid={`link-wa-bot-msg-${lead.id}`}
                  title="Mensagem para quem já tem Telegram instalado"
                >
                  <Send className="w-3 h-3" />
                  Tem Telegram
                </a>
                <a
                  href={waNoTelegramMsg(lead)}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-muted text-muted-foreground hover:bg-muted/80 text-[11px] font-medium transition-colors"
                  data-testid={`link-wa-no-telegram-msg-${lead.id}`}
                  title="Mensagem com passo a passo para baixar o Telegram"
                >
                  <Send className="w-3 h-3" />
                  Não tem Telegram
                </a>
              </div>
            </div>
          )}

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
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 underline underline-offset-2"
              data-testid={`link-ads-whatsapp-${lead.id}`}
            >
              <Phone className="w-3 h-3" /> Abrir no WhatsApp
            </a>
            <RouterLink
              to="/trial-admin"
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
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

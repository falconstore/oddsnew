import { useMemo, useState } from 'react';
import { format, subDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid,
} from 'recharts';
import {
  Users2, UserCheck, UserMinus, Percent, Search, RefreshCw,
  Copy, ExternalLink, TrendingUp, MessageCircle, Radio,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useTrialLeads, useFreeGroupSnapshots } from '@/hooks/useTrialLeads';
import { toast } from '@/hooks/use-toast';
import type { TrialLead } from '@/types/trial';
import { cn } from '@/lib/utils';

// Link público do Grupo Free (canal). Usado pra reconvite.
const FREE_GROUP_URL = 'https://t.me/sharkgreenfree2';

// ── Vínculo do lead ──
// O "Grupo Free" é um CANAL do Telegram (não grupo): canais NÃO notificam
// entrada/saída individual via bot. Então não dá pra saber quem "saiu".
// O sinal confiável é: a pessoa passou pelo BOT (deep-link ?start=free_<id>),
// que captura o telegram_user_id REAL → consideramos "vinculada".
//   vinculado   → tem telegram_user_id real (confirmou o Telegram via bot)
//   so_cadastro → só preencheu o forms, sem Telegram real capturado
type Vinculo = 'vinculado' | 'so_cadastro';

function vinculoDe(l: TrialLead): Vinculo {
  return l.telegram_user_id != null ? 'vinculado' : 'so_cadastro';
}

const fmtDia = (iso: string | null) =>
  iso ? format(new Date(iso), 'dd/MM/yy', { locale: ptBR }) : '—';

const fmtWhatsapp = (raw: string) => {
  const d = (raw ?? '').replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
};

// Um @username é "real" quando não é o placeholder (free_<whats> / email).
const usernameReal = (l: TrialLead): string | null => {
  const u = l.telegram_username ?? '';
  if (!u || u.startsWith('free_') || u.includes('@')) return null;
  return u;
};

export default function GrupoFree() {
  const { data: allLeads = [], isLoading, isRefetching, refetch } = useTrialLeads();
  const { data: snapshots = [] } = useFreeGroupSnapshots();

  const [search, setSearch] = useState('');
  const [vinculoFiltro, setVinculoFiltro] = useState<'all' | Vinculo>('all');

  // Só leads do grupo free.
  const leads = useMemo(
    () => allLeads.filter((l) => l.cohort === 'free_group'),
    [allLeads],
  );

  const stats = useMemo(() => {
    const s = { total: leads.length, vinculados: 0, soCadastro: 0 };
    for (const l of leads) {
      if (vinculoDe(l) === 'vinculado') s.vinculados++;
      else s.soCadastro++;
    }
    return s;
  }, [leads]);

  // Taxa de vínculo: quantos confirmaram o Telegram (passaram pelo bot).
  const taxaVinculo = stats.total > 0
    ? Math.round((stats.vinculados / stats.total) * 100)
    : 0;

  // Vínculos nas últimas 24h (pessoas que confirmaram o Telegram via bot hoje).
  const vinculos24h = useMemo(() => {
    const limite = Date.now() - 24 * 60 * 60 * 1000;
    return leads.filter((l) =>
      l.telegram_user_id != null &&
      l.free_group_entered_at != null &&
      new Date(l.free_group_entered_at).getTime() >= limite,
    ).length;
  }, [leads]);

  // Série diária (30 dias) de NOVOS cadastros — usa created_at, que sempre
  // existe. É a métrica de captação confiável pra um canal.
  const serie = useMemo(() => {
    const dias: { key: string; label: string; Cadastros: number }[] = [];
    const idx = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = startOfDay(subDays(new Date(), i));
      const key = format(d, 'yyyy-MM-dd');
      idx.set(key, dias.length);
      dias.push({ key, label: format(d, 'dd/MM'), Cadastros: 0 });
    }
    for (const l of leads) {
      if (!l.created_at) continue;
      const k = format(startOfDay(new Date(l.created_at)), 'yyyy-MM-dd');
      const i = idx.get(k);
      if (i != null) dias[i].Cadastros++;
    }
    return dias;
  }, [leads]);

  const temSerie = serie.some((d) => d.Cadastros > 0);

  // Crescimento do total de inscritos do canal (snapshots diários do cron).
  const inscritos = useMemo(
    () => snapshots.map((s) => ({ label: format(new Date(s.dia + 'T12:00:00'), 'dd/MM'), Inscritos: s.total })),
    [snapshots],
  );
  const totalInscritos = snapshots.length ? snapshots[snapshots.length - 1].total : null;
  // Variação vs primeiro snapshot disponível (desde quando começamos a medir).
  const varInscritos = snapshots.length >= 2
    ? snapshots[snapshots.length - 1].total - snapshots[0].total
    : 0;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (vinculoFiltro !== 'all' && vinculoDe(l) !== vinculoFiltro) return false;
      if (!term) return true;
      return (
        l.name?.toLowerCase().includes(term) ||
        l.email?.toLowerCase().includes(term) ||
        l.whatsapp?.toLowerCase().includes(term) ||
        l.telegram_username?.toLowerCase().includes(term)
      );
    });
  }, [leads, search, vinculoFiltro]);

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(FREE_GROUP_URL);
      toast({ title: 'Link copiado', description: FREE_GROUP_URL });
    } catch {
      toast({ title: 'Não consegui copiar', description: FREE_GROUP_URL, variant: 'destructive' });
    }
  };

  // Reconvida o lead. Se tiver WhatsApp real, abre o WhatsApp com mensagem
  // pronta + link. Senão, abre o canal no Telegram pra compartilhar.
  const reconvidar = (lead: TrialLead) => {
    const digits = (lead.whatsapp ?? '').replace(/\D/g, '');
    const ehWhatsReal = digits.length >= 10 && !lead.whatsapp?.startsWith('tg_');
    if (ehWhatsReal) {
      const nome = (lead.name || '').split(' ')[0] || '';
      const msg = encodeURIComponent(
        `Oi${nome ? ` ${nome}` : ''}! 🦈 Aqui é da Shark Green. Você se cadastrou mas ainda não confirmou sua entrada no nosso Grupo Free. Entra aqui pra acompanhar as entradas gratuitas: ${FREE_GROUP_URL}`,
      );
      const wa = digits.startsWith('55') ? digits : `55${digits}`;
      window.open(`https://wa.me/${wa}?text=${msg}`, '_blank', 'noopener');
    } else {
      window.open(FREE_GROUP_URL, '_blank', 'noopener');
      toast({ title: 'Sem WhatsApp válido', description: 'Abri o canal no Telegram pra você compartilhar o link.' });
    }
  };

  return (
    <Layout>
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        <PageHeader
          eyebrow="FREE"
          title="Grupo Free"
          subtitle="ACOMPANHAMENTO DOS LEADS DO CANAL GRATUITO"
          icon={Users2}
          actions={
            <>
              <Button size="sm" variant="outline" onClick={copiarLink}>
                <Copy className="w-4 h-4 mr-1.5" />
                Copiar link
              </Button>
              <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isRefetching}>
                <RefreshCw className={cn('w-4 h-4 mr-1.5', isRefetching && 'animate-spin')} />
                Atualizar
              </Button>
            </>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={<Users2 className="w-5 h-5" />} label="Total de leads" value={stats.total}
            accent="from-muted/20 to-muted/5 border-border text-muted-foreground" />
          <StatCard icon={<UserCheck className="w-5 h-5" />} label="Telegram confirmado" value={stats.vinculados}
            accent="from-primary/20 to-primary/5 border-primary/25 text-primary" />
          <StatCard icon={<UserMinus className="w-5 h-5" />} label="Só cadastro" value={stats.soCadastro}
            accent="from-warning/20 to-warning/5 border-warning/25 text-warning" />
          <StatCard icon={<Percent className="w-5 h-5" />} label="Taxa de confirmação" value={taxaVinculo} suffix="%"
            accent="from-primary/20 to-primary/5 border-primary/25 text-primary" />
        </div>

        {/* Movimento 24h + gráfico de cadastros */}
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-3">
          <div className="rounded-lg border border-primary/25 bg-gradient-to-br from-primary/15 to-primary/5 p-4 flex flex-col justify-center">
            <p className="text-[11px] uppercase tracking-wider text-primary/80 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Confirmaram (24h)
            </p>
            <p className="text-3xl font-bold font-mono tabular-nums text-primary mt-1">{vinculos24h}</p>
            <p className="text-[11px] text-muted-foreground mt-1">passaram pelo bot nas últimas 24h</p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="telemetry-label text-primary mb-3">[ NOVOS CADASTROS — ÚLTIMOS 30 DIAS ]</p>
            {!temSerie ? (
              <p className="text-sm text-muted-foreground py-12 text-center">
                Sem cadastros nos últimos 30 dias.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={serie} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                  <RTooltip
                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 0, fontSize: 12 }}
                    cursor={{ fill: 'hsl(var(--accent))' }}
                  />
                  <Bar dataKey="Cadastros" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Crescimento do canal (total de inscritos — snapshot diário) */}
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-3">
          <div className="rounded-lg border border-primary/25 bg-gradient-to-br from-primary/15 to-primary/5 p-4 flex flex-col justify-center">
            <p className="text-[11px] uppercase tracking-wider text-primary/80 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5" /> Inscritos no canal
            </p>
            <p className="text-3xl font-bold font-mono tabular-nums text-primary mt-1">
              {totalInscritos != null ? totalInscritos.toLocaleString('pt-BR') : '—'}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {snapshots.length >= 2
                ? `${varInscritos >= 0 ? '+' : ''}${varInscritos.toLocaleString('pt-BR')} desde ${format(new Date(snapshots[0].dia + 'T12:00:00'), 'dd/MM')}`
                : 'medição diária (atualiza às 3h)'}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="telemetry-label text-primary mb-3">[ CRESCIMENTO DE INSCRITOS NO CANAL ]</p>
            {inscritos.length < 2 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">
                Coletando dados… o gráfico de crescimento aparece a partir do 2º dia de medição.
                {totalInscritos != null && ` Hoje: ${totalInscritos.toLocaleString('pt-BR')} inscritos.`}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={inscritos} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} domain={['dataMin - 5', 'dataMax + 5']} allowDecimals={false} width={48} />
                  <RTooltip
                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 0, fontSize: 12 }}
                  />
                  <Line type="monotone" dataKey="Inscritos" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Nota explicativa sobre canal */}
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <MessageCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-muted-foreground/60" />
          <p>
            O Grupo Free é um <b>canal</b> do Telegram — canais não avisam quando alguém entra ou sai.
            Por isso rastreamos a <b className="text-primary">confirmação do Telegram</b> (quem passa pelo
            bot tem o ID/@ capturado) e o <b className="text-primary">total de inscritos</b>, medido 1x/dia.
          </p>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nome, email, WhatsApp ou @telegram…"
              className="w-full h-9 pl-9 pr-3 text-sm bg-background border border-border focus:border-primary outline-none rounded-md"
            />
          </div>
          <Select value={vinculoFiltro} onValueChange={(v) => setVinculoFiltro(v as 'all' | Vinculo)}>
            <SelectTrigger className="w-full sm:w-[220px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="vinculado">🟢 Telegram confirmado ({stats.vinculados})</SelectItem>
              <SelectItem value="so_cadastro">🟡 Só cadastro ({stats.soCadastro})</SelectItem>
            </SelectContent>
          </Select>
          {(search || vinculoFiltro !== 'all') && (
            <Button size="sm" variant="ghost" onClick={() => { setSearch(''); setVinculoFiltro('all'); }}>
              Limpar
            </Button>
          )}
        </div>

        {/* Lista */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users2 className="w-12 h-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              {leads.length === 0 ? 'Nenhum lead do Grupo Free ainda.' : 'Nenhum lead com esses filtros.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="telemetry-label text-muted-foreground/50">
              {filtered.length} {filtered.length === 1 ? 'LEAD' : 'LEADS'}
            </p>
            {filtered.map((lead) => (
              <LeadCard key={lead.id} lead={lead} onReconvidar={reconvidar} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

function LeadCard({ lead, onReconvidar }: { lead: TrialLead; onReconvidar: (lead: TrialLead) => void }) {
  const v = vinculoDe(lead);
  const uname = usernameReal(lead);

  return (
    <div className="border border-border rounded-lg bg-card px-4 py-3 flex flex-col md:flex-row md:items-center gap-3">
      {/* Identidade */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate">{lead.name || uname || lead.email}</span>
          <VinculoBadge v={v} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-1">
          {lead.email && !lead.email.includes('@telegram.local') && !lead.email.includes('@placeholder') && (
            <span className="truncate">{lead.email}</span>
          )}
          {lead.whatsapp && !lead.whatsapp.startsWith('tg_') && <span>{fmtWhatsapp(lead.whatsapp)}</span>}
          {uname && <span>@{uname}</span>}
        </div>
      </div>

      {/* Datas: cadastro + confirmação */}
      <div className="flex items-center gap-5 text-xs">
        <div>
          <p className="text-muted-foreground/60 uppercase tracking-wider mb-0.5">Cadastro</p>
          <p className="font-mono">{fmtDia(lead.created_at)}</p>
        </div>
        <div>
          <p className="text-muted-foreground/60 uppercase tracking-wider mb-0.5">Telegram ID</p>
          <p className={cn('font-mono', v === 'vinculado' ? 'text-primary' : 'text-muted-foreground/50')}>
            {lead.telegram_user_id ?? '—'}
          </p>
        </div>
      </div>

      {/* Ação: reconvidar quem só cadastrou (não confirmou o Telegram) */}
      {v === 'so_cadastro' && (
        <div className="flex-shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="border-warning/40 text-warning hover:bg-warning/10"
            onClick={() => onReconvidar(lead)}
          >
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            Reconvidar
          </Button>
        </div>
      )}
    </div>
  );
}

function VinculoBadge({ v }: { v: Vinculo }) {
  const map = {
    vinculado: { txt: 'Telegram confirmado', cls: 'bg-primary/15 text-primary border-primary/40' },
    so_cadastro: { txt: 'Só cadastro', cls: 'bg-warning/15 text-warning border-warning/40' },
  }[v];
  return (
    <span className={cn('text-[10px] px-2 py-0.5 border rounded-full whitespace-nowrap font-medium', map.cls)}>
      {map.txt}
    </span>
  );
}

function StatCard({
  icon, label, value, accent, suffix,
}: { icon: React.ReactNode; label: string; value: number; accent: string; suffix?: string }) {
  return (
    <div className={cn('rounded-lg border bg-gradient-to-br p-3', accent)}>
      <div className="flex items-center gap-1.5 mb-1 opacity-80">{icon}</div>
      <p className="text-2xl font-bold font-mono tabular-nums">{value}{suffix ?? ''}</p>
      <p className="text-[11px] uppercase tracking-wider opacity-70 mt-0.5">{label}</p>
    </div>
  );
}

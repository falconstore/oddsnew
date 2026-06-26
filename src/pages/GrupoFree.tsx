import { useMemo, useState } from 'react';
import { format, differenceInDays, differenceInHours, subDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid,
} from 'recharts';
import {
  Users2, UserCheck, UserMinus, UserX, Percent, Search, RefreshCw,
  Copy, ExternalLink, Clock, TrendingUp, LogOut,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useTrialLeads } from '@/hooks/useTrialLeads';
import { toast } from '@/hooks/use-toast';
import type { TrialLead } from '@/types/trial';
import { cn } from '@/lib/utils';

// Link público do Grupo Free (usado pra reconvite de quem não entrou).
const FREE_GROUP_URL = 'https://t.me/sharkgreenfree2';

// ── Presença no grupo free, derivada dos timestamps ──
//   no_grupo  → entrou e não saiu (ou reentrou depois de sair)
//   saiu      → tem saída registrada e ela é posterior à última entrada
//   nao_entrou→ nunca entrou (sem free_group_entered_at)
type Presenca = 'no_grupo' | 'saiu' | 'nao_entrou';

function presencaDe(l: TrialLead): Presenca {
  const entrou = l.free_group_entered_at ? new Date(l.free_group_entered_at).getTime() : null;
  const saiu = l.free_group_left_at ? new Date(l.free_group_left_at).getTime() : null;
  if (!entrou) return 'nao_entrou';
  if (saiu && saiu >= entrou) return 'saiu';
  return 'no_grupo';
}

const fmt = (iso: string | null) =>
  iso ? format(new Date(iso), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '—';

const fmtDia = (iso: string | null) =>
  iso ? format(new Date(iso), 'dd/MM/yy', { locale: ptBR }) : '—';

const fmtWhatsapp = (raw: string) => {
  const d = (raw ?? '').replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
};

// Quanto tempo a pessoa ficou (ou está) no grupo. Free → entrada→saída;
// ainda no grupo → entrada→agora.
function tempoNoGrupo(l: TrialLead): string | null {
  if (!l.free_group_entered_at) return null;
  const inicio = new Date(l.free_group_entered_at);
  const fim = l.free_group_left_at ? new Date(l.free_group_left_at) : new Date();
  const dias = differenceInDays(fim, inicio);
  if (dias >= 1) return `${dias}d`;
  const horas = differenceInHours(fim, inicio);
  return `${Math.max(horas, 0)}h`;
}

export default function GrupoFree() {
  const { data: allLeads = [], isLoading, isRefetching, refetch } = useTrialLeads();

  const [search, setSearch] = useState('');
  const [presencaFiltro, setPresencaFiltro] = useState<'all' | Presenca>('all');

  // Só leads do grupo free.
  const leads = useMemo(
    () => allLeads.filter((l) => l.cohort === 'free_group'),
    [allLeads],
  );

  const stats = useMemo(() => {
    const s = { total: leads.length, noGrupo: 0, saiu: 0, naoEntrou: 0 };
    for (const l of leads) {
      const p = presencaDe(l);
      if (p === 'no_grupo') s.noGrupo++;
      else if (p === 'saiu') s.saiu++;
      else s.naoEntrou++;
    }
    return s;
  }, [leads]);

  // Taxa de entrada: já entrou alguma vez (no_grupo + saiu) / total.
  const taxaEntrada = stats.total > 0
    ? Math.round(((stats.noGrupo + stats.saiu) / stats.total) * 100)
    : 0;

  // Movimento nas últimas 24h.
  const mov24h = useMemo(() => {
    const limite = Date.now() - 24 * 60 * 60 * 1000;
    let entraram = 0, sairam = 0;
    for (const l of leads) {
      if (l.free_group_entered_at && new Date(l.free_group_entered_at).getTime() >= limite) entraram++;
      if (l.free_group_left_at && new Date(l.free_group_left_at).getTime() >= limite) sairam++;
    }
    return { entraram, sairam };
  }, [leads]);

  // Série diária dos últimos 30 dias: entradas e saídas por dia.
  const serie = useMemo(() => {
    const dias: { key: string; label: string; Entradas: number; Saídas: number }[] = [];
    const idx = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = startOfDay(subDays(new Date(), i));
      const key = format(d, 'yyyy-MM-dd');
      idx.set(key, dias.length);
      dias.push({ key, label: format(d, 'dd/MM'), Entradas: 0, Saídas: 0 });
    }
    for (const l of leads) {
      if (l.free_group_entered_at) {
        const k = format(startOfDay(new Date(l.free_group_entered_at)), 'yyyy-MM-dd');
        const i = idx.get(k); if (i != null) dias[i].Entradas++;
      }
      if (l.free_group_left_at) {
        const k = format(startOfDay(new Date(l.free_group_left_at)), 'yyyy-MM-dd');
        const i = idx.get(k); if (i != null) dias[i].Saídas++;
      }
    }
    return dias;
  }, [leads]);

  const temMovimento = serie.some((d) => d.Entradas > 0 || d.Saídas > 0);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (presencaFiltro !== 'all' && presencaDe(l) !== presencaFiltro) return false;
      if (!term) return true;
      return (
        l.name?.toLowerCase().includes(term) ||
        l.email?.toLowerCase().includes(term) ||
        l.whatsapp?.toLowerCase().includes(term) ||
        l.telegram_username?.toLowerCase().includes(term)
      );
    });
  }, [leads, search, presencaFiltro]);

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(FREE_GROUP_URL);
      toast({ title: 'Link copiado', description: FREE_GROUP_URL });
    } catch {
      toast({ title: 'Não consegui copiar', description: FREE_GROUP_URL, variant: 'destructive' });
    }
  };

  // Reconvida o lead. Se tiver WhatsApp real, abre o WhatsApp Web/app com uma
  // mensagem pronta + link do grupo. Senão, abre o grupo no Telegram.
  const reconvidar = (lead: TrialLead) => {
    const digits = (lead.whatsapp ?? '').replace(/\D/g, '');
    const ehWhatsReal = digits.length >= 10 && !lead.whatsapp?.startsWith('tg_');
    if (ehWhatsReal) {
      const nome = (lead.name || '').split(' ')[0] || '';
      const msg = encodeURIComponent(
        `Oi${nome ? ` ${nome}` : ''}! 🦈 Aqui é da Shark Green. Você se cadastrou mas ainda não entrou no nosso Grupo Free. Entra aqui pra acompanhar as entradas gratuitas: ${FREE_GROUP_URL}`,
      );
      const wa = digits.startsWith('55') ? digits : `55${digits}`;
      window.open(`https://wa.me/${wa}?text=${msg}`, '_blank', 'noopener');
    } else {
      window.open(FREE_GROUP_URL, '_blank', 'noopener');
      toast({ title: 'Sem WhatsApp válido', description: 'Abri o grupo no Telegram pra você compartilhar o link.' });
    }
  };

  return (
    <Layout>
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        <PageHeader
          eyebrow="FREE"
          title="Grupo Free"
          subtitle="ACOMPANHAMENTO DE QUEM ENTRA E SAI DO GRUPO GRATUITO"
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard icon={<Users2 className="w-5 h-5" />} label="Total de leads" value={stats.total}
            accent="from-muted/20 to-muted/5 border-border text-muted-foreground" />
          <StatCard icon={<UserCheck className="w-5 h-5" />} label="No grupo" value={stats.noGrupo}
            accent="from-primary/20 to-primary/5 border-primary/25 text-primary" />
          <StatCard icon={<UserX className="w-5 h-5" />} label="Saíram" value={stats.saiu}
            accent="from-destructive/20 to-destructive/5 border-destructive/25 text-destructive" />
          <StatCard icon={<UserMinus className="w-5 h-5" />} label="Nunca entraram" value={stats.naoEntrou}
            accent="from-warning/20 to-warning/5 border-warning/25 text-warning" />
          <StatCard icon={<Percent className="w-5 h-5" />} label="Taxa de entrada" value={taxaEntrada} suffix="%"
            accent="from-primary/20 to-primary/5 border-primary/25 text-primary" />
        </div>

        {/* Movimento 24h + gráfico */}
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-3">
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
            <div className="rounded-lg border border-primary/25 bg-gradient-to-br from-primary/15 to-primary/5 p-3">
              <p className="text-[11px] uppercase tracking-wider text-primary/80 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> Entraram (24h)
              </p>
              <p className="text-2xl font-bold font-mono tabular-nums text-primary mt-1">{mov24h.entraram}</p>
            </div>
            <div className="rounded-lg border border-destructive/25 bg-gradient-to-br from-destructive/15 to-destructive/5 p-3">
              <p className="text-[11px] uppercase tracking-wider text-destructive/80 flex items-center gap-1.5">
                <LogOut className="w-3.5 h-3.5" /> Saíram (24h)
              </p>
              <p className="text-2xl font-bold font-mono tabular-nums text-destructive mt-1">{mov24h.sairam}</p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="telemetry-label text-primary mb-3">[ ENTRADAS vs SAÍDAS — ÚLTIMOS 30 DIAS ]</p>
            {!temMovimento ? (
              <p className="text-sm text-muted-foreground py-12 text-center">
                Sem entradas/saídas registradas ainda. Os dados aparecem conforme as pessoas entram no grupo.
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
                  <Bar dataKey="Entradas" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Saídas" fill="hsl(var(--destructive))" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
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
          <Select value={presencaFiltro} onValueChange={(v) => setPresencaFiltro(v as 'all' | Presenca)}>
            <SelectTrigger className="w-full sm:w-[200px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Presença: todos</SelectItem>
              <SelectItem value="no_grupo">🟢 No grupo ({stats.noGrupo})</SelectItem>
              <SelectItem value="saiu">🔴 Saíram ({stats.saiu})</SelectItem>
              <SelectItem value="nao_entrou">🟡 Nunca entraram ({stats.naoEntrou})</SelectItem>
            </SelectContent>
          </Select>
          {(search || presencaFiltro !== 'all') && (
            <Button size="sm" variant="ghost" onClick={() => { setSearch(''); setPresencaFiltro('all'); }}>
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
  const p = presencaDe(lead);
  const tempo = tempoNoGrupo(lead);

  return (
    <div className="border border-border rounded-lg bg-card px-4 py-3 flex flex-col md:flex-row md:items-center gap-3">
      {/* Identidade */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate">{lead.name || lead.telegram_username || lead.email}</span>
          <PresencaBadge p={p} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-1">
          {lead.email && <span className="truncate">{lead.email}</span>}
          {lead.whatsapp && <span>{fmtWhatsapp(lead.whatsapp)}</span>}
          {lead.telegram_username && <span>@{lead.telegram_username}</span>}
        </div>
      </div>

      {/* Datas de entrada/saída + tempo */}
      <div className="flex items-center gap-5 text-xs">
        <div>
          <p className="text-muted-foreground/60 uppercase tracking-wider mb-0.5">Entrou</p>
          <p className="font-mono">{fmtDia(lead.free_group_entered_at)}</p>
        </div>
        <div>
          <p className="text-muted-foreground/60 uppercase tracking-wider mb-0.5">Saiu</p>
          <p className={cn('font-mono', p === 'saiu' ? 'text-destructive' : 'text-muted-foreground/50')}>
            {fmtDia(lead.free_group_left_at)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground/60 uppercase tracking-wider mb-0.5 flex items-center gap-1">
            <Clock className="w-3 h-3" /> {p === 'no_grupo' ? 'Está há' : 'Ficou'}
          </p>
          <p className="font-mono">{tempo ?? '—'}</p>
        </div>
      </div>

      {/* Ação: reconvidar quem não entrou.
          - tem WhatsApp real → abre conversa no WhatsApp com mensagem + link
          - senão → abre o grupo no Telegram (e o admin compartilha) */}
      {p === 'nao_entrou' && (
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

function PresencaBadge({ p }: { p: Presenca }) {
  const map = {
    no_grupo: { txt: 'No grupo', cls: 'bg-primary/15 text-primary border-primary/40' },
    saiu: { txt: 'Saiu', cls: 'bg-destructive/15 text-destructive border-destructive/40' },
    nao_entrou: { txt: 'Não entrou', cls: 'bg-warning/15 text-warning border-warning/40' },
  }[p];
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

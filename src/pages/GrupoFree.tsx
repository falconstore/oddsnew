import { useMemo, useState } from 'react';
import { format, differenceInDays, differenceInHours, formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Users2, UserCheck, UserMinus, UserX, Percent, Search, RefreshCw,
  Copy, ExternalLink, Clock,
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
              <LeadCard key={lead.id} lead={lead} onReconvidar={copiarLink} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

function LeadCard({ lead, onReconvidar }: { lead: TrialLead; onReconvidar: () => void }) {
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

      {/* Ação: reconvidar quem não entrou */}
      {p === 'nao_entrou' && (
        <div className="flex-shrink-0">
          <Button size="sm" variant="outline" className="border-warning/40 text-warning hover:bg-warning/10" onClick={onReconvidar}>
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

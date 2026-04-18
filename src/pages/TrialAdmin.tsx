import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Gift, Search, Sparkles, Users, CheckCircle2, Clock, Ban, UserMinus,
  Mail, Phone, Send, ExternalLink, Trash2,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useTrialLeads, useKickTrialLead } from '@/hooks/useTrialLeads';
import type { TrialLead, TrialStatus } from '@/types/trial';

const STATUS_META: Record<TrialStatus, { label: string; cls: string }> = {
  pending: { label: 'Aguardando entrada', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  active: { label: 'Ativo', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  expired: { label: 'Expirado', cls: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30' },
  removed: { label: 'Removido', cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
  blocked: { label: 'Bloqueado', cls: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
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

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TrialStatus>('all');
  const [confirmKick, setConfirmKick] = useState<TrialLead | null>(null);

  const stats = useMemo(() => {
    const s = { total: leads.length, active: 0, expired: 0, blocked: 0, pending: 0, removed: 0 };
    for (const l of leads) {
      if (l.status === 'active') s.active++;
      else if (l.status === 'expired') s.expired++;
      else if (l.status === 'blocked') s.blocked++;
      else if (l.status === 'pending') s.pending++;
      else if (l.status === 'removed') s.removed++;
    }
    return s;
  }, [leads]);

  const filtered = useMemo(() => {
    let list = leads;
    if (statusFilter !== 'all') list = list.filter(l => l.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        l.name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.whatsapp.includes(q.replace(/\D/g, '')) ||
        l.telegram_username.toLowerCase().includes(q)
      );
    }
    return list;
  }, [leads, statusFilter, search]);

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
            <a href="/trial" target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="border-pink-500/30 text-pink-300 hover:bg-pink-500/10" data-testid="link-trial-landing">
                <ExternalLink className="w-4 h-4 mr-1.5" />
                Abrir landing
              </Button>
            </a>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
          <StatCard icon={<Users className="w-5 h-5" />} label="Total leads" value={stats.total} accent="from-pink-500/20 to-pink-500/5 border-pink-500/25 text-pink-300" />
          <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="Ativos" value={stats.active} accent="from-emerald-500/20 to-emerald-500/5 border-emerald-500/25 text-emerald-300" />
          <StatCard icon={<Clock className="w-5 h-5" />} label="Expirados" value={stats.expired} accent="from-zinc-500/20 to-zinc-500/5 border-zinc-500/25 text-zinc-300" />
          <StatCard icon={<Ban className="w-5 h-5" />} label="Bloqueados" value={stats.blocked} accent="from-purple-500/20 to-purple-500/5 border-purple-500/25 text-purple-300" />
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
            </SelectContent>
          </Select>
          {(search || statusFilter !== 'all') && (
            <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => { setSearch(''); setStatusFilter('all'); }}
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
                <a href="/trial" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:text-pink-300 underline">
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
              const canKick = lead.status === 'active';
              return (
                <div key={lead.id}
                  className="glass rounded-2xl border border-white/8 p-4 hover:border-pink-500/25 transition-all duration-200 card-hover"
                  data-testid={`card-trial-lead-${lead.id}`}>
                  <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
                    {/* Identity */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <h3 className="font-bold text-sm truncate" data-testid={`text-lead-name-${lead.id}`}>{lead.name}</h3>
                        <Badge className={`text-[10px] ${meta.cls}`} data-testid={`badge-lead-status-${lead.id}`}>
                          {meta.label}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</span>
                        <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{fmtWhatsapp(lead.whatsapp)}</span>
                        <span className="inline-flex items-center gap-1"><Send className="w-3 h-3" />@{lead.telegram_username}</span>
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
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs border-red-500/30 text-red-300 hover:bg-red-500/10 disabled:opacity-40"
                        disabled={!canKick}
                        onClick={() => setConfirmKick(lead)}
                        data-testid={`button-lead-kick-${lead.id}`}
                        title={canKick ? 'Remover do grupo agora' : 'Disponível apenas para leads ativos'}
                      >
                        <UserMinus className="w-3 h-3 mr-1" />
                        Remover
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
    </Layout>
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

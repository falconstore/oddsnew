import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, subDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart3, Users, Smartphone, Bell, TrendingUp, Eye, RefreshCw, Activity, UserCheck, UserX, Crown, Search } from 'lucide-react';
import { getActivityInfo } from '@/hooks/useTrialPwaStats';
import { supabaseProcedures } from '@/lib/supabaseProcedures';

// ─── Types ────────────────────────────────────────────────────────────────────
type DailyCount = { day: string; count: number };
type PageView = { page: string; count: number };
type LeadRow = {
  id: string;
  status: string;
  subscription_status: string | null;
  paid_at: string | null;
  created_at: string;
  cohort: string | null;
  expires_at: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDay(iso: string) {
  try { return format(parseISO(iso), 'dd/MM', { locale: ptBR }); } catch { return iso; }
}

function KpiCard({
  label, value, sub, icon: Icon, color, loading,
}: {
  label: string; value: string | number; sub?: string; icon: any; color: string; loading?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className={color} />
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
      </div>
      {loading ? (
        <div className="h-8 w-20 bg-muted rounded animate-pulse" />
      ) : (
        <>
          <p className="text-2xl font-bold">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </>
      )}
    </div>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-1.5 bg-muted rounded-full overflow-hidden flex-1">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Data hooks ───────────────────────────────────────────────────────────────
function useLeads() {
  return useQuery<LeadRow[]>({
    queryKey: ['app_stats_leads'],
    queryFn: async () => {
      const { data, error } = await supabaseProcedures
        .from('trial_leads')
        .select('id,status,subscription_status,paid_at,created_at,cohort,expires_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function usePwaEvents() {
  return useQuery({
    queryKey: ['pwa_events_stats'],
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString();
      const { data, error } = await supabaseProcedures
        .from('pwa_events')
        .select('event_type,page,created_at,user_id,lead_id,session_id')
        .gte('created_at', since)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function usePushSubs() {
  return useQuery<number>({
    queryKey: ['push_sub_count'],
    queryFn: async () => {
      const { count, error } = await supabaseProcedures
        .from('push_subscriptions')
        .select('id', { count: 'exact', head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function AppStats() {
  const { data: leads = [], isLoading: leadsLoading } = useLeads();
  const { data: events = [], isLoading: eventsLoading } = usePwaEvents();
  const { data: pushSubs = 0 } = usePushSubs();
  const [activeTab, setActiveTab] = useState<'overview' | 'pages' | 'users'>('overview');
  const [userSearch, setUserSearch] = useState('');

  // ── Lead funnel ──────────────────────────────────────────────────────────
  const totalLeads = leads.length;
  const activeTrials = leads.filter(l =>
    l.status === 'active' && !l.paid_at && l.subscription_status !== 'active' &&
    (l.expires_at ? new Date(l.expires_at) > new Date() : false)
  ).length;
  const subscribers = leads.filter(l => l.paid_at || l.subscription_status === 'active').length;
  const expired = leads.filter(l => {
    const isSubscriber = l.paid_at || l.subscription_status === 'active';
    const trialExpired = l.expires_at ? new Date(l.expires_at) <= new Date() : true;
    return !isSubscriber && trialExpired;
  }).length;
  const convRate = totalLeads > 0 ? ((subscribers / totalLeads) * 100).toFixed(1) : '0';
  const directLeads = leads.filter(l => l.cohort === 'direct').length;

  // ── PWA events (last 30d) ────────────────────────────────────────────────
  const sessions = events.filter(e => e.event_type === 'session_start');
  const pageViews = events.filter(e => e.event_type === 'page_view');

  // ── Per-lead activity map ────────────────────────────────────────────────
  const perLeadStats = (() => {
    const lastSeenMap = new Map<string, string>();
    const sessionSetMap = new Map<string, Set<string>>();
    for (const e of events as any[]) {
      const lid = e.lead_id as string;
      if (!lid) continue;
      if (!lastSeenMap.has(lid) || e.created_at > lastSeenMap.get(lid)!) {
        lastSeenMap.set(lid, e.created_at as string);
      }
      if (!sessionSetMap.has(lid)) sessionSetMap.set(lid, new Set());
      if (e.session_id) sessionSetMap.get(lid)!.add(e.session_id as string);
    }
    return { lastSeenMap, sessionCountMap: new Map(Array.from(sessionSetMap.entries()).map(([k, v]) => [k, v.size])) };
  })();

  const uniqueUsers = new Set(events.map(e => e.user_id).filter(Boolean)).size;
  const uniqueLeadsInApp = new Set(events.map(e => e.lead_id).filter(Boolean)).size;

  const today = startOfDay(new Date()).toISOString();
  const yesterday = startOfDay(subDays(new Date(), 1)).toISOString();
  const dau = new Set(
    sessions.filter(e => e.created_at >= today).map(e => e.user_id)
  ).size;
  const dauYest = new Set(
    sessions.filter(e => e.created_at >= yesterday && e.created_at < today).map(e => e.user_id)
  ).size;

  const mau = uniqueUsers; // last 30d by default

  // ── Daily sessions (last 14d) ────────────────────────────────────────────
  const dailySessions: DailyCount[] = Array.from({ length: 14 }, (_, i) => {
    const d = subDays(new Date(), 13 - i);
    const dayStr = format(d, 'yyyy-MM-dd');
    const count = new Set(
      sessions.filter(e => e.created_at.slice(0, 10) === dayStr).map(e => e.session_id)
    ).size;
    return { day: dayStr, count };
  });

  const maxSessions = Math.max(...dailySessions.map(d => d.count), 1);

  // ── Page views breakdown ─────────────────────────────────────────────────
  const pvByPage: Record<string, number> = {};
  for (const e of pageViews) {
    if (e.page) pvByPage[e.page] = (pvByPage[e.page] ?? 0) + 1;
  }
  const pvSorted: PageView[] = Object.entries(pvByPage)
    .sort((a, b) => b[1] - a[1])
    .map(([page, count]) => ({ page, count }));
  const maxPv = pvSorted[0]?.count ?? 1;

  // ── New signups per day (last 14d) ───────────────────────────────────────
  const dailySignups: DailyCount[] = Array.from({ length: 14 }, (_, i) => {
    const d = subDays(new Date(), 13 - i);
    const dayStr = format(d, 'yyyy-MM-dd');
    const count = leads.filter(l => l.created_at?.slice(0, 10) === dayStr).length;
    return { day: dayStr, count };
  });
  const maxSignups = Math.max(...dailySignups.map(d => d.count), 1);

  const cohortCounts: Record<string, number> = {};
  for (const l of leads) {
    const c = l.cohort ?? 'sem_cohort';
    cohortCounts[c] = (cohortCounts[c] ?? 0) + 1;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 size={20} className="text-green-400" />
            <h1 className="text-xl font-bold">Estatísticas App</h1>
          </div>
          <p className="text-sm text-muted-foreground">Métricas de uso do Shark Green App · últimos 30 dias</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {(['overview', 'pages', 'users'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}>
            {tab === 'overview' ? 'Visão Geral' : tab === 'pages' ? 'Páginas' : 'Usuários'}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          {/* App KPIs */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">App (últimos 30 dias)</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="DAU (hoje)" value={dau} sub={`${dauYest} ontem`} icon={Activity} color="text-green-400" loading={eventsLoading} />
              <KpiCard label="MAU (30d)" value={mau} sub="usuários únicos" icon={Users} color="text-blue-400" loading={eventsLoading} />
              <KpiCard label="Sessões (30d)" value={sessions.length} sub={`${pageViews.length} page views`} icon={Smartphone} color="text-violet-400" loading={eventsLoading} />
              <KpiCard label="Push inscritos" value={pushSubs} sub="dispositivos ativos" icon={Bell} color="text-amber-400" />
            </div>
          </div>

          {/* Sessions chart (last 14d) */}
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-sm font-semibold mb-4">Sessões diárias — últimos 14 dias</p>
            {eventsLoading ? (
              <div className="h-20 bg-muted rounded animate-pulse" />
            ) : (
              <div className="flex items-end gap-1 h-24">
                {dailySessions.map(d => {
                  const h = maxSessions > 0 ? Math.max(4, Math.round((d.count / maxSessions) * 96)) : 4;
                  return (
                    <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-background border border-border rounded px-2 py-1 text-[10px] whitespace-nowrap z-10">
                        {fmtDay(d.day)}: {d.count}
                      </div>
                      <div className="w-full bg-green-500/80 rounded-t transition-all" style={{ height: `${h}%` }} />
                      <span className="text-[9px] text-muted-foreground">{fmtDay(d.day)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Lead funnel */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Funil de Leads</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Total leads" value={totalLeads} icon={Users} color="text-slate-400" loading={leadsLoading} />
              <KpiCard label="Trial ativo" value={activeTrials} sub="no período de teste" icon={UserCheck} color="text-blue-400" loading={leadsLoading} />
              <KpiCard label="Assinantes" value={subscribers} sub={`Taxa: ${convRate}%`} icon={Crown} color="text-amber-400" loading={leadsLoading} />
              <KpiCard label="Expirados" value={expired} sub={`${directLeads} diretos`} icon={UserX} color="text-red-400" loading={leadsLoading} />
            </div>
          </div>

          {/* Signups chart */}
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-sm font-semibold mb-4">Novos leads por dia — últimos 14 dias</p>
            {leadsLoading ? (
              <div className="h-20 bg-muted rounded animate-pulse" />
            ) : (
              <div className="flex items-end gap-1 h-24">
                {dailySignups.map(d => {
                  const h = maxSignups > 0 ? Math.max(4, Math.round((d.count / maxSignups) * 96)) : 4;
                  return (
                    <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-background border border-border rounded px-2 py-1 text-[10px] whitespace-nowrap z-10">
                        {fmtDay(d.day)}: {d.count}
                      </div>
                      <div className="w-full bg-blue-500/70 rounded-t transition-all" style={{ height: `${h}%` }} />
                      <span className="text-[9px] text-muted-foreground">{fmtDay(d.day)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cohort breakdown */}
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-sm font-semibold mb-4">Leads por Cohort</p>
            <div className="space-y-3">
              {Object.entries(cohortCounts).sort((a, b) => b[1] - a[1]).map(([cohort, count]) => (
                <div key={cohort} className="flex items-center gap-3">
                  <span className="text-xs font-mono w-24 text-muted-foreground truncate">{cohort}</span>
                  <MiniBar value={count} max={totalLeads} color="bg-green-500" />
                  <span className="text-xs font-bold w-8 text-right">{count}</span>
                  <span className="text-xs text-muted-foreground w-10 text-right">
                    {totalLeads > 0 ? `${((count / totalLeads) * 100).toFixed(0)}%` : '0%'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === 'pages' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border">
            <p className="text-sm font-semibold">Page Views por Página — últimos 30 dias</p>
            <p className="text-xs text-muted-foreground mt-0.5">{pageViews.length} visualizações no período</p>
          </div>
          {eventsLoading ? (
            <div className="p-4 space-y-3">
              {[1,2,3,4,5].map(i => <div key={i} className="h-8 bg-muted rounded animate-pulse" />)}
            </div>
          ) : pvSorted.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <Eye size={28} className="mx-auto mb-2 opacity-30" />
              Nenhum page view registrado ainda — assim que usuários navegarem no app, os dados aparecerão aqui
            </div>
          ) : (
            <div className="divide-y divide-border">
              {pvSorted.map((pv, i) => (
                <div key={pv.page} className="flex items-center gap-4 px-5 py-3">
                  <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                  <span className="text-sm font-medium flex-1">{pv.page}</span>
                  <MiniBar value={pv.count} max={maxPv} color="bg-violet-500" />
                  <span className="text-sm font-bold w-12 text-right">{pv.count}</span>
                  <span className="text-xs text-muted-foreground w-10 text-right">
                    {pageViews.length > 0 ? `${((pv.count / pageViews.length) * 100).toFixed(0)}%` : '0%'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <KpiCard label="Usuários únicos (30d)" value={uniqueUsers} icon={Smartphone} color="text-green-400" loading={eventsLoading} />
            <KpiCard label="Leads com acesso app" value={uniqueLeadsInApp} sub="que abriram o app" icon={UserCheck} color="text-blue-400" loading={eventsLoading} />
            <KpiCard label="Push inscritos" value={pushSubs} sub={`${uniqueUsers > 0 ? ((pushSubs / uniqueUsers) * 100).toFixed(0) : 0}% dos usuários`} icon={Bell} color="text-amber-400" />
          </div>

          {/* Funnel */}
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-sm font-semibold mb-3">Funil de Ativação</p>
            <div className="space-y-3">
              {[
                { label: 'Total de leads cadastrados', value: totalLeads, color: 'bg-slate-500', pct: 100 },
                { label: 'Que acessaram o app', value: uniqueLeadsInApp, color: 'bg-blue-500', pct: totalLeads > 0 ? (uniqueLeadsInApp / totalLeads) * 100 : 0 },
                { label: 'Com push ativo', value: pushSubs, color: 'bg-violet-500', pct: totalLeads > 0 ? (pushSubs / totalLeads) * 100 : 0 },
                { label: 'Convertidos (assinantes)', value: subscribers, color: 'bg-amber-500', pct: totalLeads > 0 ? (subscribers / totalLeads) * 100 : 0 },
              ].map(step => (
                <div key={step.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-muted-foreground">{step.label}</span>
                    <span className="text-sm font-bold">{step.value} <span className="text-xs text-muted-foreground font-normal">({step.pct.toFixed(1)}%)</span></span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${step.color}`} style={{ width: `${step.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Per-lead activity table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Atividade por Lead — últimos 30 dias</p>
                <p className="text-xs text-muted-foreground mt-0.5">{uniqueLeadsInApp} leads com acesso ao app</p>
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Buscar..."
                  className="bg-muted border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs w-40 outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            {eventsLoading || leadsLoading ? (
              <div className="p-4 space-y-2">
                {[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
              </div>
            ) : (() => {
              // Build per-lead rows: join leads + activity data, sorted by last_seen desc
              const q = userSearch.trim().toLowerCase();
              const rows = leads
                .filter(l => perLeadStats.lastSeenMap.has(l.id))
                .map(l => ({
                  ...l,
                  lastSeen: perLeadStats.lastSeenMap.get(l.id)!,
                  sessions: perLeadStats.sessionCountMap.get(l.id) ?? 0,
                }))
                .filter(r => !q || (r as any).email?.toLowerCase().includes(q))
                .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));

              if (rows.length === 0) return (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  <Smartphone size={28} className="mx-auto mb-2 opacity-30" />
                  Nenhum lead acessou o app ainda
                </div>
              );

              return (
                <div className="divide-y divide-border">
                  {/* Header */}
                  <div className="grid grid-cols-[1fr_140px_80px_60px] gap-2 px-4 py-2 text-[10px] text-muted-foreground uppercase tracking-wider">
                    <span>Lead</span>
                    <span>Atividade</span>
                    <span>Status</span>
                    <span className="text-right">Sess.</span>
                  </div>
                  {rows.slice(0, 100).map(row => {
                    const info = getActivityInfo(row.lastSeen);
                    return (
                      <div key={row.id} className="grid grid-cols-[1fr_140px_80px_60px] gap-2 items-center px-4 py-2.5 hover:bg-muted/40 transition-colors">
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{row.email ?? row.id.slice(0, 8)}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{row.status}</p>
                        </div>
                        <div>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${info.bgClass} ${info.textClass}`}>
                            {info.label}
                          </span>
                        </div>
                        <div>
                          <span className={`text-[10px] font-medium ${
                            row.subscription_status === 'active' ? 'text-amber-400' :
                            row.status === 'active' ? 'text-emerald-400' :
                            row.status === 'expired' ? 'text-zinc-400' : 'text-muted-foreground'
                          }`}>
                            {row.subscription_status === 'active' ? '👑 Assinante' :
                             row.status === 'active' ? 'Trial' :
                             row.status === 'expired' ? 'Expirado' : row.status}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-muted-foreground">{row.sessions}</span>
                        </div>
                      </div>
                    );
                  })}
                  {rows.length > 100 && (
                    <div className="px-4 py-3 text-xs text-muted-foreground text-center">
                      Mostrando 100 de {rows.length} leads — use a busca para filtrar
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

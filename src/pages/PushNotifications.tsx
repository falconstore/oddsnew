import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bell, BellOff, Send, Users, CheckCircle, AlertCircle, Clock, Zap, RefreshCw, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { supabaseProcedures } from '@/lib/supabaseProcedures';
import { toast } from '@/hooks/use-toast';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';

// ─── Types ───────────────────────────────────────────────────────────────────
type PushSub = {
  id: string;
  lead_id: string | null;
  user_id: string | null;
  endpoint: string;
  created_at: string;
};

type PushLog = {
  id: string;
  created_at: string;
  type: string;
  title: string | null;
  body: string | null;
  url: string | null;
  target: string | null;
  sent_count: number;
  triggered_by: string | null;
  error: string | null;
};

type SendPayload = {
  type: string;
  title?: string;
  body_text?: string;
  url?: string;
  tag?: string;
  user_id?: string;
  lead_id?: string;
  triggered_by?: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  try { return format(parseISO(iso), "dd/MM/yy 'às' HH:mm", { locale: ptBR }); } catch { return iso; }
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  new_procedure:        { label: 'Novo Procedimento',    color: 'text-primary' },
  daily_summary:        { label: 'Resumo Diário',         color: 'text-muted-foreground' },
  subscription_pending: { label: 'Assin. Pendente',       color: 'text-warning' },
  subscription_canceled:{ label: 'Assin. Cancelada',      color: 'text-destructive' },
  subscription_expired: { label: 'Pedido Expirado',       color: 'text-warning' },
  custom:               { label: 'Mensagem Manual',        color: 'text-muted-foreground' },
};

// ─── Hooks ───────────────────────────────────────────────────────────────────
function usePushSubs() {
  return useQuery<PushSub[]>({
    queryKey: ['push_subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabaseProcedures
        .from('push_subscriptions')
        .select('id, lead_id, user_id, endpoint, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function usePushLogs() {
  return useQuery<PushLog[]>({
    queryKey: ['push_notification_logs'],
    queryFn: async () => {
      const { data, error } = await supabaseProcedures
        .from('push_notification_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

async function invokeSendPush(payload: SendPayload): Promise<{ sent: number; expired?: number; reason?: string }> {
  const { data, error } = await supabaseProcedures.functions.invoke('send-push', { body: payload });
  if (error) throw new Error(error.message);
  return data;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className={color} />
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

// ─── Quick action button ──────────────────────────────────────────────────────
function QuickBtn({ label, icon: Icon, color, onClick, loading }: {
  label: string; icon: any; color: string; onClick: () => void; loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card hover:bg-muted transition-colors text-sm font-medium disabled:opacity-50"
    >
      {loading ? <RefreshCw size={14} className="animate-spin" /> : <Icon size={14} className={color} />}
      {label}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function PushNotifications() {
  const qc = useQueryClient();
  const { data: subs = [], isLoading: subsLoading } = usePushSubs();
  const { data: logs = [], isLoading: logsLoading } = usePushLogs();
  const [sending, setSending] = useState<string | null>(null);
  const [showSubs, setShowSubs] = useState(false);

  // Custom form state
  const [form, setForm] = useState({
    title: '',
    body_text: '',
    url: '/',
    target: 'all' as 'all' | 'user' | 'lead',
    target_id: '',
  });
  const [formSending, setFormSending] = useState(false);

  async function quickSend(type: string, label: string) {
    setSending(type);
    try {
      const res = await invokeSendPush({ type, triggered_by: 'admin-quick' });
      qc.invalidateQueries({ queryKey: ['push_notification_logs'] });
      toast({ title: `${label} enviado`, description: `${res.sent} dispositivos alcançados` });
    } catch (e: any) {
      toast({ title: 'Erro ao enviar', description: e.message, variant: 'destructive' });
    } finally {
      setSending(null);
    }
  }

  async function handleCustomSend() {
    if (!form.title || !form.body_text) {
      toast({ title: 'Preencha título e mensagem', variant: 'destructive' }); return;
    }
    setFormSending(true);
    try {
      const payload: SendPayload = {
        type: 'custom',
        title: form.title,
        body_text: form.body_text,
        url: form.url || '/',
        triggered_by: 'admin-manual',
      };
      if (form.target === 'user' && form.target_id) payload.user_id = form.target_id;
      if (form.target === 'lead' && form.target_id) payload.lead_id = form.target_id;

      const res = await invokeSendPush(payload);
      qc.invalidateQueries({ queryKey: ['push_notification_logs'] });
      toast({ title: 'Notificação enviada!', description: `${res.sent} dispositivos alcançados${res.reason ? ` (${res.reason})` : ''}` });
      setForm(f => ({ ...f, title: '', body_text: '' }));
    } catch (e: any) {
      toast({ title: 'Erro ao enviar', description: e.message, variant: 'destructive' });
    } finally {
      setFormSending(false);
    }
  }

  async function deleteSub(id: string) {
    await supabaseProcedures.from('push_subscriptions').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['push_subscriptions'] });
    toast({ title: 'Assinatura removida' });
  }

  const totalSubs = subs.length;
  const todayLogs = logs.filter(l => l.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10));
  const totalSent = logs.reduce((s, l) => s + (l.sent_count ?? 0), 0);

  return (
    <Layout>
      <div className="animate-fade-in">
        <PageHeader
          eyebrow="PUSH"
          title="Push Notifications"
          subtitle="GERENCIE E DISPARE NOTIFICAÇÕES PARA OS USUÁRIOS DO APP"
          icon={Bell}
          actions={
            <button onClick={() => { qc.invalidateQueries({ queryKey: ['push_subscriptions'] }); qc.invalidateQueries({ queryKey: ['push_notification_logs'] }); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted transition-colors">
              <RefreshCw size={13} /> Atualizar
            </button>
          }
        />

        <div className="space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Dispositivos ativos" value={subsLoading ? '…' : totalSubs} icon={Bell} color="text-muted-foreground" />
        <KpiCard label="Notif. hoje" value={logsLoading ? '…' : todayLogs.length} icon={Send} color="text-muted-foreground" />
        <KpiCard label="Total envios" value={logsLoading ? '…' : totalSent} icon={CheckCircle} color="text-primary" />
        <KpiCard label="Histór. (50 ult.)" value={logsLoading ? '…' : logs.length} icon={Clock} color="text-muted-foreground" />
      </div>

      {/* Quick actions */}
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Ações Rápidas</p>
        <div className="flex flex-wrap gap-2">
          <QuickBtn label="Resumo do Dia" icon={Zap} color="text-muted-foreground"
            loading={sending === 'daily_summary'} onClick={() => quickSend('daily_summary', 'Resumo do dia')} />
          <QuickBtn label="Assinatura Pendente (teste)" icon={AlertCircle} color="text-warning"
            loading={sending === 'subscription_pending'} onClick={() => quickSend('subscription_pending', 'Assinatura pendente')} />
          <QuickBtn label="Assinatura Cancelada (teste)" icon={BellOff} color="text-destructive"
            loading={sending === 'subscription_canceled'} onClick={() => quickSend('subscription_canceled', 'Assinatura cancelada')} />
        </div>
      </div>

      {/* Custom notification form */}
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wide">Enviar Mensagem Personalizada</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3 md:col-span-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Título *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="ex: 🦈 Shark Green — Resultado do dia"
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Mensagem *</label>
              <textarea value={form.body_text} onChange={e => setForm(f => ({ ...f, body_text: e.target.value }))}
                rows={2} placeholder="ex: Fechamos o dia com +R$ 1.200 em procedimentos. Confira!"
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">URL de destino</label>
            <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              placeholder="/"
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Destino</label>
            <div className="flex gap-2">
              <select value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value as any, target_id: '' }))}
                className="px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="all">Todos ({totalSubs} dispositivos)</option>
                <option value="user">User ID específico</option>
                <option value="lead">Lead ID específico</option>
              </select>
              {form.target !== 'all' && (
                <input value={form.target_id} onChange={e => setForm(f => ({ ...f, target_id: e.target.value }))}
                  placeholder={form.target === 'user' ? 'UUID do user' : 'UUID do lead'}
                  className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              )}
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={handleCustomSend} disabled={formSending || !form.title || !form.body_text}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            {formSending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
            {formSending ? 'Enviando…' : 'Enviar Notificação'}
          </button>
        </div>
      </div>

      {/* Notification history */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <p className="text-sm font-semibold">Histórico de Notificações</p>
          <p className="text-xs text-muted-foreground mt-0.5">Últimas 50 notificações disparadas</p>
        </div>
        {logsLoading ? (
          <div className="space-y-0">
            {[1,2,3].map(i => (
              <div key={i} className="h-14 mx-5 my-3 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            <Bell size={28} className="mx-auto mb-2 opacity-30" />
            Nenhuma notificação enviada ainda
          </div>
        ) : (
          <div className="divide-y divide-border">
            {logs.map(log => {
              const t = TYPE_LABELS[log.type] ?? { label: log.type, color: 'text-muted-foreground' };
              return (
                <div key={log.id} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/40 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs font-bold uppercase tracking-wide ${t.color}`}>{t.label}</span>
                      {log.triggered_by && (
                        <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 bg-muted rounded">{log.triggered_by}</span>
                      )}
                    </div>
                    <p className="text-sm truncate font-medium">{log.title ?? '—'}</p>
                    {log.body && <p className="text-xs text-muted-foreground truncate">{log.body}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-primary">{log.sent_count} enviados</p>
                    <p className="text-xs text-muted-foreground">{log.target === 'all' ? 'Todos' : log.target}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(log.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Subscribers list (collapsible) */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <button onClick={() => setShowSubs(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 transition-colors">
          <div>
            <p className="text-sm font-semibold text-left flex items-center gap-2">
              <Users size={14} className="text-muted-foreground" />
              Dispositivos Inscritos ({totalSubs})
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 text-left">Endpoints ativos de push notification</p>
          </div>
          {showSubs ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
        </button>

        {showSubs && (
          <div className="border-t border-border">
            {subsLoading ? (
              <div className="p-4 space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />)}
              </div>
            ) : subs.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">Nenhum dispositivo inscrito</div>
            ) : (
              <div className="divide-y divide-border">
                {subs.map(sub => (
                  <div key={sub.id} className="flex items-center gap-3 px-5 py-2.5">
                    <Bell size={13} className="text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono truncate text-muted-foreground">{sub.endpoint.slice(0, 60)}…</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Inscrito em {fmtDate(sub.created_at)}
                        {sub.lead_id && <span className="ml-2 text-muted-foreground">lead: {sub.lead_id.slice(0, 8)}…</span>}
                      </p>
                    </div>
                    <button onClick={() => deleteSub(sub.id)}
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
        </div>
      </div>
    </Layout>
  );
}

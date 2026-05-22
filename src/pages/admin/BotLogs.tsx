import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bot, RefreshCw, AlertCircle, AlertTriangle, Info, Trash2, ChevronDown, ChevronUp, Activity } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabaseProcedures, isProceduresSupabaseConfigured } from '@/lib/supabaseProcedures';
import { cn } from '@/lib/utils';

interface BotLog {
  id: string;
  created_at: string;
  level: 'error' | 'warning' | 'info';
  event: string;
  message: string;
  procedure_number: string | null;
  update_id: number | null;
  message_id: number | null;
  raw_text: string | null;
  context: Record<string, unknown> | null;
}

function useBotLogs() {
  return useQuery({
    queryKey: ['bot_logs'],
    queryFn: async (): Promise<BotLog[]> => {
      if (!isProceduresSupabaseConfigured()) return [];
      const { data, error } = await supabaseProcedures
        .from('bot_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as BotLog[];
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

const levelConfig = {
  error: {
    icon: AlertCircle,
    badge: 'bg-red-500/15 text-red-400 border-red-500/30',
    row: 'border-l-2 border-l-red-500/50',
    label: 'Erro',
  },
  warning: {
    icon: AlertTriangle,
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    row: 'border-l-2 border-l-amber-500/50',
    label: 'Aviso',
  },
  info: {
    icon: Info,
    badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    row: 'border-l-2 border-l-blue-500/50',
    label: 'Info',
  },
};

function LogRow({ log }: { log: BotLog }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = levelConfig[log.level] ?? levelConfig.error;
  const Icon = cfg.icon;
  const hasExtra = !!(log.raw_text || log.context);

  return (
    <div className={cn('rounded-xl bg-card border border-white/5 overflow-hidden', cfg.row)}>
      <div
        className={cn(
          'flex items-start gap-3 p-4',
          hasExtra && 'cursor-pointer hover:bg-white/[0.02] transition-colors'
        )}
        onClick={() => hasExtra && setExpanded(v => !v)}
      >
        <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', cfg.badge.split(' ')[1])} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge className={cn('text-[10px] px-2 py-0 border', cfg.badge)}>{cfg.label}</Badge>
            <span className="text-[10px] font-mono text-muted-foreground/60 bg-white/5 px-2 py-0.5 rounded">
              {log.event}
            </span>
            {log.procedure_number && (
              <span className="text-[10px] font-semibold text-cyan-400">#{log.procedure_number}</span>
            )}
          </div>
          <p className="text-sm text-foreground/90 leading-snug">{log.message}</p>
          <p className="text-[10px] text-muted-foreground/50 mt-1">
            {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
            {log.update_id && <span className="ml-2 opacity-60">update #{log.update_id}</span>}
          </p>
        </div>
        {hasExtra && (
          <div className="flex-shrink-0 text-muted-foreground/40">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        )}
      </div>

      {expanded && hasExtra && (
        <div className="px-4 pb-4 space-y-2 border-t border-white/5 pt-3">
          {log.raw_text && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">
                Mensagem original do Telegram
              </p>
              <pre className="text-xs font-mono bg-black/30 rounded-lg p-3 whitespace-pre-wrap break-all text-foreground/70">
                {log.raw_text}
              </pre>
            </div>
          )}
          {log.context && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">
                Contexto
              </p>
              <pre className="text-xs font-mono bg-black/30 rounded-lg p-3 whitespace-pre-wrap break-all text-foreground/70">
                {JSON.stringify(log.context, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Eventos que comprovam que o webhook do Telegram chegou na edge function
// (mensagem real do canal, comando manual, edição, ignorada por chat errado, etc.).
// Eventos puramente "internos" como trial_recall_*, freebetpro_sync_* não contam.
const RECEIVED_EVENTS = new Set([
  // Sucesso / fluxo normal
  'inserted',
  'registered_partial',
  'edit_updated',
  // Comandos manuais
  'command_registered',
  'command_resynced',
  'command_not_found',
  'command_parse_failed',
  'command_insert_error',
  'command_number_mismatch',
  'command_lookup_error',
  // Erros e descartes — provam que o webhook está vivo
  'insert_error',
  'ignored_no_number',
  'ignored_no_text',
  'ignored_no_message',
  'ignored_via_bot',
  'ignored_wrong_chat',
  'ignored_bot_disabled',
  'invalid_secret',
]);

function findLastReceivedAt(logs: BotLog[]): Date | null {
  for (const l of logs) {
    if (RECEIVED_EVENTS.has(l.event)) return new Date(l.created_at);
  }
  return null;
}

export default function BotLogs() {
  const { data: logs = [], isLoading, isFetching, refetch, dataUpdatedAt } = useBotLogs();
  const [levelFilter, setLevelFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');

  const filtered = levelFilter === 'all' ? logs : logs.filter(l => l.level === levelFilter);

  const counts = {
    error: logs.filter(l => l.level === 'error').length,
    warning: logs.filter(l => l.level === 'warning').length,
    info: logs.filter(l => l.level === 'info').length,
  };

  const lastReceivedAt = findLastReceivedAt(logs);
  const minutesSinceLast = lastReceivedAt
    ? (Date.now() - lastReceivedAt.getTime()) / 60000
    : null;
  const freshnessTone =
    minutesSinceLast == null
      ? 'muted'
      : minutesSinceLast < 60
        ? 'ok'
        : minutesSinceLast < 240
          ? 'warn'
          : 'bad';
  const freshnessClass = {
    muted: 'from-white/5 to-transparent border-white/10 text-muted-foreground',
    ok: 'from-emerald-500/15 to-transparent border-emerald-500/30 text-emerald-300',
    warn: 'from-amber-500/15 to-transparent border-amber-500/30 text-amber-300',
    bad: 'from-red-500/15 to-transparent border-red-500/30 text-red-300',
  }[freshnessTone];

  return (
    <Layout>
      <div className="space-y-5 animate-fade-in">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500/25 to-red-500/5 border border-red-500/25 flex items-center justify-center flex-shrink-0">
              <Bot className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight gradient-text">
                Logs do Bot de Procedimentos
              </h1>
              <p className="text-muted-foreground text-xs md:text-sm mt-0.5">
                Erros e avisos do bot — não vão mais para o grupo do Telegram
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {dataUpdatedAt && (
              <span className="text-xs text-muted-foreground/50 flex items-center gap-1">
                <RefreshCw className={cn('h-3 w-3', isFetching && 'animate-spin')} />
                {format(new Date(dataUpdatedAt), 'HH:mm:ss')}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="border-white/10 hover:bg-white/5 h-9">
              <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', isFetching && 'animate-spin')} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Freshness — última atividade do bot */}
        <div className={cn(
          'rounded-2xl border bg-gradient-to-br p-4 flex items-center gap-3',
          freshnessClass,
        )}>
          <Activity className="w-4 h-4 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest opacity-80">
              Última mensagem recebida do canal
            </p>
            <p className="text-sm font-medium mt-0.5" data-testid="text-bot-last-received">
              {lastReceivedAt
                ? `há ${formatDistanceToNowStrict(lastReceivedAt, { locale: ptBR })} · ${format(lastReceivedAt, "dd/MM 'às' HH:mm")}`
                : 'Sem registro nos últimos 200 logs'}
            </p>
            {minutesSinceLast != null && minutesSinceLast >= 240 && (
              <p className="text-[11px] opacity-80 mt-1">
                ⚠️ Bot pode estar mudo — verifique o webhook no Telegram BotFather ou as variáveis TELEGRAM_PROC_*.
              </p>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          {(['error', 'warning', 'info'] as const).map(level => {
            const cfg = levelConfig[level];
            const Icon = cfg.icon;
            return (
              <button
                key={level}
                onClick={() => setLevelFilter(prev => prev === level ? 'all' : level)}
                className={cn(
                  'rounded-2xl border p-4 text-left transition-all duration-200',
                  'bg-gradient-to-br hover:-translate-y-0.5',
                  levelFilter === level
                    ? `${cfg.badge} opacity-100`
                    : 'from-white/5 to-transparent border-white/10 opacity-80 hover:opacity-100'
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-4 h-4" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest">{cfg.label}s</span>
                </div>
                <div className="text-2xl font-bold">
                  {isLoading ? '—' : counts[level]}
                </div>
              </button>
            );
          })}
        </div>

        {/* Filtro ativo pill */}
        {levelFilter !== 'all' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Filtrando por:</span>
            <Badge
              className={cn('text-xs border cursor-pointer', levelConfig[levelFilter].badge)}
              onClick={() => setLevelFilter('all')}
            >
              {levelConfig[levelFilter].label} <Trash2 className="w-3 h-3 ml-1" />
            </Badge>
          </div>
        )}

        {/* Log list */}
        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {levelFilter === 'all' ? (
                  <>
                    <Bot className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="font-medium">Nenhum log ainda</p>
                    <p className="text-xs mt-1 opacity-60">Os erros do bot aparecerão aqui automaticamente</p>
                  </>
                ) : (
                  <p>Nenhum log do tipo <strong>{levelConfig[levelFilter].label}</strong></p>
                )}
              </CardContent>
            </Card>
          ) : (
            filtered.map(log => <LogRow key={log.id} log={log} />)
          )}
        </div>

        {filtered.length > 0 && (
          <p className="text-center text-xs text-muted-foreground/40">
            Mostrando {filtered.length} de {logs.length} — últimos 200 registros
          </p>
        )}
      </div>
    </Layout>
  );
}

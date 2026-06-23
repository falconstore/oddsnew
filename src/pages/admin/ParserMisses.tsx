import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Brain, RefreshCw, ChevronDown, ChevronUp, CircleCheck, CircleX,
  Coins, Cpu, Sparkles, AlertTriangle,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabaseProcedures, isProceduresSupabaseConfigured } from '@/lib/supabaseProcedures';
import { cn } from '@/lib/utils';

// ──────────────────────────────────────────────────────────
// Custos da IA (fallback do parser)
// Preços Anthropic por 1M de tokens. Haiku 4.5: $1 entrada / $5 saída.
// Câmbio aproximado USD→BRL (ajustável). Custo é ESTIMADO — para conferência.
// ──────────────────────────────────────────────────────────
const PRICE_PER_M = {
  'claude-haiku-4-5': { in: 1, out: 5 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-opus-4-8': { in: 15, out: 75 },
} as const;
const USD_TO_BRL = 5.5;

function rowCostUsd(model: string | null, tokensIn: number, tokensOut: number): number {
  const p = (model && (PRICE_PER_M as any)[model]) || PRICE_PER_M['claude-haiku-4-5'];
  return (tokensIn / 1_000_000) * p.in + (tokensOut / 1_000_000) * p.out;
}

const usd = (v: number) => `US$ ${v.toFixed(v < 0.01 ? 4 : 2)}`;
const brl = (v: number) => `R$ ${v.toFixed(v < 0.01 ? 4 : 2)}`;

interface ParserMiss {
  id: string;
  created_at: string;
  miss_type: 'no_number' | 'partial';
  procedure_number: string | null;
  raw_text: string;
  regex_missing: string[] | null;
  ai_extracted: Record<string, unknown> | null;
  ai_reason: string | null;
  ai_model: string | null;
  ai_tokens_in: number | null;
  ai_tokens_out: number | null;
  resolved: boolean;
  procedure_id: string | null;
  reviewed: boolean;
  update_id: number | null;
  message_id: number | null;
}

function useParserMisses() {
  return useQuery({
    queryKey: ['parser_misses'],
    queryFn: async (): Promise<ParserMiss[]> => {
      if (!isProceduresSupabaseConfigured()) return [];
      const { data, error } = await supabaseProcedures
        .from('parser_misses')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ParserMiss[];
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

const FIELD_LABELS: Record<string, string> = {
  procedure_number: 'Nº',
  titulo: 'Título',
  platform: 'Casa',
  category: 'Categoria',
  tipo: 'Tipo',
  partida_descricao: 'Partida',
  data_partida: 'Data partida',
  horario_partida: 'Horário',
  lucro_prejuizo_previsto: 'Lucro',
  freebet_valor_previsto: 'Freebet',
  ref_procedure_number: 'Ref.',
};

function MissRow({ miss }: { miss: ParserMiss }) {
  const [expanded, setExpanded] = useState(false);
  const tokensIn = miss.ai_tokens_in ?? 0;
  const tokensOut = miss.ai_tokens_out ?? 0;
  const costUsd = rowCostUsd(miss.ai_model, tokensIn, tokensOut);

  return (
    <div className={cn(
      'rounded-none bg-card border overflow-hidden',
      miss.resolved ? 'border-l-2 border-l-primary/50 border-border' : 'border-l-2 border-l-destructive/50 border-border',
    )}>
      <div
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        {miss.resolved
          ? <CircleCheck className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
          : <CircleX className="w-4 h-4 mt-0.5 flex-shrink-0 text-destructive" />}

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge className={cn(
              'text-[10px] px-2 py-0 border rounded-none',
              miss.miss_type === 'no_number'
                ? 'bg-destructive/15 text-destructive border-destructive/30'
                : 'bg-warning/15 text-warning border-warning/30',
            )}>
              {miss.miss_type === 'no_number' ? 'Regex não leu' : 'Regex parcial'}
            </Badge>
            {miss.procedure_number && (
              <span className="text-[10px] font-semibold text-muted-foreground">#{miss.procedure_number}</span>
            )}
            {miss.resolved
              ? <span className="text-[10px] text-primary">resolvido pela IA</span>
              : <span className="text-[10px] text-destructive">IA não resolveu</span>}
            {miss.reviewed && (
              <Badge className="text-[10px] px-2 py-0 border rounded-none bg-muted/20 text-muted-foreground border-border">
                já tratado no regex
              </Badge>
            )}
          </div>

          {/* Motivo — o coração do aprendizado */}
          <p className="text-sm text-foreground/90 leading-snug">
            {miss.ai_reason || <span className="italic text-muted-foreground/60">sem explicação</span>}
          </p>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground/50 mt-1.5">
            <span>{format(new Date(miss.created_at), "dd/MM 'às' HH:mm:ss", { locale: ptBR })}</span>
            <span className="flex items-center gap-1">
              <Cpu className="w-3 h-3" />{tokensIn + tokensOut} tk
              <span className="opacity-50">({tokensIn}→{tokensOut})</span>
            </span>
            <span className="flex items-center gap-1 text-primary/70">
              <Coins className="w-3 h-3" />{brl(costUsd * USD_TO_BRL)}
            </span>
            <span className="opacity-50">{miss.ai_model ?? '—'}</span>
          </div>
        </div>

        <div className="flex-shrink-0 text-muted-foreground/40">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {/* Campos que o regex não pegou */}
          {miss.regex_missing && miss.regex_missing.length > 0 && (
            <div>
              <p className="telemetry-label text-muted-foreground mb-1">CAMPOS QUE O REGEX NÃO PEGOU</p>
              <div className="flex flex-wrap gap-1">
                {miss.regex_missing.map((f, i) => (
                  <span key={i} className="text-[10px] font-mono bg-destructive/10 text-destructive/80 px-2 py-0.5">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* O que a IA extraiu */}
          {miss.ai_extracted && (
            <div>
              <p className="telemetry-label text-muted-foreground mb-1">O QUE A IA EXTRAIU</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border border border-border">
                {Object.entries(FIELD_LABELS).map(([key, label]) => {
                  const val = (miss.ai_extracted as any)?.[key];
                  if (val === undefined || val === null || val === '') return null;
                  return (
                    <div key={key} className="flex items-baseline gap-2 bg-card px-2.5 py-1.5">
                      <span className="telemetry-label text-muted-foreground/60 shrink-0">{label}</span>
                      <span className="text-xs font-mono text-foreground/90 truncate">{String(val)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Texto original */}
          <div>
            <p className="telemetry-label text-muted-foreground mb-1">MENSAGEM ORIGINAL DO TELEGRAM</p>
            <pre className="text-xs font-mono bg-black/30 p-3 whitespace-pre-wrap break-all text-foreground/70">
              {miss.raw_text}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ParserMisses() {
  const { data: misses = [], isLoading, isFetching, refetch, dataUpdatedAt } = useParserMisses();
  const [filter, setFilter] = useState<'all' | 'resolved' | 'unresolved' | 'pending_review'>('all');

  const stats = useMemo(() => {
    let tokensIn = 0, tokensOut = 0, costUsd = 0, resolved = 0, pendingReview = 0;
    for (const m of misses) {
      const tin = m.ai_tokens_in ?? 0, tout = m.ai_tokens_out ?? 0;
      tokensIn += tin; tokensOut += tout;
      costUsd += rowCostUsd(m.ai_model, tin, tout);
      if (m.resolved) resolved += 1;
      if (m.resolved && !m.reviewed) pendingReview += 1;
    }
    const total = misses.length;
    return {
      total,
      resolved,
      resolvedPct: total ? Math.round((resolved / total) * 100) : 0,
      pendingReview,
      tokensIn, tokensOut,
      tokensTotal: tokensIn + tokensOut,
      costUsd,
      costBrl: costUsd * USD_TO_BRL,
      avgBrl: total ? (costUsd * USD_TO_BRL) / total : 0,
    };
  }, [misses]);

  const filtered = useMemo(() => {
    switch (filter) {
      case 'resolved': return misses.filter(m => m.resolved);
      case 'unresolved': return misses.filter(m => !m.resolved);
      case 'pending_review': return misses.filter(m => m.resolved && !m.reviewed);
      default: return misses;
    }
  }, [misses, filter]);

  return (
    <Layout>
      <div className="space-y-5 animate-fade-in">
        <PageHeader
          eyebrow="AI_PARSER"
          title="Aprendizado do Parser (IA)"
          subtitle="QUANDO O REGEX FALHA, A IA RESGATA — E REGISTRA O CASO AQUI PRA EVOLUIR O PARSER"
          icon={Brain}
          actions={
            <>
              {dataUpdatedAt && (
                <span className="text-xs text-muted-foreground/50 flex items-center gap-1">
                  <RefreshCw className={cn('h-3 w-3', isFetching && 'animate-spin')} />
                  {format(new Date(dataUpdatedAt), 'HH:mm:ss')}
                </span>
              )}
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="border-border hover:bg-white/5 h-9">
                <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', isFetching && 'animate-spin')} />
                Atualizar
              </Button>
            </>
          }
        />

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border">
          <div className="bg-card p-4">
            <p className="telemetry-label text-muted-foreground flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> RESGATES DA IA</p>
            <p className="text-2xl font-bold font-mono mt-1 tabular-nums">{isLoading ? '—' : stats.total}</p>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">{stats.resolvedPct}% resolvidos · {stats.resolved}/{stats.total}</p>
          </div>
          <div className="bg-card p-4">
            <p className="telemetry-label text-muted-foreground flex items-center gap-1.5"><Coins className="w-3 h-3" /> CUSTO TOTAL</p>
            <p className="text-2xl font-bold font-mono mt-1 tabular-nums text-primary">{isLoading ? '—' : brl(stats.costBrl)}</p>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">{usd(stats.costUsd)} · ~{brl(stats.avgBrl)}/caso</p>
          </div>
          <div className="bg-card p-4">
            <p className="telemetry-label text-muted-foreground flex items-center gap-1.5"><Cpu className="w-3 h-3" /> TOKENS</p>
            <p className="text-2xl font-bold font-mono mt-1 tabular-nums">{isLoading ? '—' : stats.tokensTotal.toLocaleString('pt-BR')}</p>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">{stats.tokensIn.toLocaleString('pt-BR')} entrada · {stats.tokensOut.toLocaleString('pt-BR')} saída</p>
          </div>
          <button
            onClick={() => setFilter(f => f === 'pending_review' ? 'all' : 'pending_review')}
            className={cn('bg-card p-4 text-left transition-colors hover:bg-white/[0.03]', filter === 'pending_review' && 'ring-1 ring-warning/40')}
          >
            <p className="telemetry-label text-muted-foreground flex items-center gap-1.5"><AlertTriangle className="w-3 h-3" /> A REVISAR</p>
            <p className="text-2xl font-bold font-mono mt-1 tabular-nums text-warning">{isLoading ? '—' : stats.pendingReview}</p>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">padrões pra endurecer no regex</p>
          </button>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          {([
            ['all', 'Todos'],
            ['resolved', 'Resolvidos pela IA'],
            ['unresolved', 'Não resolvidos'],
            ['pending_review', 'A revisar'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                'text-xs px-3 py-1.5 border transition-colors',
                filter === key
                  ? 'bg-primary/15 text-primary border-primary/40'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/30',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Brain className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="font-medium">
                  {filter === 'all' ? 'Nenhum resgate da IA ainda' : 'Nada neste filtro'}
                </p>
                <p className="text-xs mt-1 opacity-60">
                  {filter === 'all'
                    ? 'Quando um template fugir do padrão, o caso aparece aqui com o motivo e o custo.'
                    : 'Tente outro filtro.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            filtered.map(m => <MissRow key={m.id} miss={m} />)
          )}
        </div>

        {filtered.length > 0 && (
          <p className="text-center text-xs text-muted-foreground/40">
            Mostrando {filtered.length} de {misses.length} — últimos 200 registros
          </p>
        )}
      </div>
    </Layout>
  );
}

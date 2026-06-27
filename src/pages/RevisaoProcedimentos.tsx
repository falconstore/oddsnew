import { useState, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ImageLightbox } from '@/components/ImageLightbox';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  useProcedureDrafts, useReviewDraft, draftImageUrl,
  type ProcedureDraft, type DraftStatus,
} from '@/hooks/useProcedureDrafts';
import {
  ClipboardCheck, CheckCircle2, XCircle, Clock, Send as SendIcon,
  Ticket, Calculator, ZoomIn, Loader2, User, FileText, Ban, Megaphone,
  Link2 as LinkIcon, Search, ChevronRight,
} from 'lucide-react';

const fmt = (iso: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
};

const STATUS_META: Record<DraftStatus, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  pendente: { label: 'Pendente', cls: 'text-amber-400 border-amber-400/40 bg-amber-400/10', icon: Clock },
  aprovado: { label: 'Aprovado', cls: 'text-primary border-primary/40 bg-primary/10', icon: CheckCircle2 },
  rejeitado: { label: 'Rejeitado', cls: 'text-destructive border-destructive/40 bg-destructive/10', icon: XCircle },
  enviado: { label: 'Enviado', cls: 'text-sky-400 border-sky-400/40 bg-sky-400/10', icon: SendIcon },
};

const FILTERS: { key: DraftStatus; label: string }[] = [
  { key: 'pendente', label: 'Fila de revisão' },
  { key: 'aprovado', label: 'Aprovados' },
  { key: 'rejeitado', label: 'Rejeitados' },
  { key: 'enviado', label: 'Enviados' },
];

export default function RevisaoProcedimentos() {
  const { user } = useAuth();
  const [filtro, setFiltro] = useState<DraftStatus>('pendente');
  const { data: drafts = [], isLoading } = useProcedureDrafts(filtro);
  const review = useReviewDraft();

  // Lightbox (zoom da imagem).
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);

  // Procedimento aberto no modal de detalhes.
  const [aberto, setAberto] = useState<ProcedureDraft | null>(null);

  // Busca (número / casa / autor).
  const [busca, setBusca] = useState('');

  // Rejeição: qual draft está com o textarea de motivo aberto (dentro do modal).
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const counts = useProcedureDrafts('pendente');
  const pendentes = counts.data?.length ?? 0;

  // Lista filtrada pela busca.
  const listaFiltrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return drafts;
    return drafts.filter((d) => {
      const hay = [
        d.texto, d.created_by_email,
        ...(d.entradas ?? []).map((e) => e.casa),
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [drafts, busca]);

  // Mantém o modal sincronizado com a query (após aprovar/rejeitar atualiza o status).
  const abertoAtual = useMemo(
    () => (aberto ? drafts.find((d) => d.id === aberto.id) ?? aberto : null),
    [aberto, drafts],
  );

  const aprovar = (d: ProcedureDraft) => {
    review.mutate(
      { id: d.id, decision: 'aprovado', reviewedByEmail: user?.email ?? null },
      { onSuccess: () => setAberto(null) },
    );
  };

  const confirmarRejeicao = (d: ProcedureDraft) => {
    review.mutate(
      { id: d.id, decision: 'rejeitado', reviewedByEmail: user?.email ?? null, rejectReason: rejectReason.trim() || undefined },
      { onSuccess: () => { setRejecting(null); setRejectReason(''); setAberto(null); } },
    );
  };

  return (
    <Layout>
      <div className="space-y-5 animate-fade-in pb-24">
        <PageHeader
          eyebrow="REVISÃO"
          title="Revisão de Procedimentos"
          subtitle="CONFIRA O TEXTO E AS IMAGENS ANTES DE LIBERAR O ENVIO"
          icon={ClipboardCheck}
        />

        {/* Filtros por status + busca */}
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const active = filtro === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFiltro(f.key)}
                  className={cn(
                    'h-9 px-3 text-xs rounded border transition-colors',
                    active ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground hover:border-primary/40',
                  )}
                >
                  {f.label}
                  {f.key === 'pendente' && pendentes > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400/20 text-amber-400 text-[10px] font-semibold">
                      {pendentes}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar número, casa ou autor…"
              className="h-9 pl-8 text-sm w-56" />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
          </div>
        ) : listaFiltrada.length === 0 ? (
          <div className="panel-bracket p-10 text-center text-muted-foreground/70 text-sm">
            {busca ? 'Nada encontrado pra essa busca.' : (filtro === 'pendente' ? 'Nenhum procedimento aguardando revisão. 🦈' : 'Nada aqui.')}
          </div>
        ) : (
          <div className="panel-bracket divide-y divide-border">
            {listaFiltrada.map((d) => (
              <DraftRow
                key={d.id}
                draft={d}
                onOpen={() => setAberto(d)}
                onAprovar={() => aprovar(d)}
                onRejeitar={() => { setAberto(d); setRejecting(d.id); setRejectReason(''); }}
                processing={review.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal de detalhes do procedimento */}
      <Dialog open={!!abertoAtual} onOpenChange={(o) => { if (!o) { setAberto(null); setRejecting(null); setRejectReason(''); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          {abertoAtual && (
            <DraftDetail
              draft={abertoAtual}
              onZoom={setZoomUrl}
              onAprovar={() => aprovar(abertoAtual)}
              onIniciarRejeicao={() => { setRejecting(abertoAtual.id); setRejectReason(''); }}
              rejecting={rejecting === abertoAtual.id}
              rejectReason={rejectReason}
              setRejectReason={setRejectReason}
              onConfirmarRejeicao={() => confirmarRejeicao(abertoAtual)}
              onCancelarRejeicao={() => { setRejecting(null); setRejectReason(''); }}
              processing={review.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Lightbox de zoom interativo */}
      <ImageLightbox url={zoomUrl} onClose={() => setZoomUrl(null)} />
    </Layout>
  );
}

// ── Linha compacta da lista ────────────────────────────────────────────────
function DraftRow({ draft: d, onOpen, onAprovar, onRejeitar, processing }: {
  draft: ProcedureDraft;
  onOpen: () => void;
  onAprovar: () => void;
  onRejeitar: () => void;
  processing: boolean;
}) {
  const meta = STATUS_META[d.status];
  const StatusIcon = meta.icon;
  const titulo = (d.texto ?? '').split('\n').find((l) => l.trim())?.slice(0, 60) || 'Procedimento';
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-card/50 cursor-pointer transition-colors" onClick={onOpen}>
      <span className={cn('inline-flex items-center gap-1 px-2 h-6 rounded border text-[11px] font-semibold flex-shrink-0', meta.cls)}>
        <StatusIcon className="w-3 h-3" /> {meta.label}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground/90 font-medium truncate">{titulo.toUpperCase()}</p>
        <p className="text-[11px] text-muted-foreground/70 truncate">
          {d.created_by_email ?? 'desconhecido'} · {fmt(d.created_at)} · {d.entradas?.length ?? 0} entrada(s)
        </p>
      </div>
      {/* Ações rápidas só pra pendentes */}
      {d.status === 'pendente' && (
        <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="outline" onClick={onRejeitar} disabled={processing}
            className="h-7 px-2 text-destructive border-destructive/40 hover:bg-destructive/10" title="Rejeitar">
            <XCircle className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" onClick={onAprovar} disabled={processing} className="h-7 px-2.5 gap-1 text-xs" title="Liberar para envio">
            {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Liberar
          </Button>
        </div>
      )}
      <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
    </div>
  );
}

function DraftDetail({
  draft: d, onZoom, onAprovar, onIniciarRejeicao, rejecting, rejectReason,
  setRejectReason, onConfirmarRejeicao, onCancelarRejeicao, processing,
}: {
  draft: ProcedureDraft;
  onZoom: (url: string) => void;
  onAprovar: () => void;
  onIniciarRejeicao: () => void;
  rejecting: boolean;
  rejectReason: string;
  setRejectReason: (v: string) => void;
  onConfirmarRejeicao: () => void;
  onCancelarRejeicao: () => void;
  processing: boolean;
}) {
  const meta = STATUS_META[d.status];
  const StatusIcon = meta.icon;

  return (
    <div className="p-5 space-y-5">
      {/* Cabeçalho — status + autor + data */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-border pb-3 pr-8">
        <span className={cn('inline-flex items-center gap-1.5 px-2.5 h-7 rounded border text-xs font-semibold', meta.cls)}>
          <StatusIcon className="w-3.5 h-3.5" /> {meta.label}
        </span>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" /> {d.created_by_email ?? 'desconhecido'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> {fmt(d.created_at)}
          </span>
        </div>
      </div>

      {/* Texto do procedimento */}
      <div>
        <p className="telemetry-label text-primary flex items-center gap-1.5 mb-2">
          <FileText className="w-3.5 h-3.5" /> TEXTO DO PROCEDIMENTO
        </p>
        <pre className="whitespace-pre-wrap font-mono text-[14px] leading-relaxed text-foreground/90 bg-background border border-border rounded-lg p-4 max-h-80 overflow-auto">
          {(d.texto ?? '').toUpperCase()}
        </pre>
      </div>

      {/* Promoções (entre o texto e as entradas) */}
      {Array.isArray(d.promocoes) && d.promocoes.length > 0 && (
        <div>
          <p className="telemetry-label text-primary flex items-center gap-1.5 mb-2">
            <Megaphone className="w-3.5 h-3.5" /> PROMOÇÕES ({d.promocoes.length})
          </p>
          <div className="space-y-3">
            {d.promocoes.map((p, i) => {
              const url = draftImageUrl(p.image_path);
              return (
                <div key={i} className="border border-border rounded-lg p-4 bg-card/60 flex gap-4">
                  {url ? (
                    <ThumbZoom url={url} onZoom={onZoom} />
                  ) : (
                    <SemImg />
                  )}
                  <div className="flex-1 min-w-0 space-y-2">
                    <span className="telemetry-label text-muted-foreground">PROMOÇÃO {i + 1}</span>
                    {p.descricao && <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{p.descricao.toUpperCase()}</p>}
                    <p className="text-sm text-primary font-medium">{(p.chamada || 'PARTICIPE DA PROMOÇÃO ✅').toUpperCase()}</p>
                    {p.link && <LinkRow href={p.link} label="LINK DA PROMOÇÃO" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Entradas — cada uma num card próprio */}
      <div>
        <p className="telemetry-label text-primary flex items-center gap-1.5 mb-2">
          <Ticket className="w-3.5 h-3.5" /> ENTRADAS ({d.entradas.length})
        </p>
        <div className="space-y-3">
          {d.entradas.map((e, i) => {
            const url = draftImageUrl(e.image_path);
            return (
              <div key={i} className="border border-border rounded-lg p-4 bg-card/60 flex gap-4">
                {url ? (
                  <ThumbZoom url={url} onZoom={onZoom} />
                ) : (
                  <SemImg />
                )}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="telemetry-label text-muted-foreground">ENTRADA {i + 1}</span>
                    {e.lay && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-400 font-semibold">LAY</span>}
                    {e.freebet && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-400 font-semibold">🎟️ FREEBET</span>}
                  </div>
                  <p className="text-base text-foreground font-semibold">
                    {(e.casa || 'CASA').toUpperCase()}
                  </p>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                    <span className="text-muted-foreground">{e.lay ? 'LAY ODD' : 'ODD'} <span className="text-primary font-semibold">{e.odd || '—'}</span></span>
                    <span className="text-muted-foreground">APOSTE <span className="text-foreground font-semibold">{e.aposte || '—'}</span></span>
                    {e.lay && e.responsabilidade && <span className="text-muted-foreground">RESP. <span className="text-amber-400 font-semibold">{e.responsabilidade}</span></span>}
                  </div>
                  {e.observacao && <p className="text-sm text-muted-foreground/90">📝 {e.observacao.toUpperCase()}</p>}
                  {e.link && <LinkRow href={e.link} label="LINK DA PARTIDA" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Calculadora */}
      {d.calc && (d.calc.image_path || d.calc.link || d.calc.obs) && (
        <div>
          <p className="telemetry-label text-primary flex items-center gap-1.5 mb-2">
            <Calculator className="w-3.5 h-3.5" /> CALCULADORA
          </p>
          <div className="border border-border rounded-lg p-4 bg-card/60 flex gap-4 items-center">
            {(() => {
              const url = draftImageUrl(d.calc!.image_path);
              return url ? <ThumbZoom url={url} onZoom={onZoom} /> : null;
            })()}
            <div className="min-w-0 space-y-2">
              {d.calc.link && <LinkRow href={d.calc.link} label="LINK DA CALCULADORA" />}
              {d.calc.obs && <p className="text-sm text-muted-foreground/90">🟥 {d.calc.obs.toUpperCase()}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Info de revisão (se já revisado) */}
      {d.status !== 'pendente' && (
        <div className="text-sm text-muted-foreground/80 border-t border-border pt-3 space-y-1">
          {d.reviewed_by_email && <p>Revisado por <span className="text-foreground/90 font-medium">{d.reviewed_by_email}</span> em {fmt(d.reviewed_at)}</p>}
          {d.status === 'rejeitado' && d.reject_reason && (
            <p className="text-destructive flex items-start gap-1.5"><Ban className="w-4 h-4 mt-0.5 flex-shrink-0" /> {d.reject_reason}</p>
          )}
          {d.status === 'enviado' && d.sent_at && <p>Enviado em {fmt(d.sent_at)}</p>}
        </div>
      )}

      {/* Ações (só pra pendentes) */}
      {d.status === 'pendente' && (
        rejecting ? (
          <div className="border-t border-border pt-4 space-y-2">
            <Textarea
              value={rejectReason}
              onChange={(ev) => setRejectReason(ev.target.value)}
              placeholder="Motivo da rejeição (volta pro montador corrigir)…"
              className="min-h-[80px] text-sm"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={onCancelarRejeicao} disabled={processing}>Cancelar</Button>
              <Button variant="destructive" size="sm" onClick={onConfirmarRejeicao} disabled={processing} className="gap-1.5">
                {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                Confirmar rejeição
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 justify-end border-t border-border pt-4">
            <Button variant="outline" onClick={onIniciarRejeicao} disabled={processing}
              className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10">
              <XCircle className="w-4 h-4" /> Rejeitar
            </Button>
            <Button onClick={onAprovar} disabled={processing} className="gap-1.5">
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Liberar para envio
            </Button>
          </div>
        )
      )}
    </div>
  );
}

// Miniatura clicável (zoom) — maior e mais visível.
function ThumbZoom({ url, onZoom }: { url: string; onZoom: (url: string) => void }) {
  return (
    <button onClick={() => onZoom(url)} className="relative group flex-shrink-0" title="Ampliar imagem">
      <img src={url} alt="" className="h-24 w-24 object-cover rounded-lg border border-border" />
      <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 rounded-lg transition-colors">
        <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100" />
      </span>
    </button>
  );
}

function SemImg() {
  return (
    <div className="h-24 w-24 flex-shrink-0 rounded-lg border border-dashed border-border flex items-center justify-center text-[10px] text-muted-foreground/40 text-center">
      sem<br />imagem
    </div>
  );
}

// Link clicável (abre em nova aba) — mostra o rótulo padrão + o domínio.
function LinkRow({ href, label }: { href: string; label: string }) {
  let dominio = '';
  try { dominio = new URL(href).hostname.replace(/^www\./, ''); } catch { dominio = ''; }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm text-sky-400 hover:text-sky-300 hover:underline break-all">
      <LinkIcon className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="font-medium">{label}</span>
      {dominio && <span className="text-muted-foreground/60 text-xs">({dominio})</span>}
    </a>
  );
}

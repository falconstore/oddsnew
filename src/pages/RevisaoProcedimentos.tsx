import { useState, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  useProcedureDrafts, useReviewDraft, draftImageUrl,
  type ProcedureDraft, type DraftStatus,
} from '@/hooks/useProcedureDrafts';
import {
  ClipboardCheck, CheckCircle2, XCircle, Clock, Send as SendIcon,
  Ticket, Calculator, ZoomIn, Loader2, User, FileText, Ban,
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

  // Rejeição: qual draft está com o textarea de motivo aberto.
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const counts = useProcedureDrafts('pendente');
  const pendentes = counts.data?.length ?? 0;

  const aprovar = (d: ProcedureDraft) => {
    review.mutate(
      { id: d.id, decision: 'aprovado', reviewedByEmail: user?.email ?? null },
      { onSuccess: () => { /* a query invalida sozinha */ } },
    );
  };

  const confirmarRejeicao = (d: ProcedureDraft) => {
    review.mutate(
      { id: d.id, decision: 'rejeitado', reviewedByEmail: user?.email ?? null, rejectReason: rejectReason.trim() || undefined },
      { onSuccess: () => { setRejecting(null); setRejectReason(''); } },
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

        {/* Filtros por status */}
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = filtro === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFiltro(f.key)}
                className={cn(
                  'h-8 px-3 text-xs rounded border transition-colors',
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

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
          </div>
        ) : drafts.length === 0 ? (
          <div className="panel-bracket p-10 text-center text-muted-foreground/70 text-sm">
            {filtro === 'pendente' ? 'Nenhum procedimento aguardando revisão. 🦈' : 'Nada aqui.'}
          </div>
        ) : (
          <div className="space-y-4">
            {drafts.map((d) => (
              <DraftCard
                key={d.id}
                draft={d}
                onZoom={setZoomUrl}
                onAprovar={() => aprovar(d)}
                onIniciarRejeicao={() => { setRejecting(d.id); setRejectReason(''); }}
                rejecting={rejecting === d.id}
                rejectReason={rejectReason}
                setRejectReason={setRejectReason}
                onConfirmarRejeicao={() => confirmarRejeicao(d)}
                onCancelarRejeicao={() => { setRejecting(null); setRejectReason(''); }}
                processing={review.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox de zoom */}
      <Dialog open={!!zoomUrl} onOpenChange={(o) => !o && setZoomUrl(null)}>
        <DialogContent className="max-w-4xl p-2 bg-background/95">
          {zoomUrl && (
            <img src={zoomUrl} alt="Imagem do procedimento" className="w-full h-auto max-h-[85vh] object-contain rounded" />
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function DraftCard({
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
    <div className="panel-bracket p-4 space-y-3">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={cn('inline-flex items-center gap-1 px-2 h-6 rounded border text-[11px] font-medium', meta.cls)}>
            <StatusIcon className="w-3 h-3" /> {meta.label}
          </span>
          <span className="inline-flex items-center gap-1">
            <User className="w-3 h-3" /> {d.created_by_email ?? 'desconhecido'}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3" /> {fmt(d.created_at)}
          </span>
        </div>
      </div>

      {/* Texto do procedimento */}
      <div>
        <p className="telemetry-label text-muted-foreground flex items-center gap-1.5 mb-1">
          <FileText className="w-3 h-3" /> TEXTO
        </p>
        <pre className="whitespace-pre-wrap font-mono text-[12px] bg-background border border-border rounded p-3 max-h-64 overflow-auto">
          {(d.texto ?? '').toUpperCase()}
        </pre>
      </div>

      {/* Entradas */}
      <div>
        <p className="telemetry-label text-muted-foreground flex items-center gap-1.5 mb-1">
          <Ticket className="w-3 h-3" /> ENTRADAS ({d.entradas.length})
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {d.entradas.map((e, i) => {
            const url = draftImageUrl(e.image_path);
            return (
              <div key={i} className="border border-border rounded p-2.5 bg-card flex gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-[11px] text-foreground/90 font-medium">
                    {(e.casa || 'CASA').toUpperCase()} · <span className="text-primary/80">ODD {e.odd || '—'}</span> · APOSTE {e.aposte || '—'}
                    {e.freebet && <span className="ml-1 text-amber-400">🎟️ FREEBET</span>}
                  </p>
                  {e.observacao && <p className="text-[10px] text-muted-foreground/70 truncate">📝 {e.observacao.toUpperCase()}</p>}
                  {e.link && <p className="text-[10px] text-muted-foreground/50 truncate">🔗 {e.link}</p>}
                </div>
                {url ? (
                  <button
                    onClick={() => onZoom(url)}
                    className="relative group flex-shrink-0"
                    title="Ampliar imagem"
                  >
                    <img src={url} alt="" className="h-16 w-16 object-cover rounded border border-border" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 rounded transition-colors">
                      <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100" />
                    </span>
                  </button>
                ) : (
                  <div className="h-16 w-16 flex-shrink-0 rounded border border-dashed border-border flex items-center justify-center text-[9px] text-muted-foreground/40 text-center">
                    sem img
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Calculadora */}
      {d.calc && (d.calc.image_path || d.calc.link || d.calc.obs) && (
        <div>
          <p className="telemetry-label text-muted-foreground flex items-center gap-1.5 mb-1">
            <Calculator className="w-3 h-3" /> CALCULADORA
          </p>
          <div className="border border-border rounded p-2.5 bg-card flex gap-3 items-center">
            {(() => {
              const url = draftImageUrl(d.calc!.image_path);
              return url ? (
                <button onClick={() => onZoom(url)} className="relative group flex-shrink-0" title="Ampliar">
                  <img src={url} alt="" className="h-16 w-16 object-cover rounded border border-border" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 rounded transition-colors">
                    <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100" />
                  </span>
                </button>
              ) : null;
            })()}
            <div className="min-w-0 space-y-0.5">
              {d.calc.link && <p className="text-[11px] text-sky-400 truncate">🔗 LINK DA CALCULADORA 👆</p>}
              {d.calc.obs && <p className="text-[11px] text-muted-foreground/70">🟥 {d.calc.obs.toUpperCase()}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Info de revisão (se já revisado) */}
      {d.status !== 'pendente' && (
        <div className="text-[11px] text-muted-foreground/70 border-t border-border pt-2 space-y-0.5">
          {d.reviewed_by_email && <p>Revisado por <span className="text-foreground/80">{d.reviewed_by_email}</span> em {fmt(d.reviewed_at)}</p>}
          {d.status === 'rejeitado' && d.reject_reason && (
            <p className="text-destructive/90 flex items-start gap-1"><Ban className="w-3 h-3 mt-0.5 flex-shrink-0" /> {d.reject_reason}</p>
          )}
          {d.status === 'enviado' && d.sent_at && <p>Enviado em {fmt(d.sent_at)}</p>}
        </div>
      )}

      {/* Ações (só pra pendentes) */}
      {d.status === 'pendente' && (
        rejecting ? (
          <div className="border-t border-border pt-3 space-y-2">
            <Textarea
              value={rejectReason}
              onChange={(ev) => setRejectReason(ev.target.value)}
              placeholder="Motivo da rejeição (volta pro montador corrigir)…"
              className="min-h-[70px] text-sm"
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
          <div className="flex gap-2 justify-end border-t border-border pt-3">
            <Button variant="outline" size="sm" onClick={onIniciarRejeicao} disabled={processing}
              className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10">
              <XCircle className="w-3.5 h-3.5" /> Rejeitar
            </Button>
            <Button size="sm" onClick={onAprovar} disabled={processing} className="gap-1.5">
              {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Liberar para envio
            </Button>
          </div>
        )
      )}
    </div>
  );
}

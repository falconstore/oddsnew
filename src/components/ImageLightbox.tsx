import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ZoomIn, ZoomOut, RotateCcw, ExternalLink } from 'lucide-react';

// Lightbox com zoom interativo: scroll do mouse aproxima/afasta, clique amplia,
// arrastar navega (pan) quando ampliado. Botões de zoom +/- , reset e abrir
// original. Usado na Revisão e no Envio de Procedimentos.
interface ImageLightboxProps {
  url: string | null;
  onClose: () => void;
}

const MIN = 1;
const MAX = 6;
const STEP = 0.5;

export function ImageLightbox({ url, onClose }: ImageLightboxProps) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragging = useRef<{ x: number; y: number } | null>(null);

  // Reset ao trocar de imagem.
  useEffect(() => { setScale(1); setPos({ x: 0, y: 0 }); }, [url]);

  const clampScale = (s: number) => Math.min(MAX, Math.max(MIN, s));

  const zoomBy = useCallback((delta: number) => {
    setScale((s) => {
      const ns = clampScale(s + delta);
      if (ns === 1) setPos({ x: 0, y: 0 }); // ao voltar pro 1x, recentra
      return ns;
    });
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? STEP : -STEP);
  }, [zoomBy]);

  // Clique simples alterna entre 1x e 2.5x (zoom rápido).
  const onClickImg = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (dragging.current) return;
    setScale((s) => {
      if (s > 1) { setPos({ x: 0, y: 0 }); return 1; }
      return 2.5;
    });
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    dragging.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    setPos({ x: e.clientX - dragging.current.x, y: e.clientY - dragging.current.y });
  };
  const endDrag = () => { setTimeout(() => { dragging.current = null; }, 0); };

  return (
    <Dialog open={!!url} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[96vw] w-[96vw] h-[92vh] p-0 bg-background/95 overflow-hidden">
        {url && (
          <div
            className="relative w-full h-full flex items-center justify-center overflow-hidden"
            onWheel={onWheel}
            onMouseMove={onMouseMove}
            onMouseUp={endDrag}
            onMouseLeave={endDrag}
          >
            <img
              src={url}
              alt="Imagem do procedimento"
              draggable={false}
              onClick={onClickImg}
              onMouseDown={onMouseDown}
              style={{
                transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
                cursor: scale > 1 ? (dragging.current ? 'grabbing' : 'grab') : 'zoom-in',
                transition: dragging.current ? 'none' : 'transform 0.12s ease-out',
              }}
              className="max-w-full max-h-[92vh] object-contain select-none"
            />

            {/* Controles */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-card/90 border border-border rounded-full px-2 py-1.5 shadow-lg">
              <button onClick={() => zoomBy(-STEP)} disabled={scale <= MIN}
                className="p-1.5 rounded-full hover:bg-muted disabled:opacity-30" title="Diminuir">
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs text-muted-foreground w-10 text-center tabular-nums">{Math.round(scale * 100)}%</span>
              <button onClick={() => zoomBy(STEP)} disabled={scale >= MAX}
                className="p-1.5 rounded-full hover:bg-muted disabled:opacity-30" title="Ampliar">
                <ZoomIn className="w-4 h-4" />
              </button>
              <button onClick={() => { setScale(1); setPos({ x: 0, y: 0 }); }}
                className="p-1.5 rounded-full hover:bg-muted" title="Resetar zoom">
                <RotateCcw className="w-4 h-4" />
              </button>
              <a href={url} target="_blank" rel="noopener noreferrer"
                className="p-1.5 rounded-full hover:bg-muted" title="Abrir original em nova aba">
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            <p className="absolute top-3 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground/60">
              scroll pra ampliar · clique pra zoom rápido · arraste pra mover
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

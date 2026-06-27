import { useRef, useState, useCallback } from 'react';
import { ImageIcon, X, ClipboardPaste, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';

// Zona pra adicionar uma imagem por: COLAR (Ctrl+V), arrastar-e-soltar ou
// clicar pra selecionar arquivo. Entrega o File pro pai (que aplica a marca
// d'água). Mostra preview quando já há imagem.
interface PasteImageZoneProps {
  /** dataURL da imagem já processada (com marca d'água), pra preview. */
  previewUrl: string | null;
  /** Recebe o arquivo bruto (do paste/drop/seleção). */
  onFile: (file: File) => void;
  onClear: () => void;
  /** Se fornecido, recebe TODOS os arquivos de imagem (colar/soltar vários de
   *  uma vez). Quando presente, tem prioridade sobre onFile. */
  onFiles?: (files: File[]) => void;
  /** Se fornecido, mostra um botão de lupa no preview pra ampliar a imagem. */
  onZoom?: (url: string) => void;
  label?: string;
  className?: string;
}

export function PasteImageZone({ previewUrl, onFile, onClear, onFiles, onZoom, label, className }: PasteImageZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [active, setActive] = useState(false); // recebeu foco — pronto pra colar

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imgs: File[] = [];
    for (const it of items) {
      if (it.type.startsWith('image/')) {
        const file = it.getAsFile();
        if (file) imgs.push(file);
      }
    }
    if (!imgs.length) return;
    e.preventDefault();
    if (onFiles) onFiles(imgs);
    else onFile(imgs[0]);
  }, [onFile, onFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const all = Array.from(e.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'));
    if (!all.length) return;
    if (onFiles) onFiles(all);
    else onFile(all[0]);
  }, [onFile, onFiles]);

  if (previewUrl) {
    return (
      <div className={cn('relative inline-block group', className)}>
        <button
          type="button"
          onClick={() => onZoom?.(previewUrl)}
          disabled={!onZoom}
          className={cn('block', onZoom && 'cursor-zoom-in')}
          title={onZoom ? 'Ampliar imagem' : undefined}
        >
          <img src={previewUrl} alt="" className="h-24 rounded border border-border object-contain bg-muted" />
          {onZoom && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 rounded transition-colors">
              <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100" />
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onClear}
          className="absolute -top-1.5 -right-1.5 bg-card border border-border rounded-full p-0.5 hover:text-destructive z-10"
          aria-label="Remover imagem"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div
      tabIndex={0}
      onPaste={handlePaste}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        'flex items-center gap-2 rounded border border-dashed px-3 py-2.5 cursor-pointer outline-none transition-colors',
        dragOver || active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
        className,
      )}
    >
      {active ? <ClipboardPaste className="w-4 h-4 text-primary flex-shrink-0" /> : <ImageIcon className="w-4 h-4 text-muted-foreground/60 flex-shrink-0" />}
      <span className="text-[11px] text-muted-foreground/70 leading-tight">
        {active
          ? 'Cole agora (Ctrl+V) ou arraste a imagem aqui'
          : (label ?? 'Clique e cole o bilhete (Ctrl+V), arraste ou selecione')}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={!!onFiles}
        className="hidden"
        onChange={(e) => {
          const all = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'));
          if (!all.length) return;
          if (onFiles) onFiles(all); else onFile(all[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}

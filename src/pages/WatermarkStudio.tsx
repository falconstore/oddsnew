import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import {
  Upload, Copy, Download, RotateCcw, Image as ImageIcon, Stamp,
  Loader2, Sparkles,
} from 'lucide-react';
import {
  DEFAULT_CONFIG, WatermarkConfig, WatermarkPosition, WatermarkFillMode,
  loadImage, fileToDataURL, renderWatermarkedCanvas, canvasToBlob,
} from '@/lib/watermark';
import defaultLogoUrl from '@assets/logo_1778182494299.png';

const ACCEPTED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

const POSITIONS: { value: WatermarkPosition; label: string; aria: string }[] = [
  { value: 'top-left', label: '↖', aria: 'Posição superior esquerda' },
  { value: 'top-center', label: '↑', aria: 'Posição superior centro' },
  { value: 'top-right', label: '↗', aria: 'Posição superior direita' },
  { value: 'middle-left', label: '←', aria: 'Posição meio esquerda' },
  { value: 'middle-center', label: '·', aria: 'Posição centralizada' },
  { value: 'middle-right', label: '→', aria: 'Posição meio direita' },
  { value: 'bottom-left', label: '↙', aria: 'Posição inferior esquerda' },
  { value: 'bottom-center', label: '↓', aria: 'Posição inferior centro' },
  { value: 'bottom-right', label: '↘', aria: 'Posição inferior direita' },
];

export default function WatermarkStudio() {
  const { toast } = useToast();
  const [baseImg, setBaseImg] = useState<HTMLImageElement | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [config, setConfig] = useState<WatermarkConfig>(DEFAULT_CONFIG);
  const [format, setFormat] = useState<'png' | 'jpg'>('png');
  const [quality, setQuality] = useState<number>(92);
  const [filename, setFilename] = useState<string>('imagem-com-marca');
  const [busy, setBusy] = useState<'copy' | 'download' | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Carrega logo padrão
  useEffect(() => {
    loadImage(defaultLogoUrl).then(setLogoImg).catch(() => {
      toast({ title: 'Falha ao carregar logo padrão', variant: 'destructive' });
    });
  }, [toast]);

  const validateFile = useCallback((file: File): string | null => {
    if (!ACCEPTED.includes(file.type)) return 'Formato inválido. Use PNG, JPG ou WEBP.';
    if (file.size > MAX_BYTES) return 'Imagem maior que 10MB.';
    return null;
  }, []);

  const handleBaseFile = useCallback(async (file: File) => {
    const err = validateFile(file);
    if (err) { toast({ title: 'Erro', description: err, variant: 'destructive' }); return; }
    try {
      const dataUrl = await fileToDataURL(file);
      const img = await loadImage(dataUrl);
      setBaseImg(img);
    } catch {
      toast({ title: 'Falha ao carregar imagem', variant: 'destructive' });
    }
  }, [toast, validateFile]);

  const handleLogoFile = useCallback(async (file: File) => {
    const err = validateFile(file);
    if (err) { toast({ title: 'Erro', description: err, variant: 'destructive' }); return; }
    try {
      const dataUrl = await fileToDataURL(file);
      const img = await loadImage(dataUrl);
      setLogoImg(img);
      toast({ title: 'Logo personalizada carregada' });
    } catch {
      toast({ title: 'Falha ao carregar logo', variant: 'destructive' });
    }
  }, [toast, validateFile]);

  // Render preview com debounce leve via requestAnimationFrame
  useEffect(() => {
    if (!baseImg || !logoImg) return;
    let raf = 0;
    const id = window.setTimeout(() => {
      raf = requestAnimationFrame(() => {
        try {
          const canvas = renderWatermarkedCanvas(baseImg, logoImg, config);
          previewRef.current = canvas;
          setPreviewUrl(canvas.toDataURL('image/png'));
        } catch (e) {
          console.error(e);
        }
      });
    }, 40);
    return () => { clearTimeout(id); cancelAnimationFrame(raf); };
  }, [baseImg, logoImg, config]);

  const reset = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    setBaseImg(null);
    setPreviewUrl('');
    toast({ title: 'Editor resetado' });
  }, [toast]);

  const doCopy = useCallback(async () => {
    if (!previewRef.current) return;
    setBusy('copy');
    try {
      const blob = await canvasToBlob(previewRef.current, 'png');
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast({ title: 'Imagem copiada para a área de transferência' });
      } else {
        // Fallback: download
        const a = document.createElement('a');
        const url = URL.createObjectURL(blob);
        a.href = url; a.download = `${filename || 'imagem'}.png`;
        a.click(); URL.revokeObjectURL(url);
        toast({ title: 'Navegador não suporta copiar — baixei o arquivo', variant: 'default' });
      }
    } catch (e) {
      toast({ title: 'Falha ao copiar', description: String(e), variant: 'destructive' });
    } finally { setBusy(null); }
  }, [filename, toast]);

  const doDownload = useCallback(async () => {
    if (!previewRef.current) return;
    setBusy('download');
    try {
      const blob = await canvasToBlob(previewRef.current, format, quality / 100);
      const a = document.createElement('a');
      const url = URL.createObjectURL(blob);
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.href = url;
      a.download = `${filename || 'imagem'}-${ts}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Download iniciado' });
    } catch (e) {
      toast({ title: 'Falha ao baixar', description: String(e), variant: 'destructive' });
    } finally { setBusy(null); }
  }, [format, quality, filename, toast]);

  // Atalhos: Ctrl+V (paste), Ctrl+C (copy result), Ctrl+S (download)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;
      const tag = (e.target as HTMLElement)?.tagName;
      const isField = tag === 'INPUT' || tag === 'TEXTAREA';
      if (e.key.toLowerCase() === 's' && !isField && previewRef.current) {
        e.preventDefault();
        doDownload();
      } else if (e.key.toLowerCase() === 'c' && !isField && previewRef.current) {
        e.preventDefault();
        doCopy();
      }
    };
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) { e.preventDefault(); handleBaseFile(file); return; }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('paste', onPaste);
    };
  }, [doCopy, doDownload, handleBaseFile]);

  const dimensions = useMemo(() => baseImg
    ? `${baseImg.naturalWidth} × ${baseImg.naturalHeight}px`
    : null, [baseImg]);

  return (
    <Layout>
      <TooltipProvider>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                <Stamp className="h-7 w-7 text-primary" />
                <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
                  Marca d'Água
                </span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Aplique a logo Shark sobre prints e imagens. Tudo no navegador, nada vai pro servidor.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px]">Ctrl+V</kbd> colar ·
              <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px]">Ctrl+C</kbd> copiar ·
              <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px]">Ctrl+S</kbd> baixar
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
            {/* Preview */}
            <Card className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-primary" /> Preview
                </CardTitle>
                {dimensions && <span className="text-xs text-muted-foreground font-mono">{dimensions}</span>}
              </CardHeader>
              <CardContent>
                {!baseImg ? (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault(); setDragOver(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleBaseFile(file);
                    }}
                    className={`min-h-[400px] flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed transition-colors ${
                      dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                    }`}
                    data-testid="dropzone-base-image"
                  >
                    <div className="p-4 rounded-full bg-primary/10">
                      <Upload className="h-8 w-8 text-primary" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="font-medium">Arraste uma imagem aqui</p>
                      <p className="text-sm text-muted-foreground">ou clique pra selecionar · ou <kbd className="px-1 py-0.5 rounded bg-muted border text-[10px]">Ctrl+V</kbd> pra colar</p>
                      <p className="text-xs text-muted-foreground">PNG, JPG ou WEBP · até 10MB</p>
                    </div>
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="button-select-image"
                    >
                      <Upload className="h-4 w-4 mr-2" /> Selecionar arquivo
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPTED.join(',')}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleBaseFile(file);
                        e.target.value = '';
                      }}
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative bg-[#0a0a0a] rounded-xl overflow-hidden border flex items-center justify-center min-h-[400px]">
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt="Preview com marca d'água"
                          className="max-w-full max-h-[70vh] object-contain"
                          data-testid="img-watermark-preview"
                        />
                      ) : (
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline" size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        data-testid="button-change-image"
                      >
                        <Upload className="h-4 w-4 mr-2" /> Trocar imagem
                      </Button>
                      <input
                        ref={fileInputRef} type="file"
                        accept={ACCEPTED.join(',')}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleBaseFile(file);
                          e.target.value = '';
                        }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Controles */}
            <div className="space-y-4">
              {/* Logo */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" /> Logo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {logoImg && (
                    <div className="bg-[#0a0a0a] rounded-lg p-3 flex items-center justify-center border">
                      <img src={logoImg.src} alt="Logo atual" className="h-16 object-contain" />
                    </div>
                  )}
                  <Button
                    variant="outline" size="sm" className="w-full"
                    onClick={() => logoInputRef.current?.click()}
                    data-testid="button-change-logo"
                  >
                    <Upload className="h-3.5 w-3.5 mr-2" /> Trocar logo (PNG transparente)
                  </Button>
                  <input
                    ref={logoInputRef} type="file"
                    accept="image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoFile(file);
                      e.target.value = '';
                    }}
                  />
                </CardContent>
              </Card>

              {/* Ajustes */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Ajustes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <SliderRow label="Opacidade" value={config.opacity} unit="%" min={0} max={100} step={1}
                    onChange={(v) => setConfig({ ...config, opacity: v })} testId="slider-opacity" />
                  <SliderRow label="Tamanho" value={config.size} unit="%" min={5} max={100} step={1}
                    onChange={(v) => setConfig({ ...config, size: v })} testId="slider-size" />
                  <SliderRow label="Rotação" value={config.rotation} unit="°" min={-180} max={180} step={1}
                    onChange={(v) => setConfig({ ...config, rotation: v })} testId="slider-rotation" />
                  <SliderRow label="Margem" value={config.margin} unit="px" min={0} max={200} step={1}
                    onChange={(v) => setConfig({ ...config, margin: v })} testId="slider-margin" />

                  <div className="space-y-2">
                    <Label className="text-xs">Posição</Label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {POSITIONS.map((p) => (
                        <Tooltip key={p.value}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setConfig({ ...config, position: p.value })}
                              aria-label={p.aria}
                              aria-pressed={config.position === p.value}
                              title={p.aria}
                              className={`aspect-square rounded-md border text-lg font-bold transition-all ${
                                config.position === p.value
                                  ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_10px_hsl(145_80%_48%/0.5)]'
                                  : 'bg-muted/30 hover:bg-muted hover:border-primary/40'
                              }`}
                              data-testid={`button-position-${p.value}`}
                              disabled={config.fillMode !== 'single'}
                            >
                              {p.label}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{p.value}</TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                    {config.fillMode !== 'single' && (
                      <p className="text-[11px] text-muted-foreground">Posição não se aplica em modo {config.fillMode === 'pattern' ? 'repetido' : 'diagonal'}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Modo de preenchimento</Label>
                    <ToggleGroup
                      type="single" value={config.fillMode}
                      onValueChange={(v) => v && setConfig({ ...config, fillMode: v as WatermarkFillMode })}
                      className="grid grid-cols-3 gap-1.5"
                    >
                      <ToggleGroupItem value="single" data-testid="toggle-fill-single">Única</ToggleGroupItem>
                      <ToggleGroupItem value="pattern" data-testid="toggle-fill-pattern">Repetida</ToggleGroupItem>
                      <ToggleGroupItem value="diagonal" data-testid="toggle-fill-diagonal">Diagonal</ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                </CardContent>
              </Card>

              {/* Exportar */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Exportar</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Nome do arquivo</Label>
                    <Input
                      value={filename}
                      onChange={(e) => setFilename(e.target.value)}
                      placeholder="imagem-com-marca"
                      data-testid="input-filename"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Formato</Label>
                    <RadioGroup
                      value={format}
                      onValueChange={(v) => setFormat(v as 'png' | 'jpg')}
                      className="flex gap-4"
                    >
                      <label className="flex items-center gap-2 cursor-pointer">
                        <RadioGroupItem value="png" data-testid="radio-format-png" /> PNG
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <RadioGroupItem value="jpg" data-testid="radio-format-jpg" /> JPG
                      </label>
                    </RadioGroup>
                  </div>
                  {format === 'jpg' && (
                    <SliderRow label="Qualidade JPG" value={quality} unit="%" min={50} max={100} step={1}
                      onChange={setQuality} testId="slider-quality" />
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Button
                      variant="outline" disabled={!baseImg || busy !== null}
                      onClick={doCopy} data-testid="button-copy"
                    >
                      {busy === 'copy' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Copy className="h-4 w-4 mr-2" />}
                      Copiar
                    </Button>
                    <Button
                      disabled={!baseImg || busy !== null}
                      onClick={doDownload} data-testid="button-download"
                    >
                      {busy === 'download' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                      Baixar
                    </Button>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full text-muted-foreground hover:text-destructive" disabled={!baseImg}
                        data-testid="button-reset">
                        <RotateCcw className="h-3.5 w-3.5 mr-2" /> Resetar tudo
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Resetar editor?</AlertDialogTitle>
                        <AlertDialogDescription>
                          A imagem atual e todos os ajustes voltarão ao padrão. Essa ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={reset} data-testid="button-confirm-reset">Resetar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </TooltipProvider>
    </Layout>
  );
}

function SliderRow({
  label, value, unit, min, max, step, onChange, testId,
}: {
  label: string; value: number; unit: string;
  min: number; max: number; step: number;
  onChange: (v: number) => void; testId?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs font-mono text-primary tabular-nums">{value}{unit}</span>
      </div>
      <Slider
        value={[value]} min={min} max={max} step={step}
        onValueChange={([v]) => onChange(v)}
        data-testid={testId}
      />
    </div>
  );
}

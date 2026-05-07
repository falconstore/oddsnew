export type WatermarkPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'middle-center' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

export type WatermarkFillMode = 'single' | 'pattern' | 'diagonal';

export interface WatermarkConfig {
  opacity: number;
  position: WatermarkPosition;
  size: number;
  fillMode: WatermarkFillMode;
  rotation: number;
  margin: number;
}

export const DEFAULT_CONFIG: WatermarkConfig = {
  opacity: 20,
  position: 'middle-center',
  size: 62,
  fillMode: 'single',
  rotation: 0,
  margin: 0,
};

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Falha ao carregar imagem: ${e}`));
    img.src = src;
  });
}

export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

function computePosition(
  position: WatermarkPosition,
  baseW: number,
  baseH: number,
  logoW: number,
  logoH: number,
  margin: number,
): { x: number; y: number } {
  const [vert, horiz] = position.split('-');
  let x = 0, y = 0;
  if (horiz === 'left') x = margin;
  else if (horiz === 'center') x = (baseW - logoW) / 2;
  else x = baseW - logoW - margin;
  if (vert === 'top') y = margin;
  else if (vert === 'middle') y = (baseH - logoH) / 2;
  else y = baseH - logoH - margin;
  return { x, y };
}

export function renderWatermarkedCanvas(
  baseImg: HTMLImageElement,
  logoImg: HTMLImageElement,
  config: WatermarkConfig,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = baseImg.naturalWidth;
  canvas.height = baseImg.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context não disponível');

  ctx.drawImage(baseImg, 0, 0);

  const logoW = (canvas.width * config.size) / 100;
  const ratio = logoImg.naturalHeight / logoImg.naturalWidth;
  const logoH = logoW * ratio;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, config.opacity / 100));

  if (config.fillMode === 'single') {
    const { x, y } = computePosition(
      config.position,
      canvas.width,
      canvas.height,
      logoW,
      logoH,
      config.margin,
    );
    drawRotated(ctx, logoImg, x, y, logoW, logoH, config.rotation);
  } else if (config.fillMode === 'pattern') {
    const stepX = logoW * 1.6;
    const stepY = logoH * 1.6;
    for (let y = 0; y < canvas.height; y += stepY) {
      for (let x = 0; x < canvas.width; x += stepX) {
        drawRotated(ctx, logoImg, x, y, logoW, logoH, config.rotation);
      }
    }
  } else {
    const diag = Math.sqrt(canvas.width ** 2 + canvas.height ** 2);
    const stepX = logoW * 1.8;
    const stepY = logoH * 1.8;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((-30 * Math.PI) / 180);
    for (let y = -diag; y < diag; y += stepY) {
      for (let x = -diag; x < diag; x += stepX) {
        drawRotated(ctx, logoImg, x, y, logoW, logoH, config.rotation);
      }
    }
  }
  ctx.restore();
  return canvas;
}

function drawRotated(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number,
  w: number, h: number,
  rotation: number,
) {
  if (!rotation) {
    ctx.drawImage(img, x, y, w, h);
    return;
  }
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: 'png' | 'jpg' = 'png',
  quality = 0.92,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar blob'))),
      mime,
      format === 'jpg' ? quality : undefined,
    );
  });
}

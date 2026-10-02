import { luminance, mix } from './color';
import { initials, subtitle, type Profile } from './profile';
import { drawCirclePhoto, drawQr, fontStack, type DotStyle, type QrLayout } from './qr';

export interface Device {
  id: string;
  label: string;
  width: number;
  height: number;
}

export const DEVICES: Device[] = [
  { id: 'iphone-6.9', label: 'iPhone 16 Pro Max · 17 Pro Max', width: 1320, height: 2868 },
  { id: 'iphone-6.7', label: 'iPhone 15 Pro Max · 16 Plus', width: 1290, height: 2796 },
  { id: 'iphone-air', label: 'iPhone Air', width: 1260, height: 2736 },
  { id: 'iphone-6.3', label: 'iPhone 16 Pro · 17 · 17 Pro', width: 1206, height: 2622 },
  { id: 'iphone-6.1', label: 'iPhone 15 · 15 Pro · 16', width: 1179, height: 2556 },
  { id: 'iphone-se', label: 'iPhone SE', width: 750, height: 1334 },
  { id: 'android-fhd', label: 'Android, Full HD+', width: 1080, height: 2400 },
  { id: 'android-qhd', label: 'Android, Quad HD+', width: 1440, height: 3120 },
];

/** The phone this page runs on, at its native resolution. Null on desktops. */
export function detectDevice(): Device | null {
  if (typeof window === 'undefined') return null;
  const touch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const short = Math.min(screen.width, screen.height);
  // Phones only: tablets and touch laptops get a phone preset instead.
  if (!touch || short >= 600) return null;
  const dpr = window.devicePixelRatio || 1;
  const width = Math.round(short * dpr);
  const height = Math.round(Math.max(screen.width, screen.height) * dpr);
  if (width < 600 || height < 1000) return null;
  return { id: 'this', label: 'This phone', width, height };
}

export function resolveDevice(id: string): Device {
  if (id === 'auto') return detectDevice() ?? DEVICES[3];
  return DEVICES.find((d) => d.id === id) ?? DEVICES[3];
}

export interface Backdrop {
  id: string;
  label: string;
  stops: string[];
}

export const BACKDROPS: Backdrop[] = [
  { id: 'midnight', label: 'Midnight', stops: ['#0b1023', '#1e1b4b', '#3730a3'] },
  { id: 'aurora', label: 'Aurora', stops: ['#03201f', '#0f766e', '#2dd4bf'] },
  { id: 'sunset', label: 'Sunset', stops: ['#1f1147', '#9d174d', '#fb923c'] },
  { id: 'ocean', label: 'Ocean', stops: ['#082f49', '#0369a1', '#7dd3fc'] },
  { id: 'graphite', label: 'Graphite', stops: ['#0a0a0b', '#1f1f23', '#3f3f46'] },
  { id: 'sand', label: 'Sand', stops: ['#fbf8f3', '#efe5d6', '#dcc9ad'] },
  { id: 'mist', label: 'Mist', stops: ['#f8fafc', '#e2e8f0', '#b8c4d6'] },
];

export function accentBackdrop(accent: string): Backdrop {
  return { id: 'accent', label: 'Your color', stops: [mix(accent, '#000000', 0.7), mix(accent, '#000000', 0.3), accent] };
}

export interface WallpaperSettings {
  /** A DEVICES id, or "auto" for the phone this runs on. */
  device: string;
  /** A BACKDROPS id, "accent", "solid" or "image". */
  backdrop: string;
  solid: string;
  /** Darkening over a photo background, 0 to 0.7. */
  dim: number;
  layout: 'card' | 'minimal';
  /** Vertical centre of the card, as a fraction of the screen height. */
  y: number;
  /** QR code width, as a fraction of the screen width. */
  scale: number;
  caption: string;
}

export const DEFAULT_WALLPAPER: WallpaperSettings = {
  device: 'auto',
  backdrop: 'accent',
  solid: '#1e293b',
  dim: 0.25,
  layout: 'card',
  y: 0.63,
  scale: 0.55,
  caption: 'Scan to save my contact',
};

export interface Scene {
  width: number;
  height: number;
  settings: WallpaperSettings;
  profile: Profile;
  qr: QrLayout;
  qrColor: string;
  dots: DotStyle;
  photo: HTMLImageElement | null;
  background: HTMLImageElement | null;
}

/** Where the card landed, as fractions of the screen height. */
export interface Placement {
  top: number;
  bottom: number;
}

function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

const imageTone = new WeakMap<HTMLImageElement, number>();

/** Average luminance of an image, sampled at 16×16. */
function averageLuminance(img: HTMLImageElement): number {
  const cached = imageTone.get(img);
  if (cached !== undefined) return cached;
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, 16, 16);
  const px = ctx.getImageData(0, 0, 16, 16).data;
  let sum = 0;
  for (let i = 0; i < px.length; i += 4) sum += (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
  const value = sum / (px.length / 4);
  imageTone.set(img, value);
  return value;
}

/** Paints the background and reports whether it reads as dark. */
function paintBackground(ctx: CanvasRenderingContext2D, s: Scene): boolean {
  const { width: W, height: H, settings } = s;
  if (settings.backdrop === 'image' && s.background) {
    cover(ctx, s.background, W, H);
    if (settings.dim > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${settings.dim})`;
      ctx.fillRect(0, 0, W, H);
    }
    return averageLuminance(s.background) * (1 - settings.dim) < 0.55;
  }
  if (settings.backdrop === 'solid' || settings.backdrop === 'image') {
    ctx.fillStyle = settings.solid;
    ctx.fillRect(0, 0, W, H);
    return luminance(settings.solid) < 0.4;
  }
  const backdrop =
    settings.backdrop === 'accent'
      ? accentBackdrop(s.profile.accent)
      : (BACKDROPS.find((b) => b.id === settings.backdrop) ?? BACKDROPS[0]);
  const gradient = ctx.createLinearGradient(0, 0, W * 0.45, H);
  backdrop.stops.forEach((stop, i) => gradient.addColorStop(i / (backdrop.stops.length - 1), stop));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  // A soft glow keeps flat gradients from looking banded and adds depth.
  const glow = ctx.createRadialGradient(W * 0.15, H * 0.1, 0, W * 0.15, H * 0.1, W * 1.1);
  glow.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  return luminance(backdrop.stops[1]) < 0.4;
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let chars = Array.from(text);
  while (chars.length > 1 && ctx.measureText(chars.join('') + '…').width > maxWidth) chars = chars.slice(0, -1);
  return chars.join('').trimEnd() + '…';
}

interface CardMetrics {
  pad: number;
  gap: number;
  /** The name row: a small photo beside the name and title. Zero when there is no name. */
  rowH: number;
  avatarR: number;
  nameSize: number;
  subSize: number;
  captionSize: number;
  width: number;
  height: number;
}

function cardMetrics(qrPx: number, s: Scene): CardMetrics {
  const module = qrPx / s.qr.size;
  // Keep at least three modules of white around the code for scanners.
  const pad = Math.max(qrPx * 0.085, module * 3);
  const gap = Math.max(qrPx * 0.056, module * 2.5);
  const avatarR = qrPx * 0.09;
  const nameSize = qrPx * 0.08;
  const subSize = qrPx * 0.056;
  const captionSize = qrPx * 0.065;
  const text = s.profile.name.trim() ? nameSize * 1.25 + (subtitle(s.profile) ? subSize * 1.35 : 0) : 0;
  const rowH = text ? Math.max(avatarR * 2, text) : 0;
  let height = pad * 0.85 + (rowH ? rowH + gap : 0) + qrPx;
  height += s.settings.caption.trim() ? gap + captionSize * 1.2 + pad * 0.75 : pad;
  return { pad, gap, rowH, avatarR, nameSize, subSize, captionSize, width: qrPx + pad * 2, height };
}

function drawAvatar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, s: Scene) {
  if (s.photo) {
    drawCirclePhoto(ctx, s.photo, cx, cy, r);
    return;
  }
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  g.addColorStop(0, mix(s.profile.accent, '#ffffff', 0.15));
  g.addColorStop(1, mix(s.profile.accent, '#000000', 0.2));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = fontStack(700, r * 0.78);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials(s.profile.name) || '?', cx, cy + r * 0.04);
}

function qrPaint(s: Scene) {
  return {
    fg: s.qrColor,
    dots: s.dots,
    quiet: 0,
    photo: s.photo,
    initials: initials(s.profile.name),
  };
}

/** Draws a small QR glyph, the same mark the app shows beside its captions. */
function drawQrGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  const u = size / 7;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = u * 0.75;
  for (const [gx, gy] of [
    [0, 0],
    [4, 0],
    [0, 4],
  ]) {
    ctx.beginPath();
    ctx.roundRect(x + gx * u + u * 0.4, y + gy * u + u * 0.4, u * 2.2, u * 2.2, u * 0.4);
    ctx.stroke();
  }
  ctx.fillRect(x + 4.4 * u, y + 4.4 * u, u, u);
  ctx.fillRect(x + 5.8 * u, y + 5.8 * u, u, u);
  ctx.restore();
}

function drawCard(ctx: CanvasRenderingContext2D, s: Scene, qrPx: number): Placement {
  const { width: W, height: H } = s;
  const m = cardMetrics(qrPx, s);
  const top = Math.min(Math.max(s.settings.y * H - m.height / 2, H * 0.03), H * 0.97 - m.height);
  const cx = W / 2;
  const cardX = cx - m.width / 2;

  ctx.save();
  ctx.shadowColor = 'rgba(2, 6, 23, 0.4)';
  ctx.shadowBlur = qrPx * 0.18;
  ctx.shadowOffsetY = qrPx * 0.07;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(cardX, top, m.width, m.height, qrPx * 0.12);
  ctx.fill();
  ctx.restore();

  let y = top + m.pad * 0.85;
  const left = cx - qrPx / 2;
  if (m.rowH) {
    const mid = y + m.rowH / 2;
    drawAvatar(ctx, left + m.avatarR, mid, m.avatarR, s);
    const textX = left + m.avatarR * 2 + qrPx * 0.047;
    const maxText = left + qrPx - textX;
    const sub = subtitle(s.profile);
    const block = m.nameSize * 1.25 + (sub ? m.subSize * 1.35 : 0);
    let ty = mid - block / 2;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#0f172a';
    ctx.font = fontStack(700, m.nameSize);
    ctx.fillText(fitText(ctx, s.profile.name.trim(), maxText), textX, ty + m.nameSize * 0.98);
    ty += m.nameSize * 1.25;
    if (sub) {
      ctx.fillStyle = '#475569';
      ctx.font = fontStack(500, m.subSize);
      ctx.fillText(fitText(ctx, sub, maxText), textX, ty + m.subSize * 1.05);
    }
    y += m.rowH + m.gap;
  }

  drawQr(ctx, s.qr, left, y, qrPx, qrPaint(s));
  y += qrPx;

  const caption = s.settings.caption.trim();
  if (caption) {
    y += m.gap;
    ctx.font = fontStack(700, m.captionSize);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    const glyph = m.captionSize * 1.05;
    const space = m.captionSize * 0.45;
    const text = fitText(ctx, caption, m.width - m.pad * 1.5 - glyph - space);
    const total = glyph + space + ctx.measureText(text).width;
    const x0 = cx - total / 2;
    drawQrGlyph(ctx, x0, y + m.captionSize * 0.05, glyph, '#2d3040');
    ctx.fillStyle = '#2d3040';
    ctx.fillText(text, x0 + glyph + space, y + m.captionSize * 0.95);
  }
  return { top: top / H, bottom: (top + m.height) / H };
}

function drawMinimal(ctx: CanvasRenderingContext2D, s: Scene, qrPx: number, darkBackground: boolean): Placement {
  const { width: W, height: H } = s;
  const pad = Math.max(qrPx * 0.08, (qrPx / s.qr.size) * 3);
  const tile = qrPx + pad * 2;
  const caption = s.settings.caption.trim();
  const captionSize = qrPx * 0.055;
  const total = tile + (caption ? captionSize * 2.4 : 0);
  const top = Math.min(Math.max(s.settings.y * H - total / 2, H * 0.03), H * 0.97 - total);
  const x = (W - tile) / 2;

  ctx.save();
  ctx.shadowColor = 'rgba(2, 6, 23, 0.3)';
  ctx.shadowBlur = qrPx * 0.12;
  ctx.shadowOffsetY = qrPx * 0.03;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(x, top, tile, tile, tile * 0.1);
  ctx.fill();
  ctx.restore();
  drawQr(ctx, s.qr, x + pad, top + pad, qrPx, qrPaint(s));

  if (caption) {
    ctx.save();
    ctx.font = fontStack(600, captionSize);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = darkBackground ? '#ffffff' : '#0f172a';
    if (darkBackground) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = captionSize * 0.4;
    }
    ctx.fillText(fitText(ctx, caption, W * 0.86), W / 2, top + tile + captionSize * 1.9);
    ctx.restore();
  }
  return { top: top / H, bottom: (top + total) / H };
}

export function drawWallpaper(ctx: CanvasRenderingContext2D, s: Scene): Placement {
  ctx.clearRect(0, 0, s.width, s.height);
  const dark = paintBackground(ctx, s);
  const qrPx = Math.round(s.width * s.settings.scale);
  return s.settings.layout === 'card' ? drawCard(ctx, s, qrPx) : drawMinimal(ctx, s, qrPx, dark);
}

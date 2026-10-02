import { isHexColor } from './color';
import type { DotStyle } from './qr';
import { BACKDROPS, DEFAULT_WALLPAPER, DEVICES, type WallpaperSettings } from './wallpaper';

export interface Settings {
  /** What a scan opens: the profile page, or a contact card that needs no internet. */
  qrMode: 'page' | 'vcard';
  /** Instant links carry the profile inside the URL; short links load profile.json. */
  linkStyle: 'instant' | 'short';
  /** Public address of this app. Empty means the address it is served from. */
  siteUrl: string;
  dots: DotStyle;
  qrColor: 'accent' | 'black';
  centerPhoto: boolean;
  wallpaper: WallpaperSettings;
}

export function defaultSettings(): Settings {
  return {
    qrMode: 'page',
    linkStyle: 'instant',
    siteUrl: '',
    dots: 'rounded',
    qrColor: 'accent',
    centerPhoto: false,
    wallpaper: { ...DEFAULT_WALLPAPER },
  };
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function num(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export function sanitizeSettings(raw: unknown): Settings {
  const d = defaultSettings();
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const w = (r.wallpaper && typeof r.wallpaper === 'object' ? r.wallpaper : {}) as Record<string, unknown>;
  const dw = d.wallpaper;
  return {
    qrMode: pick(r.qrMode, ['page', 'vcard'], d.qrMode),
    linkStyle: pick(r.linkStyle, ['instant', 'short'], d.linkStyle),
    siteUrl: typeof r.siteUrl === 'string' ? r.siteUrl.slice(0, 300) : '',
    dots: pick(r.dots, ['square', 'rounded', 'dots'], d.dots),
    qrColor: pick(r.qrColor, ['accent', 'black'], d.qrColor),
    centerPhoto: typeof r.centerPhoto === 'boolean' ? r.centerPhoto : d.centerPhoto,
    wallpaper: {
      device: pick(w.device, ['auto', ...DEVICES.map((x) => x.id)], dw.device),
      backdrop: pick(w.backdrop, ['accent', 'solid', 'image', ...BACKDROPS.map((b) => b.id)], dw.backdrop),
      solid: isHexColor(w.solid) ? w.solid : dw.solid,
      dim: num(w.dim, 0, 0.7, dw.dim),
      layout: pick(w.layout, ['card', 'minimal'], dw.layout),
      y: num(w.y, 0.2, 0.85, dw.y),
      scale: num(w.scale, 0.35, 0.7, dw.scale),
      caption: typeof w.caption === 'string' ? w.caption.slice(0, 60) : dw.caption,
    },
  };
}

import { Download, ImagePlus, Share, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useImage } from '../hooks';
import { fileToBackground } from '../lib/image';
import type { Profile } from '../lib/profile';
import type { QrLayout } from '../lib/qr';
import type { Settings } from '../lib/settings';
import { canvasToBlob, isTouchDevice, saveOrShareFile } from '../lib/share';
import {
  BACKDROPS,
  DEVICES,
  accentBackdrop,
  detectDevice,
  drawWallpaper,
  resolveDevice,
  type Placement,
  type WallpaperSettings,
} from '../lib/wallpaper';
import { Hint, Section, Segmented, Slider } from './ui';

function LockScreenOverlay() {
  const now = new Date();
  const date = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const time = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, '');
  return (
    <div className="lock-overlay" aria-hidden="true">
      <span className="lock-island" />
      <span className="lock-date">{date}</span>
      <span className="lock-time">{time}</span>
      <span className="lock-button lock-left" />
      <span className="lock-button lock-right" />
      <span className="lock-home" />
    </div>
  );
}

function gradientCss(stops: string[]) {
  return `linear-gradient(160deg, ${stops.join(', ')})`;
}

export function WallpaperStudio({
  profile,
  settings,
  onSettings,
  layout,
  fg,
  photo,
  backgroundImage,
  onBackgroundImage,
  notify,
}: {
  profile: Profile;
  settings: Settings;
  onSettings: (s: Settings) => void;
  layout: QrLayout | null;
  fg: string;
  photo: HTMLImageElement | null;
  backgroundImage: string;
  onBackgroundImage: (dataUrl: string) => void;
  notify: (message: string) => void;
}) {
  const ws = settings.wallpaper;
  const set = (patch: Partial<WallpaperSettings>) => onSettings({ ...settings, wallpaper: { ...ws, ...patch } });
  const device = resolveDevice(ws.device);
  const thisPhone = useMemo(detectDevice, []);
  const background = useImage(backgroundImage);
  const canvas = useRef<HTMLCanvasElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [overlay, setOverlay] = useState(true);
  const [busy, setBusy] = useState(false);

  // Encoded ahead of time: iOS only opens the share sheet straight from a tap,
  // and encoding a full-size PNG after the tap can take too long.
  const encoded = useRef<Promise<Blob> | null>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el || !layout) return;
    encoded.current = null;
    let timer: ReturnType<typeof setTimeout>;
    const frame = requestAnimationFrame(() => {
      el.width = device.width;
      el.height = device.height;
      setPlacement(
        drawWallpaper(el.getContext('2d')!, {
          width: device.width,
          height: device.height,
          settings: ws,
          profile,
          qr: layout,
          qrColor: fg,
          dots: settings.dots,
          photo,
          background,
        }),
      );
      timer = setTimeout(() => {
        encoded.current = canvasToBlob(el);
      }, 400);
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [device.width, device.height, ws, profile, layout, fg, settings.dots, photo, background]);

  async function save() {
    if (!canvas.current) return;
    setBusy(true);
    try {
      const blob = await (encoded.current ?? canvasToBlob(canvas.current));
      const result = await saveOrShareFile(blob, 'qr-wallpaper.png', isTouchDevice());
      if (result === 'downloaded') notify('Wallpaper downloaded');
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File) {
    try {
      onBackgroundImage(await fileToBackground(file));
      set({ backdrop: 'image' });
    } catch {
      notify('That image couldn’t be read');
    }
  }

  const clockClash = placement !== null && placement.top < 0.3;
  const bottomClash = placement !== null && placement.bottom > 0.87;
  const swatches = [accentBackdrop(profile.accent), ...BACKDROPS];

  return (
    <div className="workspace">
      <div className="stage stage-wallpaper">
        <div className="phone" style={{ aspectRatio: `${device.width} / ${device.height}` }}>
          <canvas ref={canvas} className="phone-canvas" role="img" aria-label="Wallpaper preview" />
          {overlay && <LockScreenOverlay />}
        </div>
        <label className="overlay-toggle">
          <input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} />
          Show lock screen clock
        </label>
        <div className="stage-actions">
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy || !layout}>
            {isTouchDevice() ? <Share size={18} aria-hidden="true" /> : <Download size={18} aria-hidden="true" />}
            {isTouchDevice() ? 'Save wallpaper' : 'Download wallpaper'}
          </button>
        </div>
        <p className="stage-meta">
          {device.width} × {device.height} px
        </p>
      </div>

      <div className="controls">
        {(clockClash || bottomClash) && (
          <Hint tone="warn">
            {clockClash
              ? 'The clock may cover part of your card. Move it lower or make it smaller.'
              : 'The flashlight and camera buttons may cover part of your card. Move it up or make it smaller.'}
          </Hint>
        )}

        <Section title="Phone" flush>
          <div className="group group-pad">
            <select className="select" value={ws.device} onChange={(e) => set({ device: e.target.value })} aria-label="Phone model">
              <option value="auto">
                {thisPhone
                  ? `This phone (${thisPhone.width} × ${thisPhone.height})`
                  : `Automatic: ${resolveDevice('auto').label} (${resolveDevice('auto').width} × ${resolveDevice('auto').height})`}
              </option>
              {DEVICES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label} ({d.width} × {d.height})
                </option>
              ))}
            </select>
          </div>
        </Section>

        <Section title="Background" flush>
          <div className="group group-pad">
            <div className="swatches swatches-lg" role="radiogroup" aria-label="Background">
              {swatches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="radio"
                  aria-checked={ws.backdrop === b.id}
                  aria-label={b.label}
                  title={b.label}
                  className="swatch swatch-tall"
                  style={{ background: gradientCss(b.stops) }}
                  onClick={() => set({ backdrop: b.id })}
                />
              ))}
              <label
                className="swatch swatch-tall swatch-custom"
                role="radio"
                aria-checked={ws.backdrop === 'solid'}
                title="Solid color"
                style={{ background: ws.solid }}
              >
                <input
                  type="color"
                  value={ws.solid}
                  onChange={(e) => set({ backdrop: 'solid', solid: e.target.value })}
                  onClick={() => set({ backdrop: 'solid' })}
                  aria-label="Solid color"
                />
              </label>
              <button
                type="button"
                role="radio"
                aria-checked={ws.backdrop === 'image'}
                aria-label="Your photo"
                title="Your photo"
                className="swatch swatch-tall swatch-upload"
                style={backgroundImage ? { backgroundImage: `url(${backgroundImage})` } : undefined}
                onClick={() => (backgroundImage ? set({ backdrop: 'image' }) : fileInput.current?.click())}
              >
                {!backgroundImage && <ImagePlus size={20} aria-hidden="true" />}
              </button>
            </div>
            {ws.backdrop === 'image' && backgroundImage && (
              <div className="bg-tools">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileInput.current?.click()}>
                  <ImagePlus size={16} aria-hidden="true" />
                  Change photo
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-danger"
                  onClick={() => {
                    onBackgroundImage('');
                    set({ backdrop: 'accent' });
                  }}
                >
                  <X size={16} aria-hidden="true" />
                  Remove
                </button>
              </div>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFile(file);
                e.target.value = '';
              }}
            />
          </div>
          {ws.backdrop === 'image' && backgroundImage && (
            <div className="group">
              <Slider label="Darken" value={ws.dim} min={0} max={0.7} step={0.05} onChange={(dim) => set({ dim })} format={(v) => `${Math.round(v * 100)}%`} />
            </div>
          )}
        </Section>

        <Section title="Layout" flush>
          <div className="group">
            <div className="row">
              <span className="row-title">Style</span>
              <Segmented
                label="Wallpaper layout"
                value={ws.layout}
                onChange={(l) => set({ layout: l })}
                options={[
                  { value: 'card', label: 'Card' },
                  { value: 'minimal', label: 'QR only' },
                ]}
              />
            </div>
            <Slider label="Size" value={ws.scale} min={0.35} max={0.7} step={0.01} onChange={(scale) => set({ scale })} format={(v) => `${Math.round(v * 100)}%`} />
            <Slider label="Position" value={ws.y} min={0.2} max={0.85} step={0.01} onChange={(y) => set({ y })} format={(v) => `${Math.round(v * 100)}%`} />
            <div className="field">
              <label htmlFor="caption">Caption</label>
              <input id="caption" value={ws.caption} maxLength={60} placeholder="Scan to save my contact" onChange={(e) => set({ caption: e.target.value })} />
            </div>
          </div>
        </Section>

        <Section title="Set it as your wallpaper" flush>
          <div className="group group-pad howto">
            <p>
              <strong>iPhone:</strong> Tap <em>Save wallpaper</em>, then <em>Save Image</em>. In Photos, open it, tap <em>Share → Use as Wallpaper</em>, and
              pick your Lock Screen. Turn off <em>Depth Effect</em> so the code stays sharp and in place.
            </p>
            <p>
              <strong>Android:</strong> Save the image, open it in Photos or Gallery, then tap <em>⋮ → Use as → Wallpaper → Lock screen</em>.
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
}

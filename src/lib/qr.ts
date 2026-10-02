import { create } from 'qrcode';

export type Ecc = 'L' | 'M' | 'Q' | 'H';
export type DotStyle = 'square' | 'rounded' | 'dots';

export interface QrLayout {
  /** Modules per side, not counting the quiet zone. */
  size: number;
  version: number;
  /** Dark modules outside the finder patterns and the photo hole, as [row, col]. */
  modules: Array<[number, number]>;
  /** Top-left [row, col] of the three 7×7 finder patterns. */
  finders: Array<[number, number]>;
  /** Square module range [start, end) kept clear for a centre photo. */
  hole: { start: number; end: number } | null;
}

/**
 * Builds the module layout for `text`. With `hole`, the centre is cleared for a
 * photo and error correction goes up to Q (25%) so the code still reads.
 */
export function layoutQr(text: string, opts: { hole?: boolean; ecc?: Ecc } = {}): QrLayout {
  const ecc = opts.ecc ?? (opts.hole ? 'Q' : 'M');
  const qr = create(text, { errorCorrectionLevel: ecc });
  const n = qr.modules.size;
  const data = qr.modules.data;

  let hole: QrLayout['hole'] = null;
  if (opts.hole) {
    let span = Math.round(n * 0.22);
    if ((n - span) % 2 !== 0) span += 1;
    hole = { start: (n - span) / 2, end: (n + span) / 2 };
  }

  const modules: Array<[number, number]> = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!data[r * n + c]) continue;
      if ((r < 7 && (c < 7 || c >= n - 7)) || (r >= n - 7 && c < 7)) continue;
      if (hole && r >= hole.start && r < hole.end && c >= hole.start && c < hole.end) continue;
      modules.push([r, c]);
    }
  }
  return {
    size: n,
    version: qr.version,
    modules,
    finders: [
      [0, 0],
      [0, n - 7],
      [n - 7, 0],
    ],
    hole,
  };
}

export interface QrPaint {
  fg: string;
  dots: DotStyle;
  /** Quiet-zone width, in modules. */
  quiet: number;
  /** Background fill. Omit to leave the area transparent. */
  bg?: string;
  /** Centre photo; used only when the layout has a hole. */
  photo?: HTMLImageElement | null;
  /** Shown in the hole when there is no photo. */
  initials?: string;
}

/** Corner radii of a finder pattern's ring, cut-out and eye, in modules. */
function finderRadii(dots: DotStyle): [number, number, number] {
  if (dots === 'dots') return [3.5, 2.5, 1.5];
  if (dots === 'rounded') return [2.1, 1.4, 0.9];
  return [0, 0, 0];
}

function addModule(ctx: CanvasRenderingContext2D, x: number, y: number, m: number, dots: DotStyle) {
  if (dots === 'square') {
    ctx.rect(x, y, m, m);
  } else if (dots === 'dots') {
    ctx.moveTo(x + m * 0.96, y + m / 2);
    ctx.arc(x + m / 2, y + m / 2, m * 0.46, 0, Math.PI * 2);
  } else {
    const g = m * 0.04;
    ctx.roundRect(x + g, y + g, m - 2 * g, m - 2 * g, m * 0.3);
  }
}

export function fontStack(weight: number, px: number): string {
  return `${weight} ${px}px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
}

/** Draws a square photo, cropped to cover a circle of radius `r`. */
export function drawCirclePhoto(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, r: number) {
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, sx, sy, side, side, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

/** Paints the code into the square at (x, y) with side `px`, quiet zone included. */
export function drawQr(ctx: CanvasRenderingContext2D, layout: QrLayout, x: number, y: number, px: number, paint: QrPaint) {
  const m = px / (layout.size + paint.quiet * 2);
  const ox = x + paint.quiet * m;
  const oy = y + paint.quiet * m;
  ctx.save();
  if (paint.bg) {
    ctx.fillStyle = paint.bg;
    ctx.fillRect(x, y, px, px);
  }
  ctx.fillStyle = paint.fg;

  // One path, one fill: avoids hairline seams between neighbouring modules.
  ctx.beginPath();
  for (const [r, c] of layout.modules) addModule(ctx, ox + c * m, oy + r * m, m, paint.dots);
  ctx.fill();

  const [ring, cut, eye] = finderRadii(paint.dots);
  for (const [r, c] of layout.finders) {
    const fx = ox + c * m;
    const fy = oy + r * m;
    ctx.beginPath();
    ctx.roundRect(fx, fy, 7 * m, 7 * m, ring * m);
    ctx.roundRect(fx + m, fy + m, 5 * m, 5 * m, cut * m);
    ctx.fill('evenodd');
    ctx.beginPath();
    ctx.roundRect(fx + 2 * m, fy + 2 * m, 3 * m, 3 * m, eye * m);
    ctx.fill();
  }

  if (layout.hole) {
    const span = (layout.hole.end - layout.hole.start) * m;
    const cx = ox + layout.hole.start * m + span / 2;
    const cy = oy + layout.hole.start * m + span / 2;
    const r = span / 2 - m * 0.35;
    if (paint.photo) {
      drawCirclePhoto(ctx, paint.photo, cx, cy, r);
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      if (paint.initials) {
        ctx.fillStyle = '#ffffff';
        ctx.font = fontStack(700, r * 0.8);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(paint.initials, cx, cy + r * 0.04);
      }
    }
  }
  ctx.restore();
}

function roundRectPath(x: number, y: number, w: number, h: number, r: number): string {
  if (r <= 0) return `M${x} ${y}h${w}v${h}h${-w}z`;
  return (
    `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}` +
    `h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`
  );
}

const round = (v: number) => Math.round(v * 1000) / 1000;

/** The same drawing as `drawQr`, as a standalone SVG document in module units. */
export function qrSvg(layout: QrLayout, paint: QrPaint & { photoHref?: string }): string {
  const q = paint.quiet;
  const total = layout.size + q * 2;
  const parts: string[] = [];

  if (paint.dots === 'square') {
    // Merge horizontal runs to keep the file small.
    const rows = new Map<number, number[]>();
    for (const [r, c] of layout.modules) (rows.get(r) ?? rows.set(r, []).get(r)!).push(c);
    for (const [r, cols] of rows) {
      cols.sort((a, b) => a - b);
      for (let i = 0; i < cols.length; ) {
        let j = i;
        while (j + 1 < cols.length && cols[j + 1] === cols[j] + 1) j++;
        parts.push(`M${cols[i] + q} ${r + q}h${j - i + 1}v1h${-(j - i + 1)}z`);
        i = j + 1;
      }
    }
  } else if (paint.dots === 'dots') {
    for (const [r, c] of layout.modules) {
      parts.push(`M${c + q + 0.04} ${r + q + 0.5}a0.46 0.46 0 1 0 0.92 0a0.46 0.46 0 1 0 -0.92 0z`);
    }
  } else {
    for (const [r, c] of layout.modules) parts.push(roundRectPath(c + q + 0.04, r + q + 0.04, 0.92, 0.92, 0.3));
  }

  const [ring, cut, eye] = finderRadii(paint.dots);
  const finderRings: string[] = [];
  for (const [r, c] of layout.finders) {
    const x = c + q;
    const y = r + q;
    finderRings.push(roundRectPath(x, y, 7, 7, ring) + roundRectPath(x + 1, y + 1, 5, 5, cut));
    parts.push(roundRectPath(x + 2, y + 2, 3, 3, eye));
  }

  let centre = '';
  if (layout.hole) {
    const span = layout.hole.end - layout.hole.start;
    const c = round(layout.hole.start + q + span / 2);
    const r = round(span / 2 - 0.35);
    if (paint.photoHref) {
      centre =
        `<clipPath id="p"><circle cx="${c}" cy="${c}" r="${r}"/></clipPath>` +
        `<image href="${paint.photoHref}" x="${round(c - r)}" y="${round(c - r)}" width="${round(r * 2)}" height="${round(r * 2)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#p)"/>`;
    } else {
      centre = `<circle cx="${c}" cy="${c}" r="${r}" fill="${paint.fg}"/>`;
      if (paint.initials) {
        centre += `<text x="${c}" y="${c}" fill="#fff" font-family="-apple-system, Segoe UI, Roboto, Arial, sans-serif" font-weight="700" font-size="${round(r * 0.8)}" text-anchor="middle" dominant-baseline="central">${paint.initials.replace(/[<&>"]/g, '')}</text>`;
      }
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="1024" height="1024" shape-rendering="${paint.dots === 'square' ? 'crispEdges' : 'geometricPrecision'}">` +
    (paint.bg ? `<rect width="${total}" height="${total}" fill="${paint.bg}"/>` : '') +
    `<path fill="${paint.fg}" fill-rule="evenodd" d="${finderRings.join('')}"/>` +
    `<path fill="${paint.fg}" d="${parts.join('')}"/>` +
    centre +
    `</svg>`
  );
}

export type Readability = { level: 0 | 1 | 2 | 3; label: string };

/** How easy the code is to scan from a screen, judged by module count. */
export function readability(layout: QrLayout): Readability {
  const n = layout.size;
  if (n <= 33) return { level: 0, label: 'Very easy to scan' };
  if (n <= 49) return { level: 1, label: 'Easy to scan' };
  if (n <= 65) return { level: 2, label: 'Fine for most phones' };
  return { level: 3, label: 'Dense, may scan slowly' };
}

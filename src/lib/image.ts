export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Remote images must allow CORS, or the canvas could not be exported.
    if (/^https?:/i.test(src)) img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image failed to load'));
    img.src = src;
  });
}

async function withFileImage<T>(file: File, use: (img: HTMLImageElement) => T): Promise<T> {
  const url = URL.createObjectURL(file);
  try {
    return use(await loadImage(url));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Square-crops a photo to a JPEG data URL. Portraits keep the upper part, where faces usually are. */
export function fileToAvatar(file: File, size = 480): Promise<string> {
  return withFileImage(file, (img) => {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const side = Math.min(w, h);
    const sx = (w - side) / 2;
    const sy = h > w ? (h - side) * 0.2 : (h - side) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.86);
  });
}

/** Scales a background photo to fit within `maxSide` pixels, as a JPEG data URL. */
export function fileToBackground(file: File, maxSide = 2400): Promise<string> {
  return withFileImage(file, (img) => {
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.86);
  });
}

/** Fetches a remote image as a data URL, or null when CORS or the network says no. */
export async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) return null;
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Looks up a GitHub user's avatar through the API, which allows CORS. */
export async function githubAvatar(username: string): Promise<string> {
  const fallback = `https://github.com/${encodeURIComponent(username)}.png?size=480`;
  try {
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`);
    if (!res.ok) return fallback;
    const data = (await res.json()) as { avatar_url?: unknown };
    if (typeof data.avatar_url !== 'string') return fallback;
    const url = new URL(data.avatar_url);
    url.searchParams.set('s', '480');
    return url.href;
  } catch {
    return fallback;
  }
}

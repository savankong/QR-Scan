export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not export image'))), type),
  );
}

export type ShareResult = 'shared' | 'cancelled' | 'unsupported';

export async function shareData(data: ShareData): Promise<ShareResult> {
  if (!navigator.share || (navigator.canShare && !navigator.canShare(data))) return 'unsupported';
  try {
    await navigator.share(data);
    return 'shared';
  } catch (err) {
    return err instanceof DOMException && err.name === 'AbortError' ? 'cancelled' : 'unsupported';
  }
}

/** Phones get the share sheet (with "Save Image"); everything else downloads the file. */
export async function saveOrShareFile(blob: Blob, filename: string, preferShare: boolean): Promise<ShareResult | 'downloaded'> {
  if (preferShare) {
    const result = await shareData({ files: [new File([blob], filename, { type: blob.type })] });
    if (result !== 'unsupported') return result;
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

export function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
}

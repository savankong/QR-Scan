import { filledLinks, linkHref, linkLabel, type Profile } from './profile';

export type VCardPhoto = { mime: string; base64: string } | { uri: string };

export interface VCardOptions {
  /** Compact cards go inside a QR code: no photo and no note, to keep the code scannable. */
  compact?: boolean;
  photo?: VCardPhoto | null;
}

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

/** vCard lines should be at most 75 characters; continuation lines start with a space. */
function fold(line: string): string {
  const chars = Array.from(line);
  if (chars.length <= 75) return line;
  const parts: string[] = [];
  for (let i = 0; i < chars.length; i += i === 0 ? 75 : 74) {
    parts.push(chars.slice(i, i + (i === 0 ? 75 : 74)).join(''));
  }
  return parts.join('\r\n ');
}

function splitName(full: string): [given: string, family: string] {
  const words = full.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return [words[0] ?? '', ''];
  return [words.slice(0, -1).join(' '), words[words.length - 1]];
}

export function photoFromDataUrl(dataUrl: string): VCardPhoto | null {
  const match = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  return match ? { mime: match[1], base64: match[2] } : null;
}

export function buildVCard(p: Profile, options: VCardOptions = {}): string {
  const name = p.name.trim();
  const [given, family] = splitName(name);
  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
  lines.push(`N:${escapeText(family)};${escapeText(given)};;;`);
  lines.push(`FN:${escapeText(name || 'Contact')}`);
  if (p.company.trim()) lines.push(`ORG:${escapeText(p.company.trim())}`);
  if (p.headline.trim()) lines.push(`TITLE:${escapeText(p.headline.trim())}`);
  if (p.phone.trim()) lines.push(`TEL;TYPE=CELL:${escapeText(p.phone.trim())}`);
  if (p.email.trim()) lines.push(`EMAIL;TYPE=INTERNET:${escapeText(p.email.trim())}`);

  // "itemN." groups let iOS show a label such as "LinkedIn" next to each URL.
  // Compact cards skip the labels: every byte makes the QR code denser.
  filledLinks(p).forEach((link, i) => {
    if (options.compact) {
      lines.push(`URL:${linkHref(link)}`);
      return;
    }
    lines.push(`item${i + 1}.URL:${linkHref(link)}`);
    lines.push(`item${i + 1}.X-ABLabel:${escapeText(linkLabel(link))}`);
  });

  if (!options.compact) {
    const note = [p.bio.trim(), p.location.trim() && `Based in ${p.location.trim()}`].filter(Boolean).join('\n');
    if (note) lines.push(`NOTE:${escapeText(note)}`);
    const photo = options.photo;
    if (photo && 'base64' in photo) {
      const type = photo.mime.split('/')[1].toUpperCase().replace('JPG', 'JPEG');
      lines.push(`PHOTO;ENCODING=b;TYPE=${type}:${photo.base64}`);
    } else if (photo) {
      lines.push(`PHOTO;VALUE=uri:${photo.uri}`);
    }
  }

  lines.push('END:VCARD');
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function vcardFileName(p: Profile): string {
  const base = p.name.trim().replace(/[^\p{L}\p{N} _-]+/gu, '').trim() || 'contact';
  return `${base}.vcf`;
}

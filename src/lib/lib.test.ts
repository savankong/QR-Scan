import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';
import { packProfile, unpackProfile } from './codec';
import { contrast, ensureContrast } from './color';
import {
  emptyProfile,
  exportProfile,
  linkHref,
  newLink,
  normalizeLinkValue,
  sanitizeProfile,
  type LinkType,
  type Profile,
} from './profile';
import { layoutQr, type QrLayout } from './qr';
import { normalizeSiteUrl, isPrivateSite } from './site';
import { buildVCard } from './vcard';

function link(type: LinkType, value: string, label = '') {
  return { ...newLink(type), value, label };
}

function sample(): Profile {
  return {
    ...emptyProfile(),
    name: 'Savan Kong',
    headline: 'Software Engineer',
    company: 'Acme, Inc.',
    location: 'Seattle, WA',
    bio: 'I build friendly tools; ask me about QR codes.',
    email: 'savan@example.com',
    phone: '+1 (206) 555-0142',
    photo: 'https://avatars.githubusercontent.com/u/1?v=4&s=480',
    accent: '#0d9488',
    links: [
      link('linkedin', 'savan-kong'),
      link('github', 'savankong/qr-scan'),
      link('website', 'savan.dev'),
      link('custom', 'https://blog.example.com/posts', 'Blog'),
      link('x', ''),
    ],
  };
}

/** Rasterizes a layout as plain squares (finders included) and decodes it with jsQR. */
function decode(layout: QrLayout, scale = 4, quiet = 4): string | null {
  const n = layout.size + quiet * 2;
  const px = n * scale;
  const rgba = new Uint8ClampedArray(px * px * 4).fill(255);
  const dark = (r: number, c: number) => {
    for (let y = 0; y < scale; y++)
      for (let x = 0; x < scale; x++) {
        const i = (((r + quiet) * scale + y) * px + (c + quiet) * scale + x) * 4;
        rgba[i] = rgba[i + 1] = rgba[i + 2] = 0;
      }
  };
  for (const [r, c] of layout.modules) dark(r, c);
  for (const [fr, fc] of layout.finders)
    for (let r = 0; r < 7; r++)
      for (let c = 0; c < 7; c++) {
        const ring = r === 0 || r === 6 || c === 0 || c === 6;
        const eye = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        if (ring || eye) dark(fr + r, fc + c);
      }
  return jsQR(rgba, px, px)?.data ?? null;
}

describe('profile links', () => {
  it('builds URLs from handles and pasted URLs', () => {
    expect(linkHref(link('linkedin', 'savan-kong'))).toBe('https://www.linkedin.com/in/savan-kong');
    expect(linkHref(link('github', 'savankong/qr-scan'))).toBe('https://github.com/savankong/qr-scan');
    expect(linkHref(link('instagram', 'john.doe'))).toBe('https://instagram.com/john.doe');
    expect(linkHref(link('linkedin', 'linkedin.com/company/acme'))).toBe('https://linkedin.com/company/acme');
    expect(linkHref(link('website', 'savan.dev'))).toBe('https://savan.dev/');
    expect(linkHref(link('x', '@savan'))).toBe('https://x.com/savan');
  });

  it('never produces script or non-web URLs', () => {
    expect(linkHref(link('custom', 'javascript:alert(1)'))).toBeNull();
    expect(linkHref(link('website', 'javascript:alert(1)'))).toBeNull();
    expect(linkHref(link('custom', '   '))).toBeNull();
  });

  it('turns pasted profile URLs into handles', () => {
    expect(normalizeLinkValue('linkedin', 'https://www.linkedin.com/in/savan-kong/')).toBe('savan-kong');
    expect(normalizeLinkValue('github', 'github.com/savankong')).toBe('savankong');
    expect(normalizeLinkValue('youtube', 'https://youtube.com/@chan?si=1')).toBe('chan');
    expect(normalizeLinkValue('x', '@handle')).toBe('handle');
    expect(normalizeLinkValue('github', 'https://github.com/savankong/qr-scan')).toBe('https://github.com/savankong/qr-scan');
  });
});

describe('sanitizeProfile', () => {
  it('drops unsafe and malformed fields', () => {
    const p = sanitizeProfile({
      name: 42,
      accent: 'red; background:url(x)',
      photo: 'javascript:alert(1)',
      links: [{ type: 'nope', value: 'x' }, { type: 'github', value: 'ok' }, null],
    });
    expect(p.name).toBe('');
    expect(p.accent).toBe('#4f46e5');
    expect(p.photo).toBe('');
    expect(p.links.map((l) => l.type)).toEqual(['github']);
  });
});

describe('card link codec', () => {
  it('round-trips a profile', async () => {
    const original = sample();
    const packed = await packProfile(original);
    expect(packed).toMatch(/^[zj][A-Za-z0-9_-]+$/);
    const restored = await unpackProfile(packed);
    expect(exportProfile(restored)).toEqual(exportProfile(original));
  });

  it('leaves uploaded photos out of the link', async () => {
    const p = { ...sample(), photo: 'data:image/jpeg;base64,AAAA' };
    const restored = await unpackProfile(await packProfile(p));
    expect(restored.photo).toBe('');
  });

  it('rejects garbage', async () => {
    await expect(unpackProfile('x123')).rejects.toThrow();
    await expect(unpackProfile('jbm90LWpzb24')).rejects.toThrow();
  });
});

describe('vCard', () => {
  it('escapes text and labels links', () => {
    const card = buildVCard(sample(), { compact: true });
    expect(card).toContain('BEGIN:VCARD\r\nVERSION:3.0\r\n');
    expect(card).toContain('N:Kong;Savan;;;');
    expect(card).toContain('ORG:Acme\\, Inc.');
    expect(card).toContain('URL:https://www.linkedin.com/in/savan-kong\r\n');
    expect(card).not.toContain('X-ABLabel');
    expect(card).not.toContain('NOTE');
    expect(card.trimEnd().endsWith('END:VCARD')).toBe(true);
  });

  it('folds long photo lines', () => {
    const base64 = 'A'.repeat(400);
    const card = buildVCard(sample(), { photo: { mime: 'image/jpeg', base64 } });
    expect(card).toContain('item1.URL:https://www.linkedin.com/in/savan-kong');
    expect(card).toContain('item1.X-ABLabel:LinkedIn');
    expect(card).toContain('item4.X-ABLabel:Blog');
    expect(card).toContain('NOTE:I build friendly tools\\; ask me about QR codes.\\nBased in Seattle\\, WA');
    const lines = card.split('\r\n');
    expect(lines.every((l) => l.length <= 75)).toBe(true);
    expect(card.replace(/\r\n /g, '')).toContain(`PHOTO;ENCODING=b;TYPE=JPEG:${base64}`);
  });
});

describe('QR layout', () => {
  const texts = [
    'https://savankong.github.io/qr-scan/#/card',
    'https://savankong.github.io/qr-scan/#/c/' + 'z'.repeat(300),
    buildVCard(sample(), { compact: true }),
  ];

  it.each(texts)('decodes without a photo hole (%#)', (text) => {
    expect(decode(layoutQr(text))).toBe(text);
  });

  it.each(texts)('still decodes with the centre cleared for a photo (%#)', (text) => {
    const layout = layoutQr(text, { hole: true });
    expect(layout.hole).not.toBeNull();
    expect(decode(layout)).toBe(text);
  });

  it('decodes a real packed card link with a photo hole', async () => {
    const url = 'https://savankong.github.io/qr-scan/#/c/' + (await packProfile(sample()));
    expect(decode(layoutQr(url, { hole: true }))).toBe(url);
  });
});

describe('colors and sites', () => {
  it('darkens light accents until they scan', () => {
    expect(contrast(ensureContrast('#fde047'), '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(ensureContrast('#111111')).toBe('#111111');
  });

  it('normalizes and classifies site addresses', () => {
    expect(normalizeSiteUrl('savankong.github.io/qr-scan')).toBe('https://savankong.github.io/qr-scan/');
    expect(normalizeSiteUrl('https://x.dev/app/index.html?a=1#x')).toBe('https://x.dev/app/');
    expect(isPrivateSite('http://localhost:5173/')).toBe(true);
    expect(isPrivateSite('http://192.168.1.4:5173/')).toBe(true);
    expect(isPrivateSite('https://savankong.github.io/qr-scan/')).toBe(false);
  });
});

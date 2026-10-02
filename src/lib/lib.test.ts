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
import { defaultSettings, sanitizeSettings } from './settings';
import { parseRoute } from '../hooks';

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

describe('contact QR fields', () => {
  it('leaves out hidden fields and labels the card link', () => {
    const p = sample();
    const card = buildVCard(p, {
      compact: true,
      hidden: ['org', 'email', `link:${p.links[1].id}`],
      cardUrl: 'https://card.savankong.com/',
    });
    expect(card).toContain('N:Kong;Savan;;;');
    expect(card).toContain('TEL;TYPE=CELL:');
    expect(card).not.toContain('ORG:');
    expect(card).not.toContain('TITLE:');
    expect(card).not.toContain('EMAIL');
    expect(card).not.toContain('github.com');
    expect(card).toContain('URL:https://www.linkedin.com/in/savan-kong\r\n');
    expect(card).toContain('item1.URL:https://card.savankong.com/\r\nitem1.X-ABLabel:My card\r\n');
    expect(decode(layoutQr(card))).toBe(card);
  });

  it('drops the card link when it is switched off', () => {
    const card = buildVCard(sample(), { compact: true, hidden: ['card'], cardUrl: 'https://card.savankong.com/' });
    expect(card).not.toContain('My card');
  });

  it('defaults to saving the contact and sanitizes the field list', () => {
    expect(defaultSettings().qrMode).toBe('vcard');
    expect(sanitizeSettings({}).vcardHidden).toEqual([]);
    expect(sanitizeSettings({ vcardHidden: ['phone', 'phone', 3, 'x'.repeat(50)] }).vcardHidden).toEqual(['phone']);
  });
});

describe('routes', () => {
  it('shows the card at the root and the editor at #/edit', () => {
    expect(parseRoute('')).toEqual({ view: 'published' });
    expect(parseRoute('#/')).toEqual({ view: 'published' });
    expect(parseRoute('#/card')).toEqual({ view: 'published' });
    expect(parseRoute('#/edit')).toEqual({ view: 'studio', tab: 'profile' });
    expect(parseRoute('#/qr')).toEqual({ view: 'studio', tab: 'qr' });
    expect(parseRoute('#/c/abc')).toEqual({ view: 'packed', data: 'abc' });
  });
});

describe('QR layout', () => {
  const texts = [
    'https://card.savankong.com/#/card',
    'https://card.savankong.com/#/c/' + 'z'.repeat(300),
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
    const url = 'https://card.savankong.com/#/c/' + (await packProfile(sample()));
    expect(decode(layoutQr(url, { hole: true }))).toBe(url);
  });
});

describe('colors and sites', () => {
  it('darkens light accents until they scan', () => {
    expect(contrast(ensureContrast('#fde047'), '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(ensureContrast('#111111')).toBe('#111111');
  });

  it('normalizes and classifies site addresses', () => {
    expect(normalizeSiteUrl('card.savankong.com')).toBe('https://card.savankong.com/');
    expect(normalizeSiteUrl('savankong.com/card')).toBe('https://savankong.com/card/');
    expect(normalizeSiteUrl('https://x.dev/app/index.html?a=1#x')).toBe('https://x.dev/app/');
    expect(isPrivateSite('http://localhost:5173/')).toBe(true);
    expect(isPrivateSite('http://192.168.1.4:5173/')).toBe(true);
    expect(isPrivateSite('https://card.savankong.com/')).toBe(false);
  });
});

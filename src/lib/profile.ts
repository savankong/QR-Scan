import { isHexColor } from './color';

export type LinkType =
  | 'linkedin'
  | 'github'
  | 'website'
  | 'portfolio'
  | 'x'
  | 'instagram'
  | 'youtube'
  | 'medium'
  | 'dribbble'
  | 'behance'
  | 'calendly'
  | 'custom';

export interface ProfileLink {
  id: string;
  type: LinkType;
  value: string;
  /** Only used by custom links. */
  label: string;
}

export interface Profile {
  name: string;
  headline: string;
  company: string;
  location: string;
  bio: string;
  email: string;
  phone: string;
  /** A data: URL from an upload, or an http(s) image URL. */
  photo: string;
  accent: string;
  links: ProfileLink[];
}

interface LinkTypeInfo {
  label: string;
  /** Host and path in front of a handle, e.g. "github.com/". URL-only types have none. */
  prefix?: string;
  placeholder: string;
}

export const LINK_TYPES: Record<LinkType, LinkTypeInfo> = {
  linkedin: { label: 'LinkedIn', prefix: 'linkedin.com/in/', placeholder: 'your-name' },
  github: { label: 'GitHub', prefix: 'github.com/', placeholder: 'username' },
  website: { label: 'Website', placeholder: 'yourname.com' },
  portfolio: { label: 'Portfolio', placeholder: 'yourname.com/work' },
  x: { label: 'X', prefix: 'x.com/', placeholder: 'handle' },
  instagram: { label: 'Instagram', prefix: 'instagram.com/', placeholder: 'handle' },
  youtube: { label: 'YouTube', prefix: 'youtube.com/@', placeholder: 'channel' },
  medium: { label: 'Medium', prefix: 'medium.com/@', placeholder: 'username' },
  dribbble: { label: 'Dribbble', prefix: 'dribbble.com/', placeholder: 'username' },
  behance: { label: 'Behance', prefix: 'behance.net/', placeholder: 'username' },
  calendly: { label: 'Book a meeting', placeholder: 'calendly.com/you/30min' },
  custom: { label: 'Link', placeholder: 'https://…' },
};

/** Wire codes for packed links: the index is the code. Append only, never reorder. */
export const LINK_TYPE_CODES: LinkType[] = [
  'custom',
  'linkedin',
  'github',
  'website',
  'portfolio',
  'x',
  'instagram',
  'youtube',
  'medium',
  'dribbble',
  'behance',
  'calendly',
];

/** Types that make sense more than once on a card. */
export const REPEATABLE_TYPES: LinkType[] = ['website', 'portfolio', 'custom'];

export const DEFAULT_ACCENT = '#4f46e5';

export const ACCENTS = ['#4f46e5', '#2563eb', '#0d9488', '#16a34a', '#ea580c', '#e11d48', '#7c3aed', '#334155'];

export const LIMITS = {
  name: 80,
  headline: 100,
  company: 80,
  location: 80,
  bio: 160,
  email: 254,
  phone: 40,
  linkValue: 500,
  linkLabel: 40,
  links: 20,
} as const;

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function newLink(type: LinkType): ProfileLink {
  return { id: uid(), type, value: '', label: '' };
}

export function emptyProfile(): Profile {
  return {
    name: '',
    headline: '',
    company: '',
    location: '',
    bio: '',
    email: '',
    phone: '',
    photo: '',
    accent: DEFAULT_ACCENT,
    links: [newLink('linkedin'), newLink('github'), newLink('website')],
  };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function prefixHost(prefix: string): string {
  return prefix.split('/')[0];
}

/** Turns a pasted profile URL into a bare handle when it matches the link type. */
export function normalizeLinkValue(type: LinkType, raw: string): string {
  const prefix = LINK_TYPES[type].prefix;
  if (!prefix) return raw;
  const pattern = new RegExp(
    '^\\s*(?:https?://)?(?:www\\.|m\\.)?' + escapeRegExp(prefix) + '@?([^/?#\\s]+)/?(?:[?#]\\S*)?\\s*$',
    'i',
  );
  const match = raw.match(pattern);
  if (match) return match[1];
  return raw.replace(/^\s*@/, '');
}

/** Accepts only http(s) URLs, so links from a shared card can never run script. */
export function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) && safeHttpUrl(value) !== null;
}

export function isDataImage(value: string): boolean {
  return /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(value);
}

export function linkHref(link: ProfileLink): string | null {
  const value = link.value.trim();
  if (!value) return null;
  const prefix = LINK_TYPES[link.type].prefix;
  const hasScheme = /^https?:\/\//i.test(value);
  if (hasScheme) return safeHttpUrl(value);
  if (prefix && !value.toLowerCase().includes(prefixHost(prefix))) {
    const www = link.type === 'linkedin' ? 'www.' : '';
    return safeHttpUrl(`https://${www}${prefix}${value.replace(/^@/, '')}`);
  }
  return safeHttpUrl(`https://${value}`);
}

export function linkLabel(link: ProfileLink): string {
  if (link.type !== 'custom') return LINK_TYPES[link.type].label;
  if (link.label.trim()) return link.label.trim();
  const href = linkHref(link);
  return href ? new URL(href).hostname.replace(/^www\./, '') : 'Link';
}

/** Short, human form of a URL: no scheme, no "www.", no trailing slash. */
export function displayUrl(href: string): string {
  return href.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
}

export function telHref(phone: string): string {
  return 'tel:' + phone.replace(/[^\d+*#,;]/g, '');
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const first = Array.from(words[0])[0] ?? '';
  const last = words.length > 1 ? (Array.from(words[words.length - 1])[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function subtitle(p: Pick<Profile, 'headline' | 'company'>): string {
  return [p.headline.trim(), p.company.trim()].filter(Boolean).join(' · ');
}

export function filledLinks(p: Profile): ProfileLink[] {
  return p.links.filter((l) => linkHref(l) !== null);
}

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function sanitizePhoto(value: unknown): string {
  if (typeof value !== 'string') return '';
  if (value.startsWith('data:')) return value.length <= 3_000_000 && isDataImage(value) ? value : '';
  return value.length <= 2048 && isHttpUrl(value) ? value : '';
}

/** Validates data from storage, a shared link or profile.json into a well-formed Profile. */
export function sanitizeProfile(raw: unknown): Profile {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const links: ProfileLink[] = [];
  if (Array.isArray(r.links)) {
    for (const item of r.links.slice(0, LIMITS.links)) {
      if (!item || typeof item !== 'object') continue;
      const l = item as Record<string, unknown>;
      if (typeof l.type !== 'string' || !(l.type in LINK_TYPES)) continue;
      links.push({
        id: typeof l.id === 'string' && l.id ? l.id.slice(0, 32) : uid(),
        type: l.type as LinkType,
        value: str(l.value, LIMITS.linkValue),
        label: str(l.label, LIMITS.linkLabel),
      });
    }
  }
  return {
    name: str(r.name, LIMITS.name),
    headline: str(r.headline, LIMITS.headline),
    company: str(r.company, LIMITS.company),
    location: str(r.location, LIMITS.location),
    bio: str(r.bio, LIMITS.bio),
    email: str(r.email, LIMITS.email),
    phone: str(r.phone, LIMITS.phone),
    photo: sanitizePhoto(r.photo),
    accent: isHexColor(r.accent) ? r.accent.toLowerCase() : DEFAULT_ACCENT,
    links,
  };
}

/** The profile as published in profile.json: trimmed, no empty links, no editor ids. */
export function exportProfile(p: Profile) {
  return {
    name: p.name.trim(),
    headline: p.headline.trim(),
    company: p.company.trim(),
    location: p.location.trim(),
    bio: p.bio.trim(),
    email: p.email.trim(),
    phone: p.phone.trim(),
    photo: p.photo,
    accent: p.accent,
    links: filledLinks(p).map((l) => ({
      type: l.type,
      value: l.value.trim(),
      ...(l.type === 'custom' ? { label: l.label.trim() } : {}),
    })),
  };
}

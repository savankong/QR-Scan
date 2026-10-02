import { Briefcase, CalendarDays, Globe, Link2, Mail, Phone } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { LinkType } from '../lib/profile';

const TILE_COLORS: Record<LinkType | 'email' | 'phone', string> = {
  linkedin: '#0a66c2',
  github: '#24292f',
  website: '#0f766e',
  portfolio: '#7c3aed',
  x: '#000000',
  instagram: 'linear-gradient(45deg, #f9a825, #e1306c 55%, #833ab4)',
  youtube: '#ff0000',
  medium: '#000000',
  dribbble: '#ea4c89',
  behance: '#1769ff',
  calendly: '#006bff',
  custom: '#64748b',
  email: '#2563eb',
  phone: '#16a34a',
};

function Glyph({ type }: { type: LinkType | 'email' | 'phone' }) {
  switch (type) {
    case 'linkedin':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M5.34 3.5a2.06 2.06 0 1 1 0 4.12 2.06 2.06 0 0 1 0-4.12ZM3.56 9h3.56v11.5H3.56ZM9.34 9h3.41v1.57h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.32h-3.55v-5.6c0-1.34-.03-3.06-1.86-3.06-1.87 0-2.15 1.46-2.15 2.96v5.7H9.34Z" />
        </svg>
      );
    case 'github':
      return (
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
        </svg>
      );
    case 'x':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'youtube':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 7.5v9l7.5-4.5Z" />
        </svg>
      );
    case 'medium':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M13.54 12a6.8 6.8 0 0 1-6.77 6.82A6.8 6.8 0 0 1 0 12a6.8 6.8 0 0 1 6.77-6.82A6.8 6.8 0 0 1 13.54 12Zm7.42 0c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12Z" />
        </svg>
      );
    case 'dribbble':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="9.5" />
          <path d="M8.56 2.75c4.37 6 6 9.42 8 17.72M19.13 5.09c-4.27 4.6-8.57 5.73-15.6 5.1M21.75 12.84c-6.62-1.41-12.14 1-16.38 6.32" />
        </svg>
      );
    case 'behance':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor">
          <text x="12" y="17" textAnchor="middle" fontSize="13" fontWeight="800" fontFamily="Arial, sans-serif">
            Bē
          </text>
        </svg>
      );
    case 'calendly':
      return <CalendarDays />;
    case 'portfolio':
      return <Briefcase />;
    case 'website':
      return <Globe />;
    case 'email':
      return <Mail />;
    case 'phone':
      return <Phone />;
    default:
      return <Link2 />;
  }
}

export function BrandTile({ type, size = 32 }: { type: LinkType | 'email' | 'phone'; size?: number }) {
  const style: CSSProperties = { background: TILE_COLORS[type], width: size, height: size };
  return (
    <span className="tile" style={style} aria-hidden="true">
      <Glyph type={type} />
    </span>
  );
}

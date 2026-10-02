import { ArrowUpRight, MapPin, UserPlus } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { mix } from '../lib/color';
import { downloadContact } from '../lib/contact';
import { displayUrl, filledLinks, linkHref, linkLabel, subtitle, telHref, type Profile } from '../lib/profile';
import { BrandTile } from './BrandIcon';
import { Avatar } from './ui';

/** The page people land on after scanning. Also used as the live preview in the editor. */
export function ProfileCard({ profile, preview = false }: { profile: Profile; preview?: boolean }) {
  const [saving, setSaving] = useState(false);
  const name = profile.name.trim();
  const sub = subtitle(profile);
  const email = profile.email.trim();
  const phone = profile.phone.trim();
  const links = filledLinks(profile);
  const style = {
    '--accent': profile.accent,
    '--accent-deep': mix(profile.accent, '#000000', 0.45),
  } as CSSProperties;

  async function save() {
    setSaving(true);
    try {
      await downloadContact(profile);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="pcard" style={style}>
      <div className="pcard-banner" />
      <header className="pcard-head">
        <Avatar profile={profile} size={104} className="pcard-avatar" />
        <h1 className={name ? '' : 'is-placeholder'}>{name || (preview ? 'Your name' : 'Contact card')}</h1>
        {sub && <p className="pcard-sub">{sub}</p>}
        {profile.location.trim() && (
          <p className="pcard-loc">
            <MapPin size={14} aria-hidden="true" />
            {profile.location.trim()}
          </p>
        )}
        {profile.bio.trim() && <p className="pcard-bio">{profile.bio.trim()}</p>}
        <button type="button" className="btn btn-primary btn-block" onClick={save} disabled={saving}>
          <UserPlus size={18} aria-hidden="true" />
          {saving ? 'Preparing…' : 'Save contact'}
        </button>
      </header>

      {(email || phone) && (
        <ul className="group list" aria-label="Contact">
          {email && (
            <li>
              <a className="row link-row" href={`mailto:${email}`}>
                <BrandTile type="email" />
                <span className="row-text">
                  <span className="row-sub">Email</span>
                  <span className="row-title">{email}</span>
                </span>
              </a>
            </li>
          )}
          {phone && (
            <li>
              <a className="row link-row" href={telHref(phone)}>
                <BrandTile type="phone" />
                <span className="row-text">
                  <span className="row-sub">Phone</span>
                  <span className="row-title">{phone}</span>
                </span>
              </a>
            </li>
          )}
        </ul>
      )}

      {links.length > 0 && (
        <ul className="group list" aria-label="Links">
          {links.map((link) => {
            const href = linkHref(link)!;
            return (
              <li key={link.id}>
                <a className="row link-row" href={href} target="_blank" rel="noopener noreferrer">
                  <BrandTile type={link.type} />
                  <span className="row-text">
                    <span className="row-title">{linkLabel(link)}</span>
                    <span className="row-sub">{displayUrl(href)}</span>
                  </span>
                  <ArrowUpRight size={18} className="row-arrow" aria-hidden="true" />
                </a>
              </li>
            );
          })}
        </ul>
      )}

      {preview && !email && !phone && links.length === 0 && (
        <p className="pcard-empty">Add contact details and links, and they show up here.</p>
      )}
    </article>
  );
}

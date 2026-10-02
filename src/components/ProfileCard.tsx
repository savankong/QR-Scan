import { ArrowUpRight, Check, Mail, MapPin, MessageCircle, Phone, UserPlus } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { ensureContrast, mix } from '../lib/color';
import { contactBlob, downloadContact } from '../lib/contact';
import { displayUrl, filledLinks, linkHref, linkLabel, subtitle, telHref, type Profile } from '../lib/profile';
import { BrandTile } from './BrandIcon';
import { Avatar } from './ui';

function smsHref(phone: string, body: string): string {
  const number = phone.replace(/[^\d+]/g, '');
  // "?&body=" is read by both iOS and Android Messages.
  return body ? `sms:${number}?&body=${encodeURIComponent(body)}` : `sms:${number}`;
}

/** "Name, number, email, links and photo", listing only what this card has. */
function saveSummary(p: Profile): string {
  const parts = ['Name'];
  if (p.phone.trim()) parts.push('number');
  if (p.email.trim()) parts.push('email');
  if (filledLinks(p).length) parts.push('links');
  if (p.photo) parts.push('photo');
  if (parts.length === 1) return 'Adds this card to your contacts';
  const last = parts.pop();
  return `${parts.join(', ')} and ${last} in one tap`;
}

/** The page people land on after scanning. Also used as the live preview in the editor. */
export function ProfileCard({ profile, preview = false }: { profile: Profile; preview?: boolean }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState<Blob | null>(null);
  const name = profile.name.trim();
  const firstName = name.split(/\s+/)[0] ?? '';
  const sub = subtitle(profile);
  const email = profile.email.trim();
  const phone = profile.phone.trim();
  const links = filledLinks(profile);
  const actions = [phone && 'call', phone && 'text', email && 'email'].filter(Boolean).length;
  const style = {
    '--accent': profile.accent,
    '--accent-deep': mix(profile.accent, '#000000', 0.45),
    '--card-ink': ensureContrast(profile.accent),
    '--card-ink-dark': mix(profile.accent, '#ffffff', 0.55),
  } as CSSProperties;

  // Build the contact file as soon as the card shows, so the tap saves at once.
  // Waiting for the photo after the tap is slow, and iOS can drop the download.
  // The editor preview changes on every keystroke, so it builds on tap instead.
  useEffect(() => {
    setReady(null);
    if (preview) return;
    let live = true;
    contactBlob(profile).then(
      (blob) => live && setReady(blob),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [profile, preview]);

  async function save() {
    setSaving(true);
    try {
      await downloadContact(profile, ready);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="pcard" style={style}>
      <header className="pcard-head">
        <Avatar profile={profile} size={116} className="pcard-avatar" />
        <h1 className={name ? '' : 'is-placeholder'}>{name || (preview ? 'Your name' : 'Contact card')}</h1>
        {sub && <p className="pcard-sub">{sub}</p>}

        {saved ? (
          <div className="pcard-done" role="status">
            <span className="pcard-done-mark" aria-hidden="true">
              <Check size={16} strokeWidth={3} />
            </span>
            <span className="pcard-done-text">
              <strong className="pcard-done-title">Almost done</strong>
              <span>
                Your phone opened the contact. Tap <strong>Create New Contact</strong> on iPhone, or <strong>Save</strong> on Android.
              </span>
              <button type="button" className="link-btn" onClick={save} disabled={saving}>
                Didn’t open? Save again
              </button>
            </span>
          </div>
        ) : (
          <>
            <button type="button" className="btn btn-primary btn-block pcard-save" onClick={save} disabled={saving}>
              <UserPlus size={22} aria-hidden="true" />
              {saving ? 'Preparing…' : 'Save to Contacts'}
            </button>
            <p className="pcard-save-note">{saveSummary(profile)}</p>
          </>
        )}
      </header>

      {actions > 0 && (
        <nav className="pcard-actions" aria-label="Get in touch" style={{ '--n': actions } as CSSProperties}>
          {phone && (
            <a href={telHref(phone)}>
              <Phone size={20} aria-hidden="true" />
              Call
            </a>
          )}
          {phone && (
            <a href={smsHref(phone, '')}>
              <MessageCircle size={20} aria-hidden="true" />
              Text
            </a>
          )}
          {email && (
            <a href={`mailto:${email}`}>
              <Mail size={20} aria-hidden="true" />
              Email
            </a>
          )}
        </nav>
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

      {(profile.location.trim() || profile.bio.trim()) && (
        <section className="pcard-about" aria-label="About">
          {profile.bio.trim() && <p className="pcard-bio">{profile.bio.trim()}</p>}
          {profile.location.trim() && (
            <p className="pcard-loc">
              <MapPin size={14} aria-hidden="true" />
              {profile.location.trim()}
            </p>
          )}
        </section>
      )}

      {phone && (
        <a className="pcard-textback" href={smsHref(phone, firstName ? `Hi ${firstName}, it’s ` : 'Hi, it’s ')}>
          <MessageCircle size={18} aria-hidden="true" />
          Text {firstName || 'them'} your number
        </a>
      )}

      {preview && !email && !phone && links.length === 0 && (
        <p className="pcard-empty">Add contact details and links, and they show up here.</p>
      )}
    </article>
  );
}

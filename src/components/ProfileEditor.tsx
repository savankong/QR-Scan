import { ArrowUp, Camera, ImagePlus, Link2, Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { fileToAvatar, githubAvatar } from '../lib/image';
import {
  ACCENTS,
  LIMITS,
  LINK_TYPES,
  REPEATABLE_TYPES,
  isHttpUrl,
  newLink,
  normalizeLinkValue,
  type LinkType,
  type Profile,
  type ProfileLink,
} from '../lib/profile';
import { BrandTile } from './BrandIcon';
import { Avatar, Section, TextArea, TextField } from './ui';

type Update = (patch: Partial<Profile>) => void;

function PhotoPicker({ profile, update }: { profile: Profile; update: Update }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showUrl, setShowUrl] = useState(false);
  const [url, setUrl] = useState('');
  const github = profile.links.find((l) => l.type === 'github' && /^[a-z\d-]+$/i.test(l.value.trim()))?.value.trim();

  async function onFile(file: File) {
    setBusy(true);
    setError('');
    try {
      update({ photo: await fileToAvatar(file) });
    } catch {
      setError('That image couldn’t be read. Try a JPEG or PNG.');
    } finally {
      setBusy(false);
    }
  }

  async function useGithub() {
    if (!github) return;
    setBusy(true);
    update({ photo: await githubAvatar(github) });
    setBusy(false);
  }

  function applyUrl() {
    const value = url.trim();
    if (!isHttpUrl(value)) {
      setError('Enter a full image address starting with https://');
      return;
    }
    setError('');
    update({ photo: value });
    setShowUrl(false);
  }

  return (
    <div className="photo-picker">
      <button
        type="button"
        className="photo-button"
        onClick={() => input.current?.click()}
        aria-label={profile.photo ? 'Change photo' : 'Add a photo'}
        disabled={busy}
      >
        <Avatar profile={profile} size={104} />
        <span className="photo-badge" aria-hidden="true">
          <Camera size={16} />
        </span>
      </button>
      <div className="photo-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => input.current?.click()} disabled={busy}>
          <ImagePlus size={16} aria-hidden="true" />
          {profile.photo ? 'Change photo' : 'Upload photo'}
        </button>
        {github && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={useGithub} disabled={busy}>
            <BrandTile type="github" size={18} />
            Use GitHub photo
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowUrl((v) => !v)}>
          <Link2 size={16} aria-hidden="true" />
          Image URL
        </button>
        {profile.photo && (
          <button type="button" className="btn btn-ghost btn-sm btn-danger" onClick={() => update({ photo: '' })}>
            Remove
          </button>
        )}
      </div>
      {showUrl && (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            applyUrl();
          }}
        >
          <input
            type="url"
            inputMode="url"
            placeholder="https://…/photo.jpg"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-label="Image URL"
          />
          <button type="submit" className="btn btn-secondary btn-sm">
            Use
          </button>
        </form>
      )}
      {error && <p className="field-error">{error}</p>}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function LinkRow({
  link,
  first,
  onChange,
  onRemove,
  onMoveUp,
}: {
  link: ProfileLink;
  first: boolean;
  onChange: (link: ProfileLink) => void;
  onRemove: () => void;
  onMoveUp: () => void;
}) {
  const info = LINK_TYPES[link.type];
  return (
    <div className="link-edit">
      <BrandTile type={link.type} />
      <div className="link-edit-fields">
        {link.type === 'custom' && (
          <input
            className="link-label-input"
            value={link.label}
            maxLength={LIMITS.linkLabel}
            placeholder="Label, e.g. Blog"
            aria-label="Link label"
            onChange={(e) => onChange({ ...link, label: e.target.value })}
          />
        )}
        <div className="prefixed">
          {info.prefix && <span className="prefix">{info.prefix}</span>}
          <input
            value={link.value}
            maxLength={LIMITS.linkValue}
            placeholder={info.placeholder}
            aria-label={`${info.label}${info.prefix ? ' handle or URL' : ' URL'}`}
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => onChange({ ...link, value: e.target.value })}
            onBlur={(e) => onChange({ ...link, value: normalizeLinkValue(link.type, e.target.value).trim() })}
          />
        </div>
      </div>
      <div className="link-edit-actions">
        <button type="button" className="icon-btn icon-btn-sm" onClick={onMoveUp} disabled={first} aria-label="Move up">
          <ArrowUp size={16} />
        </button>
        <button type="button" className="icon-btn icon-btn-sm" onClick={onRemove} aria-label={`Remove ${info.label}`}>
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

const ADDABLE: LinkType[] = [
  'linkedin',
  'github',
  'website',
  'portfolio',
  'calendly',
  'x',
  'instagram',
  'youtube',
  'medium',
  'dribbble',
  'behance',
  'custom',
];

function LinksEditor({ links, onChange }: { links: ProfileLink[]; onChange: (links: ProfileLink[]) => void }) {
  const present = new Set(links.map((l) => l.type));
  const addable = ADDABLE.filter((t) => REPEATABLE_TYPES.includes(t) || !present.has(t));
  const full = links.length >= LIMITS.links;

  return (
    <>
      {links.length > 0 && (
        <div className="group">
          {links.map((link, i) => (
            <LinkRow
              key={link.id}
              link={link}
              first={i === 0}
              onChange={(next) => onChange(links.map((l) => (l.id === link.id ? next : l)))}
              onRemove={() => onChange(links.filter((l) => l.id !== link.id))}
              onMoveUp={() => {
                const next = [...links];
                [next[i - 1], next[i]] = [next[i], next[i - 1]];
                onChange(next);
              }}
            />
          ))}
        </div>
      )}
      {!full && (
        <div className="chips" aria-label="Add a link">
          {addable.map((type) => (
            <button key={type} type="button" className="chip" onClick={() => onChange([...links, newLink(type)])}>
              <Plus size={14} aria-hidden="true" />
              {type === 'custom' ? 'Other link' : LINK_TYPES[type].label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function AccentPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const custom = !ACCENTS.includes(value);
  return (
    <div className="swatches" role="radiogroup" aria-label="Accent color">
      {ACCENTS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={color}
          className="swatch"
          style={{ background: color }}
          onClick={() => onChange(color)}
        />
      ))}
      <label className={`swatch swatch-custom${custom ? ' is-custom' : ''}`} aria-checked={custom} role="radio" style={custom ? { background: value } : undefined}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Custom color" />
      </label>
    </div>
  );
}

export function ProfileEditor({ profile, onChange }: { profile: Profile; onChange: (p: Profile) => void }) {
  const update: Update = (patch) => onChange({ ...profile, ...patch });
  const text = (key: 'name' | 'headline' | 'company' | 'location' | 'email' | 'phone') => ({
    value: profile[key],
    maxLength: LIMITS[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => update({ [key]: e.target.value }),
  });

  return (
    <div className="editor">
      <PhotoPicker profile={profile} update={update} />

      <Section title="About you">
        <TextField label="Name" placeholder="Alex Morgan" autoComplete="name" {...text('name')} />
        <TextField label="Title" placeholder="Software Engineer" autoComplete="organization-title" {...text('headline')} />
        <TextField label="Company" placeholder="Acme Inc." autoComplete="organization" {...text('company')} />
        <TextField label="Location" placeholder="Seattle, WA" autoComplete="address-level2" {...text('location')} />
        <TextArea
          label="Short bio"
          placeholder="One or two lines about what you do."
          value={profile.bio}
          maxLength={LIMITS.bio}
          onChange={(e) => update({ bio: e.target.value })}
        />
      </Section>

      <Section title="Contact" description="Leave a field empty to keep it off your card.">
        <TextField label="Email" type="email" inputMode="email" placeholder="you@example.com" autoComplete="email" {...text('email')} />
        <TextField label="Phone" type="tel" inputMode="tel" placeholder="+1 555 010 0000" autoComplete="tel" {...text('phone')} />
      </Section>

      <Section title="Links" flush description="Type a handle or paste a full profile URL.">
        <LinksEditor links={profile.links} onChange={(links) => update({ links })} />
      </Section>

      <Section title="Color" flush>
        <div className="group group-pad">
          <AccentPicker value={profile.accent} onChange={(accent) => update({ accent })} />
        </div>
      </Section>
    </div>
  );
}

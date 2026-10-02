import {
  Check,
  Contact,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  FileJson,
  Image as ImageIcon,
  QrCode,
  Share,
} from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { mix } from '../lib/color';
import { downloadContact } from '../lib/contact';
import { exportProfile, filledLinks, initials, linkLabel, subtitle, type Profile } from '../lib/profile';
import { drawQr, qrSvg, readability, type DotStyle, type QrLayout, type QrPaint } from '../lib/qr';
import { canvasToBlob, copyText, downloadBlob, isTouchDevice, saveOrShareFile, shareData } from '../lib/share';
import type { Settings } from '../lib/settings';
import { currentSiteUrl, isPrivateSite, publishedCardUrl } from '../lib/site';
import { drawWallpaper } from '../lib/wallpaper';
import { fetchPublished } from './PublicCard';
import { Avatar, Hint, Section, Segmented, Toggle } from './ui';

export interface QrTarget {
  /** What the QR code encodes. */
  text: string;
  /** The page it opens, when it opens one. */
  url: string | null;
}

export function QrCanvas({ layout, paint, label }: { layout: QrLayout; paint: QrPaint; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { fg, dots, quiet, bg, photo, initials: letters } = paint;
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const px = 720;
    canvas.width = canvas.height = px;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, px, px);
    drawQr(ctx, layout, 0, 0, px, { fg, dots, quiet, bg, photo, initials: letters });
  }, [layout, fg, dots, quiet, bg, photo, letters]);
  return <canvas ref={ref} className="qr-canvas" role="img" aria-label={label} />;
}

function captionFor(settings: Settings) {
  return settings.qrMode === 'vcard' ? 'Scan to save my contact' : 'Scan to see my card';
}

function ReadabilityMeter({ layout, tip }: { layout: QrLayout; tip: string }) {
  const r = readability(layout);
  return (
    <div className="meter">
      <div className="meter-head">
        <span className="row-title">{r.label}</span>
        <span className="row-sub">
          {layout.size} × {layout.size} modules
        </span>
      </div>
      <div className={`meter-bar level-${r.level}`} aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i <= 3 - r.level ? 'on' : ''} />
        ))}
      </div>
      {r.level >= 2 && <p className="row-sub meter-tip">{tip}</p>}
    </div>
  );
}

type PublishStatus = 'checking' | 'missing' | 'current' | 'outdated';

function PublishPanel({ profile, site }: { profile: Profile; site: string }) {
  const [published, setPublished] = useState<Profile | null | undefined>(undefined);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    setPublished(undefined);
    fetchPublished(site).then(
      (p) => live && setPublished(p),
      () => live && setPublished(null),
    );
    return () => {
      live = false;
    };
  }, [site, nonce]);

  const status: PublishStatus =
    published === undefined
      ? 'checking'
      : published === null
        ? 'missing'
        : JSON.stringify(exportProfile(published)) === JSON.stringify(exportProfile(profile))
          ? 'current'
          : 'outdated';

  function download() {
    const body = JSON.stringify({ version: 1, profile: exportProfile(profile) }, null, 2) + '\n';
    downloadBlob(new Blob([body], { type: 'application/json' }), 'profile.json');
  }

  return (
    <div className="publish">
      <div className={`status status-${status}`}>
        <span className="status-dot" aria-hidden="true" />
        <span>
          {status === 'checking' && 'Checking your site…'}
          {status === 'missing' && 'Not published yet'}
          {status === 'current' && 'Published and up to date'}
          {status === 'outdated' && 'Published, but older than your edits'}
        </span>
        <button type="button" className="link-btn" onClick={() => setNonce((n) => n + 1)}>
          Check again
        </button>
      </div>
      {status !== 'current' && (
        <ol className="steps">
          <li>
            <button type="button" className="btn btn-secondary btn-sm" onClick={download}>
              <FileJson size={16} aria-hidden="true" />
              Download profile.json
            </button>
          </li>
          <li>
            Add it to the <code>public/</code> folder of this app’s repository. On GitHub: open <code>public</code>, then{' '}
            <strong>Add file → Upload files</strong>, and commit.
          </li>
          <li>Wait about a minute for the site to redeploy. Your QR code stays the same.</li>
        </ol>
      )}
      <p className="row-sub">Anyone with the link can read profile.json, the same as your card.</p>
    </div>
  );
}

function ModeOption({
  selected,
  title,
  badge,
  detail,
  onSelect,
}: {
  selected: boolean;
  title: string;
  badge?: string;
  detail: string;
  onSelect: () => void;
}) {
  return (
    <button type="button" role="radio" aria-checked={selected} className="mode-option" onClick={onSelect}>
      <span className="mode-radio" aria-hidden="true" />
      <span className="mode-text">
        <span className="mode-title">
          {title}
          {badge && <span className="mode-badge">{badge}</span>}
        </span>
        <span className="row-sub">{detail}</span>
      </span>
    </button>
  );
}

/** The details a scan can save, keyed as in `Settings.vcardHidden`. Only filled-in ones are listed. */
function contactFields(profile: Profile): { key: string; label: string; description?: string }[] {
  const fields: { key: string; label: string; description?: string }[] = [];
  if (profile.headline.trim() || profile.company.trim()) {
    const both = profile.headline.trim() && profile.company.trim();
    fields.push({ key: 'org', label: both ? 'Title and company' : profile.headline.trim() ? 'Title' : 'Company' });
  }
  if (profile.phone.trim()) fields.push({ key: 'phone', label: 'Phone' });
  if (profile.email.trim()) fields.push({ key: 'email', label: 'Email' });
  for (const link of filledLinks(profile)) fields.push({ key: `link:${link.id}`, label: linkLabel(link) });
  fields.push({ key: 'card', label: 'Link to my card page', description: 'So they can see your photo later' });
  return fields;
}

export function SharePanel({
  profile,
  settings,
  onSettings,
  site,
  target,
  layout,
  fg,
  photo,
  notify,
}: {
  profile: Profile;
  settings: Settings;
  onSettings: (s: Settings) => void;
  site: string;
  target: QrTarget | null;
  layout: QrLayout | null;
  fg: string;
  photo: HTMLImageElement | null;
  notify: (message: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [siteDraft, setSiteDraft] = useState(settings.siteUrl);
  const set = (patch: Partial<Settings>) => onSettings({ ...settings, ...patch });
  const page = settings.qrMode === 'page';
  const instant = page && settings.linkStyle === 'instant';
  const sub = subtitle(profile);
  const paint: QrPaint = { fg, dots: settings.dots, quiet: 0, photo, initials: initials(profile.name) };
  const stageStyle = {
    '--accent': profile.accent,
    '--accent-deep': mix(profile.accent, '#000000', 0.55),
  } as CSSProperties;
  const privateSite = isPrivateSite(site);
  const hidden = settings.vcardHidden;
  const cardInContact = !page && !hidden.includes('card');
  const toggleField = (key: string, on: boolean) =>
    set({ vcardHidden: on ? hidden.filter((k) => k !== key) : [...hidden, key] });

  async function copyLink() {
    if (!target?.url) return;
    if (await copyText(target.url)) {
      setCopied(true);
      notify('Link copied');
      setTimeout(() => setCopied(false), 1600);
    }
  }

  async function cardImage(): Promise<Blob> {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    drawWallpaper(canvas.getContext('2d')!, {
      width: canvas.width,
      height: canvas.height,
      settings: { ...settings.wallpaper, backdrop: 'accent', layout: 'card', y: 0.5, scale: 0.56, caption: captionFor(settings) },
      profile,
      qr: layout!,
      qrColor: fg,
      dots: settings.dots,
      photo,
      background: null,
    });
    return canvasToBlob(canvas);
  }

  async function share() {
    if (!layout) return;
    if (target?.url) {
      const result = await shareData({ title: profile.name.trim() || 'My card', url: target.url });
      if (result === 'unsupported') await copyLink();
      return;
    }
    const result = await saveOrShareFile(await cardImage(), 'my-qr-card.png', true);
    if (result === 'downloaded') notify('Image downloaded');
  }

  async function saveCard() {
    const result = await saveOrShareFile(await cardImage(), 'my-qr-card.png', isTouchDevice());
    if (result === 'downloaded') notify('Image downloaded');
  }

  async function downloadPng() {
    if (!layout) return;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1024;
    drawQr(canvas.getContext('2d')!, layout, 0, 0, 1024, { ...paint, quiet: 4, bg: '#ffffff' });
    downloadBlob(await canvasToBlob(canvas), 'qr-code.png');
  }

  function downloadSvg() {
    if (!layout) return;
    const svg = qrSvg(layout, { ...paint, quiet: 4, bg: '#ffffff', photoHref: profile.photo || undefined });
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'qr-code.svg');
  }

  function saveSite() {
    set({ siteUrl: siteDraft.trim() });
  }

  return (
    <div className="workspace">
      <div className="stage stage-share" style={stageStyle}>
        <div className="share-card">
          <div className="share-who">
            <Avatar profile={profile} size={40} />
            <span className="share-who-text">
              <span className={`share-name${profile.name.trim() ? '' : ' is-placeholder'}`}>{profile.name.trim() || 'Your name'}</span>
              {sub && <span className="share-sub">{sub}</span>}
            </span>
          </div>
          <div className="share-qr">
            {layout ? (
              <QrCanvas layout={layout} paint={paint} label={page ? `QR code that opens ${target?.url ?? ''}` : 'QR code with your contact card'} />
            ) : (
              <div className="qr-skeleton" aria-busy="true" />
            )}
          </div>
          <p className="share-caption">
            <QrCode size={16} aria-hidden="true" />
            {captionFor(settings)}
          </p>
          <div className="share-card-actions">
            <a className="btn btn-primary" href="#/wallpaper">
              Make wallpaper
            </a>
            <button type="button" className="btn btn-secondary" onClick={share} disabled={!layout}>
              <Share size={18} aria-hidden="true" />
              Share
            </button>
          </div>
        </div>
        <div className="stage-actions">
          {target?.url && (
            <button type="button" className="btn btn-on-dark" onClick={copyLink}>
              {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
              Copy link
            </button>
          )}
          <button type="button" className="btn btn-on-dark" onClick={saveCard} disabled={!layout}>
            <ImageIcon size={18} aria-hidden="true" />
            Save image
          </button>
        </div>
      </div>

      <div className="controls">
        <Section title="When someone scans" flush>
          <div className="mode-options" role="radiogroup" aria-label="What the QR code does">
            <ModeOption
              selected={!page}
              title="Straight to Contacts"
              badge="Fastest"
              detail="About 3 taps. Works offline. No photo."
              onSelect={() => set({ qrMode: 'vcard' })}
            />
            <ModeOption
              selected={page}
              title="Open my card page"
              detail="About 4 taps. Shows your photo and every link."
              onSelect={() => set({ qrMode: 'page' })}
            />
          </div>
        </Section>

        {!page && (
          <Section title="In your contact" flush>
            <div className="group">
              <div className="row">
                <span className="row-title">Name</span>
                <span className="row-sub row-end">Always</span>
              </div>
              {contactFields(profile).map((f) => (
                <Toggle
                  key={f.key}
                  label={f.label}
                  description={f.description}
                  checked={!hidden.includes(f.key)}
                  onChange={(on) => toggleField(f.key, on)}
                />
              ))}
            </div>
            {layout && (
              <div className="group">
                <ReadabilityMeter layout={layout} tip="Turn off details people don’t need, and the code gets simpler." />
              </div>
            )}
            {cardInContact && (
              <div className="group group-pad">
                <p className="row-sub">
                  The card link opens <strong>{publishedCardUrl(site)}</strong>, which shows your published card.
                </p>
                <PublishPanel profile={profile} site={site} />
              </div>
            )}
          </Section>
        )}

        {page && (
          <Section title="Your card link" flush>
            <div className="group group-pad">
              {target?.url && (
                <div className="url-box">
                  <span className="url-text">{target.url}</span>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={copyLink}>
                    {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                    Copy
                  </button>
                  <a className="icon-btn icon-btn-sm" href={target.url} target="_blank" rel="noopener noreferrer" aria-label="Open link">
                    <ExternalLink size={16} />
                  </a>
                </div>
              )}
              <Segmented
                label="Link style"
                value={settings.linkStyle}
                onChange={(linkStyle) => set({ linkStyle })}
                options={[
                  { value: 'instant', label: 'Instant' },
                  { value: 'short', label: 'Short' },
                ]}
              />
              <p className="row-sub segment-note">
                {instant
                  ? 'Your details travel inside the link. There’s nothing to set up, but you need a new QR code after you edit your card.'
                  : 'Short and never changes. Publish your card, and the same QR code shows every update.'}
              </p>
              {!instant && <PublishPanel profile={profile} site={site} />}
            </div>
            {privateSite && (
              <Hint tone="warn">
                This code points to <strong>{new URL(site).host}</strong>, which other phones can’t open. Deploy the app (see the README) or enter
                its public address below.
              </Hint>
            )}
            <details className="disclosure" open={privateSite}>
              <summary>Public address of this app</summary>
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveSite();
                }}
              >
                <input
                  type="url"
                  inputMode="url"
                  placeholder={currentSiteUrl()}
                  value={siteDraft}
                  onChange={(e) => setSiteDraft(e.target.value)}
                  aria-label="Public address"
                />
                <button type="submit" className="btn btn-secondary btn-sm">
                  Save
                </button>
              </form>
              <p className="row-sub">Leave empty to use the address this page is open at.</p>
            </details>
          </Section>
        )}

        <Section title="Look" flush>
          <div className="group">
            <div className="row">
              <span className="row-title">Style</span>
              <Segmented<DotStyle>
                label="Module style"
                value={settings.dots}
                onChange={(dots) => set({ dots })}
                options={[
                  { value: 'rounded', label: 'Rounded' },
                  { value: 'square', label: 'Square' },
                  { value: 'dots', label: 'Dots' },
                ]}
              />
            </div>
            <div className="row">
              <span className="row-title">Color</span>
              <Segmented
                label="QR color"
                value={settings.qrColor}
                onChange={(qrColor) => set({ qrColor })}
                options={[
                  { value: 'accent', label: 'My color' },
                  { value: 'black', label: 'Black' },
                ]}
              />
            </div>
            <Toggle
              label="Photo in the middle"
              description="Uses stronger error correction, so the code gets a little denser."
              checked={settings.centerPhoto}
              onChange={(centerPhoto) => set({ centerPhoto })}
            />
            {layout && page && (
              <ReadabilityMeter
                layout={layout}
                tip={instant ? 'A shorter bio or fewer links makes a simpler code. A short link is always simple.' : 'Fewer links make a simpler code.'}
              />
            )}
          </div>
        </Section>

        <Section title="Download" flush>
          <div className="group">
            <button type="button" className="row row-button" onClick={downloadPng} disabled={!layout}>
              <Download size={18} aria-hidden="true" />
              <span className="row-title">QR code, PNG</span>
            </button>
            <button type="button" className="row row-button" onClick={downloadSvg} disabled={!layout}>
              <FileCode2 size={18} aria-hidden="true" />
              <span className="row-title">QR code, SVG</span>
              <span className="row-sub row-end">For print</span>
            </button>
            <button type="button" className="row row-button" onClick={() => downloadContact(profile)}>
              <Contact size={18} aria-hidden="true" />
              <span className="row-title">Contact file, .vcf</span>
              <span className="row-sub row-end">{profile.photo ? 'With photo' : ''}</span>
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}

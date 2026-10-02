import { Eye, QrCode, Smartphone, UserRound, X } from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ProfileCard } from './components/ProfileCard';
import { ProfileEditor } from './components/ProfileEditor';
import { PublicCard } from './components/PublicCard';
import { SharePanel, type QrTarget } from './components/SharePanel';
import { Hint } from './components/ui';
import { WallpaperStudio } from './components/WallpaperStudio';
import { useImage, useRoute, useStoredState, useToast, type Tab } from './hooks';
import { packProfile } from './lib/codec';
import { ensureContrast, mix } from './lib/color';
import { emptyProfile, isDataImage, sanitizeProfile, type Profile } from './lib/profile';
import { layoutQr } from './lib/qr';
import { defaultSettings, sanitizeSettings, type Settings } from './lib/settings';
import { currentSiteUrl, normalizeSiteUrl, packedCardUrl, publishedCardUrl } from './lib/site';
import { buildVCard } from './lib/vcard';

const TABS: { id: Tab; label: string; href: string; icon: typeof UserRound }[] = [
  { id: 'profile', label: 'Profile', href: '#/edit', icon: UserRound },
  { id: 'qr', label: 'QR code', href: '#/qr', icon: QrCode },
  { id: 'wallpaper', label: 'Wallpaper', href: '#/wallpaper', icon: Smartphone },
];

function useQrTarget(profile: Profile, settings: Settings, site: string): QrTarget | null {
  const instant = settings.qrMode === 'page' && settings.linkStyle === 'instant';
  const [packed, setPacked] = useState<string | null>(null);

  useEffect(() => {
    if (!instant) return;
    let live = true;
    packProfile(profile).then((value) => live && setPacked(value));
    return () => {
      live = false;
    };
  }, [profile, instant]);

  const vcard = useMemo(
    () =>
      settings.qrMode === 'vcard'
        ? buildVCard(profile, { compact: true, hidden: settings.vcardHidden, cardUrl: publishedCardUrl(site) })
        : '',
    [profile, settings.qrMode, settings.vcardHidden, site],
  );

  if (settings.qrMode === 'vcard') return { text: vcard, url: null };
  if (!instant) {
    const url = publishedCardUrl(site);
    return { text: url, url };
  }
  if (packed === null) return null;
  const url = packedCardUrl(site, packed);
  return { text: url, url };
}

function Studio({ tab }: { tab: Tab }) {
  const [profile, setProfile] = useStoredState('qrcard.profile', emptyProfile, sanitizeProfile);
  const [settings, setSettings] = useStoredState('qrcard.settings', defaultSettings, sanitizeSettings);
  const [backgroundImage, setBackgroundImage] = useStoredState(
    'qrcard.background',
    () => '',
    (raw) => (typeof raw === 'string' && isDataImage(raw) ? raw : ''),
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const toast = useToast();

  const site = normalizeSiteUrl(settings.siteUrl) ?? currentSiteUrl();
  const target = useQrTarget(profile, settings, site);
  const text = target?.text ?? null;
  const layout = useMemo(() => (text === null ? null : layoutQr(text, { hole: settings.centerPhoto })), [text, settings.centerPhoto]);
  const fg = settings.qrColor === 'accent' ? ensureContrast(profile.accent) : '#0b0b0f';
  const photo = useImage(profile.photo);
  const instant = settings.qrMode === 'page' && settings.linkStyle === 'instant';

  useEffect(() => {
    document.title = 'QR Card';
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);

  const style = {
    '--accent': profile.accent,
    '--accent-soft': mix(profile.accent, '#ffffff', 0.88),
    '--accent-ink': ensureContrast(profile.accent, '#ffffff', 3),
  } as CSSProperties;

  return (
    <div className="app" style={style}>
      <header className="topbar">
        <a className="brand" href="#/edit">
          <span className="brand-mark" aria-hidden="true">
            <QrCode size={18} />
          </span>
          QR Card
        </a>
        <nav className="tabs" aria-label="Sections">
          {TABS.map(({ id, label, href, icon: Icon }) => (
            <a key={id} href={href} className={tab === id ? 'is-active' : ''} aria-current={tab === id ? 'page' : undefined}>
              <Icon size={20} aria-hidden="true" />
              <span>{label}</span>
            </a>
          ))}
        </nav>
        {tab === 'profile' && (
          <button type="button" className="btn btn-secondary btn-sm preview-btn" onClick={() => setPreviewOpen(true)}>
            <Eye size={16} aria-hidden="true" />
            Preview
          </button>
        )}
      </header>

      <main className="main">
        {tab === 'profile' && (
          <div className="workspace workspace-profile">
            <div className="controls">
              <ProfileEditor profile={profile} onChange={setProfile} />
              {instant && isDataImage(profile.photo) && (
                <Hint>
                  An instant QR link can’t carry an uploaded photo, so people who scan see your initials. Your photo still appears on your wallpaper
                  and in your contact file. To show it on your card page too, choose <a href="#/qr">a short link</a> or use an image URL.
                </Hint>
              )}
              <a className="btn btn-primary btn-block next-step" href="#/qr">
                <QrCode size={18} aria-hidden="true" />
                Make my QR code
              </a>
            </div>
            <div className="stage stage-profile">
              <div className="phone phone-scroll">
                <ProfileCard profile={profile} preview />
              </div>
              <p className="stage-meta">What people see after they scan</p>
            </div>
          </div>
        )}
        {tab === 'qr' && (
          <SharePanel
            profile={profile}
            settings={settings}
            onSettings={setSettings}
            site={site}
            target={target}
            layout={layout}
            fg={fg}
            photo={photo}
            notify={toast.show}
          />
        )}
        {tab === 'wallpaper' && (
          <WallpaperStudio
            profile={profile}
            settings={settings}
            onSettings={setSettings}
            layout={layout}
            fg={fg}
            photo={photo}
            backgroundImage={backgroundImage}
            onBackgroundImage={setBackgroundImage}
            notify={toast.show}
          />
        )}
      </main>

      {previewOpen && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Card preview" onClick={() => setPreviewOpen(false)}>
          <div className="sheet-body" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="icon-btn sheet-close" onClick={() => setPreviewOpen(false)} aria-label="Close preview">
              <X size={20} />
            </button>
            <ProfileCard profile={profile} preview />
          </div>
        </div>
      )}

      <div className={`toast${toast.message ? ' is-visible' : ''}`} role="status" aria-live="polite">
        {toast.message}
      </div>
    </div>
  );
}

export function App() {
  const route = useRoute();
  if (route.view === 'packed') return <PublicCard source={{ kind: 'packed', data: route.data }} />;
  if (route.view === 'published') return <PublicCard source={{ kind: 'published' }} />;
  return <Studio tab={route.tab} />;
}

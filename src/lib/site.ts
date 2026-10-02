/** Normalizes a site address to "https://host/path/" with no query or fragment. */
export function normalizeSiteUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    let path = url.pathname.replace(/\/[^/]*\.[a-z0-9]+$/i, '/');
    if (!path.endsWith('/')) path += '/';
    return `${url.origin}${path}`;
  } catch {
    return null;
  }
}

/** The address this app is served from, e.g. https://card.savankong.com/. */
export function currentSiteUrl(): string {
  return normalizeSiteUrl(window.location.origin + window.location.pathname) ?? window.location.origin + '/';
}

/** True when other phones cannot open the address: localhost, LAN-only or file URLs. */
export function isPrivateSite(site: string): boolean {
  try {
    const { hostname, protocol } = new URL(site);
    if (protocol !== 'https:' && protocol !== 'http:') return true;
    return (
      hostname === 'localhost' ||
      hostname === '0.0.0.0' ||
      hostname === '[::1]' ||
      hostname.endsWith('.local') ||
      /^127\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    );
  } catch {
    return true;
  }
}

export function packedCardUrl(site: string, packed: string): string {
  return `${site}#/c/${packed}`;
}

export function publishedCardUrl(site: string): string {
  return `${site}#/card`;
}

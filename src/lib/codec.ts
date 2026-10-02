import { DEFAULT_ACCENT, LINK_TYPE_CODES, filledLinks, isHttpUrl, sanitizeProfile, type Profile } from './profile';

/*
 * A card link carries the whole profile in the URL fragment, so no server is
 * needed and the data never reaches one. The payload is a positional JSON
 * array, deflated when that is shorter, then base64url-encoded:
 *
 *   [1, name, headline, company, location, bio, email, phone, accent, photoUrl, links]
 *
 * Each link is [typeCode, value], or [0, label, url] for custom links. The
 * first character of the encoded string says how to read the rest:
 * "z" = deflate-raw, "j" = plain JSON.
 */

const FORMAT = 1;

type PackedLink = [number, string] | [0, string, string];

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64 + '==='.slice((b64.length + 3) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function transform(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function packProfile(p: Profile): Promise<string> {
  const links: PackedLink[] = filledLinks(p).map((l) =>
    l.type === 'custom'
      ? [0, l.label.trim(), l.value.trim()]
      : [LINK_TYPE_CODES.indexOf(l.type), l.value.trim()],
  );
  const data = [
    FORMAT,
    p.name.trim(),
    p.headline.trim(),
    p.company.trim(),
    p.location.trim(),
    p.bio.trim(),
    p.email.trim(),
    p.phone.trim(),
    p.accent === DEFAULT_ACCENT ? '' : p.accent.slice(1),
    // Uploaded photos are far too large for a QR code; only a photo URL can ride along.
    isHttpUrl(p.photo) ? p.photo : '',
    links,
  ];
  const json = new TextEncoder().encode(JSON.stringify(data));
  let best = 'j' + toBase64Url(json);
  if (typeof CompressionStream !== 'undefined') {
    try {
      const deflated = 'z' + toBase64Url(await transform(json, new CompressionStream('deflate-raw')));
      if (deflated.length < best.length) best = deflated;
    } catch {
      // Fall back to plain JSON.
    }
  }
  return best;
}

export async function unpackProfile(encoded: string): Promise<Profile> {
  const kind = encoded[0];
  let bytes = fromBase64Url(encoded.slice(1));
  if (kind === 'z') bytes = await transform(bytes, new DecompressionStream('deflate-raw'));
  else if (kind !== 'j') throw new Error('Unknown card link format');

  const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!Array.isArray(data) || data[0] !== FORMAT) throw new Error('Unsupported card link version');
  const [, name, headline, company, location, bio, email, phone, accent, photo, rawLinks] = data;
  const links = (Array.isArray(rawLinks) ? rawLinks : []).map((item: unknown) => {
    if (!Array.isArray(item)) return null;
    if (item[0] === 0) return { type: 'custom', label: item[1], value: item[2] };
    return { type: LINK_TYPE_CODES[item[0] as number], value: item[1] };
  });
  return sanitizeProfile({
    name,
    headline,
    company,
    location,
    bio,
    email,
    phone,
    accent: accent ? `#${accent}` : DEFAULT_ACCENT,
    photo,
    links,
  });
}

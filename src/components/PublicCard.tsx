import { useEffect, useState } from 'react';
import { unpackProfile } from '../lib/codec';
import { sanitizeProfile, type Profile } from '../lib/profile';
import { ProfileCard } from './ProfileCard';

type State = { status: 'loading' } | { status: 'ready'; profile: Profile } | { status: 'error'; message: string };

export type CardSource = { kind: 'packed'; data: string } | { kind: 'published' };

export async function fetchPublished(site?: string): Promise<Profile | null> {
  const url = site ? new URL('profile.json', site) : 'profile.json';
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  const json = (await res.json()) as { profile?: unknown };
  return sanitizeProfile(json.profile);
}

/** Full-page card for visitors, from a packed link or the published profile.json. */
export function PublicCard({ source }: { source: CardSource }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const key = source.kind === 'packed' ? source.data : 'published';

  useEffect(() => {
    let live = true;
    const load =
      source.kind === 'packed'
        ? unpackProfile(source.data)
        : fetchPublished().then((p) => {
            if (!p) throw new Error('missing');
            return p;
          });
    load.then(
      (profile) => live && setState({ status: 'ready', profile }),
      () =>
        live &&
        setState({
          status: 'error',
          message:
            source.kind === 'packed'
              ? 'This card link looks incomplete. Ask the person to share it again.'
              : 'This card hasn’t been published yet.',
        }),
    );
    return () => {
      live = false;
    };
    // `key` captures everything in `source`, which is a new object on every render.
  }, [key]);

  useEffect(() => {
    if (state.status === 'ready' && state.profile.name.trim()) document.title = state.profile.name.trim();
  }, [state]);

  return (
    <main className="public">
      {state.status === 'loading' && <div className="public-status" aria-busy="true" />}
      {state.status === 'error' && (
        <div className="public-status">
          <p>{state.message}</p>
          {source.kind === 'published' && (
            <a className="btn btn-secondary btn-sm" href="#/edit">
              Make or edit your card
            </a>
          )}
        </div>
      )}
      {state.status === 'ready' && <ProfileCard profile={state.profile} />}
    </main>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadImage } from './lib/image';

/**
 * State mirrored to localStorage. Only local edits are written (debounced, and
 * flushed when the page hides), so an idle tab never overwrites newer data from
 * another tab; edits made in other tabs are picked up as they happen.
 */
export function useStoredState<T>(key: string, init: () => T, sanitize: (raw: unknown) => T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) return sanitize(JSON.parse(raw));
    } catch {
      // Unreadable or unavailable storage: start fresh.
    }
    return init();
  });
  const latest = useRef(value);
  latest.current = value;
  const unsaved = useRef(false);
  // The first render and values that came from another tab are already stored.
  const skipWrite = useRef(true);
  const sanitizeRef = useRef(sanitize);
  sanitizeRef.current = sanitize;

  const write = useCallback(() => {
    unsaved.current = false;
    try {
      localStorage.setItem(key, JSON.stringify(latest.current));
    } catch {
      // Storage full or blocked; the app still works for this visit.
    }
  }, [key]);

  useEffect(() => {
    if (skipWrite.current) {
      skipWrite.current = false;
      return;
    }
    unsaved.current = true;
    const timer = setTimeout(write, 300);
    return () => clearTimeout(timer);
  }, [value, write]);

  useEffect(() => {
    const flush = () => unsaved.current && write();
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key || e.newValue === null) return;
      try {
        skipWrite.current = true;
        setValue(sanitizeRef.current(JSON.parse(e.newValue)));
      } catch {
        skipWrite.current = false;
      }
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('storage', onStorage);
    };
  }, [key, write]);

  return [value, setValue] as const;
}

export type Tab = 'profile' | 'qr' | 'wallpaper';

export type Route = { view: 'studio'; tab: Tab } | { view: 'packed'; data: string } | { view: 'published' };

/**
 * Visitors land on the bare address, so it shows the published card; the
 * editor lives under #/edit. "#/card" is kept for links made before the move.
 */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  if (path.startsWith('c/')) return { view: 'packed', data: path.slice(2) };
  if (path === 'edit') return { view: 'studio', tab: 'profile' };
  if (path === 'qr' || path === 'wallpaper') return { view: 'studio', tab: path };
  return { view: 'published' };
}

export function useRoute(): Route {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return parseRoute(hash);
}

/** Loads an image for canvas drawing. Null while loading, when empty, or on failure. */
export function useImage(src: string): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) {
      setImg(null);
      return;
    }
    let live = true;
    loadImage(src).then(
      (loaded) => live && setImg(loaded),
      () => live && setImg(null),
    );
    return () => {
      live = false;
    };
  }, [src]);
  return img;
}

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((text: string) => {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 2200);
  }, []);
  return { message, show };
}

import { useCallback, useEffect, useState } from 'react';
import type { LibrarySnapshot } from '../api/library/route';

const EMPTY: LibrarySnapshot = { shapes: {}, collections: [] };

/** Shapes already saved (for duplicate warnings in any key) and collection names. */
export function useLibrary() {
  const [library, setLibrary] = useState<LibrarySnapshot>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/library', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Library failed to load (${res.status})`);
      setLibrary((await res.json()) as LibrarySnapshot);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Library failed to load');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { library, error, refresh };
}

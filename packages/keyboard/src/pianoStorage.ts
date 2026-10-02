/**
 * Sample fetching for smplr. Successful responses are kept in Cache Storage,
 * so a repeat visit loads the piano without network requests. Failures are
 * counted (smplr skips a failed sample silently) and never cached; smplr's
 * own CacheStorage would also cache a 404.
 */

import type { Storage, StorageResponse } from 'smplr';

const CACHE_NAME = 'voicings-piano-v1';

export type PianoStorage = Storage & { readonly failures: number };

export function createPianoStorage(
  cachesApi: CacheStorage | undefined = typeof caches === 'undefined' ? undefined : caches,
  fetcher: typeof fetch = (...args) => fetch(...args),
): PianoStorage {
  // Cache Storage is unavailable outside secure contexts; fall back to plain fetches.
  const cache: Promise<Cache | null> = cachesApi
    ? cachesApi.open(CACHE_NAME).catch(() => null)
    : Promise.resolve(null);
  let failures = 0;

  async function fetchSample(request: string): Promise<StorageResponse> {
    const store = await cache;
    const hit = await store?.match(request).catch(() => undefined);
    if (hit) return hit;
    try {
      const response = await fetcher(request);
      if (!response.ok) failures++;
      else await store?.put(request, response.clone()).catch(() => undefined);
      return response;
    } catch (error) {
      failures++;
      throw error;
    }
  }

  return {
    fetch: fetchSample,
    get failures() {
      return failures;
    },
  };
}

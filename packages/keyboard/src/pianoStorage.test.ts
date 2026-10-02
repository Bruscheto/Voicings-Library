import { describe, expect, it, vi } from 'vitest';
import { createPianoStorage } from './pianoStorage';

const BASE = 'https://example.test/samples';

function fakeCaches() {
  const store = new Map<string, Response>();
  const cache = {
    match: vi.fn(async (key: string) => store.get(key)?.clone()),
    put: vi.fn(async (key: string, response: Response) => void store.set(key, response)),
  };
  return { api: { open: vi.fn(async () => cache) } as unknown as CacheStorage, cache, store };
}

const ok = () => new Response(new Uint8Array([1, 2, 3]), { status: 200 });

describe('createPianoStorage', () => {
  it('fetches a sample once, then serves it from Cache Storage', async () => {
    const { api, store } = fakeCaches();
    const fetcher = vi.fn(async () => ok());
    const storage = createPianoStorage(api, fetcher as unknown as typeof fetch);

    const url = `${BASE}/Mf%20D%230.ogg`;
    const first = await storage.fetch(url);
    const second = await storage.fetch(url);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(url);
    expect(store.has(url)).toBe(true);
    expect(first.status).toBe(200);
    expect((await second.arrayBuffer()).byteLength).toBe(3);
    expect(storage.failures).toBe(0);
  });

  it('counts failed responses and never caches them', async () => {
    const { api, store } = fakeCaches();
    const fetcher = vi.fn(async () => new Response('missing', { status: 404 }));
    const storage = createPianoStorage(api, fetcher as unknown as typeof fetch);

    expect((await storage.fetch(`${BASE}/MF C3.ogg`)).status).toBe(404);
    await storage.fetch(`${BASE}/MF C3.ogg`);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(store.size).toBe(0);
    expect(storage.failures).toBe(2);
  });

  it('counts network errors and rethrows them', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('offline');
    });
    const storage = createPianoStorage(undefined, fetcher as unknown as typeof fetch);

    await expect(storage.fetch(`${BASE}/MF C3.ogg`)).rejects.toThrow('offline');
    expect(storage.failures).toBe(1);
  });

  it('still fetches when Cache Storage cannot be opened', async () => {
    const api = { open: vi.fn(async () => Promise.reject(new Error('insecure'))) };
    const fetcher = vi.fn(async () => ok());
    const storage = createPianoStorage(
      api as unknown as CacheStorage,
      fetcher as unknown as typeof fetch,
    );

    expect((await storage.fetch(`${BASE}/MF C3.ogg`)).status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

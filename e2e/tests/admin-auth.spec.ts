import { expect, test } from '@playwright/test';
import { ADMIN } from './piano';

test('admin pages and APIs reject missing, wrong and malformed credentials', async ({
  playwright,
}) => {
  const client = await playwright.request.newContext({ httpCredentials: undefined });
  try {
    for (const path of ['/', '/api/library', '/_next/static/nonexistent.js']) {
      const response = await client.get(`${ADMIN}${path}`);
      expect(response.status()).toBe(401);
      expect(response.headers()['www-authenticate']).toContain('Basic');
      expect(response.headers()['cache-control']).toBe('no-store');
    }
    for (const authorization of [
      undefined,
      'Basic !!!',
      'Bearer wrong',
      'Basic d3Jvbmc6d3Jvbmc=',
    ]) {
      const response = await client.post(`${ADMIN}/api/voicings`, {
        headers: authorization ? { authorization } : {},
        data: { pitches: ['C3', 'E3', 'G3'] },
      });
      expect(response.status()).toBe(401);
    }
  } finally {
    await client.dispose();
  }
});

test('admin API handlers reject middleware-bypass requests independently', async ({
  playwright,
}) => {
  const client = await playwright.request.newContext({
    httpCredentials: undefined,
    extraHTTPHeaders: {
      'x-middleware-subrequest': 'middleware:middleware:middleware:middleware:middleware',
    },
  });
  try {
    expect((await client.get(`${ADMIN}/api/library`)).status()).toBe(401);
    expect(
      (
        await client.post(`${ADMIN}/api/voicings`, { data: { pitches: ['C3', 'E3', 'G3'] } })
      ).status(),
    ).toBe(401);
  } finally {
    await client.dispose();
  }
});

test('authenticated admin reads work and cross-origin writes are rejected', async ({
  playwright,
}) => {
  const client = await playwright.request.newContext({
    httpCredentials: { username: 'e2e-admin', password: 'e2e-only-password', send: 'always' },
  });
  try {
    expect((await client.get(`${ADMIN}/api/library`)).status()).toBe(200);
    const response = await client.post(`${ADMIN}/api/voicings`, {
      headers: { origin: 'https://untrusted.example' },
      data: { pitches: ['C3', 'E3', 'G3'] },
    });
    expect(response.status()).toBe(403);
  } finally {
    await client.dispose();
  }
});

const challengeHeaders = {
  'WWW-Authenticate': 'Basic realm="Voicings capture", charset="UTF-8"',
  'Cache-Control': 'no-store',
};

/** Used by both middleware and route handlers; no credentials enter client bundles. */
export async function authorizeAdmin(request: Request): Promise<Response | null> {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    return new Response('Admin access is not configured', {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(request.headers.get('authorization') ?? '');
  if (match) {
    try {
      const bytes = Uint8Array.from(atob(match[1]), (character) => character.charCodeAt(0));
      const supplied = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      const encoder = new TextEncoder();
      const [actual, expected] = await Promise.all(
        [supplied, `${username}:${password}`].map((value) =>
          crypto.subtle.digest('SHA-256', encoder.encode(value)),
        ),
      );
      const actualBytes = new Uint8Array(actual);
      const expectedBytes = new Uint8Array(expected);
      let difference = 0;
      for (let index = 0; index < actualBytes.length; index++) {
        difference |= actualBytes[index] ^ expectedBytes[index];
      }
      if (difference === 0) return null;
    } catch {
      // Malformed Base64 or UTF-8 is an invalid credential, never an auth bypass.
    }
  }
  return new Response('Authentication required', { status: 401, headers: challengeHeaders });
}

export function rejectCrossOriginWrite(request: Request): Response | null {
  const origin = request.headers.get('origin');
  // Next's internal URL can use localhost behind its HTTP server or a reverse proxy.
  const target = new URL(request.url);
  target.host = request.headers.get('host') ?? target.host;
  const protocol = request.headers.get('x-forwarded-proto');
  if (protocol === 'http' || protocol === 'https') target.protocol = `${protocol}:`;
  if (origin && origin !== target.origin) {
    return new Response('Cross-origin writes are not allowed', {
      status: 403,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  return null;
}

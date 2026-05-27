const raw = process.env.KINO_BASE_URL ?? 'https://www.usekino.dev';
// Silently normalise legacy configs that omit the www subdomain — Node.js fetch
// strips the Authorization header when following the non-www → www redirect.
const BASE_URL = raw.replace('://usekino.dev', '://www.usekino.dev');
const API_KEY = process.env.KINO_API_KEY!;

export async function kinoFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE_URL}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      `Kino: cannot reach ${BASE_URL}. Check your internet connection and try again.`,
    );
  }

  if (res.status === 401) {
    throw new Error(
      'Kino: API key is invalid or has been revoked. Re-run setup to reconnect:\n  npx @kino-app/mcp setup',
    );
  }
  if (res.status === 429) {
    throw new Error('Kino: rate limited. Wait a moment and try again.');
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kino: server error ${res.status} on ${path} — ${text}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

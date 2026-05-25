const BASE_URL = process.env.KINO_BASE_URL ?? 'https://kino.app';
const API_KEY = process.env.KINO_API_KEY!;

export async function kinoFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kino API error ${res.status}: ${text}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

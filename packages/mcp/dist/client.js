/**
 * Builds a request-scoped fetch bound to a Kino base URL and bearer token.
 * The stdio server builds one from env vars; the remote MCP route builds one
 * per request from the caller's OAuth access token.
 */
export function createKinoFetch({ baseUrl, token, }) {
    // Silently normalise legacy configs that omit the www subdomain — Node.js fetch
    // strips the Authorization header when following the non-www → www redirect.
    const BASE_URL = baseUrl.replace('://usekino.dev', '://www.usekino.dev');
    return async function kinoFetch(path, options = {}) {
        const url = `${BASE_URL}${path}`;
        let res;
        try {
            res = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                    ...options.headers,
                },
            });
        }
        catch {
            throw new Error(`Kino: cannot reach ${BASE_URL}. Check your internet connection and try again.`);
        }
        if (res.status === 401) {
            throw new Error('Kino: authentication failed. Your API key or access token is invalid or has been revoked.');
        }
        if (res.status === 429) {
            throw new Error('Kino: rate limited. Wait a moment and try again.');
        }
        // A 409 is the one error the agent can actually recover from on its own, so
        // it says how instead of surfacing a bare status code.
        if (res.status === 409) {
            throw new Error(`Kino: conflict (409) on ${path}. Something changed since you read it — read it again, apply your change on top of the new version, and retry. ${await res.text()}`);
        }
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Kino: server error ${res.status} on ${path} — ${text}`);
        }
        if (res.status === 204)
            return undefined;
        return res.json();
    };
}

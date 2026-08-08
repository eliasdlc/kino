#!/usr/bin/env node
/**
 * Prueba de carga del rate limit por identidad (KIN-149 / BE-12).
 *
 * Dispara N requests concurrentes con una API key contra un endpoint limitado y
 * verifica que las primeras pasan, el resto recibe 429 con `Retry-After`, y que
 * una segunda API key sigue pasando mientras la primera está agotada.
 *
 * CÓRRELO CONTRA UN DESPLIEGUE DE PREVIEW, NO CONTRA LOCALHOST. En local hay un
 * solo proceso, así que hasta el `Map` en memoria que esto vino a reemplazar
 * pasaría la prueba. El bug sólo se reproduce con varias instancias serverless.
 *
 *   node scripts/rate-limit-load-test.mjs \
 *     --url https://kino-git-rama.vercel.app \
 *     --key sk-kino-xxx [--key2 sk-kino-yyy] [--path /api/mcp] [--count 100]
 *
 * Si el preview tiene Deployment Protection, Vercel corta en el edge antes de
 * que el proxy corra y todo devuelve 401. Pasá `--bypass "_vercel_jwt=…"` con
 * la cookie de un enlace compartido para atravesarla.
 */

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1]]);
    return pairs;
  }, []),
);

const baseUrl = args.url?.replace(/\/$/, '');
const key = args.key;
const key2 = args.key2;
const path = args.path ?? '/api/mcp';
const count = Number(args.count ?? 100);

if (!baseUrl || !key) {
  console.error('Faltan --url y --key. Ver el encabezado del archivo.');
  process.exit(1);
}
if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
  console.error('Apuntá a un preview, no a localhost: en un solo proceso la prueba no vale.');
  process.exit(1);
}

/** El body es irrelevante: sólo interesa el status que devuelve el proxy. */
function fire(token) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(args.bypass ? { Cookie: args.bypass } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  }).then((res) => ({
    status: res.status,
    retryAfter: res.headers.get('retry-after'),
    remaining: res.headers.get('x-ratelimit-remaining'),
  }));
}

console.log(`→ ${count} requests concurrentes a ${baseUrl}${path}\n`);
const results = await Promise.all(Array.from({ length: count }, () => fire(key)));

const limited = results.filter((r) => r.status === 429);
const passed = results.filter((r) => r.status !== 429);
const byStatus = results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});

console.log('statuses:', byStatus);
// Lo que se mide es el limitador, no la autenticación: cualquier status que no
// sea 429 significa que la request lo atravesó. Con una key inválida eso es un
// 401 de la capa de auth, y sirve igual — el proxy ya la contó.
console.log(`atravesaron el limitador: ${passed.length} · cortadas con 429: ${limited.length}`);

const sinRetryAfter = limited.filter((r) => !r.retryAfter);
if (limited.length === 0) {
  console.error('\n✗ Ninguna request fue cortada. El límite no está aplicando.');
} else if (sinRetryAfter.length > 0) {
  console.error(`\n✗ ${sinRetryAfter.length} respuestas 429 sin Retry-After.`);
} else {
  console.log(`✓ 429 con Retry-After (ej. ${limited[0].retryAfter}s)`);
}

if (key2) {
  const other = await fire(key2);
  console.log(
    other.status === 429
      ? `\n✗ La segunda API key también fue cortada (${other.status}). El límite es global y está mal.`
      : `\n✓ La segunda identidad sigue pasando (${other.status}) con la primera agotada.`,
  );
} else {
  console.log('\n(pasá --key2 para verificar que el límite no es global)');
}

import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Ninguna ruta contesta sin credencial (KIN-190).
 *
 * Este test no enumera rutas a mano: importa todos los `*.routes.ts` y prueba
 * cada handler exportado que pase por el wrapper. Con la adopción terminada
 * (KIN-193) eso es la práctica totalidad de la API, y una ruta nueva queda
 * cubierta el día que se escribe, sin tocar este archivo.
 *
 * `getAuthContext` se mockea a "no hay nadie": lo que se comprueba es que el
 * borde de autenticación existe y responde con el shape canónico, no cómo
 * valida una credencial (eso es de `auth-context`).
 */

vi.mock('@/shared/utils/auth-context', () => ({
  getAuthContext: vi.fn(async () => null),
}));

type RouteModule = Record<string, unknown>;

// `import.meta.glob` lo resuelve Vite en tiempo de build. Los tipos vienen de
// `vite/client`, que no es dependencia directa de este repo, así que se declara
// aquí lo poco que se usa en vez de arrastrar el paquete entero.
declare global {
  interface ImportMeta {
    glob<T>(pattern: string): Record<string, () => Promise<T>>;
  }
}

const routeModules = import.meta.glob<RouteModule>('./*/*.routes.ts');

/**
 * Los tres slices que no pasan por el wrapper tienen su razón escrita en el
 * archivo: `api-keys` y `onboarding` son session-only (KIN-144) y `github-sync`
 * tiene dos handlers de OAuth que responden con un 302. Se excluyen aquí
 * porque autentican por otra vía, no porque no autentiquen.
 */
const NOT_WRAPPED = ['api-keys', 'onboarding', 'github-sync'];

const CONTEXT = { params: Promise.resolve({}) };

function anonymousRequest(method: string) {
  return new NextRequest('http://localhost/api/probe', {
    method,
    ...(method === 'GET' || method === 'HEAD'
      ? {}
      : { body: '{}', headers: { 'content-type': 'application/json' } }),
  });
}

/** Deduce el verbo del nombre exportado; el default es GET, que es el más laxo. */
function methodFor(exportName: string): string {
  const upper = exportName.toUpperCase();
  for (const verb of ['DELETE', 'PATCH', 'POST', 'PUT']) {
    if (upper.startsWith(verb) || upper === verb) return verb;
  }
  return 'GET';
}

describe('ninguna ruta contesta sin credencial', () => {
  for (const [path, load] of Object.entries(routeModules)) {
    const slice = path.split('/')[1]!;
    if (NOT_WRAPPED.includes(slice)) continue;

    it(`${slice}: todos los handlers devuelven 401`, async () => {
      const mod = await load();
      const handlers = Object.entries(mod).filter(
        ([, value]) => typeof value === 'function' && (value as { length: number }).length === 2,
      );

      // Si un slice deja de exportar handlers, este test se volvería verde por
      // vacío sin que nadie lo note.
      expect(handlers.length).toBeGreaterThan(0);

      for (const [name, handler] of handlers) {
        const run = handler as (req: NextRequest, ctx: unknown) => Promise<Response>;
        const res = await run(anonymousRequest(methodFor(name)), CONTEXT);

        expect(res.status, `${slice}.${name}`).toBe(401);
        await expect(res.json(), `${slice}.${name}`).resolves.toEqual({
          code: 'UNAUTHORIZED',
          message: 'Unauthorized',
        });
      }
    });
  }
});

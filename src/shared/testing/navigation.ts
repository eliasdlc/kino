/**
 * `next/navigation` para tests de componente.
 *
 * Fuera de la app, `useRouter` lanza: no hay router de Next montado. Cada test
 * que renderiza algo que navega lo tenía que fingir a mano, y cada mano
 * fingía una forma distinta. Aquí está una sola, con las cinco cosas que el
 * producto importa de verdad de ese módulo.
 *
 * En el test:
 *
 * ```ts
 * vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());
 * ```
 */

import { vi } from "vitest";

/** A dónde empujó el componente. Se comprueba con `expect(testRouter.push)`. */
export const testRouter = {
  push: vi.fn<(href: string) => void>(),
  replace: vi.fn<(href: string) => void>(),
  back: vi.fn<() => void>(),
  forward: vi.fn<() => void>(),
  refresh: vi.fn<() => void>(),
  prefetch: vi.fn<(href: string) => void>(),
};

/** Adónde navegó el servidor. `redirect` corta el render, como en la app. */
export const testRedirect = vi.fn<(href: string) => never>();

const DEFAULT_PATHNAME = "/";

let pathname = DEFAULT_PATHNAME;
let searchParams = new URLSearchParams();

/** La URL que el componente cree estar leyendo. */
export function setNavigation(next: { pathname?: string; search?: string }): void {
  if (next.pathname !== undefined) pathname = next.pathname;
  if (next.search !== undefined) searchParams = new URLSearchParams(next.search);
}

/** Vuelve a la raíz sin parámetros y olvida las llamadas. Lo corre `jsdom-setup`. */
export function resetNavigation(): void {
  pathname = DEFAULT_PATHNAME;
  searchParams = new URLSearchParams();
  for (const spy of Object.values(testRouter)) spy.mockClear();
  testRedirect.mockClear();
}

/** El módulo que sustituye a `next/navigation`. */
export function navigationMock() {
  return {
    useRouter: () => testRouter,
    usePathname: () => pathname,
    useSearchParams: () => searchParams,
    redirect: (href: string) => {
      testRedirect(href);
      throw new Error(`NEXT_REDIRECT: ${href}`);
    },
    notFound: () => {
      throw new Error("NEXT_NOT_FOUND");
    },
  };
}

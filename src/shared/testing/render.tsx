/**
 * El árbol de proveedores que monta un test de componente, en un solo sitio.
 *
 * La regla que lo sostiene: un `.test.tsx` que no renderice desde aquí se
 * inventó su propio árbol. El motivo no es uniformidad, es que los proveedores
 * de la app (tema, arquetipos, cliente de Convex) cambian, y cinco copias del
 * árbol se quedan viejas de una en una sin que nada falle.
 */

import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { ConvexProviderWithAuth, type ConvexReactClient } from "convex/react";
import { SystemTypeProvider } from "@/components/SystemTypeProvider";
import { ThemeProvider, type ThemeMode } from "@/components/ThemeProvider";
import { makeTestConvexClient, useTestAuth, type TestConvexClient } from "./convex-client";

export { makeTestConvexClient, stubQuery, TestConvexClient } from "./convex-client";
export type { ConvexCall, QueryStub } from "./convex-client";

/** El ancho de un iPhone 15, el mismo de las capturas de revisión. */
export const MOBILE_WIDTH = 393;

export interface RenderWithProvidersOptions extends Omit<RenderOptions, "wrapper"> {
  /** El cliente de Convex. Si no se pasa, las queries se quedan cargando. */
  convex?: TestConvexClient;
  theme?: ThemeMode;
}

export interface RenderWithProvidersResult extends RenderResult {
  convex: TestConvexClient;
}

/** Renderiza en escritorio, con el árbol de proveedores de la app. */
export function renderWithProviders(ui: React.ReactNode, options: RenderWithProvidersOptions = {}): RenderWithProvidersResult {
  const { convex = makeTestConvexClient(), theme = "light", ...rest } = options;

  // El único `as` del harness: `TestConvexClient` implementa lo que el árbol
  // de React llama, no las cuarenta cosas que la clase real expone.
  const client = convex as unknown as ConvexReactClient;

  const result = render(ui, {
    ...rest,
    wrapper: ({ children }) => (
      <ConvexProviderWithAuth client={client} useAuth={useTestAuth}>
        <ThemeProvider initialTheme={theme}>
          <SystemTypeProvider>{children}</SystemTypeProvider>
        </ThemeProvider>
      </ConvexProviderWithAuth>
    ),
  });

  return { ...result, convex };
}

/**
 * Lo mismo, en móvil. El ancho se asigna **antes** de montar porque
 * `useIsMobile` arranca en `false` y cambia en el efecto: sin esto, un test de
 * la rama móvil prueba la de escritorio y pasa igual, que es la clase de test
 * que da falsa confianza.
 *
 * El ancho vuelve a su sitio en el `beforeEach` de `jsdom-setup.ts`.
 */
export function renderMobile(ui: React.ReactNode, options: RenderWithProvidersOptions = {}): RenderWithProvidersResult {
  window.innerWidth = MOBILE_WIDTH;
  return renderWithProviders(ui, options);
}

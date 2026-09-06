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
import { getFunctionName, type FunctionReference, type FunctionReturnType } from "convex/server";
import { SystemTypeProvider } from "@/components/SystemTypeProvider";
import { ThemeProvider, type ThemeMode } from "@/components/ThemeProvider";

/** El ancho de un iPhone 15, el mismo de las capturas de revisión. */
export const MOBILE_WIDTH = 393;

/** Lo que una query devuelve en el test, atado al tipo real de esa query. */
export interface QueryStub {
  readonly name: string;
  readonly value: unknown;
}

/**
 * El valor que una query devolverá. El tipo sale de la propia query, así que
 * cambiar lo que devuelve `api.tasks.list` rompe el test que la finge.
 */
export function stubQuery<Q extends FunctionReference<"query">>(query: Q, value: FunctionReturnType<Q>): QueryStub {
  return { name: getFunctionName(query), value };
}

/** Una escritura que el componente disparó. */
export interface ConvexCall {
  readonly kind: "mutation" | "action";
  readonly name: string;
  readonly args: Record<string, unknown>;
}

/**
 * El cliente de Convex de los tests: responde las queries que se le den y
 * apunta las escrituras en vez de mandarlas. Implementa lo que `useQuery`,
 * `useMutation` y `useAction` llaman de verdad sobre el cliente, ni más ni
 * menos, y por eso el componente corre sin saber que no hay servidor.
 */
export class TestConvexClient {
  readonly #results = new Map<string, unknown>();
  readonly #listeners = new Map<string, Set<() => void>>();

  /** Las mutaciones y acciones que el componente disparó, en orden. */
  readonly calls: ConvexCall[] = [];

  constructor(stubs: readonly QueryStub[] = []) {
    for (const stub of stubs) this.#results.set(stub.name, stub.value);
  }

  /**
   * Cambia lo que una query devuelve y avisa a quien la está mirando, que es
   * lo que hace el servidor cuando la base cambia. Sirve para probar que un
   * componente se repinta con datos nuevos sin volver a montarlo.
   */
  publish(stub: QueryStub): void {
    this.#results.set(stub.name, stub.value);
    for (const notify of this.#listeners.get(stub.name) ?? []) notify();
  }

  watchQuery(query: FunctionReference<"query">) {
    const name = getFunctionName(query);
    const results = this.#results;
    const listeners = this.#listeners;
    return {
      localQueryResult: () => results.get(name),
      localQueryLogs: () => undefined,
      journal: () => undefined,
      onUpdate: (callback: () => void) => {
        const forName = listeners.get(name) ?? new Set<() => void>();
        forName.add(callback);
        listeners.set(name, forName);
        return () => {
          forName.delete(callback);
        };
      },
    };
  }

  mutation(mutation: FunctionReference<"mutation">, args: Record<string, unknown>): Promise<undefined> {
    this.calls.push({ kind: "mutation", name: getFunctionName(mutation), args });
    return Promise.resolve(undefined);
  }

  action(action: FunctionReference<"action">, args: Record<string, unknown>): Promise<undefined> {
    this.calls.push({ kind: "action", name: getFunctionName(action), args });
    return Promise.resolve(undefined);
  }

  /**
   * `ConvexProviderWithAuth` la llama al montar y espera a que el backend
   * confirme la identidad por el callback. Aquí el backend somos nosotros y la
   * respuesta es que sí: sin esta llamada, `useConvexAuth` se queda en «aún no»
   * y toda query de todo componente se salta la suscripción para siempre.
   */
  setAuth(_fetchToken: () => Promise<string | null>, onChange: (authenticated: boolean) => void): void {
    onChange(true);
  }

  clearAuth(): void {}
}

/** El cliente de prueba con las queries que este test necesita respondidas. */
export function makeTestConvexClient(stubs: readonly QueryStub[] = []): TestConvexClient {
  return new TestConvexClient(stubs);
}

/**
 * La sesión que ve un test: siempre autenticada. `useConvexQuery` no se
 * suscribe hasta que `useConvexAuth` dice que hay identidad, así que sin esto
 * toda query de todo componente se quedaría cargando para siempre.
 */
const TEST_AUTH = {
  isLoading: false,
  isAuthenticated: true,
  // Estable a propósito: el efecto que llama a `setAuth` la lleva en sus
  // dependencias, y una función nueva por render lo dispara en bucle.
  fetchAccessToken: async () => "test-token",
};

function useTestAuth() {
  return TEST_AUTH;
}

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

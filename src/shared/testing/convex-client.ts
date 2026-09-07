/**
 * El cliente de Convex que responde con datos dados y apunta las escrituras.
 *
 * Lo comparten los tests de componente (`render.tsx`) y el catálogo visual
 * (`/system-design`): los dos necesitan montar un componente real con datos
 * conocidos y sin servidor. Vive aparte de `render.tsx` para que el catálogo
 * no arrastre `@testing-library/react` al bundle de la app.
 */
import { getFunctionName, type FunctionReference, type FunctionReturnType } from "convex/server";

/** Lo que una query devuelve, atado al tipo real de esa query. */
export interface QueryStub {
  readonly name: string;
  readonly value: unknown;
}

/**
 * El valor que una query devolverá. El tipo sale de la propia query, así que
 * cambiar lo que devuelve `api.tasks.list` rompe el test o el specimen que la finge.
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
 * Responde las queries que se le den y apunta las escrituras en vez de
 * mandarlas. Implementa lo que `useQuery`, `useMutation` y `useAction` llaman
 * de verdad sobre el cliente, ni más ni menos, y por eso el componente corre
 * sin saber que no hay servidor.
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
   * lo que hace el servidor cuando la base cambia.
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

/** El cliente con las queries que este test o specimen necesita respondidas. */
export function makeTestConvexClient(stubs: readonly QueryStub[] = []): TestConvexClient {
  return new TestConvexClient(stubs);
}

/**
 * La sesión que ve el cliente de prueba: siempre autenticada. `useConvexQuery`
 * no se suscribe hasta que `useConvexAuth` dice que hay identidad.
 */
const TEST_AUTH = {
  isLoading: false,
  isAuthenticated: true,
  // Estable a propósito: el efecto que llama a `setAuth` la lleva en sus
  // dependencias, y una función nueva por render lo dispara en bucle.
  fetchAccessToken: async () => "test-token",
};

export function useTestAuth() {
  return TEST_AUTH;
}

import { afterAll } from "vitest";
import { startTestDatabase } from "./engine";

/**
 * Setup de `vitest.integration.config.ts`. Corre antes de que vitest importe el
 * archivo de test, que es la única ventana posible: `@/shared/db` lee
 * `DATABASE_URL` al importarse, así que la base tiene que existir antes.
 *
 * El ciclo de vida vive aquí y no en cada test para que un `.itest.ts` nuevo no
 * tenga que acordarse de cerrar nada.
 */
const stopDatabase = await startTestDatabase();

// Ya con DATABASE_URL puesta, así que el cliente apunta donde toca. Es la misma
// instancia del módulo que verán los servicios bajo test.
const { db } = await import("@/shared/db");

afterAll(async () => {
  // El cliente primero: cerrar el servidor con una conexión viva deja a vitest
  // esperando un socket que ya no contesta.
  await db.$client.end();
  await stopDatabase();
});

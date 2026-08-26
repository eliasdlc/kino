/**
 * Lo que de verdad cruza la red.
 *
 * `typeof tasks.$inferSelect` describe una fila de Postgres, no un cuerpo JSON.
 * No son lo mismo: `JSON.stringify` convierte un `Date` en texto ISO y no hay
 * nada en el tipo que lo diga. El cliente sobrevivía envolviendo todo en
 * `new Date(...)` por si acaso.
 *
 * `Transport<T>` deriva del tipo de la fila en vez de repetirlo, así que añadir
 * una columna no obliga a acordarse de nada, y `toTransport` es la conversión
 * que el compilador exige para que el valor coincida con el tipo declarado.
 */

export type Transport<T> = T extends Date
  ? string
  : T extends readonly (infer U)[]
    ? Transport<U>[]
    : T extends object
      ? { [K in keyof T]: Transport<T[K]> }
      : T;

function convert(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(convert);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, convert(inner)]),
    );
  }
  return value;
}

/**
 * Pasa un valor del servidor a su forma de transporte.
 *
 * Se llama en los dos bordes por los que un dato del servidor llega al cliente:
 * la salida de una ruta y el `initialData` que un Server Component le pasa a
 * TanStack Query. El segundo importa tanto como el primero — React conserva los
 * `Date` al serializar props, así que sin esto el `initialData` traía objetos
 * `Date` y el primer refetch los reemplazaba por texto.
 */
export function toTransport<T>(value: T): Transport<T> {
  return convert(value) as Transport<T>;
}

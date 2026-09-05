/**
 * La forma de un valor una vez cruza la red: cada `Date` se vuelve texto ISO.
 * Deriva del tipo original en vez de repetirlo, así que añadir un campo no
 * obliga a acordarse de nada.
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
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, convert(inner)]));
  }
  return value;
}

/** Pasa un valor con fechas a su forma de transporte, con las fechas en texto ISO. */
export function toTransport<T>(value: T): Transport<T> {
  return convert(value) as Transport<T>;
}

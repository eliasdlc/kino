// El contador de lecturas de los tests. La restricción 9 de AGENTS.md dice que
// una query declara qué rango lee, y eso se comprueba contando lo que abre, no
// afirmándolo: cada `useConvexQuery` es una suscripción, así que lo que una
// lectura se lleva se vuelve a llevar en cada escritura que la toque.

/** Lo que una lectura abrió. Son dos números distintos y los dos importan. */
export interface Cuenta {
  /** Consultas abiertas: cada una es un recorrido de índice. */
  consultas: number;
  /** Documentos que esas consultas se llevan, que es el I/O que se paga. */
  documentos: number;
}

/**
 * Envuelve el `db` de Convex para contar lo que una lectura abre. Se mete en el
 * encadenado entero (`query().withIndex().take()`) porque el número de
 * consultas y el de documentos son dos cosas distintas: un `ctx.db.get` suma un
 * documento y ninguna consulta, y un `.collect()` suma tantos documentos como
 * filas se lleve.
 *
 *     const cuenta: Cuenta = { consultas: 0, documentos: 0 };
 *     await t.run((ctx) => leer({ ...ctx, db: espiar(ctx.db, cuenta) }));
 */
export function espiar<T extends object>(objetivo: T, cuenta: Cuenta): T {
  return new Proxy(objetivo, {
    get(destino, prop) {
      const valor: unknown = Reflect.get(destino, prop, destino);
      if (typeof valor !== 'function') return valor;
      const metodo = valor as (...args: unknown[]) => unknown;
      return (...args: unknown[]) => {
        if (prop === 'query') cuenta.consultas++;
        const salida = metodo.apply(destino, args);
        if (salida instanceof Promise) {
          return salida.then((filas: unknown) => {
            cuenta.documentos += Array.isArray(filas) ? filas.length : filas == null ? 0 : 1;
            return filas;
          });
        }
        return typeof salida === 'object' && salida !== null ? espiar(salida, cuenta) : salida;
      };
    },
  });
}

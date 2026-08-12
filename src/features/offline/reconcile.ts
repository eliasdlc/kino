/**
 * Reconciliación de la entidad optimista con la que devuelve el servidor
 * (KIN-57).
 *
 * Cuando algo se crea sin conexión, la lista cacheada muestra un placeholder con
 * un id inventado por el navegador. Al subirse, el servidor devuelve la entidad
 * real con **otro** id. Esta función es el punto donde ambas se convierten en una
 * sola fila de la lista.
 *
 * ── El id del placeholder ES el `clientRequestId` ────────────────────────────
 *
 * Los dos son uuid, así que en vez de arrastrar un campo extra por los tipos de
 * cliente, el placeholder se identifica con el propio id de la petición. Eso da
 * dos cosas gratis:
 *
 *  - **Se puede reconstruir.** Tras cerrar y reabrir la app, la cola persistida
 *    conserva las variables de la mutación (donde vive el `clientRequestId`), así
 *    que el mismo placeholder se vuelve a dibujar con el mismo id en vez de
 *    aparecer como una entidad nueva y distinta.
 *  - **Se sabe qué está pendiente** comparando el id de la fila contra los
 *    `clientRequestId` que siguen en la cola, sin leer ninguna columna nueva.
 *
 * De ahí salen las dos garantías que importan:
 *
 *  - **No duplica.** Aunque la cola reproduzca la misma creación dos veces, o
 *    llegue tarde una respuesta ya aplicada, el resultado es la misma lista: se
 *    retira la entrada del placeholder y cualquier otra que ya tuviera el id real
 *    antes de insertar.
 *  - **No pierde el sitio.** La entidad real ocupa la posición del placeholder,
 *    así que lo capturado offline no salta al final al sincronizar.
 *
 * Es pura a propósito: es la única parte de la captura offline que se puede probar
 * sin red, sin IndexedDB y sin service worker.
 */

/** Mínimo que necesita una entidad para poder reconciliarse. */
export type Reconcilable = { id: string };

/**
 * Devuelve la lista con `created` en el lugar de su placeholder optimista.
 *
 * @param list             Lista cacheada actual.
 * @param clientRequestId  Id de la petición que originó la creación, que es
 *                         también el id del placeholder. `undefined` en las
 *                         creaciones que no pasan por la cola: entonces sólo se
 *                         deduplica por el id real.
 * @param created          Entidad confirmada por el servidor.
 */
export function reconcileCreated<T extends Reconcilable>(
  list: T[],
  clientRequestId: string | undefined,
  created: T,
): T[] {
  const isStale = (item: T) =>
    item.id === created.id || item.id === clientRequestId;

  const index = list.findIndex(isStale);
  const withoutStale = list.filter((item) => !isStale(item));

  if (index === -1) return [...withoutStale, created];

  return [
    ...withoutStale.slice(0, index),
    created,
    ...withoutStale.slice(index),
  ];
}

/**
 * Retira el placeholder sin sustituirlo. Se usa cuando la creación falla de verdad
 * contra el servidor (un 500, una validación) y hay que revertir: ahí restaurar el
 * snapshot del `onMutate` no basta, porque entre el intento y el error pueden haber
 * entrado otras entidades a la misma lista y el snapshot las borraría.
 */
export function dropOptimistic<T extends Reconcilable>(
  list: T[],
  clientRequestId: string | undefined,
): T[] {
  if (clientRequestId === undefined) return list;
  return list.filter((item) => item.id !== clientRequestId);
}

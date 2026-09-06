import type { ImageStorage, StoredBlob } from "./image-storage";
import { userKeyPrefix } from "./image-storage";

/**
 * Barrido de imágenes huérfanas.
 *
 * Una imagen queda huérfana cuando el usuario la quita del editor o borra la página
 * que la contenía: el blob sigue ocupando cuota sin que nada apunte a él. No se borra
 * en el momento de quitarla, y es deliberado: la misma imagen puede estar en dos
 * páginas, y un `Ctrl+Z` justo después de guardar la devolvería apuntando a un blob
 * ya muerto. Barrer aparte, comparando contra *todo* el contenido vivo a la vez, es
 * la única forma de decidir bien con una sola pasada.
 */

/** Nada recién subido se toca: puede estar en un editor que aún no ha guardado. */
export const DEFAULT_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * Clave estable de un blob: su ruta dentro del store.
 *
 * Comparar URLs completas sería frágil de una forma peligrosa. El `<img src>` que
 * guardó el editor y la URL que devuelve el listado tendrían que coincidir carácter
 * a carácter; en cuanto una de las dos ganara una query string o cambiara de host,
 * **ninguna** imagen parecería estar en uso y el barrido se las llevaría todas. La
 * ruta sobrevive a esas diferencias.
 */
export function toBlobKey(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export interface SweepBudget {
  /** Tope de blobs inspeccionados por ejecución. */
  maxBlobs: number;
  /** Tope de blobs borrados por ejecución. */
  maxDeletes: number;
  /** Plazo antes de dejar de pedir páginas al store. */
  deadlineMs: number;
  /** Antigüedad mínima de un blob para ser candidato. */
  graceMs: number;
}

export const DEFAULT_SWEEP_BUDGET: SweepBudget = {
  maxBlobs: 5_000,
  maxDeletes: 500,
  deadlineMs: 7_000,
  graceMs: DEFAULT_GRACE_MS,
};

export interface SweepResult {
  /** Blobs inspeccionados. */
  scanned: number;
  /** Blobs borrados. */
  deleted: number;
  /** Bytes liberados. */
  freedBytes: number;
  /** Siguen en uso. */
  keptReferenced: number;
  /** Huérfanos, pero demasiado recientes para tocarlos. */
  keptRecent: number;
  /** Quedó store sin inspeccionar: se agotó el presupuesto y hay que repetir. */
  incomplete: boolean;
  /**
   * El barrido se negó a borrar porque el resultado no era creíble: el usuario
   * tiene imágenes en uso servidas por este store y el listado no encontró ni una.
   */
  aborted: boolean;
}

/**
 * Reparte una página de blobs entre lo que se borra y lo que se conserva. Sin I/O:
 * es la decisión, y es lo que conviene poder probar sin un store delante.
 */
export function selectOrphans(
  blobs: StoredBlob[],
  referenced: ReadonlySet<string>,
  options: { now: number; graceMs: number },
): { orphans: StoredBlob[]; keptReferenced: number; keptRecent: number } {
  const inUse = new Set([...referenced].map(toBlobKey));
  const orphans: StoredBlob[] = [];
  let keptReferenced = 0;
  let keptRecent = 0;

  for (const blob of blobs) {
    if (inUse.has(toBlobKey(blob.url))) {
      keptReferenced += 1;
      continue;
    }
    if (options.now - blob.uploadedAt.getTime() < options.graceMs) {
      keptRecent += 1;
      continue;
    }
    orphans.push(blob);
  }

  return { orphans, keptReferenced, keptRecent };
}

/** El `del` de Blob acepta varias URLs por llamada, pero no una lista sin fin. */
const DELETE_BATCH = 100;

/**
 * Recorre el store del usuario y borra lo que ya no referencia nada.
 *
 * Se escanea entero **antes** de borrar nada. Cuesta memoria (acotada por el tope
 * de borrados) y a cambio permite mirar el resultado completo y negarse si no tiene
 * sentido: algo imposible si se va borrando página a página.
 *
 * `incomplete: true` significa que se quedó a medias por presupuesto; volver a
 * llamar sigue por donde tocaba, porque lo ya borrado deja de aparecer en el listado.
 */
export async function sweepUserImages(input: {
  userId: string;
  storage: ImageStorage;
  referenced: ReadonlySet<string>;
  budget?: Partial<SweepBudget>;
  now?: () => number;
}): Promise<SweepResult> {
  const budget = { ...DEFAULT_SWEEP_BUDGET, ...input.budget };
  const now = input.now ?? Date.now;
  const started = now();
  const prefix = userKeyPrefix(input.userId);

  const result: SweepResult = {
    scanned: 0,
    deleted: 0,
    freedBytes: 0,
    keptReferenced: 0,
    keptRecent: 0,
    incomplete: false,
    aborted: false,
  };

  const doomed: StoredBlob[] = [];
  let cursor: string | undefined;

  do {
    const page = await input.storage.list({ prefix, cursor });
    cursor = page.cursor;
    result.scanned += page.blobs.length;

    const { orphans, keptReferenced, keptRecent } = selectOrphans(page.blobs, input.referenced, {
      now: now(),
      graceMs: budget.graceMs,
    });
    result.keptReferenced += keptReferenced;
    result.keptRecent += keptRecent;

    // El tope de borrados corta por lo sano: lo que sobra se queda para la
    // siguiente pasada, que lo volverá a encontrar igual de huérfano.
    const room = Math.max(0, budget.maxDeletes - doomed.length);
    if (orphans.length > room) {
      doomed.push(...orphans.slice(0, room));
      // Se dejaron huérfanas sin borrar en esta misma página: aunque el listado
      // llegue al final, el barrido no terminó el trabajo.
      result.incomplete = true;
    } else {
      doomed.push(...orphans);
    }

    if (doomed.length >= budget.maxDeletes) break;
    if (result.scanned >= budget.maxBlobs) break;
    if (now() - started >= budget.deadlineMs) break;
  } while (cursor);

  // Y también queda trabajo si el listado se cortó antes del final del store.
  if (cursor !== undefined) result.incomplete = true;

  if (isImplausible(result, input.referenced, input.storage)) {
    result.aborted = true;
    return result;
  }

  for (let i = 0; i < doomed.length; i += DELETE_BATCH) {
    const batch = doomed.slice(i, i + DELETE_BATCH);
    await input.storage.deleteMany(batch.map((b) => b.url));
    result.deleted += batch.length;
    result.freedBytes += batch.reduce((sum, b) => sum + b.size, 0);
  }

  return result;
}

/**
 * Freno de mano. Si el usuario tiene imágenes en uso servidas por este store y el
 * barrido no reconoció **ninguna**, lo que falla no es que todo esté huérfano: es
 * la comparación. Borrar ahí se llevaría por delante todas las imágenes vivas, así
 * que se prefiere no liberar nada y que alguien mire.
 *
 * Solo cuentan las referencias del propio store: un usuario que únicamente usa
 * imágenes por URL externa tiene cero coincidencias de forma legítima, y no debe
 * bloquear su propia limpieza.
 */
function isImplausible(
  result: SweepResult,
  referenced: ReadonlySet<string>,
  storage: ImageStorage,
): boolean {
  if (result.scanned === 0 || result.keptReferenced > 0) return false;
  return [...referenced].some((url) => storage.owns(url));
}

/**
 * Borra todo lo que el usuario tiene en el store, sin mirar referencias: es el
 * barrido del borrado de cuenta, donde ya no va a quedar contenido que las
 * sostenga. Se lista entero antes de borrar para no depender de cómo se
 * comporte el cursor del store cuando desaparecen entradas a mitad del listado.
 * Devuelve cuántos blobs se fueron.
 */
export async function deleteAllUserImages(storage: ImageStorage, userId: string): Promise<number> {
  const prefix = userKeyPrefix(userId);
  const urls: string[] = [];
  let cursor: string | undefined;

  do {
    const page = await storage.list({ prefix, cursor });
    urls.push(...page.blobs.map((b) => b.url));
    cursor = page.cursor;
  } while (cursor);

  for (let i = 0; i < urls.length; i += DELETE_BATCH) {
    await storage.deleteMany(urls.slice(i, i + DELETE_BATCH));
  }
  return urls.length;
}

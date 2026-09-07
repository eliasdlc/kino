/**
 * Cronología in-world (KIN-140): los eventos de la historia ordenados en el
 * **tiempo interno de la narración**, no en el orden en que aparecen los
 * capítulos.
 *
 * De ahí sale lo que hace que valga la pena: comparar las dos líneas. Cualquier
 * narración no lineal (flashbacks, tramas paralelas, un misterio que revela el
 * pasado por partes) vive de que el autor tenga clara la cronología real
 * mientras escribe una distinta. Hoy eso vive en la cabeza o en un documento
 * aparte; aquí se deriva de datos que ya existen (`entities` de tipo `event` y
 * sus menciones) más un solo campo nuevo: el orden.
 */

/** Clave del atributo que guarda la posición in-world de un evento. */
export const TIMELINE_ORDER_KEY = "timelineOrder";

export interface TimelineChapter {
  id: string;
  title: string | null;
}

export interface TimelineEventInput {
  id: string;
  name: string;
  summary: string | null;
  attributes: Record<string, string | number> | null;
  /** Capítulos donde se menciona, en orden de obra. */
  narratedIn: Array<{ pageId: string; mentionCount: number }>;
}

export interface TimelineNarration {
  pageId: string;
  title: string | null;
  /** Posición 1-based del capítulo en la obra. */
  index: number;
  mentionCount: number;
}

export interface TimelineEntry {
  entityId: string;
  name: string;
  summary: string | null;
  /** Etiqueta in-world tal cual la escribió el autor ("Año 1023, otoño"). */
  when: string | null;
  what: string | null;
  /** Posición in-world; `null` si el evento todavía no se ha ubicado. */
  order: number | null;
  narratedIn: TimelineNarration[];
  /** Primer capítulo donde se cuenta; `null` si no se cuenta en esta obra. */
  firstNarratedIndex: number | null;
  /**
   * Se narra fuera de su orden interno: existe un evento posterior in-world que
   * se cuenta antes. Eso es exactamente un flashback (o una trama paralela), y
   * verlo marcado es la mitad del valor de la vista.
   */
  outOfOrder: boolean;
}

/** Lo que devuelve el endpoint de cronología de una obra. */
export interface TimelineReport extends Timeline {
  folderId: string;
  folderName: string;
  chapterCount: number;
}

export interface Timeline {
  /** Eventos con orden in-world, de más antiguo a más reciente. */
  placed: TimelineEntry[];
  /** Eventos sin ubicar todavía, alfabéticos. */
  unplaced: TimelineEntry[];
}

function readText(
  attributes: Record<string, string | number> | null,
  key: string,
): string | null {
  const raw = attributes?.[key];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** El orden puede llegar como número o como string: el jsonb no garantiza nada. */
export function readTimelineOrder(
  attributes: Record<string, string | number> | null,
): number | null {
  const raw = attributes?.[TIMELINE_ORDER_KEY];
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function buildTimeline(
  events: TimelineEventInput[],
  chapters: TimelineChapter[],
): Timeline {
  const indexById = new Map(chapters.map((c, i) => [c.id, i]));
  const titleById = new Map(chapters.map((c) => [c.id, c.title]));

  const entries: TimelineEntry[] = events.map((event) => {
    const narratedIn = event.narratedIn
      .filter((n) => indexById.has(n.pageId))
      .map((n) => ({
        pageId: n.pageId,
        title: titleById.get(n.pageId) ?? null,
        index: indexById.get(n.pageId)! + 1,
        mentionCount: n.mentionCount,
      }))
      .sort((a, b) => a.index - b.index);

    return {
      entityId: event.id,
      name: event.name,
      summary: event.summary,
      when: readText(event.attributes, "when"),
      what: readText(event.attributes, "what"),
      order: readTimelineOrder(event.attributes),
      narratedIn,
      firstNarratedIndex: narratedIn[0]?.index ?? null,
      outOfOrder: false,
    };
  });

  const placed = entries
    .filter((e) => e.order !== null)
    // Desempate estable por nombre: dos eventos pueden compartir posición
    // in-world (pasan a la vez) y la lista no debe bailar entre recargas.
    .sort((a, b) => a.order! - b.order! || a.name.localeCompare(b.name, "es"));

  markOutOfOrder(placed);

  const unplaced = entries
    .filter((e) => e.order === null)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return { placed, unplaced };
}

/**
 * Marca los eventos que se cuentan antes de tiempo. Un evento está fuera de
 * orden si algún evento **posterior** en la cronología interna se narra antes
 * que él: la definición literal de contar el futuro primero.
 */
function markOutOfOrder(placed: TimelineEntry[]): void {
  // Recorriendo de atrás hacia delante, `minLater` es el capítulo más temprano
  // en el que se cuenta algo posterior in-world. Una sola pasada.
  let minLater = Infinity;
  for (let i = placed.length - 1; i >= 0; i--) {
    const entry = placed[i]!;
    if (entry.firstNarratedIndex !== null) {
      entry.outOfOrder = entry.firstNarratedIndex > minLater;
      minLater = Math.min(minLater, entry.firstNarratedIndex);
    }
  }
}

/**
 * Reasigna posiciones consecutivas desde 1 a partir de un orden de ids. La vista
 * reordena moviendo eventos arriba y abajo; nadie teclea números.
 */
export function assignOrders(orderedIds: string[]): Map<string, number> {
  return new Map(orderedIds.map((id, i) => [id, i + 1]));
}

/** Mueve un elemento una posición y devuelve el nuevo orden de ids. */
export function moveWithin(ids: string[], id: string, delta: number): string[] {
  const from = ids.indexOf(id);
  if (from === -1) return ids;
  const to = from + delta;
  if (to < 0 || to >= ids.length) return ids;
  const next = [...ids];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

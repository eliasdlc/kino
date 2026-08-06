import type { EntityType } from "@/features/entities/entities.attributes";

/**
 * Detector de hilos sueltos (KIN-137). *"La Daga apareció en el capítulo 2 y
 * nunca más."*
 *
 * Continuidad narrativa **sin LLM**: es aritmética sobre `page_entity_mentions`,
 * que existe desde W2. Una entidad que se nombró poco y hace mucho es un hilo
 * suelto candidato — y el escritor puede verificar cada señalamiento en un clic,
 * porque el detector dice exactamente en qué capítulo fue.
 *
 * Todo aquí es puro: recibe los capítulos en orden y las apariciones, y devuelve
 * los candidatos. Sin esto separado no habría forma de probar el criterio, que es
 * lo único que decide si la herramienta sirve o se vuelve ruido.
 */

export interface ChekhovSettings {
  /** Hasta cuántas menciones totales cuentan como "se nombró poco". */
  maxMentions: number;
  /** Cuántos capítulos de silencio hacen falta para considerarlo abandonado. */
  minSilentChapters: number;
}

/**
 * Un umbral que grita demasiado se ignora, y un detector ignorado no existe. El
 * default es deliberadamente conservador: hasta 3 menciones y 3 capítulos de
 * silencio. Una entidad de fondo nombrada una vez a propósito seguirá saliendo —
 * para eso está poder cerrarla a mano.
 */
export const DEFAULT_CHEKHOV: ChekhovSettings = {
  maxMentions: 3,
  minSilentChapters: 3,
};

export const CHEKHOV_LIMITS = {
  maxMentions: { min: 1, max: 50 },
  minSilentChapters: { min: 1, max: 50 },
} as const;

export interface ThreadChapter {
  id: string;
  title: string | null;
}

export interface ThreadAppearance {
  entityId: string;
  pageId: string;
  mentionCount: number;
}

export interface ThreadEntity {
  id: string;
  name: string;
  type: EntityType;
  /**
   * Menciones de la entidad en **todo el sistema**, no solo en esta obra. El
   * codex es un universo compartido y cerrar un hilo es una decisión sobre la
   * entidad, así que la comparación tiene que hacerse contra el mismo universo
   * que se guardó al cerrarlo.
   */
  mentionsInSystem: number;
  /**
   * Menciones que la entidad tenía en el sistema cuando el autor dio el hilo por
   * cerrado. `null` = nunca se cerró. Guardar el conteo y no una fecha es lo que
   * permite reabrirlo solo: si vuelve a nombrarse, el número de hoy supera al de
   * entonces y el hilo reaparece sin que nadie tenga que acordarse.
   */
  threadResolvedMentions: number | null;
}

export interface ThreadChapterRef {
  /** Posición 1-based del capítulo en la obra. */
  index: number;
  id: string;
  title: string | null;
}

export interface LooseThread {
  entityId: string;
  name: string;
  type: EntityType;
  totalMentions: number;
  /** En cuántos capítulos distintos aparece. */
  chapterCount: number;
  firstChapter: ThreadChapterRef;
  lastChapter: ThreadChapterRef;
  /** Capítulos transcurridos desde su última aparición. */
  silentChapters: number;
  /** Cerrado a mano y todavía callado. */
  resolved: boolean;
  /** Estaba cerrado y volvió a nombrarse: el hilo se retomó. */
  reopened: boolean;
}

/** Lo que devuelve el endpoint de hilos de una obra. */
export interface LooseThreadsReport {
  folderId: string;
  folderName: string;
  chapterCount: number;
  settings: ChekhovSettings;
  threads: LooseThread[];
}

export interface DetectInput {
  /** Capítulos de la obra **en orden de lectura**. */
  chapters: ThreadChapter[];
  appearances: ThreadAppearance[];
  entities: ThreadEntity[];
  settings: ChekhovSettings;
}

/**
 * Hilos sueltos de una obra. Devuelve también los que están cerrados a mano, con
 * su bandera: la lista de lo descartado tiene que poder revisarse, si no cerrar
 * un hilo por error es irreversible en la práctica.
 */
export function detectLooseThreads({
  chapters,
  appearances,
  entities,
  settings,
}: DetectInput): LooseThread[] {
  if (chapters.length === 0) return [];

  const chapterIndex = new Map(chapters.map((c, i) => [c.id, i]));
  const byEntity = new Map<string, ThreadAppearance[]>();
  for (const appearance of appearances) {
    if (!chapterIndex.has(appearance.pageId)) continue; // capítulo de otra obra
    const list = byEntity.get(appearance.entityId) ?? [];
    list.push(appearance);
    byEntity.set(appearance.entityId, list);
  }

  const lastIndex = chapters.length - 1;
  const threads: LooseThread[] = [];

  for (const entity of entities) {
    const own = byEntity.get(entity.id);
    // Sin una sola aparición no es un hilo de *esta* obra. El codex es del
    // sistema entero: una entidad puede vivir en otra historia.
    if (!own || own.length === 0) continue;

    const indices = own
      .map((a) => chapterIndex.get(a.pageId)!)
      .sort((a, b) => a - b);
    const totalMentions = own.reduce((sum, a) => sum + a.mentionCount, 0);
    const first = indices[0]!;
    const last = indices[indices.length - 1]!;
    const silentChapters = lastIndex - last;

    if (totalMentions > settings.maxMentions) continue;
    if (silentChapters < settings.minSilentChapters) continue;

    const wasResolved = entity.threadResolvedMentions !== null;
    const reopened = wasResolved && entity.mentionsInSystem > entity.threadResolvedMentions!;

    threads.push({
      entityId: entity.id,
      name: entity.name,
      type: entity.type,
      totalMentions,
      chapterCount: new Set(indices).size,
      firstChapter: refFor(chapters, first),
      lastChapter: refFor(chapters, last),
      silentChapters,
      resolved: wasResolved && !reopened,
      reopened,
    });
  }

  // Lo más olvidado primero; a igual silencio, lo menos nombrado. El desempate
  // por nombre mantiene el orden estable entre recargas.
  return threads.sort(
    (a, b) =>
      b.silentChapters - a.silentChapters ||
      a.totalMentions - b.totalMentions ||
      a.name.localeCompare(b.name, "es"),
  );
}

function refFor(chapters: ThreadChapter[], index: number): ThreadChapterRef {
  const chapter = chapters[index]!;
  return { index: index + 1, id: chapter.id, title: chapter.title };
}

/** Frase del hallazgo, con el capítulo concreto para poder ir a verificarlo. */
export function threadSummary(thread: LooseThread): string {
  const where = thread.lastChapter.title?.trim()
    ? `«${thread.lastChapter.title.trim()}»`
    : `el capítulo ${thread.lastChapter.index}`;
  const silence =
    thread.silentChapters === 1
      ? "y no ha vuelto en el capítulo siguiente"
      : `y no ha vuelto en ${thread.silentChapters} capítulos`;
  return `Apareció por última vez en ${where} ${silence}.`;
}

import {
  PROJECT_BOARD_COLUMNS,
  PROJECT_BOARD_TERMINAL,
} from "@/shared/lib/system-types";
import { GITHUB_SOURCE, type GithubIssue } from "./github-sync.types";

/**
 * Traducción issue → tarjeta. Todo aquí es función pura: es la parte del ticket
 * que se puede probar sin GitHub y sin base, y es donde vive la regla que
 * protege al resto de la app.
 */

/**
 * La vía con la que firma esta sincronización cuando cierra una tarjeta por su
 * issue. Es lo que distingue "lo cerró GitHub" de "lo cerró la persona".
 */
const GITHUB_SYNC_VIA = "sync";

/** Primera columna no terminal del board: donde entra un issue abierto nuevo. */
export const INITIAL_BOARD_COLUMN =
  PROJECT_BOARD_COLUMNS.find((c) => c.id !== PROJECT_BOARD_TERMINAL)?.id ??
  PROJECT_BOARD_COLUMNS[0].id;

/**
 * Campos que la sincronización **nunca** escribe sobre una tarea que ya existe.
 * Son exactamente el valor que Kino añade sobre GitHub: el nivel de energía, la
 * fecha, el plan de hoy y el bloque del calendario (`startDate`). Si un refresco
 * los borrase, el feature pasaría de útil a dañino: sería más barato mirar los
 * issues en GitHub.
 *
 * Está aquí como lista explícita, y no implícito en el `UPDATE`, para que se vea
 * en el diff si alguien la toca.
 */
export const KINO_OWNED_FIELDS = [
  "energyLevel",
  "dueDate",
  "startDate",
  "inTodayPlan",
  "priority",
  "estimatedTime",
  "folderId",
  "contextTagId",
  "parentTaskId",
] as const;

/**
 * Hasta dónde puede avanzar el cursor después de un refresco.
 *
 * Sin truncar, al instante en que arrancó la llamada: lo que se toque mientras
 * GitHub responde entra en el siguiente refresco en vez de caerse por el hueco.
 *
 * Truncado, al `updated_at` del último issue que de verdad llegó. Avanzarlo
 * hasta el arranque es lo que perdía issues: los que quedaron fuera del tope de
 * páginas se tocaron antes de ese instante, así que el refresco siguiente ya no
 * los pedía y no volvían nunca. `since` es inclusivo, así que el último issue
 * traído vuelve una vez y se reconoce por su `external_id`, sin duplicar nada.
 *
 * Null significa que no se sabe hasta dónde se leyó: el cursor se queda donde
 * estaba, que repite trabajo pero no se salta nada.
 *
 * **Deuda con nombre: el lote que no cabe en un solo instante.** Si más de
 * trescientos issues comparten el mismo `updated_at`, que es lo que deja un
 * etiquetado en bloque, el cursor para donde ya estaba y cada refresco repite
 * ese mismo lote sin avanzar. No duplica nada (`external_id` los reconoce) y no
 * pierde nada, pero los issues de después de ese instante no llegan nunca. La
 * salida cara es paginar dentro del instante, que es estado nuevo por sistema
 * (`since` más número de página). La barata sería dejar el cursor un
 * milisegundo por encima del lote cuando no avanzó, y no la toma este código
 * porque cambia la promesa: pasa de repetir a saltarse los que quedaron dentro
 * de ese segundo. `refrescoCompleto`, que el panel manda desde su salida de
 * emergencia, devuelve el recorrido al principio y recupera lo que un cursor
 * saltado dejó atrás, pero **no deshace este atasco**: el recorrido vuelve a
 * llegar al mismo instante y se queda ahí otra vez.
 */
export function cursorSiguiente({
  truncated,
  ultimoUpdatedAt,
  arranque,
}: {
  truncated: boolean;
  ultimoUpdatedAt: number | null;
  arranque: number;
}): number | null {
  return truncated ? ultimoUpdatedAt : arranque;
}

/** `external_id` de un issue: el id numérico global, único en todo GitHub. */
export function externalIdFor(issue: Pick<GithubIssue, "id">): string {
  return String(issue.id);
}

/** `external_id` de un milestone. Mismo criterio que los issues. */
export function externalIdForMilestone(milestoneId: number): string {
  return String(milestoneId);
}

/**
 * Título de la tarjeta. Se antepone el número del issue porque en un board sin
 * él es imposible saber a qué issue corresponde una tarjeta sin abrirla.
 */
export function taskTitleFor(issue: GithubIssue): string {
  const titulo = issue.title.trim() || "(sin título)";
  return `#${issue.number} ${titulo}`.slice(0, 500);
}

/**
 * Descripción de la tarjeta: el cuerpo del issue más su enlace. El enlace es lo
 * que hace que la tarjeta sirva de puerta a GitHub en vez de una copia muerta.
 */
export function taskDescriptionFor(issue: GithubIssue): string {
  const cuerpo = issue.body?.trim();
  return cuerpo ? `${cuerpo}\n\n${issue.htmlUrl}` : issue.htmlUrl;
}

/**
 * Columna del board que le toca a un issue.
 *
 * La regla, y el porqué:
 *
 * - Issue **cerrado** → columna terminal. Es el único movimiento que GitHub
 *   impone, y el que hace valioso el feature: cierras en GitHub y la tarjeta se
 *   mueve sola. El puente de `moveTaskBoard` la completa además en el eje de
 *   scheduling.
 * - Issue **abierto** que la sincronización había dejado en la terminal → vuelve
 *   a la primera columna. Es el caso de reabrir, y hay que deshacerlo o la
 *   tarjeta se queda completada para siempre.
 * - Issue **abierto** cuya tarjeta completó una persona en Kino → **no se
 *   toca**. Terminar el trabajo y cerrar el issue son dos cosas distintas, y un
 *   issue abierto que recibe un comentario no es una reapertura: descompletar
 *   ahí borraría el cierre que alguien firmó.
 * - Issue **abierto** en cualquier otra columna → **no se toca**. GitHub no sabe
 *   nada de "en progreso" ni de "en review": esas columnas las mueve la persona,
 *   y un refresco que las devolviera a "por hacer" haría el board inservible.
 * - Tarea **nueva** → primera columna, o la terminal si nace cerrada.
 *
 * Devuelve null cuando no hay que mover nada.
 */
export function boardStatusFor(
  issueState: GithubIssue["state"],
  currentBoardStatus: string | null,
  /**
   * Por qué vía se completó la tarjeta (`completedVia`). `sync` es la firma que
   * deja esta misma sincronización al cerrar por el issue; cualquier otra, o
   * ninguna, es una persona en Kino.
   */
  completedVia: string | null,
): string | null {
  const cerrado = issueState === "closed";

  if (cerrado) {
    return currentBoardStatus === PROJECT_BOARD_TERMINAL
      ? null
      : PROJECT_BOARD_TERMINAL;
  }

  if (currentBoardStatus === null) return INITIAL_BOARD_COLUMN;
  if (currentBoardStatus === PROJECT_BOARD_TERMINAL) {
    return completedVia === GITHUB_SYNC_VIA ? INITIAL_BOARD_COLUMN : null;
  }

  return null;
}

/** Lo que se escribe al **crear** la tarjeta de un issue que aún no existía. */
export interface NewTaskFromIssue {
  externalSource: string;
  externalId: string;
  title: string;
  description: string;
  boardStatus: string;
  status: "backlog" | "done";
}

export function newTaskFromIssue(issue: GithubIssue): NewTaskFromIssue {
  const cerrado = issue.state === "closed";
  return {
    externalSource: GITHUB_SOURCE,
    externalId: externalIdFor(issue),
    title: taskTitleFor(issue),
    description: taskDescriptionFor(issue),
    boardStatus: cerrado ? PROJECT_BOARD_TERMINAL : INITIAL_BOARD_COLUMN,
    // Un issue que se importa ya cerrado nace completado: lo contrario obligaría
    // a cerrarlo a mano en Kino sólo por haber llegado tarde a importarlo.
    status: cerrado ? "done" : "backlog",
  };
}

/** Lo que se escribe al **refrescar** una tarjeta que ya existe. */
export interface TaskPatchFromIssue {
  title?: string;
  description?: string;
  sprintId?: string | null;
  /** Movimiento de columna a aplicar por `moveTaskBoard`, o null si no toca. */
  boardStatus: string | null;
}

export interface ExistingTask {
  title: string;
  description: string | null;
  boardStatus: string | null;
  sprintId: string | null;
  /** Firma del cierre de la tarjeta, si está cerrada. Ver `boardStatusFor`. */
  completedVia: string | null;
}

/**
 * Calcula el parche mínimo para una tarjeta ya importada. Sólo devuelve las
 * claves que de verdad cambian: así una re-sincronización sin novedades no
 * escribe nada y `updatedAt` no miente sobre cuándo se tocó la tarea.
 *
 * `sprintId` sólo se escribe cuando el issue **tiene** milestone. Sin milestone
 * no se limpia el sprint: GitHub no está diciendo "quítalo del sprint", está
 * diciendo que no opina, y la asignación pudo hacerla la persona en Kino.
 */
export function taskPatchFromIssue(
  issue: GithubIssue,
  existing: ExistingTask,
  sprintIdForMilestone: string | null,
): TaskPatchFromIssue {
  const patch: TaskPatchFromIssue = { boardStatus: null };

  const title = taskTitleFor(issue);
  if (title !== existing.title) patch.title = title;

  const description = taskDescriptionFor(issue);
  if (description !== existing.description) patch.description = description;

  if (
    issue.milestone &&
    sprintIdForMilestone &&
    sprintIdForMilestone !== existing.sprintId
  ) {
    patch.sprintId = sprintIdForMilestone;
  }

  patch.boardStatus = boardStatusFor(issue.state, existing.boardStatus, existing.completedVia);

  return patch;
}

/** ¿El parche cambia algo de verdad? */
export function isEmptyPatch(patch: TaskPatchFromIssue): boolean {
  return (
    patch.title === undefined &&
    patch.description === undefined &&
    patch.sprintId === undefined &&
    patch.boardStatus === null
  );
}

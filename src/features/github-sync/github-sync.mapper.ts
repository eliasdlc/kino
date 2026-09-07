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
 * - Issue **abierto** que estaba en la terminal → vuelve a la primera columna.
 *   Es el caso de reabrir, y hay que deshacerlo o la tarjeta se queda completada
 *   para siempre.
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
): string | null {
  const cerrado = issueState === "closed";

  if (cerrado) {
    return currentBoardStatus === PROJECT_BOARD_TERMINAL
      ? null
      : PROJECT_BOARD_TERMINAL;
  }

  if (currentBoardStatus === null) return INITIAL_BOARD_COLUMN;
  if (currentBoardStatus === PROJECT_BOARD_TERMINAL) return INITIAL_BOARD_COLUMN;

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

  patch.boardStatus = boardStatusFor(issue.state, existing.boardStatus);

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

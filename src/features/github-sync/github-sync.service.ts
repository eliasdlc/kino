import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/shared/utils/error";
import { getSystemById, updateSystem } from "@/features/systems/systems.service";
import { moveTaskBoard } from "@/features/tasks/tasks.service";
import { isEncryptionConfigured } from "@/shared/utils/crypto";
import {
  fetchIssues,
  fetchRepoFullName,
  fetchViewerLogin,
} from "./github-sync.client";
import {
  deleteGithubConnection,
  findImportedTasks,
  getGithubConnection,
  hasGithubConnection,
  insertImportedTasks,
  saveGithubConnection,
  touchLastSynced,
  updateImportedTask,
  upsertSprintForMilestone,
  type NewImportedTask,
} from "./github-sync.queries";
import {
  externalIdFor,
  isEmptyPatch,
  newTaskFromIssue,
  taskPatchFromIssue,
} from "./github-sync.mapper";
import {
  GithubApiError,
  type GithubConnectionStatus,
  type GithubMilestone,
  type GithubRepoRef,
  type SyncResult,
} from "./github-sync.types";

/**
 * Orquestación de la sincronización con GitHub (KIN-135).
 *
 * Las tres decisiones que el ticket pedía dejar escritas:
 *
 * 1. **Dirección**: sólo lectura. GitHub manda sobre título, cuerpo, estado
 *    abierto/cerrado y milestone. Kino nunca escribe en GitHub.
 * 2. **Estado**: issue cerrado → columna terminal, que por el puente del board
 *    completa la tarea. Issue reabierto → sale de la terminal. Las columnas
 *    intermedias son de la persona y el refresco no las toca. La regla completa,
 *    con su porqué, está en `boardStatusFor`.
 * 3. **Refresco**: bajo demanda al abrir el board o con el botón. Sin cron:
 *    la única entrada del free tier de Vercel está ocupada, y bajo demanda es
 *    más barato y suficiente para validar si el feature se usa.
 */

// ── Conexión ──

export async function getConnectionStatus(
  userId: string,
): Promise<GithubConnectionStatus> {
  const stored = await hasGithubConnection(userId);
  if (!stored) {
    return { connected: false, login: null, lastSyncedAt: null, revoked: false };
  }

  try {
    const connection = await getGithubConnection(userId);
    const login = await fetchViewerLogin(connection!.accessToken);
    return {
      connected: true,
      login,
      lastSyncedAt: stored.lastSyncedAt?.toISOString() ?? null,
      revoked: false,
    };
  } catch (error) {
    // Un token revocado no debe romper la pantalla de ajustes: se reporta como
    // conexión que necesita renovarse y la UI ofrece reconectar.
    if (error instanceof GithubApiError && error.unauthorized) {
      return {
        connected: true,
        login: null,
        lastSyncedAt: stored.lastSyncedAt?.toISOString() ?? null,
        revoked: true,
      };
    }
    throw error;
  }
}

export async function connectGithub(
  userId: string,
  accessToken: string,
  refreshToken: string | null,
): Promise<void> {
  if (!isEncryptionConfigured()) {
    throw new ValidationError(
      "Falta ENCRYPTION_KEY en el entorno: sin ella no se puede guardar el token cifrado.",
    );
  }
  // Se valida contra GitHub antes de guardar: un token que no vale no merece
  // una fila que luego haya que limpiar.
  await fetchViewerLogin(accessToken);
  await saveGithubConnection(userId, accessToken, refreshToken);
}

export async function disconnectGithub(userId: string): Promise<void> {
  await deleteGithubConnection(userId);
}

// ── Repositorio de un sistema ──

/**
 * Lee el repositorio declarado en la metadata del sistema. Devuelve null si el
 * sistema no es de tipo `project` o no tiene repositorio: el resto de arquetipos
 * no ven nada de esta integración.
 */
export function repoRefOf(system: {
  templateType: string;
  metadata: { github?: GithubRepoRef } | null;
}): GithubRepoRef | null {
  if (system.templateType !== "project") return null;
  const ref = system.metadata?.github;
  if (!ref?.owner || !ref?.repo) return null;
  return { owner: ref.owner, repo: ref.repo };
}

async function requireProjectSystem(systemId: string, userId: string) {
  const system = await getSystemById(systemId, userId);
  if (!system) throw new NotFoundError("System not found");
  if (system.templateType !== "project") {
    throw new ForbiddenError(
      "La sincronización con GitHub sólo aplica a sistemas de tipo proyecto.",
    );
  }
  return system;
}

async function requireToken(userId: string): Promise<string> {
  const connection = await getGithubConnection(userId);
  if (!connection) {
    throw new ValidationError(
      "No hay ninguna cuenta de GitHub conectada. Conéctala en Ajustes.",
    );
  }
  return connection.accessToken;
}

/**
 * Enlaza un repositorio a un sistema `project`. Se comprueba contra GitHub antes
 * de guardar: enterarse de que el repositorio no existe al primer sync, y no al
 * enlazarlo, es la clase de fallo que hace abandonar la integración.
 */
export async function linkRepo(
  systemId: string,
  userId: string,
  ref: GithubRepoRef,
): Promise<{ fullName: string }> {
  const system = await requireProjectSystem(systemId, userId);
  const token = await requireToken(userId);

  const fullName = await fetchRepoFullName(ref, token);

  await updateSystem(systemId, userId, {
    metadata: { ...(system.metadata ?? {}), github: ref },
  });

  return { fullName };
}

export async function unlinkRepo(
  systemId: string,
  userId: string,
): Promise<void> {
  const system = await requireProjectSystem(systemId, userId);
  const metadata = { ...(system.metadata ?? {}) };
  delete metadata.github;
  await updateSystem(systemId, userId, { metadata });
}

// ── Sincronización ──

/**
 * Trae los issues del repositorio enlazado y los refleja en el board.
 *
 * Lo que **no** hace, y es lo que protege al resto de la app: no toca energía,
 * fecha, plan de hoy ni bloque de calendario de una tarjeta que ya existía. Esos
 * campos son el valor que Kino añade sobre un issue; un refresco que los borrase
 * convertiría el feature en un destructor de trabajo.
 */
export async function syncSystem(
  systemId: string,
  userId: string,
): Promise<SyncResult> {
  const system = await requireProjectSystem(systemId, userId);
  const ref = repoRefOf(system);
  if (!ref) {
    throw new ValidationError(
      "Este sistema no tiene ningún repositorio enlazado.",
    );
  }

  const token = await requireToken(userId);
  const { issues, truncated } = await fetchIssues(ref, token);

  // Los milestones se resuelven una sola vez por milestone, no una por issue.
  const milestones = new Map<number, GithubMilestone>();
  for (const issue of issues) {
    if (issue.milestone) milestones.set(issue.milestone.id, issue.milestone);
  }

  const sprintIdByMilestone = new Map<number, string>();
  let sprintsCreated = 0;
  for (const milestone of milestones.values()) {
    const { id, created } = await upsertSprintForMilestone(
      userId,
      systemId,
      milestone,
    );
    sprintIdByMilestone.set(milestone.id, id);
    if (created) sprintsCreated++;
  }

  const existing = await findImportedTasks(
    userId,
    systemId,
    issues.map(externalIdFor),
  );

  // ── Altas ──
  const nuevas: NewImportedTask[] = [];
  for (const issue of issues) {
    if (existing.has(externalIdFor(issue))) continue;
    const base = newTaskFromIssue(issue);
    nuevas.push({
      externalId: base.externalId,
      title: base.title,
      description: base.description,
      boardStatus: base.boardStatus,
      status: base.status,
      sprintId: issue.milestone
        ? (sprintIdByMilestone.get(issue.milestone.id) ?? null)
        : null,
    });
  }
  const imported = await insertImportedTasks(userId, systemId, nuevas);

  // ── Actualizaciones ──
  let updated = 0;
  let unchanged = 0;
  for (const issue of issues) {
    const task = existing.get(externalIdFor(issue));
    if (!task) continue;

    const sprintId = issue.milestone
      ? (sprintIdByMilestone.get(issue.milestone.id) ?? null)
      : null;
    const patch = taskPatchFromIssue(issue, task, sprintId);

    if (isEmptyPatch(patch)) {
      unchanged++;
      continue;
    }

    await updateImportedTask(task.id, userId, {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description }
        : {}),
      ...(patch.sprintId !== undefined ? { sprintId: patch.sprintId } : {}),
    });

    // El movimiento de columna pasa por el service de tasks a propósito: es
    // quien aplica el puente board ↔ scheduling (completar/descompletar,
    // `completedAt`). Reimplementarlo aquí lo dejaría desincronizado a la
    // primera que alguien tocara la máquina de estados.
    if (patch.boardStatus) {
      await moveTaskBoard(task.id, patch.boardStatus, userId);
    }

    updated++;
  }

  await touchLastSynced(userId);

  return {
    imported,
    updated,
    unchanged,
    sprintsCreated,
    truncated,
    syncedAt: new Date().toISOString(),
  };
}

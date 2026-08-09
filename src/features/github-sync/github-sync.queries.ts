import { db } from "@/shared/db";
import { sprints, syncConnections, tasks } from "@/shared/db/schema";
import { and, eq, inArray, isNull, max, sql } from "drizzle-orm";
import { decryptSecret, encryptSecret } from "@/shared/utils/crypto";
import { GITHUB_SOURCE, type GithubMilestone } from "./github-sync.types";

/**
 * Acceso a datos de la sincronización con GitHub. Aquí vive el upsert que hace
 * idempotente la importación; la decisión de *qué* escribir está en el mapper.
 */

// ── Conexión ──

export interface StoredConnection {
  id: string;
  accessToken: string;
  lastSyncedAt: Date | null;
}

/**
 * Devuelve la conexión con el token ya descifrado. El token en claro no sale
 * nunca de la capa de servidor: ninguna respuesta de la API lo incluye.
 */
export async function getGithubConnection(
  userId: string,
): Promise<StoredConnection | null> {
  const [row] = await db
    .select({
      id: syncConnections.id,
      accessTokenEncrypted: syncConnections.accessTokenEncrypted,
      lastSyncedAt: syncConnections.lastSyncedAt,
    })
    .from(syncConnections)
    .where(
      and(
        eq(syncConnections.userId, userId),
        eq(syncConnections.provider, GITHUB_SOURCE),
      ),
    );

  if (!row) return null;

  return {
    id: row.id,
    accessToken: decryptSecret(row.accessTokenEncrypted),
    lastSyncedAt: row.lastSyncedAt,
  };
}

/** ¿Hay conexión guardada? Sin descifrar: para la pantalla de ajustes. */
export async function hasGithubConnection(
  userId: string,
): Promise<{ lastSyncedAt: Date | null } | null> {
  const [row] = await db
    .select({ lastSyncedAt: syncConnections.lastSyncedAt })
    .from(syncConnections)
    .where(
      and(
        eq(syncConnections.userId, userId),
        eq(syncConnections.provider, GITHUB_SOURCE),
      ),
    );
  return row ?? null;
}

/**
 * Guarda o reemplaza la conexión. Reconectar sobreescribe el token anterior en
 * vez de crear una fila nueva — el único `(user_id, provider)` ya lo impone, y
 * así reconectar tras revocar el token es simplemente volver a pasar por OAuth.
 */
export async function saveGithubConnection(
  userId: string,
  accessToken: string,
  refreshToken: string | null,
): Promise<void> {
  const now = new Date();
  await db
    .insert(syncConnections)
    .values({
      userId,
      provider: GITHUB_SOURCE,
      accessTokenEncrypted: encryptSecret(accessToken),
      refreshTokenEncrypted: refreshToken ? encryptSecret(refreshToken) : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [syncConnections.userId, syncConnections.provider],
      set: {
        accessTokenEncrypted: encryptSecret(accessToken),
        refreshTokenEncrypted: refreshToken ? encryptSecret(refreshToken) : null,
        updatedAt: now,
      },
    });
}

export async function deleteGithubConnection(userId: string): Promise<void> {
  await db
    .delete(syncConnections)
    .where(
      and(
        eq(syncConnections.userId, userId),
        eq(syncConnections.provider, GITHUB_SOURCE),
      ),
    );
}

export async function touchLastSynced(userId: string): Promise<void> {
  await db
    .update(syncConnections)
    .set({ lastSyncedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(syncConnections.userId, userId),
        eq(syncConnections.provider, GITHUB_SOURCE),
      ),
    );
}

// ── Tareas importadas ──

export interface ImportedTaskRow {
  id: string;
  externalId: string;
  title: string;
  description: string | null;
  boardStatus: string | null;
  sprintId: string | null;
}

/**
 * Tareas ya importadas de este repositorio, indexadas por `external_id`.
 *
 * Se acota por `system_id` además de por usuario: si el mismo issue se importó
 * en dos sistemas distintos no debe cruzarse. Se excluyen las borradas para que
 * borrar una tarjeta y re-sincronizar la vuelva a traer, en vez de dejar el
 * issue invisible para siempre por culpa de un `deleted_at`.
 */
export async function findImportedTasks(
  userId: string,
  systemId: string,
  externalIds: string[],
): Promise<Map<string, ImportedTaskRow>> {
  if (externalIds.length === 0) return new Map();

  const rows = await db
    .select({
      id: tasks.id,
      externalId: tasks.externalId,
      title: tasks.title,
      description: tasks.description,
      boardStatus: tasks.boardStatus,
      sprintId: tasks.sprintId,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.systemId, systemId),
        eq(tasks.externalSource, GITHUB_SOURCE),
        inArray(tasks.externalId, externalIds),
        isNull(tasks.deletedAt),
      ),
    );

  return new Map(
    rows
      .filter((r): r is ImportedTaskRow => r.externalId !== null)
      .map((r) => [r.externalId, r]),
  );
}

export interface NewImportedTask {
  externalId: string;
  title: string;
  description: string;
  boardStatus: string;
  status: "backlog" | "done";
  sprintId: string | null;
}

/**
 * Inserta las tarjetas nuevas en un solo `INSERT`.
 *
 * `onConflictDoNothing` sobre el único parcial es el seguro de la idempotencia
 * bajo concurrencia: si dos sincronizaciones del mismo repo se solapan, la
 * segunda no duplica ni revienta — simplemente no inserta. Devuelve cuántas
 * filas entraron de verdad, que no tiene por qué ser cuántas se intentaron.
 */
export async function insertImportedTasks(
  userId: string,
  systemId: string,
  items: NewImportedTask[],
): Promise<number> {
  if (items.length === 0) return 0;

  const [{ value: maxSort } = { value: null }] = await db
    .select({ value: max(tasks.sortIndex) })
    .from(tasks)
    .where(and(eq(tasks.systemId, systemId), isNull(tasks.deletedAt)));

  const base = (maxSort ?? -1) + 1;
  const now = new Date();

  const inserted = await db
    .insert(tasks)
    .values(
      items.map((item, i) => ({
        userId,
        systemId,
        title: item.title,
        description: item.description,
        status: item.status,
        boardStatus: item.boardStatus,
        boardStatusChangedAt: now,
        completedAt: item.status === "done" ? now : null,
        sprintId: item.sprintId,
        externalSource: GITHUB_SOURCE,
        externalId: item.externalId,
        sortIndex: base + i,
      })),
    )
    .onConflictDoNothing({
      target: [tasks.userId, tasks.externalSource, tasks.externalId],
      // `where` es el predicado del índice parcial, no un filtro de filas:
      // sin él Postgres no reconoce `uq_tasks_external` como árbitro del conflicto.
      where: sql`${tasks.externalId} IS NOT NULL`,
    })
    .returning({ id: tasks.id });

  return inserted.length;
}

/**
 * Aplica el parche de contenido de una tarjeta ya importada.
 *
 * Escribe **sólo** las claves que llegan. Los campos propios de Kino —energía,
 * fecha, plan de hoy, bloque del calendario— no aparecen aquí ni por accidente:
 * el mapper los declara en `KINO_OWNED_FIELDS` y esta función no los acepta.
 */
export async function updateImportedTask(
  taskId: string,
  userId: string,
  patch: { title?: string; description?: string; sprintId?: string | null },
): Promise<void> {
  if (Object.keys(patch).length === 0) return;

  await db
    .update(tasks)
    .set({ ...patch, updatedAt: new Date() })
    .where(
      and(eq(tasks.id, taskId), eq(tasks.userId, userId), isNull(tasks.deletedAt)),
    );
}

// ── Sprints desde milestones ──

/**
 * Asegura que exista un sprint para el milestone y devuelve su id.
 *
 * El único `(system_id, external_id)` hace la operación idempotente: reimportar
 * el mismo milestone actualiza el nombre en vez de sembrar sprints repetidos.
 * `status` no se toca en el update — cerrar un sprint es una decisión de Kino, y
 * un milestone abierto en GitHub no debería reabrir un sprint ya cerrado aquí.
 */
export async function upsertSprintForMilestone(
  userId: string,
  systemId: string,
  milestone: GithubMilestone,
): Promise<{ id: string; created: boolean }> {
  const externalId = String(milestone.id);

  const [existing] = await db
    .select({ id: sprints.id, name: sprints.name })
    .from(sprints)
    .where(
      and(eq(sprints.systemId, systemId), eq(sprints.externalId, externalId)),
    );

  if (existing) {
    if (existing.name !== milestone.title) {
      await db
        .update(sprints)
        .set({ name: milestone.title.slice(0, 255), updatedAt: new Date() })
        .where(eq(sprints.id, existing.id));
    }
    return { id: existing.id, created: false };
  }

  const [{ value: maxOrder } = { value: null }] = await db
    .select({ value: max(sprints.sortOrder) })
    .from(sprints)
    .where(eq(sprints.systemId, systemId));

  const [created] = await db
    .insert(sprints)
    .values({
      userId,
      systemId,
      name: milestone.title.slice(0, 255),
      goal: milestone.description?.slice(0, 500) ?? null,
      endDate: milestone.dueOn ? new Date(milestone.dueOn) : null,
      externalId,
      sortOrder: (maxOrder ?? -1) + 1,
    })
    .onConflictDoNothing({
      target: [sprints.systemId, sprints.externalId],
      where: sql`${sprints.externalId} IS NOT NULL`,
    })
    .returning({ id: sprints.id });

  // Si el conflicto saltó (otra sincronización simultánea lo creó), se relee.
  if (created) return { id: created.id, created: true };

  const [race] = await db
    .select({ id: sprints.id })
    .from(sprints)
    .where(
      and(eq(sprints.systemId, systemId), eq(sprints.externalId, externalId)),
    );
  return { id: race.id, created: false };
}

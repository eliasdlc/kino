import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { taskKeys } from "@/features/tasks/tasks.keys";
import { buildOptimisticTask } from "@/features/tasks/tasks.optimistic";
import type { TaskTransport, CreateTaskInput } from "@/features/tasks/tasks.types";
import { pageKeys } from "@/features/pages/pages.keys";
import type { PageListItem } from "@/features/pages/pages.types";
import type { CreatePageInput } from "@/features/pages/pages.schemas";
import { stickyNoteKeys } from "@/features/sticky-notes/sticky-notes.keys";
import type { StickyNoteItem } from "@/features/sticky-notes/sticky-notes.types";
import type { CreateStickyNoteInput } from "@/features/sticky-notes/sticky-notes.schemas";
import { api } from "@/shared/api/client";
import { reconcileCreated, dropOptimistic } from "./reconcile";

/**
 * ── Creaciones que sobreviven a la falta de red (KIN-57) ─────────────────────
 *
 * Este archivo es la única fuente de verdad de *qué* se puede capturar sin
 * conexión y *cómo* se reconstruye. Tres consumidores leen de aquí:
 *
 *  1. Los hooks de cada feature (`useCreateTask`, `useCreatePage`, …), que usan el
 *     `mutationFn` y la `mutationKey` del spec en vez de definirlos inline.
 *  2. `registerOfflineMutationDefaults`, que registra esos mismos `mutationFn` con
 *     `setMutationDefaults`. Sin eso, una mutación restaurada desde IndexedDB sabe
 *     *qué* quería hacer pero no *cómo* hacerlo, y la cola se queda muda — es el
 *     fallo clásico de esta integración.
 *  3. `applyPendingOptimistic`, que al arrancar vuelve a dibujar en la cache lo que
 *     quedó encolado, para que al reabrir la app sin red siga estando ahí.
 *
 * Regla de oro: todo lo que haga falta para reproducir la creación tiene que vivir
 * en las **variables** de la mutación. Es lo único que TanStack Query persiste; lo
 * que quede capturado en el closure del hook se pierde al cerrar la pestaña.
 *
 * Alcance deliberado: sólo creación (tarea, sticky note, cuaderno). Editar y mover
 * offline abre conflictos de estado que este ticket no resuelve.
 */

/** Variables de creación que pasan por la cola: siempre llevan el id de petición. */
type Queued<T> = T & { clientRequestId?: string };

export type OfflineCreateSpec<TVars, TResult> = {
  /** Prefijo estable con el que se registran los defaults y se busca en la cola. */
  mutationKey: readonly string[];
  mutationFn: (variables: Queued<TVars>) => Promise<TResult>;
  /** Listas cacheadas que toca esta creación. Derivadas sólo de las variables. */
  queryKeys: (variables: Queued<TVars>) => QueryKey[];
  /** Placeholder a pintar mientras la creación no esté confirmada. */
  optimistic: (variables: Queued<TVars>) => TResult;
};

async function postJson<T>(url: string, body: unknown, fallbackMessage: string): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const parsed = await res.json().catch(() => ({}));
    throw new Error((parsed as { message?: string }).message ?? fallbackMessage);
  }
  return res.json() as Promise<T>;
}

export const createTaskSpec: OfflineCreateSpec<CreateTaskInput, TaskTransport> = {
  mutationKey: ["tasks", "create"],
  mutationFn: (data) => api.tasks.create(data),
  queryKeys: (data) => [
    // bySystem la escuchan las cuatro vistas; folderTasks sólo si hay carpeta.
    taskKeys.bySystem(data.systemId),
    ...(data.folderId ? [taskKeys.folderTasks(data.systemId, data.folderId)] : []),
  ],
  optimistic: (data) => buildOptimisticTask(data),
};

export const createPageSpec: OfflineCreateSpec<CreatePageInput, PageListItem> = {
  mutationKey: ["pages", "create"],
  mutationFn: ({ systemId, ...data }) =>
    postJson<PageListItem>(`/api/systems/${systemId}/pages`, data, "Failed to create page"),
  queryKeys: (data) => [pageKeys.bySystem(data.systemId)],
  optimistic: (data) => ({
    id: data.clientRequestId ?? crypto.randomUUID(),
    title: data.title ?? null,
    folderId: data.folderId ?? null,
    systemId: data.systemId,
    isPinned: false,
    parentPageId: data.parentPageId ?? null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    contentPreview: null,
    wordCount: 0,
    tags: [],
    subPageCount: 0,
  }),
};

/** Una sticky note cuelga de una página o de una carpeta, nunca de las dos. */
export type CreateStickyNoteVars = CreateStickyNoteInput &
  ({ pageId: string } | { folderId: string });

export const createStickyNoteSpec: OfflineCreateSpec<CreateStickyNoteVars, StickyNoteItem> = {
  mutationKey: ["sticky-notes", "create"],
  mutationFn: (data) =>
    "pageId" in data && data.pageId
      ? api.stickyNotes.createOnPage({ ...data, pageId: data.pageId })
      : api.stickyNotes.createOnFolder({
          ...data,
          folderId: (data as { folderId: string }).folderId,
        }),
  queryKeys: (data) => [
    "pageId" in data && data.pageId
      ? stickyNoteKeys.byPage(data.pageId)
      : stickyNoteKeys.byFolder((data as { folderId: string }).folderId),
  ],
  optimistic: (data) => ({
    id: data.clientRequestId ?? crypto.randomUUID(),
    title: data.title ?? null,
    content: data.content ?? null,
    color: data.color ?? "yellow",
    sortIndex: 0,
    pageId: "pageId" in data ? (data.pageId ?? null) : null,
    folderId: "folderId" in data ? (data.folderId ?? null) : null,
    positionSide: data.positionSide ?? null,
    positionY: data.positionY ?? null,
    positionX: data.positionX ?? null,
    anchorId: data.anchorId ?? null,
    stackId: null,
    textAnchor: data.textAnchor ?? null,
    isEureka: false,
  }),
};

/* eslint-disable @typescript-eslint/no-explicit-any -- el registro es heterogéneo
   por naturaleza: recorre specs de tres entidades distintas y sólo las usa a través
   de su interfaz común. Cada spec sí está tipado en su declaración de arriba. */
const SPECS: OfflineCreateSpec<any, any>[] = [
  createTaskSpec,
  createPageSpec,
  createStickyNoteSpec,
];
/* eslint-enable @typescript-eslint/no-explicit-any */

/** ¿Esta mutationKey pertenece a una creación encolable? */
export function isOfflineCreateKey(key: unknown): boolean {
  if (!Array.isArray(key)) return false;
  return SPECS.some(
    (spec) => spec.mutationKey.length === key.length &&
      spec.mutationKey.every((part, i) => part === key[i]),
  );
}

function specForKey(key: unknown): OfflineCreateSpec<Record<string, unknown>, { id: string }> | undefined {
  if (!Array.isArray(key)) return undefined;
  return SPECS.find(
    (spec) => spec.mutationKey.length === key.length &&
      spec.mutationKey.every((part, i) => part === key[i]),
  );
}

/**
 * Escribe el placeholder de una creación en todas las listas que toca.
 * Idempotente: reaplicarlo no duplica (pasa por `reconcileCreated`).
 */
export function applyOptimistic<TVars, TResult extends { id: string }>(
  queryClient: QueryClient,
  spec: OfflineCreateSpec<TVars, TResult>,
  variables: Queued<TVars>,
): void {
  const placeholder = spec.optimistic(variables);
  for (const key of spec.queryKeys(variables)) {
    queryClient.setQueryData<TResult[]>(key, (old = []) =>
      reconcileCreated(old, variables.clientRequestId, placeholder),
    );
  }
}

/**
 * Sustituye el placeholder por la entidad confirmada. Se registra en los defaults
 * (para las mutaciones que se reproducen sin componente montado) y la reusan los
 * hooks, para que online y offline reconcilien exactamente igual.
 */
export function applyCreated<TVars, TResult extends { id: string }>(
  queryClient: QueryClient,
  spec: OfflineCreateSpec<TVars, TResult>,
  variables: Queued<TVars>,
  created: TResult,
): void {
  for (const key of spec.queryKeys(variables)) {
    queryClient.setQueryData<TResult[]>(key, (old = []) =>
      reconcileCreated(old, variables.clientRequestId, created),
    );
  }
}

/** Retira el placeholder cuando la creación falla de verdad contra el servidor. */
export function revertOptimistic<TVars, TResult extends { id: string }>(
  queryClient: QueryClient,
  spec: OfflineCreateSpec<TVars, TResult>,
  variables: Queued<TVars>,
): void {
  for (const key of spec.queryKeys(variables)) {
    queryClient.setQueryData<TResult[]>(key, (old = []) =>
      dropOptimistic(old, variables.clientRequestId),
    );
  }
}

/**
 * Registra el `mutationFn` (y la reconciliación) de cada creación encolable.
 *
 * Esto es lo que permite que una mutación restaurada desde IndexedDB tras cerrar el
 * navegador sepa ejecutarse: la función no se persiste, sólo la clave y las
 * variables. Debe llamarse **antes** de restaurar la cache.
 */
export function registerOfflineMutationDefaults(queryClient: QueryClient): void {
  for (const spec of SPECS) {
    queryClient.setMutationDefaults(spec.mutationKey, {
      mutationFn: spec.mutationFn,
      // `offlineFirst`: intenta la petición aunque el navegador se crea sin red
      // (portales cautivos, `navigator.onLine` mintiendo) y sólo se pausa cuando
      // falla de verdad. Con `online` ni lo intentaría.
      networkMode: "offlineFirst",
      retry: 2,
      onSuccess: (created, variables) => {
        applyCreated(queryClient, spec, variables, created as { id: string });
      },
      onError: (_error, variables) => {
        revertOptimistic(queryClient, spec, variables);
      },
      onSettled: (_data, _error, variables) => {
        for (const key of spec.queryKeys(variables)) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      },
    });
  }
}

/**
 * Vuelve a dibujar en la cache todo lo que quedó encolado.
 *
 * Se llama tras rehidratar la cola: sin esto, al reabrir la app sin conexión la
 * lista sale vacía (las *queries* no se persisten en este ticket — eso es KIN-62) y
 * daría la sensación de que lo capturado se perdió, aunque la cola lo conserve.
 */
export function applyPendingOptimistic(queryClient: QueryClient): void {
  for (const mutation of queryClient.getMutationCache().getAll()) {
    if (!mutation.state.isPaused) continue;
    const spec = specForKey(mutation.options.mutationKey);
    if (!spec) continue;
    applyOptimistic(queryClient, spec, mutation.state.variables as Record<string, unknown>);
  }
}

/**
 * Ids de petición que siguen sin confirmarse. Alimenta la marca de "pendiente":
 * una fila está pendiente si su id está en este conjunto, porque el id del
 * placeholder es el propio `clientRequestId`.
 */
export function pendingCreationIds(queryClient: QueryClient): Set<string> {
  const ids = new Set<string>();
  for (const mutation of queryClient.getMutationCache().getAll()) {
    if (mutation.state.status !== "pending") continue;
    if (!isOfflineCreateKey(mutation.options.mutationKey)) continue;
    const id = (mutation.state.variables as { clientRequestId?: string })?.clientRequestId;
    if (id) ids.add(id);
  }
  return ids;
}

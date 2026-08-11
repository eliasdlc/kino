"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pageKeys } from "@/features/pages/pages.hooks";
import type { WorkJournal, WritingOverview } from "./writing.types";
import type { LooseThreadsReport } from "./chekhov";
import type { TimelineReport } from "./timeline";
import type { Manuscript } from "./writing.manuscript";
import type { PlotGrid, PlotOperation } from "./writing.plot";
import type { SnapshotDetail, SnapshotListItem } from "./snapshots";
import type { ChapterSummary, StudioReport } from "./writing.studio";

async function jsonOrThrow<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? fallback);
  }
  return res.json();
}

export const writingKeys = {
  overview: (systemId: string) => ["writing", "overview", systemId] as const,
  journal: (folderId: string) => ["writing", "journal", folderId] as const,
  threads: (folderId: string) => ["writing", "threads", folderId] as const,
  timeline: (folderId: string) => ["writing", "timeline", folderId] as const,
  manuscript: (folderId: string) => ["writing", "manuscript", folderId] as const,
  plot: (folderId: string) => ["writing", "plot", folderId] as const,
  snapshots: (pageId: string) => ["writing", "snapshots", pageId] as const,
  snapshot: (snapshotId: string) => ["writing", "snapshot", snapshotId] as const,
  studio: (systemId: string) => ["writing", "studio", systemId] as const,
  summary: (pageId: string) => ["writing", "summary", pageId] as const,
};

/** Qué escribir hoy y huecos del universo (KIN-143). */
export function useStudio(systemId: string | null) {
  return useQuery<StudioReport>({
    queryKey: writingKeys.studio(systemId ?? "none"),
    queryFn: () =>
      fetch(`/api/systems/${systemId}/studio`).then((r) =>
        jsonOrThrow(r, "No se pudo cargar el estudio"),
      ),
    enabled: !!systemId,
    // Depende de la hora local y de lo escrito hoy: al volver a la ventana, se
    // vuelve a mirar.
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}

/** Resumen extractivo del capítulo. */
export function useChapterSummary(pageId: string | null) {
  return useQuery<ChapterSummary>({
    queryKey: writingKeys.summary(pageId ?? "none"),
    queryFn: () =>
      fetch(`/api/pages/${pageId}/summary`).then((r) =>
        jsonOrThrow(r, "No se pudo resumir el capítulo"),
      ),
    enabled: !!pageId,
    staleTime: 60_000,
  });
}

/** Historial de versiones de un capítulo (KIN-142). Sin el texto: solo metadatos. */
export function useSnapshots(pageId: string | null) {
  return useQuery<SnapshotListItem[]>({
    queryKey: writingKeys.snapshots(pageId ?? "none"),
    queryFn: () =>
      fetch(`/api/pages/${pageId}/snapshots`).then((r) =>
        jsonOrThrow(r, "No se pudo cargar el historial"),
      ),
    enabled: !!pageId,
    staleTime: 15_000,
  });
}

/** Una versión concreta con su texto, para previsualizarla antes de restaurar. */
export function useSnapshot(snapshotId: string | null) {
  return useQuery<SnapshotDetail>({
    queryKey: writingKeys.snapshot(snapshotId ?? "none"),
    queryFn: () =>
      fetch(`/api/snapshots/${snapshotId}`).then((r) =>
        jsonOrThrow(r, "No se pudo cargar la versión"),
      ),
    enabled: !!snapshotId,
    // El texto de una versión no cambia nunca: no hay por qué volver a pedirlo.
    staleTime: Infinity,
  });
}

export function useRestoreSnapshot(pageId: string) {
  const qc = useQueryClient();
  return useMutation<{ pageId: string; content: string | null }, Error, string>({
    mutationFn: (snapshotId) =>
      fetch(`/api/snapshots/${snapshotId}/restore`, { method: "POST" }).then((r) =>
        jsonOrThrow(r, "No se pudo restaurar la versión"),
      ),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: writingKeys.snapshots(pageId) });
      qc.invalidateQueries({ queryKey: ["pages"] });
      qc.invalidateQueries({ queryKey: ["entities"] });
    },
  });
}

/** Escenas por capítulo y arco (KIN-141). */
export function usePlotGrid(folderId: string | null) {
  return useQuery<PlotGrid>({
    queryKey: writingKeys.plot(folderId ?? "none"),
    queryFn: () =>
      fetch(`/api/folders/${folderId}/plot`).then((r) =>
        jsonOrThrow(r, "No se pudo cargar el tablero de escenas"),
      ),
    enabled: !!folderId,
    staleTime: 15_000,
  });
}

/**
 * Mueve una escena o le cambia el arco. El server devuelve la rejilla completa ya
 * recalculada —es él quien reescribe el texto—, así que la respuesta se escribe
 * directa en el cache en vez de invalidar y volver a pedir.
 */
export function usePlotOperation(folderId: string) {
  const qc = useQueryClient();
  return useMutation<
    PlotGrid,
    Error,
    PlotOperation,
    { prev?: PlotGrid }
  >({
    mutationFn: (operation) =>
      fetch(`/api/folders/${folderId}/plot`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(operation),
      }).then((r) => jsonOrThrow(r, "No se pudo mover la escena")),
    onMutate: async () => {
      const key = writingKeys.plot(folderId);
      await qc.cancelQueries({ queryKey: key });
      return { prev: qc.getQueryData<PlotGrid>(key) };
    },
    onSuccess: (grid) => {
      qc.setQueryData(writingKeys.plot(folderId), grid);
    },
    onError: (_e, _v, context) => {
      if (context?.prev) qc.setQueryData(writingKeys.plot(folderId), context.prev);
    },
    onSettled: () => {
      // El texto de los capítulos cambió: el editor y el codex tienen que verlo.
      qc.invalidateQueries({ queryKey: ["pages"] });
      qc.invalidateQueries({ queryKey: ["entities"] });
      qc.invalidateQueries({ queryKey: writingKeys.manuscript(folderId) });
    },
  });
}

/**
 * El manuscrito completo con el contenido de cada capítulo (KIN-139). Pesa lo
 * que pese la obra, así que solo se pide cuando de verdad se va a compilar.
 */
export function useManuscript(folderId: string | null) {
  return useQuery<Manuscript>({
    queryKey: writingKeys.manuscript(folderId ?? "none"),
    queryFn: () =>
      fetch(`/api/folders/${folderId}/manuscript`).then((r) =>
        jsonOrThrow(r, "No se pudo cargar el manuscrito"),
      ),
    enabled: !!folderId,
    staleTime: 30_000,
  });
}

/** Cronología in-world de una obra (KIN-140). */
export function useTimeline(folderId: string | null) {
  return useQuery<TimelineReport>({
    queryKey: writingKeys.timeline(folderId ?? "none"),
    queryFn: () =>
      fetch(`/api/folders/${folderId}/timeline`).then((r) =>
        jsonOrThrow(r, "No se pudo cargar la cronología"),
      ),
    enabled: !!folderId,
    staleTime: 30_000,
  });
}

/**
 * Reordena la cronología. Optimista sobre la lista completa: el server reasigna
 * posiciones 1..n, así que el cliente puede anticipar exactamente el resultado.
 */
export function useReorderTimeline(systemId: string, folderId: string) {
  const qc = useQueryClient();
  return useMutation<
    { updated: number },
    Error,
    { eventIds: string[]; placed: TimelineReport["placed"] },
    { prev?: TimelineReport }
  >({
    mutationFn: ({ eventIds }) =>
      fetch(`/api/systems/${systemId}/timeline`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventIds }),
      }).then((r) => jsonOrThrow(r, "No se pudo reordenar la cronología")),
    onMutate: async ({ placed }) => {
      const key = writingKeys.timeline(folderId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TimelineReport>(key);
      if (prev) qc.setQueryData<TimelineReport>(key, { ...prev, placed });
      return { prev };
    },
    onError: (_e, _v, context) => {
      if (context?.prev) qc.setQueryData(writingKeys.timeline(folderId), context.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: writingKeys.timeline(folderId) });
      qc.invalidateQueries({ queryKey: ["entities"] });
    },
  });
}

/** Saca un evento de la cronología (vuelve a "sin ubicar"). */
export function useUnplaceEvent(folderId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (entityId) => {
      const res = await fetch(`/api/entities/${entityId}/timeline`, { method: "DELETE" });
      if (!res.ok) throw new Error("No se pudo sacar el evento de la cronología");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: writingKeys.timeline(folderId) });
      qc.invalidateQueries({ queryKey: ["entities"] });
    },
  });
}

/** Hilos sueltos de una obra (KIN-137). */
export function useLooseThreads(folderId: string | null) {
  return useQuery<LooseThreadsReport>({
    queryKey: writingKeys.threads(folderId ?? "none"),
    queryFn: () =>
      fetch(`/api/folders/${folderId}/threads`).then((r) =>
        jsonOrThrow(r, "No se pudieron cargar los hilos sueltos"),
      ),
    enabled: !!folderId,
    staleTime: 30_000,
  });
}

/**
 * Cierra o reabre un hilo. Optimista: la lista se reordena sola en el server, así
 * que aquí solo se conmuta la bandera y se revalida — el patrón canónico de
 * mutación del proyecto con el rollback incluido.
 */
export function useResolveThread(folderId: string) {
  const qc = useQueryClient();
  return useMutation<
    { id: string; threadResolvedMentions: number | null },
    Error,
    { entityId: string; resolved: boolean },
    { prev?: LooseThreadsReport }
  >({
    mutationFn: ({ entityId, resolved }) =>
      fetch(`/api/entities/${entityId}/thread`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved }),
      }).then((r) => jsonOrThrow(r, "No se pudo actualizar el hilo")),
    onMutate: async ({ entityId, resolved }) => {
      const key = writingKeys.threads(folderId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<LooseThreadsReport>(key);
      if (prev) {
        qc.setQueryData<LooseThreadsReport>(key, {
          ...prev,
          threads: prev.threads.map((t) =>
            t.entityId === entityId ? { ...t, resolved, reopened: false } : t,
          ),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) qc.setQueryData(writingKeys.threads(folderId), context.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: writingKeys.threads(folderId) });
    },
  });
}

/** Racha, palabras de hoy, ventana creativa y pulso de cada obra. */
export function useWritingOverview(systemId: string, enabled = true) {
  return useQuery<WritingOverview>({
    queryKey: writingKeys.overview(systemId),
    queryFn: () =>
      fetch(`/api/systems/${systemId}/writing`).then((r) =>
        jsonOrThrow(r, "No se pudo cargar el panorama de escritura"),
      ),
    enabled,
    // Las sesiones se registran al guardar el capítulo: al volver a la ventana
    // la racha y las palabras de hoy ya reflejan lo que se acaba de escribir.
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}

export function useWorkJournal(folderId: string | null) {
  return useQuery<WorkJournal>({
    queryKey: writingKeys.journal(folderId ?? "none"),
    queryFn: () =>
      fetch(`/api/folders/${folderId}/journal`).then((r) =>
        jsonOrThrow(r, "No se pudo cargar el diario de la obra"),
      ),
    enabled: !!folderId,
    staleTime: 30_000,
  });
}

export function useToggleChapterComplete(pageId: string, systemId: string) {
  const qc = useQueryClient();
  return useMutation<{ id: string; completedAt: string | null }, Error, boolean>({
    mutationFn: (completed) =>
      fetch(`/api/pages/${pageId}/complete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      }).then((r) => jsonOrThrow(r, "No se pudo marcar el capítulo")),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pageKeys.bySystem(systemId) });
      qc.invalidateQueries({ queryKey: pageKeys.detail(pageId) });
      qc.invalidateQueries({ queryKey: ["pages", "subpages"] });
      qc.invalidateQueries({ queryKey: ["writing"] });
    },
  });
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pageKeys } from "@/features/pages/pages.hooks";
import type { LooseThreadsReport } from "./chekhov";
import type { TimelineReport } from "./timeline";
import type { PlotGrid, PlotOperation } from "./writing.plot";
import { api } from "@/shared/api/client";
import { useOptimisticRecord } from "@/shared/hooks/optimistic";

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
  return useQuery({
    queryKey: writingKeys.studio(systemId ?? "none"),
    queryFn: () =>
      api.writing.studio({ id: systemId! }),
    enabled: !!systemId,
    // Depende de la hora local y de lo escrito hoy: al volver a la ventana, se
    // vuelve a mirar.
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}

/** Resumen extractivo del capítulo. */
export function useChapterSummary(pageId: string | null) {
  return useQuery({
    queryKey: writingKeys.summary(pageId ?? "none"),
    queryFn: () =>
      api.writing.chapterSummary({ id: pageId! }),
    enabled: !!pageId,
    staleTime: 60_000,
  });
}

/** Historial de versiones de un capítulo (KIN-142). Sin el texto: solo metadatos. */
export function useSnapshots(pageId: string | null) {
  return useQuery({
    queryKey: writingKeys.snapshots(pageId ?? "none"),
    queryFn: () =>
      api.writing.snapshots({ id: pageId! }),
    enabled: !!pageId,
    staleTime: 15_000,
  });
}

/** Una versión concreta con su texto, para previsualizarla antes de restaurar. */
export function useSnapshot(snapshotId: string | null) {
  return useQuery({
    queryKey: writingKeys.snapshot(snapshotId ?? "none"),
    queryFn: () =>
      api.writing.snapshot({ id: snapshotId! }),
    enabled: !!snapshotId,
    // El texto de una versión no cambia nunca: no hay por qué volver a pedirlo.
    staleTime: Infinity,
  });
}

export function useRestoreSnapshot(pageId: string) {
  const qc = useQueryClient();
  return useMutation<{ pageId: string; content: string | null }, Error, string>({
    mutationFn: (snapshotId) =>
      api.writing.restoreSnapshot({ id: snapshotId }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: writingKeys.snapshots(pageId) });
      qc.invalidateQueries({ queryKey: ["pages"] });
      qc.invalidateQueries({ queryKey: ["entities"] });
    },
  });
}

/** Escenas por capítulo y arco (KIN-141). */
export function usePlotGrid(folderId: string | null) {
  return useQuery({
    queryKey: writingKeys.plot(folderId ?? "none"),
    queryFn: () =>
      api.writing.plot({ id: folderId! }),
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
  // La rejilla es un registro, no una lista: el servidor la devuelve entera ya
  // recalculada, así que el updater la deja como está y `onSuccess` la escribe.
  return useOptimisticRecord<PlotGrid, Error, PlotOperation, PlotGrid>({
    mutationFn: (operation) => api.writing.applyPlotOperation({ id: folderId, ...operation }),
    queryKey: writingKeys.plot(folderId),
    updater: (grid) => grid,
    onSuccess: (grid) => qc.setQueryData(writingKeys.plot(folderId), grid),
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
  return useQuery({
    queryKey: writingKeys.manuscript(folderId ?? "none"),
    queryFn: () =>
      api.writing.manuscript({ id: folderId! }),
    enabled: !!folderId,
    staleTime: 30_000,
  });
}

/** Cronología in-world de una obra (KIN-140). */
export function useTimeline(folderId: string | null) {
  return useQuery({
    queryKey: writingKeys.timeline(folderId ?? "none"),
    queryFn: () =>
      api.writing.timeline({ id: folderId! }),
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
  return useOptimisticRecord<
    { updated: number },
    Error,
    { eventIds: string[]; placed: TimelineReport["placed"] },
    TimelineReport
  >({
    mutationFn: ({ eventIds }) => api.writing.reorderTimeline({ id: systemId, eventIds }),
    queryKey: writingKeys.timeline(folderId),
    updater: (report, { placed }) => ({ ...report, placed }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["entities"] }),
  });
}

/** Saca un evento de la cronología (vuelve a "sin ubicar"). */
export function useUnplaceEvent(folderId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (entityId) => {
      await api.writing.unplaceFromTimeline({ id: entityId });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: writingKeys.timeline(folderId) });
      qc.invalidateQueries({ queryKey: ["entities"] });
    },
  });
}

/** Hilos sueltos de una obra (KIN-137). */
export function useLooseThreads(folderId: string | null) {
  return useQuery({
    queryKey: writingKeys.threads(folderId ?? "none"),
    queryFn: () =>
      api.writing.threads({ id: folderId! }),
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
  return useOptimisticRecord<
    { id: string; threadResolvedMentions: number | null },
    Error,
    { entityId: string; resolved: boolean },
    LooseThreadsReport
  >({
    mutationFn: ({ entityId, resolved }) => api.writing.resolveThread({ id: entityId, resolved }),
    queryKey: writingKeys.threads(folderId),
    updater: (report, { entityId, resolved }) => ({
      ...report,
      threads: report.threads.map((t) =>
        t.entityId === entityId ? { ...t, resolved, reopened: false } : t,
      ),
    }),
  });
}

/** Racha, palabras de hoy, ventana creativa y pulso de cada obra. */
export function useWritingOverview(systemId: string, enabled = true) {
  return useQuery({
    queryKey: writingKeys.overview(systemId),
    queryFn: () =>
      api.writing.overview({ id: systemId! }),
    enabled,
    // Las sesiones se registran al guardar el capítulo: al volver a la ventana
    // la racha y las palabras de hoy ya reflejan lo que se acaba de escribir.
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}

export function useWorkJournal(folderId: string | null) {
  return useQuery({
    queryKey: writingKeys.journal(folderId ?? "none"),
    queryFn: () =>
      api.writing.journal({ id: folderId! }),
    enabled: !!folderId,
    staleTime: 30_000,
  });
}

export function useToggleChapterComplete(pageId: string, systemId: string) {
  const qc = useQueryClient();
  return useMutation<{ id: string; completedAt: string | null }, Error, boolean>({
    mutationFn: (completed) =>
      api.writing.setCompleted({ id: pageId, completed }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pageKeys.bySystem(systemId) });
      qc.invalidateQueries({ queryKey: pageKeys.detail(pageId) });
      qc.invalidateQueries({ queryKey: ["pages", "subpages"] });
      qc.invalidateQueries({ queryKey: ["writing"] });
    },
  });
}

"use client";

import { api } from "@convex/_generated/api";
import { useConvexMutation, useConvexQuery } from "@/shared/convex/hooks";
import type { TimelineReport } from "./timeline";
import type { PlotOperation } from "./writing.plot";

/** Qué escribir hoy y huecos del universo. */
export function useStudio(systemId: string | null) {
  return useConvexQuery(api.writing.studio, systemId ? { id: systemId } : "skip");
}

/** Resumen extractivo del capítulo. */
export function useChapterSummary(pageId: string | null) {
  return useConvexQuery(api.writing.chapterSummary, pageId ? { id: pageId } : "skip");
}

/** Historial de versiones de un capítulo. Sin el texto: solo metadatos. */
export function useSnapshots(pageId: string | null) {
  return useConvexQuery(api.writing.snapshots, pageId ? { id: pageId } : "skip");
}

/** Una versión concreta con su texto, para previsualizarla antes de restaurar. */
export function useSnapshot(snapshotId: string | null) {
  return useConvexQuery(api.writing.snapshot, snapshotId ? { id: snapshotId } : "skip");
}

export function useRestoreSnapshot(_pageId: string) {
  return useConvexMutation(api.writing.restoreSnapshot, { map: (snapshotId: string) => ({ id: snapshotId }) });
}

/** Escenas por capítulo y arco. */
export function usePlotGrid(folderId: string | null) {
  return useConvexQuery(api.writing.plot, folderId ? { id: folderId } : "skip");
}

/** Mueve una escena o le cambia el arco. El servidor reescribe el texto y devuelve la rejilla. */
export function usePlotOperation(folderId: string) {
  return useConvexMutation(api.writing.applyPlotOperation, {
    map: (operation: PlotOperation) => ({ id: folderId, operation }),
  });
}

/** El manuscrito completo con el contenido de cada capítulo. Solo se pide al compilar. */
export function useManuscript(folderId: string | null) {
  return useConvexQuery(api.writing.manuscript, folderId ? { id: folderId } : "skip");
}

/** Cronología in-world de una obra. */
export function useTimeline(folderId: string | null) {
  return useConvexQuery(api.writing.timeline, folderId ? { id: folderId } : "skip");
}

export function useReorderTimeline(systemId: string, _folderId: string) {
  return useConvexMutation(api.writing.reorderTimeline, {
    map: ({ eventIds }: { eventIds: string[]; placed: TimelineReport["placed"] }) => ({ id: systemId, eventIds }),
  });
}

/** Saca un evento de la cronología (vuelve a "sin ubicar"). */
export function useUnplaceEvent(_folderId: string) {
  return useConvexMutation(api.writing.unplaceFromTimeline, { map: (entityId: string) => ({ id: entityId }) });
}

/** Hilos sueltos de una obra. */
export function useLooseThreads(folderId: string | null) {
  return useConvexQuery(api.writing.threads, folderId ? { id: folderId } : "skip");
}

/** Cierra o reabre un hilo. */
export function useResolveThread(_folderId: string) {
  return useConvexMutation(api.writing.resolveThread, {
    map: ({ entityId, resolved }: { entityId: string; resolved: boolean }) => ({ id: entityId, resolved }),
  });
}

/** Racha, palabras de hoy, ventana creativa y pulso de cada obra. */
export function useWritingOverview(systemId: string, enabled = true) {
  return useConvexQuery(api.writing.overview, { id: systemId }, { enabled });
}

export function useWorkJournal(folderId: string | null) {
  return useConvexQuery(api.writing.journal, folderId ? { id: folderId } : "skip");
}

export function useToggleChapterComplete(pageId: string, _systemId: string) {
  return useConvexMutation(api.writing.setCompleted, {
    map: (completed: boolean) => ({ id: pageId, completed }),
  });
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pageKeys } from "@/features/pages/pages.hooks";
import type { WorkJournal, WritingOverview } from "./writing.types";
import type { LooseThreadsReport } from "./chekhov";
import type { TimelineReport } from "./timeline";

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
};

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

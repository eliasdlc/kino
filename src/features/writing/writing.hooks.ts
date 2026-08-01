"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pageKeys } from "@/features/pages/pages.hooks";
import type { WorkJournal, WritingOverview } from "./writing.types";

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
};

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

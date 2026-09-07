"use client";

import { useCallback, useState } from "react";
import { useUpdateFolder } from "@/features/folders/folders.hooks";

/**
 * Mesa de referencias (PLAN-11 §7): las entidades que el autor quiere a la vista
 * mientras escribe. Se guardan en `folders.metadata.pinnedEntityIds` de la obra
 *: es estado de la obra, no del capítulo, porque la referencia visual de un
 * personaje sirve en todos sus capítulos.
 */

export function readPinnedIds(metadata: Record<string, unknown> | null | undefined): string[] {
  const raw = metadata?.pinnedEntityIds;
  return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
}

const MAX_PINNED = 12;

export function usePinnedReferences({
  systemId,
  folderId,
  metadata,
}: {
  systemId: string;
  /** Obra a la que pertenece el capítulo; null en un manuscrito suelto. */
  folderId: string | null;
  /** Metadata de la obra tal como llegó del server (base del estado local). */
  metadata: Record<string, unknown> | null;
}) {
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => readPinnedIds(metadata));
  const { mutate: updateFolder } = useUpdateFolder(systemId);

  const toggle = useCallback(
    (entityId: string) => {
      if (!folderId) return;
      setPinnedIds((current) => {
        const next = current.includes(entityId)
          ? current.filter((id) => id !== entityId)
          : [...current, entityId].slice(-MAX_PINNED);
        // La metadata se reescribe entera (el PATCH la reemplaza), así que se
        // conservan las demás claves de la obra explícitamente.
        const rest = { ...(metadata ?? {}) };
        delete rest.pinnedEntityIds;
        updateFolder({
          folderId,
          data: { metadata: { ...rest, pinnedEntityIds: next } },
        });
        return next;
      });
    },
    [folderId, metadata, updateFolder],
  );

  return { pinnedIds, toggle, canPin: folderId !== null };
}

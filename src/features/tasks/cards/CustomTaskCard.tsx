"use client";

import { useSystemManifest } from "@/features/systems/systems.hooks";
import { findTaskKind } from "@/shared/lib/system-manifest";
import { defaultTaskMeta } from "../TaskRow";
import { DefaultTaskCard } from "./DefaultTaskCard";
import type { TaskCardProps } from "./types";

/**
 * Custom, la única fila cuyo vocabulario no está en el código: el tipo sale de
 * lo que la persona compuso para SU sistema (D16), y va delante de la meta
 * común junto a la carpeta. Sin composición se comporta como la fila genérica.
 */
export function CustomTaskCard(props: TaskCardProps) {
  const manifest = useSystemManifest(props.systemId);
  const kind = findTaskKind(manifest, (props.task.metadata as Record<string, unknown> | null)?.kind);
  return (
    <DefaultTaskCard
      {...props}
      systemType="custom"
      metaParts={(state) => {
        const contexto = [kind?.label.toLowerCase(), state.folder?.name].filter(Boolean).join(", ");
        return defaultTaskMeta(props.task, contexto || undefined);
      }}
    />
  );
}

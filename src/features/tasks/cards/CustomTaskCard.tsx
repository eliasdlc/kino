"use client";

import { useSystemManifest } from "@/features/systems/systems.hooks";
import { findTaskKind } from "@/shared/lib/system-manifest";
import { getSystemColor } from "@/shared/utils/system-colors";
import { cn } from "@/lib/utils";
import { DefaultTaskCard } from "./DefaultTaskCard";
import type { TaskCardProps } from "./types";
import type { TaskCardState } from "./useTaskCard";
import type { TaskTransport } from "../tasks.types";

/**
 * Custom, la única card cuyo vocabulario no está en el código: el kind sale de
 * lo que el usuario compuso para SU sistema (D16). Sin composición se comporta
 * exactamente como la fila genérica.
 */
function CustomMeta({ task, state, systemId }: { task: TaskTransport; state: TaskCardState; systemId: string }) {
  const manifest = useSystemManifest(systemId);
  const kind = findTaskKind(manifest, (task.metadata as Record<string, unknown> | null)?.kind);
  const KindIcon = kind?.icon;
  const { folder } = state;

  if (!kind && !folder) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap text-xs md:text-sm text-zinc-400">
      {kind && KindIcon && (
        <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-0.5 text-zinc-300">
          <KindIcon size={13} />
          {kind.label}
        </span>
      )}
      {folder && (
        <span className="inline-flex items-center gap-1">
          <span className={cn("size-1.5 rounded-full shrink-0", `bg-${getSystemColor(folder.color)}`)} />
          {folder.name}
        </span>
      )}
    </div>
  );
}

export function CustomTaskCard(props: TaskCardProps) {
  return (
    <DefaultTaskCard
      {...props}
      systemType="custom"
      renderMeta={(state) => (
        <CustomMeta task={props.task} state={state} systemId={props.systemId} />
      )}
    />
  );
}

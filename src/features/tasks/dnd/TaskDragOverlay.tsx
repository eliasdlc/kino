"use client";

import { DragOverlay } from "@dnd-kit/core";
import type { TaskTransport } from "../tasks.types";
import { ProjectTaskCard } from "../cards/ProjectTaskCard";

interface TaskDragOverlayProps {
  activeTask: TaskTransport | null;
  systemId: string;
}

export function TaskDragOverlay({ activeTask, systemId }: TaskDragOverlayProps) {
  return (
    // El ticket en vuelo es el mismo renglón sobre el papel, con el hairline
    // fuerte alrededor: sin sombra ni giro, que son otro vocabulario de
    // elevación. La caída usa la curva de la casa.
    <DragOverlay dropAnimation={{ duration: 160, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
      {activeTask ? (
        <div className="pointer-events-none cursor-grabbing rounded-md border border-input bg-background px-1">
          <ProjectTaskCard
            task={activeTask}
            systemId={systemId}
            onToggle={() => {}}
            onDelete={() => {}}
          />
        </div>
      ) : null}
    </DragOverlay>
  );
}

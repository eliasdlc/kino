"use client";

import { DragOverlay } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { Task } from "../tasks.types";
import { ProjectTaskCard } from "../cards/ProjectTaskCard";

interface TaskDragOverlayProps {
  activeTask: Task | null;
  systemId: string;
}

export function TaskDragOverlay({ activeTask, systemId }: TaskDragOverlayProps) {
  return (
    <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
      {activeTask ? (
        <div
          className={cn(
            "shadow-xl shadow-black/30",
            "scale-[1.03] rotate-[1deg]",
            "opacity-95",
            "cursor-grabbing",
            "pointer-events-none"
          )}
        >
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

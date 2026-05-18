"use client";

import { DragOverlay } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { Task } from "../tasks.types";
import { TaskCard } from "../TaskCard";

interface TaskDragOverlayProps {
  /** The task currently being dragged — null when idle */
  activeTask: Task | null;
  systemId: string;
}

/**
 * Floating overlay that follows the cursor during a drag.
 * Renders a stylized copy of the TaskCard to maintain visual consistency
 * while adding "in-flight" cues: elevated shadow, subtle scale + tilt.
 */
export function TaskDragOverlay({ activeTask, systemId }: TaskDragOverlayProps) {
  return (
    <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
      {activeTask ? (
        <div
          className={cn(
            // Elevated "in-flight" appearance
            "shadow-lg shadow-primary/10",
            "scale-105 rotate-[1deg]",
            "opacity-95",
            "ring-2 ring-primary/30 rounded-md",
            "cursor-grabbing",
            "pointer-events-none"
          )}
        >
          <TaskCard
            task={activeTask}
            systemId={systemId}
            // Interaction handlers are no-ops during drag — overlay is non-interactive
            onToggle={() => {}}
            onDelete={() => {}}
          />
        </div>
      ) : null}
    </DragOverlay>
  );
}

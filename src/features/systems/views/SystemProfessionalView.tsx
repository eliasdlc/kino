"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useTasks, useUpdateTask, useDeleteTask } from "@/features/tasks/tasks.hooks";
import { TaskCard } from "@/features/tasks/TaskCard";
import { TaskDetailSheet } from "@/features/tasks/TaskDetailSheet";
import { CreateTaskDialog } from "@/features/tasks/CreateTaskDialog";
import { DroppableColumn } from "@/features/tasks/dnd/DroppableColumn";
import { AlertTriangle } from "lucide-react";
import { SYSTEM_TYPE_CONFIG } from "@/shared/lib/system-types";
import type { Task } from "@/features/tasks/tasks.types";
import type { SystemViewProps } from "./SystemDetailView";

export function SystemProfessionalView({ system, initialTasks }: SystemViewProps) {
  const { data: allTasks = [] } = useTasks(system.id, initialTasks);
  const { mutate: updateTask } = useUpdateTask(system.id);
  const { mutate: deleteTask } = useDeleteTask(system.id);

  const [editTask, setEditTask] = useState<Task | null>(null);
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const statuses = SYSTEM_TYPE_CONFIG.professional.statuses;
  const activeTasks = allTasks.filter((t) => t.deletedAt === null || t.deletedAt === undefined);
  const blockedCount = activeTasks.filter((t) => t.status === "blocked").length;

  function handleDragStart({ active }: DragStartEvent) {
    const task = activeTasks.find((t) => t.id === active.id);
    setDraggingTask(task ?? null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDraggingTask(null);
    if (!over || active.id === over.id) return;
    const taskId = active.id as string;
    const newStatus = over.id as string;
    updateTask({ taskId, data: { status: newStatus } });
  }

  function handleToggle(taskId: string) {
    const task = activeTasks.find((t) => t.id === taskId);
    if (!task) return;
    const newStatus = task.status === "done" ? "in-progress" : "done";
    updateTask({ taskId, data: { status: newStatus } });
  }

  return (
    <div className="space-y-4">
      {blockedCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
          <AlertTriangle size={16} className="shrink-0" />
          {blockedCount} tarea{blockedCount !== 1 ? "s" : ""} bloqueada{blockedCount !== 1 ? "s" : ""} — revisión necesaria.
        </div>
      )}

      <div className="flex items-center justify-between">
        <CreateTaskDialog systemId={system.id} />
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Horizontal scroll kanban */}
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
          {statuses.map((statusDef) => {
            const columnTasks = activeTasks.filter((t) => t.status === statusDef.name);
            return (
              <DroppableColumn
                key={statusDef.name}
                id={statusDef.name}
                className="min-w-[240px] max-w-[260px] flex-shrink-0 bg-muted/40 rounded-xl p-3 flex flex-col gap-2"
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    {statusDef.emoji && <span>{statusDef.emoji}</span>}
                    {statusDef.label}
                  </span>
                  <span className="text-xs text-muted-foreground bg-background px-1.5 py-0.5 rounded-full">
                    {columnTasks.length}
                  </span>
                </div>

                {/* Tasks */}
                <div className="space-y-2 min-h-[60px]">
                  {columnTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      systemId={system.id}
                      systemType="professional"
                      draggable
                      onToggle={handleToggle}
                      onDelete={(t) => deleteTask(t.id)}
                      onEdit={setEditTask}
                    />
                  ))}
                  {columnTasks.length === 0 && (
                    <p className="text-xs text-muted-foreground/50 text-center py-4">
                      {statusDef.name === "in-progress"
                        ? "¿Hoy qué priorizas?"
                        : statusDef.name === "blocked"
                        ? "Sin bloqueadores ✓"
                        : "—"}
                    </p>
                  )}
                </div>
              </DroppableColumn>
            );
          })}
        </div>

        <DragOverlay>
          {draggingTask && (
            <div className="opacity-90 rotate-1 shadow-xl">
              <TaskCard
                task={draggingTask}
                systemId={system.id}
                systemType="professional"
                onToggle={() => {}}
                onDelete={() => {}}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <TaskDetailSheet
        task={editTask}
        systemId={system.id}
        open={editTask !== null}
        onOpenChange={(open) => { if (!open) setEditTask(null); }}
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import { useTasks, useToggleTask, useDeleteTask } from "@/features/tasks/tasks.hooks";
import { TaskCard } from "@/features/tasks/TaskCard";
import { TaskDetailSheet } from "@/features/tasks/TaskDetailSheet";
import { CreateTaskDialog } from "@/features/tasks/CreateTaskDialog";
import { cn } from "@/lib/utils";
import type { Task } from "@/features/tasks/tasks.types";
import type { SystemViewProps } from "./SystemDetailView";

type Filter = "all" | "active" | "idea" | "paused";
type GroupBy = "none" | "priority" | "energy";

const FILTER_LABELS: Record<Filter, string> = {
  all: "Todos",
  active: "Activos",
  idea: "Ideas",
  paused: "Pausados",
};

function applyFilter(tasks: Task[], filter: Filter): Task[] {
  if (filter === "all") return tasks.filter((t) => t.status !== "done");
  if (filter === "active") return tasks.filter((t) => t.status === "active");
  if (filter === "idea") return tasks.filter((t) => t.status === "idea");
  if (filter === "paused") return tasks.filter((t) => t.status === "paused");
  return tasks;
}

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0, high: 1, medium: 2, low: 3,
};

function groupTasks(tasks: Task[], groupBy: GroupBy): { label: string; tasks: Task[] }[] {
  if (groupBy === "none") return [{ label: "", tasks }];

  if (groupBy === "priority") {
    const groups: Record<string, Task[]> = { critical: [], high: [], medium: [], low: [] };
    for (const t of tasks) groups[t.priority ?? "medium"].push(t);
    return Object.entries(groups)
      .filter(([, ts]) => ts.length > 0)
      .sort(([a], [b]) => (PRIORITY_ORDER[a] ?? 99) - (PRIORITY_ORDER[b] ?? 99))
      .map(([label, ts]) => ({ label: label.charAt(0).toUpperCase() + label.slice(1), tasks: ts }));
  }

  if (groupBy === "energy") {
    const groups: Record<string, Task[]> = { high: [], medium: [], low: [] };
    for (const t of tasks) groups[t.energyLevel ?? "medium"].push(t);
    return Object.entries(groups)
      .filter(([, ts]) => ts.length > 0)
      .map(([label, ts]) => ({ label: `Energía ${label}`, tasks: ts }));
  }

  return [{ label: "", tasks }];
}

export function SystemPersonalView({ system, initialTasks }: SystemViewProps) {
  const { data: allTasks = [] } = useTasks(system.id, initialTasks);
  const { mutate: toggleTask } = useToggleTask(system.id);
  const { mutate: deleteTask } = useDeleteTask(system.id);

  const [filter, setFilter] = useState<Filter>("all");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [editTask, setEditTask] = useState<Task | null>(null);

  const filtered = applyFilter(allTasks, filter);
  const groups = groupTasks(filtered, groupBy);
  const done = allTasks.filter((t) => t.status === "done");

  function handleToggle(taskId: string) {
    toggleTask(taskId);
  }

  function handleDelete(task: Task) {
    deleteTask(task.id);
  }

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Filter pills */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className="text-sm bg-muted border-0 rounded-md px-2 py-1 text-muted-foreground"
          >
            <option value="none">Sin agrupar</option>
            <option value="priority">Por prioridad</option>
            <option value="energy">Por energía</option>
          </select>
          <CreateTaskDialog systemId={system.id} />
        </div>
      </div>

      {/* Task groups */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">
          {filter === "all"
            ? "Sin tareas. → Crear tarea rápida"
            : `No hay tareas en "${FILTER_LABELS[filter]}".`}
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.label || "tasks"} className="space-y-2">
              {group.label && (
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">
                  {group.label}
                </h3>
              )}
              <div className="space-y-2">
                {group.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    systemId={system.id}
                    systemType="personal"
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    onEdit={setEditTask}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Completed section */}
      {done.length > 0 && (
        <details className="pt-2">
          <summary className="text-xs text-muted-foreground cursor-pointer select-none">
            Completadas ({done.length})
          </summary>
          <div className="mt-2 space-y-2">
            {done.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                systemId={system.id}
                systemType="personal"
                onToggle={handleToggle}
                onDelete={handleDelete}
                onEdit={setEditTask}
              />
            ))}
          </div>
        </details>
      )}

      <TaskDetailSheet
        task={editTask}
        systemId={system.id}
        open={editTask !== null}
        onOpenChange={(open) => { if (!open) setEditTask(null); }}
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import { useTasks } from "@/features/tasks/tasks.hooks";
import { TaskActionView } from "@/features/tasks/TaskActionView";
import { TaskDetailSheet } from "@/features/tasks/TaskDetailSheet";
import { CreateTaskDialog } from "@/features/tasks/CreateTaskDialog";
import { NewFolderInline } from "@/features/folders/NewFolderInline";
import { Briefcase } from "lucide-react";
import type { Task } from "@/features/tasks/tasks.types";
import type { SystemViewProps } from "./SystemDetailView";

/**
 * Vista Professional: el trabajo se agrupa por proyecto (= folder), reusando
 * TaskActionView con groupBy="project". Sin estados Linear propios — el status
 * global queda solo para scheduling (decisión PLAN-08 §3 / PLAN-09 F2.1).
 */
export function SystemProfessionalView({ system, initialTasks }: SystemViewProps) {
  // Mantiene la query caliente para que las columnas de proyecto reaccionen.
  useTasks(system.id, initialTasks);

  const [editTask, setEditTask] = useState<Task | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <NewFolderInline
          systemId={system.id}
          label="Nuevo proyecto"
          placeholder="Nombre del proyecto"
          icon={Briefcase}
        />
        <div className="ml-auto">
          <CreateTaskDialog systemId={system.id} />
        </div>
      </div>

      <TaskActionView
        systemId={system.id}
        initialData={initialTasks}
        defaultGroupBy="project"
        onEdit={setEditTask}
        keyboardDisabled={editTask !== null}
      />

      <TaskDetailSheet
        task={editTask}
        systemId={system.id}
        open={editTask !== null}
        onOpenChange={(open) => { if (!open) setEditTask(null); }}
      />
    </div>
  );
}

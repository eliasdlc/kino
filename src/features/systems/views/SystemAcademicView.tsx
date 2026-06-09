"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateTaskDialog } from "@/features/tasks/CreateTaskDialog";
import { TaskDetailSheet } from "@/features/tasks/TaskDetailSheet";
import { TaskWeekFocusView } from "@/features/tasks/TaskWeekFocusView";
import { TaskCalendarView } from "@/features/tasks/TaskCalendarView";
import { TaskPlanningView } from "@/features/tasks/TaskPlanningView";
import { TaskArchiveView } from "@/features/tasks/TaskArchiveView";
import type { Task } from "@/features/tasks/tasks.types";
import type { SystemViewProps } from "./SystemDetailView";

/**
 * Academic — el semestre con el alma de Kino: foco con runway por defecto
 * (Esta Semana), calendario como zoom-out, y el funnel de planificación/archivo
 * reutilizado. El headspace lo da abrir en "Esta Semana", no en el calendario.
 */
export function SystemAcademicView({ system, initialTasks }: SystemViewProps) {
  const [editTask, setEditTask] = useState<Task | null>(null);

  return (
    <>
      <Tabs defaultValue="esta-semana" className="w-full flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="overflow-x-auto flex-1 min-w-0">
            <TabsList className="w-max">
              <TabsTrigger value="esta-semana">Esta Semana</TabsTrigger>
              <TabsTrigger value="calendar">Calendario</TabsTrigger>
              <TabsTrigger value="planning">Planning</TabsTrigger>
              <TabsTrigger value="archive">Archivadas</TabsTrigger>
            </TabsList>
          </div>
          <CreateTaskDialog systemId={system.id} />
        </div>

        <TabsContent value="esta-semana">
          <TaskWeekFocusView systemId={system.id} initialData={initialTasks} onEdit={setEditTask} />
        </TabsContent>
        <TabsContent value="calendar">
          <TaskCalendarView systemId={system.id} initialData={initialTasks} onEdit={setEditTask} />
        </TabsContent>
        <TabsContent value="planning">
          <TaskPlanningView systemId={system.id} initialData={initialTasks} onEdit={setEditTask} keyboardDisabled={editTask !== null} />
        </TabsContent>
        <TabsContent value="archive">
          <TaskArchiveView systemId={system.id} initialData={initialTasks} onEdit={setEditTask} keyboardDisabled={editTask !== null} />
        </TabsContent>
      </Tabs>

      <TaskDetailSheet
        task={editTask}
        systemId={system.id}
        open={editTask !== null}
        onOpenChange={(open) => { if (!open) setEditTask(null); }}
      />
    </>
  );
}

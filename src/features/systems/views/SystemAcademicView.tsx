"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateTaskDialog } from "@/features/tasks/CreateTaskDialog";
import { TaskDetailSheet } from "@/features/tasks/TaskDetailSheet";
import { TaskWeekFocusView } from "@/features/tasks/TaskWeekFocusView";
import { TaskCalendarView } from "@/features/tasks/TaskCalendarView";
import { TaskPlanningView } from "@/features/tasks/TaskPlanningView";
import { TaskArchiveView } from "@/features/tasks/TaskArchiveView";
import { SystemAcademicClasses } from "./SystemAcademicClasses";
import { useTasks } from "@/features/tasks/tasks.hooks";
import type { TaskTransport } from "@/features/tasks/tasks.types";
import type { SystemViewProps } from "./SystemDetailView";

/**
 * Academic. El semestre con el alma de Kino: foco con runway por defecto
 * (Esta Semana), calendario como zoom-out, y el funnel de planificación/archivo
 * reutilizado. El headspace lo da abrir en "Esta Semana", no en el calendario.
 */
export function SystemAcademicView({ system, initialTasks }: SystemViewProps) {
  const [editTask, setEditTask] = useState<TaskTransport | null>(null);
  const [tab, setTab] = useState("esta-semana");
  const [highlight, setHighlight] = useState<{ id: string; nonce: number } | null>(null);
  // La vista de clases necesita las tareas para contar pendientes y próxima entrega.
  const { data: allTasks = initialTasks } = useTasks(system.id, initialTasks);

  function goToAction(taskId?: string) {
    setTab("esta-semana");
    if (taskId) setHighlight({ id: taskId, nonce: Date.now() });
  }

  return (
    <>
      <Tabs value={tab} onValueChange={setTab} className="w-full flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <TabsList className="flex-1 min-w-0 md:flex-none md:w-max">
            <TabsTrigger value="esta-semana" className="min-w-0 px-2 text-xs md:px-3 md:text-sm">
              <span className="md:hidden">Semana</span>
              <span className="hidden md:inline">Esta Semana</span>
            </TabsTrigger>
            <TabsTrigger value="classes" className="min-w-0 px-2 text-xs md:px-3 md:text-sm">
              <span className="md:hidden">Clases</span>
              <span className="hidden md:inline">Clases</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="min-w-0 px-2 text-xs md:px-3 md:text-sm">
              <span className="md:hidden">Cal</span>
              <span className="hidden md:inline">Calendario</span>
            </TabsTrigger>
            <TabsTrigger value="planning" className="min-w-0 px-2 text-xs md:px-3 md:text-sm">
              <span className="md:hidden">Plan</span>
              <span className="hidden md:inline">Planificación</span>
            </TabsTrigger>
            <TabsTrigger value="archive" className="min-w-0 px-2 text-xs md:px-3 md:text-sm">
              <span className="md:hidden">Archivo</span>
              <span className="hidden md:inline">Archivadas</span>
            </TabsTrigger>
          </TabsList>
          <CreateTaskDialog systemId={system.id} />
        </div>

        <TabsContent value="esta-semana">
          <TaskWeekFocusView systemId={system.id} initialData={initialTasks} onEdit={setEditTask} highlight={highlight} />
        </TabsContent>
        <TabsContent value="classes">
          <SystemAcademicClasses systemId={system.id} tasks={allTasks} />
        </TabsContent>
        <TabsContent value="calendar">
          <TaskCalendarView systemId={system.id} initialData={initialTasks} onNavigateToAction={goToAction} />
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

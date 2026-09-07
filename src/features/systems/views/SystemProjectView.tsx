"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateTaskDialog } from "@/features/tasks/CreateTaskDialog";
import { TaskDetailSheet } from "@/features/tasks/TaskDetailSheet";
import { TaskPlanningView } from "@/features/tasks/TaskPlanningView";
import { useTasks } from "@/features/tasks/tasks.hooks";
import { useSprints } from "@/features/sprints/sprints.hooks";
import { ProjectBoard } from "./project/ProjectBoard";
import { ProjectArchive } from "./project/ProjectArchive";
import { SprintBar } from "./project/SprintBar";
import { GithubRepoPanel } from "@/features/github-sync/GithubRepoPanel";
import type { TaskTransport } from "@/features/tasks/tasks.types";
import type { SystemViewProps } from "./SystemDetailView";

/**
 * Project. Un proyecto en progreso: board kanban (eje workflow), planificación
 * semanal (eje scheduling, reutilizada de Academic) y archivadas por sprint.
 */
export function SystemProjectView({ system, initialTasks }: SystemViewProps) {
  const [editTask, setEditTask] = useState<TaskTransport | null>(null);
  const [tab, setTab] = useState("board");
  const [sprintFilter, setSprintFilter] = useState<string | null>(null);

  const { data: tasks = [] } = useTasks(system.id, initialTasks);
  const { data: sprints = [] } = useSprints(system.id);

  return (
    <>
      <Tabs value={tab} onValueChange={setTab} className="w-full flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <TabsList>
            <TabsTrigger value="board">Board</TabsTrigger>
            <TabsTrigger value="planning">
              <span className="md:hidden">Plan</span>
              <span className="hidden md:inline">Planificación</span>
            </TabsTrigger>
            <TabsTrigger value="archive">
              <span className="md:hidden">Archivo</span>
              <span className="hidden md:inline">Archivadas</span>
            </TabsTrigger>
          </TabsList>
          <CreateTaskDialog systemId={system.id} />
        </div>

        <TabsContent value="board" className="flex flex-col gap-4">
          {/* Sólo aquí: los demás arquetipos no ven nada de GitHub (KIN-135). */}
          <GithubRepoPanel systemId={system.id} metadata={system.metadata} />
          <SprintBar
            systemId={system.id}
            sprints={sprints}
            tasks={tasks}
            sprintFilter={sprintFilter}
            onSelectFilter={setSprintFilter}
          />
          <ProjectBoard
            systemId={system.id}
            initialData={initialTasks}
            sprintFilter={sprintFilter}
            onEdit={setEditTask}
            keyboardDisabled={editTask !== null}
          />
        </TabsContent>

        <TabsContent value="planning">
          <TaskPlanningView
            systemId={system.id}
            initialData={initialTasks}
            onEdit={setEditTask}
            keyboardDisabled={editTask !== null}
          />
        </TabsContent>

        <TabsContent value="archive">
          <ProjectArchive
            systemId={system.id}
            initialData={initialTasks}
            sprints={sprints}
            onEdit={setEditTask}
          />
        </TabsContent>
      </Tabs>

      <TaskDetailSheet
        task={editTask}
        systemId={system.id}
        open={editTask !== null}
        onOpenChange={(open) => {
          if (!open) setEditTask(null);
        }}
      />
    </>
  );
}

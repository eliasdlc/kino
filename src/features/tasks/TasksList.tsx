"use client";

import { useState } from "react";
import type { Task } from "./tasks.types";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { TaskDetailSheet } from "./TaskDetailSheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskBacklogView } from "./TaskBacklogView";
import { TaskActionView } from "./TaskActionView";
import { TaskPlanningView } from "./TaskPlanningView";
import { TaskArchiveView } from "./TaskArchiveView";

interface TasksListProps {
  systemId: string;
  initialData: Task[];
  /** When set, tasks are scoped to this folder (folder detail view) */
  folderId?: string;
  /** SSR-fetched folder tasks — seeds useFolderTasks immediately to avoid loading flash */
  folderInitialData?: Task[];
}

export function TasksList({ systemId, initialData, folderId, folderInitialData }: TasksListProps) {
  const [editTask, setEditTask] = useState<Task | null>(null);

  return (
    <>
      <Tabs defaultValue="action" className="w-full flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="overflow-x-auto flex-1 min-w-0">
            <TabsList className="w-max">
              <TabsTrigger value="backlog">Backlog</TabsTrigger>
              <TabsTrigger value="planning">Planning</TabsTrigger>
              <TabsTrigger value="action">Action</TabsTrigger>
              <TabsTrigger value="archive">Archive</TabsTrigger>
            </TabsList>
          </div>
          <CreateTaskDialog systemId={systemId} folderId={folderId} />
        </div>

        <TabsContent value="backlog">
          <TaskBacklogView systemId={systemId} initialData={initialData} folderId={folderId} folderInitialData={folderInitialData} onEdit={setEditTask} keyboardDisabled={editTask !== null} />
        </TabsContent>
        <TabsContent value="planning">
          <TaskPlanningView systemId={systemId} initialData={initialData} folderId={folderId} folderInitialData={folderInitialData} onEdit={setEditTask} keyboardDisabled={editTask !== null} />
        </TabsContent>
        <TabsContent value="action">
          <TaskActionView systemId={systemId} initialData={initialData} folderId={folderId} folderInitialData={folderInitialData} onEdit={setEditTask} keyboardDisabled={editTask !== null} />
        </TabsContent>
        <TabsContent value="archive">
          <TaskArchiveView systemId={systemId} initialData={initialData} folderId={folderId} folderInitialData={folderInitialData} onEdit={setEditTask} keyboardDisabled={editTask !== null} />
        </TabsContent>
      </Tabs>

      <TaskDetailSheet
        task={editTask}
        systemId={systemId}
        open={editTask !== null}
        onOpenChange={(open) => { if (!open) setEditTask(null); }}
      />
    </>
  );
}